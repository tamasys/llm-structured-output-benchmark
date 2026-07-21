import { generateObject, generateText } from 'ai';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { getModelWithKeys, type ModelConfig, type ApiKeys } from './models-factory';
import { extractJson } from './prompts';
import { type Task } from './task';
import {
  type AttemptResult,
  type StepResult,
  type RunResult,
  type ScenarioResult,
  type TestRunFile,
  type ValidationError,
  calculateScenarioSummary,
} from './storage';

export interface TestConfig {
  temperature: number;
  maxRetries: number;
  runsPerScenario: number;
  apiKeys?: ApiKeys;
}

export interface LogEntry {
  timestamp: string;
  modelId: string;
  modelName: string;
  scenario: number;
  runNumber: number;
  stepNumber?: number;
  stepName?: string;
  attemptNumber: number;
  type: 'request' | 'response' | 'validation';
  prompt?: string;
  response?: string;
  validationResult?: {
    success: boolean;
    errors?: Array<{ path: string[]; message: string; code: string }>;
  };
}

export interface TestProgress {
  modelId: string;
  modelName: string;
  scenario: number;
  runNumber: number;
  stepNumber?: number;
  stepName?: string;
  attemptNumber: number;
  status: 'running' | 'success' | 'failed' | 'retrying';
  message?: string;
  logEntry?: LogEntry;
}

export type ProgressCallback = (progress: TestProgress) => void;

export interface RunCompleteEvent {
  modelId: string;
  scenario: number;
  runNumber: number;
  runResult: RunResult;
  isSequential: boolean;
}

export type RunCompleteCallback = (event: RunCompleteEvent) => void;

const DEFAULT_CONFIG: TestConfig = {
  temperature: 0.1,
  maxRetries: 3,
  runsPerScenario: 10,
};

/**
 * Parse validation errors from ZodError
 */
function parseZodErrors(error: ZodError): ValidationError[] {
  return error.issues.map((e) => ({
    path: e.path.map(String),
    message: e.message,
    code: e.code,
  }));
}

const RATE_LIMITED_PROVIDERS = ['groq', 'openrouter'];
const RATE_LIMIT_DELAY_MS = 5000;
const BACKOFF_BASE_MS = 5000;
const BACKOFF_MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }
  }
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429;
  }
  return false;
}

async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = BACKOFF_MAX_RETRIES
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && attempt < maxRetries) {
        const delayMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.log(`Rate limited (429), backing off for ${delayMs / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(delayMs);
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * Run a single attempt with generateText (non-strict mode)
 */
async function runNonStrictAttempt<T>(
  model: ModelConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  schema: ZodSchema<T>,
  config: TestConfig
): Promise<{ success: boolean; data?: T; raw: string; errors?: ValidationError[]; tokens?: { input: number; output: number } }> {
  const result = await withExponentialBackoff(() => generateText({
    model: model.model,
    messages,
    ...(model.isReasoningModel ? {} : { temperature: config.temperature }),
    ...(model.isReasoningModel ? {
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
        },
      },
    } : {}),
  }));

  if (RATE_LIMITED_PROVIDERS.includes(model.provider)) {
    await sleep(RATE_LIMIT_DELAY_MS);
  }

  const raw = result.text;
  const cleaned = extractJson(raw);

  try {
    const parsed = JSON.parse(cleaned);
    const validated = schema.parse(parsed);
    return {
      success: true,
      data: validated,
      raw,
      tokens: {
        input: result.usage?.inputTokens || 0,
        output: result.usage?.outputTokens || 0,
      },
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        raw,
        errors: parseZodErrors(error),
        tokens: {
          input: result.usage?.inputTokens || 0,
          output: result.usage?.outputTokens || 0,
        },
      };
    }
    if (error instanceof SyntaxError) {
      return {
        success: false,
        raw,
        errors: [{ path: [], message: `Invalid JSON: ${error.message}`, code: 'invalid_json' }],
        tokens: {
          input: result.usage?.inputTokens || 0,
          output: result.usage?.outputTokens || 0,
        },
      };
    }
    throw error;
  }
}

/**
 * Run a single attempt with generateObject (strict mode)
 */
async function runStrictAttempt<T>(
  model: ModelConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  schema: ZodSchema<T>,
  config: TestConfig
): Promise<{ success: boolean; data?: T; raw: string; errors?: ValidationError[]; tokens?: { input: number; output: number } }> {
  try {
    const result = await withExponentialBackoff(() => generateObject({
      model: model.model,
      messages,
      schema,
      ...(model.isReasoningModel ? {} : { temperature: config.temperature }),
        ...(model.isReasoningModel ? {
        providerOptions: {
          openai: {
            reasoningEffort: 'low',
          },
        },
      } : {}),
    }));

    if (RATE_LIMITED_PROVIDERS.includes(model.provider)) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    return {
      success: true,
      data: result.object as T,
      raw: JSON.stringify(result.object, null, 2),
      tokens: {
        input: result.usage?.inputTokens || 0,
        output: result.usage?.outputTokens || 0,
      },
    };
  } catch (error: unknown) {
    let rawText = '';
    if (error && typeof error === 'object' && 'text' in error) {
      rawText = (error as { text: string }).text || '';
    }

    if (error instanceof ZodError) {
      return {
        success: false,
        raw: rawText,
        errors: parseZodErrors(error),
      };
    }
    // Handle AI SDK errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      raw: rawText || `Error: ${errorMessage}`,
      errors: [{ path: [], message: errorMessage, code: 'api_error' }],
    };
  }
}

/**
 * Run Scenario 1: One-shot, non-strict
 */
async function runScenario1(
  model: ModelConfig,
  config: TestConfig,
  task: Task,
  onProgress?: ProgressCallback,
  onRunComplete?: RunCompleteCallback
): Promise<RunResult[]> {
  const runs: RunResult[] = [];

  for (let runNum = 1; runNum <= config.runsPerScenario; runNum++) {
    const attempts: AttemptResult[] = [];
    let success = false;
    let finalResponse: Record<string, unknown> | null = null;
    const runStartTime = Date.now();

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      const attemptStartTime = Date.now();

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: task.systemPrompt },
        { role: 'user', content: task.context },
        { role: 'user', content: task.scenarios.oneShot.nonStrict.prompt },
      ];

      // Add retry context if not first attempt
      if (attempt > 1 && attempts.length > 0) {
        const lastAttempt = attempts[attempts.length - 1];
        messages.push({
          role: 'assistant',
          content: lastAttempt.rawResponse,
        });
        messages.push({
          role: 'user',
          content: task.retryPrompt(lastAttempt.rawResponse, lastAttempt.validationErrors),
        });
      }

      const promptText = messages.map(m => `[${m.role}] ${m.content}`).join('\n\n');
      onProgress?.({
        modelId: model.id,
        modelName: model.name,
        scenario: 1,
        runNumber: runNum,
        attemptNumber: attempt,
        status: attempt === 1 ? 'running' : 'retrying',
        logEntry: {
          timestamp: new Date().toISOString(),
          modelId: model.id,
          modelName: model.name,
          scenario: 1,
          runNumber: runNum,
          attemptNumber: attempt,
          type: 'request',
          prompt: promptText,
        },
      });

      const result = await runNonStrictAttempt(model, messages, task.scenarios.oneShot.nonStrict.schema, config);
      const attemptDuration = Date.now() - attemptStartTime;

      const attemptResult: AttemptResult = {
        attemptNumber: attempt,
        timestamp: new Date().toISOString(),
        success: result.success,
        durationMs: attemptDuration,
        inputTokens: result.tokens?.input,
        outputTokens: result.tokens?.output,
        prompt: promptText,
        rawResponse: result.raw,
        parsedResponse: result.success ? (result.data as Record<string, unknown>) : null,
        validationErrors: result.errors || [],
        errorMessage: null,
      };

      attempts.push(attemptResult);

      onProgress?.({
        modelId: model.id,
        modelName: model.name,
        scenario: 1,
        runNumber: runNum,
        attemptNumber: attempt,
        status: result.success ? 'success' : 'failed',
        message: result.errors?.[0]?.message,
        logEntry: {
          timestamp: new Date().toISOString(),
          modelId: model.id,
          modelName: model.name,
          scenario: 1,
          runNumber: runNum,
          attemptNumber: attempt,
          type: 'response',
          response: result.raw,
          validationResult: {
            success: result.success,
            errors: result.errors,
          },
        },
      });

      if (result.success) {
        success = true;
        finalResponse = result.data as Record<string, unknown>;
        break;
      }
    }

    const runResult: RunResult = {
      runNumber: runNum,
      success,
      attempts,
      totalDurationMs: Date.now() - runStartTime,
      finalResponse,
    };
    runs.push(runResult);

    onRunComplete?.({
      modelId: model.id,
      scenario: 1,
      runNumber: runNum,
      runResult,
      isSequential: false,
    });
  }

  return runs;
}

/**
 * Run Scenario 2: One-shot, strict
 */
async function runScenario2(
  model: ModelConfig,
  config: TestConfig,
  task: Task,
  onProgress?: ProgressCallback,
  onRunComplete?: RunCompleteCallback
): Promise<RunResult[]> {
  const runs: RunResult[] = [];

  for (let runNum = 1; runNum <= config.runsPerScenario; runNum++) {
    const attempts: AttemptResult[] = [];
    let success = false;
    let finalResponse: Record<string, unknown> | null = null;
    const runStartTime = Date.now();

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      const attemptStartTime = Date.now();

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: task.systemPrompt },
        { role: 'user', content: task.context },
        { role: 'user', content: task.scenarios.oneShot.strict.prompt },
      ];

      // Add retry context if not first attempt
      if (attempt > 1 && attempts.length > 0) {
        const lastAttempt = attempts[attempts.length - 1];
        messages.push({
          role: 'assistant',
          content: lastAttempt.rawResponse,
        });
        messages.push({
          role: 'user',
          content: task.retryPrompt(lastAttempt.rawResponse, lastAttempt.validationErrors),
        });
      }

      const promptText = messages.map(m => `[${m.role}] ${m.content}`).join('\n\n');
      onProgress?.({
        modelId: model.id,
        modelName: model.name,
        scenario: 2,
        runNumber: runNum,
        attemptNumber: attempt,
        status: attempt === 1 ? 'running' : 'retrying',
        logEntry: {
          timestamp: new Date().toISOString(),
          modelId: model.id,
          modelName: model.name,
          scenario: 2,
          runNumber: runNum,
          attemptNumber: attempt,
          type: 'request',
          prompt: promptText,
        },
      });

      const result = await runStrictAttempt(model, messages, task.scenarios.oneShot.strict.schema, config);
      const attemptDuration = Date.now() - attemptStartTime;

      const attemptResult: AttemptResult = {
        attemptNumber: attempt,
        timestamp: new Date().toISOString(),
        success: result.success,
        durationMs: attemptDuration,
        inputTokens: result.tokens?.input,
        outputTokens: result.tokens?.output,
        prompt: promptText,
        rawResponse: result.raw,
        parsedResponse: result.success ? (result.data as Record<string, unknown>) : null,
        validationErrors: result.errors || [],
        errorMessage: null,
      };

      attempts.push(attemptResult);

      onProgress?.({
        modelId: model.id,
        modelName: model.name,
        scenario: 2,
        runNumber: runNum,
        attemptNumber: attempt,
        status: result.success ? 'success' : 'failed',
        message: result.errors?.[0]?.message,
        logEntry: {
          timestamp: new Date().toISOString(),
          modelId: model.id,
          modelName: model.name,
          scenario: 2,
          runNumber: runNum,
          attemptNumber: attempt,
          type: 'response',
          response: result.raw,
          validationResult: {
            success: result.success,
            errors: result.errors,
          },
        },
      });

      if (result.success) {
        success = true;
        finalResponse = result.data as Record<string, unknown>;
        break;
      }
    }

    const runResult: RunResult = {
      runNumber: runNum,
      success,
      attempts,
      totalDurationMs: Date.now() - runStartTime,
      finalResponse,
    };
    runs.push(runResult);

    onRunComplete?.({
      modelId: model.id,
      scenario: 2,
      runNumber: runNum,
      runResult,
      isSequential: false,
    });
  }

  return runs;
}

/**
 * Run Scenario 3: Sequential, non-strict
 */
async function runScenario3(
  model: ModelConfig,
  config: TestConfig,
  task: Task,
  onProgress?: ProgressCallback,
  onRunComplete?: RunCompleteCallback
): Promise<RunResult[]> {
  const runs: RunResult[] = [];

  for (let runNum = 1; runNum <= config.runsPerScenario; runNum++) {
    const steps: StepResult[] = [];
    let success = false;
    let finalResponse: Record<string, unknown> | null = null;
    const runStartTime = Date.now();

    try {
      // Step 1: Initial recommendation
      const step1: StepResult = { stepNumber: 1, stepName: 'Recommendation', success: false, attempts: [] };
      let step1Result: any = null;
      let step1Messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: task.systemPrompt },
        { role: 'user', content: task.context },
        { role: 'user', content: task.scenarios.sequential.nonStrict.step1.prompt },
      ];

      for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        const attemptStartTime = Date.now();
        const promptText = step1Messages.map(m => `[${m.role}] ${m.content}`).join('\n\n');

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 3,
          runNumber: runNum,
          stepNumber: 1,
          stepName: 'Recommendation',
          attemptNumber: attempt,
          status: attempt === 1 ? 'running' : 'retrying',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 3,
            runNumber: runNum,
            stepNumber: 1,
            stepName: 'Recommendation',
            attemptNumber: attempt,
            type: 'request',
            prompt: promptText,
          },
        });

        const result = await runNonStrictAttempt(model, step1Messages, task.scenarios.sequential.nonStrict.step1.schema, config);

        const attemptResult: AttemptResult = {
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          success: result.success,
          durationMs: Date.now() - attemptStartTime,
          inputTokens: result.tokens?.input,
          outputTokens: result.tokens?.output,
          prompt: promptText,
          rawResponse: result.raw,
          parsedResponse: result.success ? (result.data as Record<string, unknown>) : null,
          validationErrors: result.errors || [],
          errorMessage: null,
        };
        step1.attempts.push(attemptResult);

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 3,
          runNumber: runNum,
          stepNumber: 1,
          stepName: 'Recommendation',
          attemptNumber: attempt,
          status: result.success ? 'success' : 'failed',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 3,
            runNumber: runNum,
            stepNumber: 1,
            stepName: 'Recommendation',
            attemptNumber: attempt,
            type: 'response',
            response: result.raw,
            validationResult: { success: result.success, errors: result.errors },
          },
        });

        if (result.success) {
          step1Result = result.data as any;
          step1.success = true;
          break;
        }

        step1Messages = [
          ...step1Messages,
          { role: 'assistant' as const, content: result.raw },
          { role: 'user' as const, content: task.retryPrompt(result.raw, result.errors || []) },
        ];
      }

      steps.push(step1);
      if (!step1Result) throw new Error('Step 1 failed');

      // Step 2: Actor details
      const step2: StepResult = { stepNumber: 2, stepName: 'Details', success: false, attempts: [] };
      let step2Result: any = null;
      let step2Messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: task.systemPrompt },
        { role: 'user', content: task.context },
        { role: 'assistant', content: JSON.stringify(step1Result) },
        { role: 'user', content: task.scenarios.sequential.nonStrict.step2.prompt },
      ];

      for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        const attemptStartTime = Date.now();
        const promptText = step2Messages.map(m => `[${m.role}] ${m.content}`).join('\n\n');

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 3,
          runNumber: runNum,
          stepNumber: 2,
          stepName: 'Details',
          attemptNumber: attempt,
          status: attempt === 1 ? 'running' : 'retrying',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 3,
            runNumber: runNum,
            stepNumber: 2,
            stepName: 'Details',
            attemptNumber: attempt,
            type: 'request',
            prompt: promptText,
          },
        });

        const result = await runNonStrictAttempt(model, step2Messages, task.scenarios.sequential.nonStrict.step2.schema, config);

        const attemptResult: AttemptResult = {
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          success: result.success,
          durationMs: Date.now() - attemptStartTime,
          inputTokens: result.tokens?.input,
          outputTokens: result.tokens?.output,
          prompt: promptText,
          rawResponse: result.raw,
          parsedResponse: result.success ? (result.data as Record<string, unknown>) : null,
          validationErrors: result.errors || [],
          errorMessage: null,
        };
        step2.attempts.push(attemptResult);

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 3,
          runNumber: runNum,
          stepNumber: 2,
          stepName: 'Details',
          attemptNumber: attempt,
          status: result.success ? 'success' : 'failed',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 3,
            runNumber: runNum,
            stepNumber: 2,
            stepName: 'Details',
            attemptNumber: attempt,
            type: 'response',
            response: result.raw,
            validationResult: { success: result.success, errors: result.errors },
          },
        });

        if (result.success) {
          step2Result = result.data as any;
          step2.success = true;
          break;
        }

        step2Messages = [
          ...step2Messages,
          { role: 'assistant' as const, content: result.raw },
          { role: 'user' as const, content: task.retryPrompt(result.raw, result.errors || []) },
        ];
      }

      steps.push(step2);
      if (!step2Result) throw new Error('Step 2 failed');

      // Step 3: AI config
      const step3: StepResult = { stepNumber: 3, stepName: 'AI Config', success: false, attempts: [] };
      let step3Result: any = null;
      let step3Messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: task.systemPrompt },
        { role: 'user', content: task.context },
        { role: 'assistant', content: JSON.stringify(step1Result) },
        { role: 'assistant', content: JSON.stringify(step2Result) },
        { role: 'user', content: task.scenarios.sequential.nonStrict.step3.prompt },
      ];

      for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        const attemptStartTime = Date.now();
        const promptText = step3Messages.map(m => `[${m.role}] ${m.content}`).join('\n\n');

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 3,
          runNumber: runNum,
          stepNumber: 3,
          stepName: 'AI Config',
          attemptNumber: attempt,
          status: attempt === 1 ? 'running' : 'retrying',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 3,
            runNumber: runNum,
            stepNumber: 3,
            stepName: 'AI Config',
            attemptNumber: attempt,
            type: 'request',
            prompt: promptText,
          },
        });

        const result = await runNonStrictAttempt(model, step3Messages, task.scenarios.sequential.nonStrict.step3.schema, config);

        const attemptResult: AttemptResult = {
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          success: result.success,
          durationMs: Date.now() - attemptStartTime,
          inputTokens: result.tokens?.input,
          outputTokens: result.tokens?.output,
          prompt: promptText,
          rawResponse: result.raw,
          parsedResponse: result.success ? (result.data as Record<string, unknown>) : null,
          validationErrors: result.errors || [],
          errorMessage: null,
        };
        step3.attempts.push(attemptResult);

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 3,
          runNumber: runNum,
          stepNumber: 3,
          stepName: 'AI Config',
          attemptNumber: attempt,
          status: result.success ? 'success' : 'failed',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 3,
            runNumber: runNum,
            stepNumber: 3,
            stepName: 'AI Config',
            attemptNumber: attempt,
            type: 'response',
            response: result.raw,
            validationResult: { success: result.success, errors: result.errors },
          },
        });

        if (result.success) {
          step3Result = result.data as any;
          step3.success = true;
          break;
        }

        step3Messages = [
          ...step3Messages,
          { role: 'assistant' as const, content: result.raw },
          { role: 'user' as const, content: task.retryPrompt(result.raw, result.errors || []) },
        ];
      }

      steps.push(step3);
      if (!step3Result) throw new Error('Step 3 failed');

      // Merge and validate final result
      const merged = task.scenarios.sequential.merge([step1Result, step2Result, step3Result]);
      task.scenarios.oneShot.nonStrict.schema.parse(merged);

      success = true;
      finalResponse = merged as unknown as Record<string, unknown>;
    } catch {
      // Mark any incomplete steps
    }

    const runResult: RunResult = {
      runNumber: runNum,
      success,
      attempts: [],
      steps,
      totalDurationMs: Date.now() - runStartTime,
      finalResponse,
    };
    runs.push(runResult);

    onRunComplete?.({
      modelId: model.id,
      scenario: 3,
      runNumber: runNum,
      runResult,
      isSequential: true,
    });
  }

  return runs;
}

/**
 * Run Scenario 4: Sequential, strict
 */
async function runScenario4(
  model: ModelConfig,
  config: TestConfig,
  task: Task,
  onProgress?: ProgressCallback,
  onRunComplete?: RunCompleteCallback
): Promise<RunResult[]> {
  const runs: RunResult[] = [];

  for (let runNum = 1; runNum <= config.runsPerScenario; runNum++) {
    const steps: StepResult[] = [];
    let success = false;
    let finalResponse: Record<string, unknown> | null = null;
    const runStartTime = Date.now();

    try {
      // Step 1: Initial recommendation
      const step1: StepResult = { stepNumber: 1, stepName: 'Recommendation', success: false, attempts: [] };
      let step1Result: any = null;
      let step1Messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: task.systemPrompt },
        { role: 'user', content: task.context },
        { role: 'user', content: task.scenarios.sequential.strict.step1.prompt },
      ];

      for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        const attemptStartTime = Date.now();
        const promptText = step1Messages.map(m => `[${m.role}] ${m.content}`).join('\n\n');

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 4,
          runNumber: runNum,
          stepNumber: 1,
          stepName: 'Recommendation',
          attemptNumber: attempt,
          status: attempt === 1 ? 'running' : 'retrying',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 4,
            runNumber: runNum,
            stepNumber: 1,
            stepName: 'Recommendation',
            attemptNumber: attempt,
            type: 'request',
            prompt: promptText,
          },
        });

        const result = await runStrictAttempt(model, step1Messages, task.scenarios.sequential.strict.step1.schema, config);

        const attemptResult: AttemptResult = {
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          success: result.success,
          durationMs: Date.now() - attemptStartTime,
          inputTokens: result.tokens?.input,
          outputTokens: result.tokens?.output,
          prompt: promptText,
          rawResponse: result.raw,
          parsedResponse: result.success ? (result.data as Record<string, unknown>) : null,
          validationErrors: result.errors || [],
          errorMessage: null,
        };
        step1.attempts.push(attemptResult);

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 4,
          runNumber: runNum,
          stepNumber: 1,
          stepName: 'Recommendation',
          attemptNumber: attempt,
          status: result.success ? 'success' : 'failed',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 4,
            runNumber: runNum,
            stepNumber: 1,
            stepName: 'Recommendation',
            attemptNumber: attempt,
            type: 'response',
            response: result.raw,
            validationResult: { success: result.success, errors: result.errors },
          },
        });

        if (result.success) {
          step1Result = result.data as any;
          step1.success = true;
          break;
        }

        step1Messages = [
          ...step1Messages,
          { role: 'assistant' as const, content: result.raw },
          { role: 'user' as const, content: task.retryPrompt(result.raw, result.errors || []) },
        ];
      }

      steps.push(step1);
      if (!step1Result) throw new Error('Step 1 failed');

      // Step 2: Actor details
      const step2: StepResult = { stepNumber: 2, stepName: 'Details', success: false, attempts: [] };
      let step2Result: any = null;
      let step2Messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: task.systemPrompt },
        { role: 'user', content: task.context },
        { role: 'assistant', content: JSON.stringify(step1Result) },
        { role: 'user', content: task.scenarios.sequential.strict.step2.prompt },
      ];

      for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        const attemptStartTime = Date.now();
        const promptText = step2Messages.map(m => `[${m.role}] ${m.content}`).join('\n\n');

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 4,
          runNumber: runNum,
          stepNumber: 2,
          stepName: 'Details',
          attemptNumber: attempt,
          status: attempt === 1 ? 'running' : 'retrying',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 4,
            runNumber: runNum,
            stepNumber: 2,
            stepName: 'Details',
            attemptNumber: attempt,
            type: 'request',
            prompt: promptText,
          },
        });

        const result = await runStrictAttempt(model, step2Messages, task.scenarios.sequential.strict.step2.schema, config);

        const attemptResult: AttemptResult = {
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          success: result.success,
          durationMs: Date.now() - attemptStartTime,
          inputTokens: result.tokens?.input,
          outputTokens: result.tokens?.output,
          prompt: promptText,
          rawResponse: result.raw,
          parsedResponse: result.success ? (result.data as Record<string, unknown>) : null,
          validationErrors: result.errors || [],
          errorMessage: null,
        };
        step2.attempts.push(attemptResult);

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 4,
          runNumber: runNum,
          stepNumber: 2,
          stepName: 'Details',
          attemptNumber: attempt,
          status: result.success ? 'success' : 'failed',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 4,
            runNumber: runNum,
            stepNumber: 2,
            stepName: 'Details',
            attemptNumber: attempt,
            type: 'response',
            response: result.raw,
            validationResult: { success: result.success, errors: result.errors },
          },
        });

        if (result.success) {
          step2Result = result.data as any;
          step2.success = true;
          break;
        }

        step2Messages = [
          ...step2Messages,
          { role: 'assistant' as const, content: result.raw },
          { role: 'user' as const, content: task.retryPrompt(result.raw, result.errors || []) },
        ];
      }

      steps.push(step2);
      if (!step2Result) throw new Error('Step 2 failed');

      // Step 3: AI config
      const step3: StepResult = { stepNumber: 3, stepName: 'AI Config', success: false, attempts: [] };
      let step3Result: any = null;
      let step3Messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: task.systemPrompt },
        { role: 'user', content: task.context },
        { role: 'assistant', content: JSON.stringify(step1Result) },
        { role: 'assistant', content: JSON.stringify(step2Result) },
        { role: 'user', content: task.scenarios.sequential.strict.step3.prompt },
      ];

      for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        const attemptStartTime = Date.now();
        const promptText = step3Messages.map(m => `[${m.role}] ${m.content}`).join('\n\n');

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 4,
          runNumber: runNum,
          stepNumber: 3,
          stepName: 'AI Config',
          attemptNumber: attempt,
          status: attempt === 1 ? 'running' : 'retrying',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 4,
            runNumber: runNum,
            stepNumber: 3,
            stepName: 'AI Config',
            attemptNumber: attempt,
            type: 'request',
            prompt: promptText,
          },
        });

        const result = await runStrictAttempt(model, step3Messages, task.scenarios.sequential.strict.step3.schema, config);

        const attemptResult: AttemptResult = {
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          success: result.success,
          durationMs: Date.now() - attemptStartTime,
          inputTokens: result.tokens?.input,
          outputTokens: result.tokens?.output,
          prompt: promptText,
          rawResponse: result.raw,
          parsedResponse: result.success ? (result.data as Record<string, unknown>) : null,
          validationErrors: result.errors || [],
          errorMessage: null,
        };
        step3.attempts.push(attemptResult);

        onProgress?.({
          modelId: model.id,
          modelName: model.name,
          scenario: 4,
          runNumber: runNum,
          stepNumber: 3,
          stepName: 'AI Config',
          attemptNumber: attempt,
          status: result.success ? 'success' : 'failed',
          logEntry: {
            timestamp: new Date().toISOString(),
            modelId: model.id,
            modelName: model.name,
            scenario: 4,
            runNumber: runNum,
            stepNumber: 3,
            stepName: 'AI Config',
            attemptNumber: attempt,
            type: 'response',
            response: result.raw,
            validationResult: { success: result.success, errors: result.errors },
          },
        });

        if (result.success) {
          step3Result = result.data as any;
          step3.success = true;
          break;
        }

        step3Messages = [
          ...step3Messages,
          { role: 'assistant' as const, content: result.raw },
          { role: 'user' as const, content: task.retryPrompt(result.raw, result.errors || []) },
        ];
      }

      steps.push(step3);
      if (!step3Result) throw new Error('Step 3 failed');

      // Merge and validate final result
      const merged = task.scenarios.sequential.merge([step1Result, step2Result, step3Result]);
      task.scenarios.oneShot.strict.schema.parse(merged);

      success = true;
      finalResponse = merged as unknown as Record<string, unknown>;
    } catch {
      // Mark any incomplete steps
    }

    const runResult: RunResult = {
      runNumber: runNum,
      success,
      attempts: [],
      steps,
      totalDurationMs: Date.now() - runStartTime,
      finalResponse,
    };
    runs.push(runResult);

    onRunComplete?.({
      modelId: model.id,
      scenario: 4,
      runNumber: runNum,
      runResult,
      isSequential: true,
    });
  }

  return runs;
}

/**
 * Run all scenarios for a single model
 */
export async function runModelTests(
  modelId: string,
  scenarios: number[],
  config: TestConfig = DEFAULT_CONFIG,
  task: Task,
  onProgress?: ProgressCallback,
  onRunComplete?: RunCompleteCallback
): Promise<{ [scenario: string]: ScenarioResult }> {
  const model = getModelWithKeys(modelId, config.apiKeys || {});
  if (!model) {
    throw new Error(`Model not found or missing API key: ${modelId}`);
  }

  const results: { [scenario: string]: ScenarioResult } = {};

  for (const scenario of scenarios) {
    const isStrictScenario = scenario === 2 || scenario === 4;
    if (isStrictScenario && !model.supportsStrictMode) {
      continue;
    }

    let runs: RunResult[];

    switch (scenario) {
      case 1:
        runs = await runScenario1(model, config, task, onProgress, onRunComplete);
        break;
      case 2:
        runs = await runScenario2(model, config, task, onProgress, onRunComplete);
        break;
      case 3:
        runs = await runScenario3(model, config, task, onProgress, onRunComplete);
        break;
      case 4:
        runs = await runScenario4(model, config, task, onProgress, onRunComplete);
        break;
      default:
        throw new Error(`Invalid scenario: ${scenario}`);
    }

    const isSequential = scenario === 3 || scenario === 4;
    results[scenario.toString()] = {
      runs,
      summary: calculateScenarioSummary(runs, isSequential),
    };
  }

  return results;
}

/**
 * Run full test suite
 */
export async function runFullTestSuite(
  modelIds: string[],
  scenarios: number[],
  config: TestConfig = DEFAULT_CONFIG,
  task: Task,
  onProgress?: ProgressCallback,
  onRunComplete?: RunCompleteCallback
): Promise<TestRunFile['results']> {
  const results: TestRunFile['results'] = {};

  for (const modelId of modelIds) {
    results[modelId] = await runModelTests(modelId, scenarios, config, task, onProgress, onRunComplete);
  }

  return results;
}
