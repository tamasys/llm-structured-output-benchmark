import { z } from 'zod';

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

export interface StepDefinition {
  prompt: string;
  schema: z.ZodType<any>;
}

export interface OneShotScenarios {
  nonStrict: StepDefinition;
  strict: StepDefinition;
}

export interface SequentialScenarios {
  nonStrict: {
    step1: StepDefinition;
    step2: StepDefinition;
    step3: StepDefinition;
  };
  strict: {
    step1: StepDefinition;
    step2: StepDefinition;
    step3: StepDefinition;
  };
  merge(parts: [unknown, unknown, unknown]): unknown;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  context: string;
  scenarios: {
    oneShot: OneShotScenarios;
    sequential: SequentialScenarios;
  };
  retryPrompt(previousResponse: string, errors: ValidationError[]): string;
}

const taskRegistry = new Map<string, Task>();

export function registerTask(task: Task): void {
  if (taskRegistry.has(task.id)) {
    throw new Error(`Task '${task.id}' is already registered`);
  }
  taskRegistry.set(task.id, task);
}

export function getTask(id: string): Task | undefined {
  return taskRegistry.get(id);
}

export function listTasks(): Task[] {
  return Array.from(taskRegistry.values());
}

export function clearTasks(): void {
  taskRegistry.clear();
}
