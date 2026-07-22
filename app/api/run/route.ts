import { NextRequest, NextResponse } from 'next/server';
import {
  createTestRun,
  saveTestRun,
  updateRunSummary,
} from '@/lib/storage';
import { runFullTestSuite, type TestProgress, type RunCompleteEvent } from '@/lib/test-runner';
import { calculateScenarioSummary } from '@/lib/storage';
import { modelDefinitions, getModelDefinition, type ApiKeys } from '@/lib/models-factory';
import { getTask, type Task } from '@/lib/task';
import {
  activeRuns,
  type AttemptStatus,
  type RunProgress,
  type ScenarioProgress,
} from '@/lib/active-runs';

function extractApiKeys(request: NextRequest): ApiKeys {
  return {
    openai: request.headers.get('x-openai-api-key') || undefined,
    anthropic: request.headers.get('x-anthropic-api-key') || undefined,
    google: request.headers.get('x-google-api-key') || undefined,
    groq: request.headers.get('x-groq-api-key') || undefined,
    openrouter: request.headers.get('x-openrouter-api-key') || undefined,
    opencode_go: request.headers.get('x-opencode-go-api-key') || undefined,
    opencode_zen: request.headers.get('x-opencode-zen-api-key') || undefined,
    nvidia: request.headers.get('x-nvidia-api-key') || undefined,
    ollama_cloud: request.headers.get('x-ollama-cloud-api-key') || undefined,
  };
}

function hasKeyForProvider(apiKeys: ApiKeys, provider: string): boolean {
  switch (provider) {
    case 'openai':
      return !!(apiKeys.openai || process.env.OPENAI_API_KEY);
    case 'anthropic':
      return !!(apiKeys.anthropic || process.env.ANTHROPIC_API_KEY);
    case 'google':
      return !!(apiKeys.google || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    case 'groq':
      return !!(apiKeys.groq || process.env.GROQ_API_KEY);
    case 'openrouter':
      return !!(apiKeys.openrouter || process.env.OPENROUTER_API_KEY);
    case 'opencode_go':
      return !!(apiKeys.opencode_go || process.env.OPENCODE_API_KEY);
    case 'opencode_zen':
      return !!(apiKeys.opencode_zen || process.env.OPENCODE_API_KEY);
    case 'nvidia':
      return !!(apiKeys.nvidia || process.env.NVIDIA_API_KEY);
    case 'ollama_cloud':
      return !!(apiKeys.ollama_cloud || process.env.OLLAMA_CLOUD_API_KEY);
    case 'lm_studio':
    case 'ollama_local':
      return true; // local providers, no key needed
    default:
      return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const runningRuns = Array.from(activeRuns.values()).filter(r => r.status === 'running');
    if (runningRuns.length > 0) {
      return NextResponse.json(
        { error: 'A test is already running. Please wait for it to complete or cancel it.' },
        { status: 409 }
      );
    }

    const apiKeys = extractApiKeys(request);
    const body = await request.json();
    const {
      models: modelIds = modelDefinitions.map(m => m.id),
      scenarios = [1, 2, 3, 4],
      runsPerScenario = 10,
      temperature = 0.1,
      maxRetries = 3,
      taskId = 'hiring',
    } = body;

    const validModelIds = modelIds.filter((id: string) => {
      const def = getModelDefinition(id);
      if (!def) return false;
      return hasKeyForProvider(apiKeys, def.provider);
    });

    if (validModelIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid models specified or missing API keys. Configure API keys in Settings.' },
        { status: 400 }
      );
    }

    const validScenarios = scenarios.filter(
      (s: number) => s >= 1 && s <= 4
    );

    if (validScenarios.length === 0) {
      return NextResponse.json(
        { error: 'No valid scenarios specified' },
        { status: 400 }
      );
    }

    const task = getTask(taskId);
    if (!task) {
      return NextResponse.json(
        { error: `Unknown task: ${taskId}` },
        { status: 400 }
      );
    }

    const run = createTestRun({
      models: validModelIds,
      scenarios: validScenarios,
      runsPerScenario,
      temperature,
      maxRetries,
    });

    const maxAttempts = maxRetries + 1;
    const totalScenarios = validModelIds.length * validScenarios.length;

    const scenariosProgress: ScenarioProgress[] = [];
    for (const modelId of validModelIds) {
      const modelDef = getModelDefinition(modelId);
      for (const scenario of validScenarios) {
        const isSequential = scenario === 3 || scenario === 4;
        const isStrictScenario = scenario === 2 || scenario === 4;
        const isSkipped = isStrictScenario && !modelDef?.supportsStrictMode;

        const runs: RunProgress[] = Array.from({ length: runsPerScenario }, (_, i) => {
          if (isSequential) {
            return {
              run: i + 1,
              steps: [
                { stepNumber: 1, stepName: 'Recommendation', attempts: Array(maxAttempts).fill(isSkipped ? 'skipped' : 'pending') as AttemptStatus[] },
                { stepNumber: 2, stepName: 'Details', attempts: Array(maxAttempts).fill(isSkipped ? 'skipped' : 'pending') as AttemptStatus[] },
                { stepNumber: 3, stepName: 'AI Config', attempts: Array(maxAttempts).fill(isSkipped ? 'skipped' : 'pending') as AttemptStatus[] },
              ],
              final: isSkipped ? 'skipped' as const : 'pending' as const,
            };
          }
          return {
            run: i + 1,
            attempts: Array(maxAttempts).fill(isSkipped ? 'skipped' : 'pending') as AttemptStatus[],
            final: isSkipped ? 'skipped' as const : 'pending' as const,
          };
        });

        scenariosProgress.push({
          modelId,
          modelName: modelDef?.name || modelId,
          scenario,
          isSequential,
          isSkipped,
          runs,
          completedRuns: isSkipped ? runsPerScenario : 0,
          totalRuns: runsPerScenario,
        });
      }
    }

    const firstModelDef = getModelDefinition(validModelIds[0]);
    activeRuns.set(run.id, {
      status: 'running',
      progress: {
        currentModel: validModelIds[0],
        currentModelName: firstModelDef?.name || validModelIds[0],
        currentScenario: validScenarios[0],
        currentRun: 1,
        currentAttempt: 1,
        currentStatus: 'running',
        statusMessage: 'Starting tests...',
        scenarios: scenariosProgress,
        totalScenarios,
        completedScenarios: 0,
        maxAttempts,
        logEntries: [],
      },
      run,
    });

    runTestsInBackground(run.id, validModelIds, validScenarios, {
      temperature,
      maxRetries,
      runsPerScenario,
      apiKeys,
    }, task);

    return NextResponse.json({ runId: run.id });
  } catch (error) {
    console.error('Error starting test run:', error);
    return NextResponse.json(
      { error: 'Failed to start test run' },
      { status: 500 }
    );
  }
}

async function runTestsInBackground(
  runId: string,
  modelIds: string[],
  scenarios: number[],
  config: { temperature: number; maxRetries: number; runsPerScenario: number; apiKeys: ApiKeys },
  task: Task
) {
  const activeRun = activeRuns.get(runId);
  if (!activeRun) return;

  const startTime = Date.now();
  const maxAttempts = config.maxRetries + 1;

  let lastModel = '';
  let lastScenario = 0;

  const onProgress = (progress: TestProgress) => {
    const activeRun = activeRuns.get(runId);
    if (!activeRun) return;

    const scenarioProgress = activeRun.progress.scenarios.find(
      s => s.modelId === progress.modelId && s.scenario === progress.scenario
    );

    if (!scenarioProgress) return;

    const isSequential = progress.scenario === 3 || progress.scenario === 4;
    const runIndex = progress.runNumber - 1;
    const attemptIndex = progress.attemptNumber - 1;
    const stepIndex = progress.stepNumber ? progress.stepNumber - 1 : 0;

    const scenarioNames: Record<number, string> = {
      1: 'one-shot non-strict mode',
      2: 'one-shot strict mode',
      3: 'sequential non-strict mode',
      4: 'sequential strict mode',
    };
    const stepNames: Record<number, string> = {
      1: 'Recommendation',
      2: 'Details',
      3: 'AI Config',
    };

    activeRun.progress.currentModel = progress.modelId;
    activeRun.progress.currentModelName = progress.modelName;
    activeRun.progress.currentScenario = progress.scenario;
    activeRun.progress.currentRun = progress.runNumber;
    activeRun.progress.currentStep = progress.stepNumber;
    activeRun.progress.currentStepName = progress.stepName;
    activeRun.progress.currentAttempt = progress.attemptNumber;
    activeRun.progress.currentStatus = progress.status;

    // Generate friendly status message
    const scenarioName = scenarioNames[progress.scenario];
    const modelName = progress.modelName;
    let statusMessage = '';

    if (progress.status === 'running') {
      if (isSequential && progress.stepNumber) {
        statusMessage = `Testing step ${progress.stepNumber} (${stepNames[progress.stepNumber]}) in ${scenarioName} with ${modelName}`;
      } else {
        statusMessage = `Testing ${scenarioName} with ${modelName}`;
      }
    } else if (progress.status === 'retrying') {
      if (isSequential && progress.stepNumber) {
        statusMessage = `Step ${progress.stepNumber} (${stepNames[progress.stepNumber]}) in ${scenarioName} with ${modelName} failed - retrying (${progress.attemptNumber}/${maxAttempts})`;
      } else {
        statusMessage = `${scenarioName} with ${modelName} failed - retrying (${progress.attemptNumber}/${maxAttempts})`;
      }
    } else if (progress.status === 'success') {
      if (isSequential && progress.stepNumber && progress.stepNumber < 3) {
        statusMessage = `Step ${progress.stepNumber} succeeded, moving to step ${progress.stepNumber + 1}...`;
      } else {
        statusMessage = `Run ${progress.runNumber} succeeded!`;
      }
    } else if (progress.status === 'failed') {
      if (isSequential && progress.stepNumber) {
        statusMessage = `Step ${progress.stepNumber} (${stepNames[progress.stepNumber]}) failed after ${maxAttempts} attempts`;
      } else {
        statusMessage = `Run failed after ${maxAttempts} attempts`;
      }
    }

    activeRun.progress.statusMessage = statusMessage;

    if (progress.logEntry) {
      activeRun.progress.logEntries.push(progress.logEntry);
      if (activeRun.progress.logEntries.length > 100) {
        activeRun.progress.logEntries = activeRun.progress.logEntries.slice(-100);
      }
    }

    if (runIndex >= 0 && runIndex < scenarioProgress.runs.length) {
      const runData = scenarioProgress.runs[runIndex];

      if (isSequential && runData.steps) {
        const step = runData.steps[stepIndex];
        if (!step) return;

        if (progress.status === 'running') {
          step.attempts[attemptIndex] = 'running';
        } else if (progress.status === 'retrying') {
          if (attemptIndex > 0) {
            step.attempts[attemptIndex - 1] = 'failed';
          }
          step.attempts[attemptIndex] = 'running';
        } else if (progress.status === 'success') {
          step.attempts[attemptIndex] = 'success';
          for (let i = attemptIndex + 1; i < maxAttempts; i++) {
            step.attempts[i] = 'skipped';
          }
          if (stepIndex === 2) {
            runData.final = 'success';
            scenarioProgress.completedRuns++;
          }
        } else if (progress.status === 'failed') {
          step.attempts[attemptIndex] = 'failed';
          if (attemptIndex === maxAttempts - 1) {
            for (let i = stepIndex + 1; i < 3; i++) {
              runData.steps![i].attempts = runData.steps![i].attempts.map(() => 'skipped' as AttemptStatus);
            }
            runData.final = 'failed';
            scenarioProgress.completedRuns++;
          }
        }
      } else if (runData.attempts) {
        if (progress.status === 'running') {
          runData.attempts[attemptIndex] = 'running';
        } else if (progress.status === 'retrying') {
          if (attemptIndex > 0) {
            runData.attempts[attemptIndex - 1] = 'failed';
          }
          runData.attempts[attemptIndex] = 'running';
        } else if (progress.status === 'success') {
          runData.attempts[attemptIndex] = 'success';
          for (let i = attemptIndex + 1; i < maxAttempts; i++) {
            runData.attempts[i] = 'skipped';
          }
          runData.final = 'success';
          scenarioProgress.completedRuns++;
        } else if (progress.status === 'failed') {
          runData.attempts[attemptIndex] = 'failed';
          if (attemptIndex === maxAttempts - 1) {
            runData.final = 'failed';
            scenarioProgress.completedRuns++;
          }
        }
      }
    }

    if (lastModel !== progress.modelId || lastScenario !== progress.scenario) {
      lastModel = progress.modelId;
      lastScenario = progress.scenario;
      const completedScenarios = activeRun.progress.scenarios.filter(
        s => s.completedRuns === s.totalRuns
      ).length;
      activeRun.progress.completedScenarios = completedScenarios;
    }
  };

  const onRunComplete = (event: RunCompleteEvent) => {
    const activeRun = activeRuns.get(runId);
    if (!activeRun) return;

    const { modelId, scenario, runResult, isSequential } = event;

    if (!activeRun.run.results[modelId]) {
      activeRun.run.results[modelId] = {};
    }

    const scenarioKey = scenario.toString();
    if (!activeRun.run.results[modelId][scenarioKey]) {
      activeRun.run.results[modelId][scenarioKey] = {
        runs: [],
        summary: {
          successRate: 0,
          firstAttemptSuccessRate: 0,
          afterRetry1SuccessRate: 0,
          afterRetry2SuccessRate: 0,
          afterRetry3SuccessRate: 0,
          averageDurationMs: 0,
          averageAttempts: 0,
          averageAttemptsPerSuccess: 0,
          averageTokensPerSuccess: 0,
          totalTokensUsed: 0,
        },
      };
    }

    activeRun.run.results[modelId][scenarioKey].runs.push(runResult);
    activeRun.run.results[modelId][scenarioKey].summary = calculateScenarioSummary(
      activeRun.run.results[modelId][scenarioKey].runs,
      isSequential
    );

    updateRunSummary(activeRun.run);
  };

  try {
    const results = await runFullTestSuite(
      modelIds,
      scenarios,
      config,
      task,
      onProgress,
      onRunComplete
    );

    activeRun.run.results = results;
    activeRun.run.duration = Date.now() - startTime;
    updateRunSummary(activeRun.run);

    saveTestRun(activeRun.run);

    activeRun.status = 'complete';
    activeRun.progress.completedScenarios = activeRun.progress.totalScenarios;

    setTimeout(() => {
      activeRuns.delete(runId);
    }, 60000);
  } catch (error) {
    console.error('Error running tests:', error);
    activeRun.status = 'error';
    activeRun.error = error instanceof Error ? error.message : String(error);

    setTimeout(() => {
      activeRuns.delete(runId);
    }, 60000);
  }
}

export async function GET() {
  const runs = Array.from(activeRuns.entries()).map(([id, data]) => ({
    id,
    status: data.status,
    progress: data.progress,
  }));

  return NextResponse.json({ runs });
}
