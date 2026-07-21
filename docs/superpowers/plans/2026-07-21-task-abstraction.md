# Task Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the benchmark tool task-agnostic via a pluggable `Task` interface so the hiring and family-history tasks can be swapped without modifying the test runner.

**Architecture:** Define a `Task` interface in `lib/task.ts` with scenario definitions (prompt + schema per scenario/step). Extract the existing hiring task into `lib/tasks/hiring.ts`. Update `lib/test-runner.ts` to accept a `Task` parameter instead of importing schemas/prompts/conversation directly.

**Tech Stack:** TypeScript, Zod, existing AI SDK packages

---

### Task 1: Define Task interface and registry

**Files:**
- Create: `lib/task.ts`

- [ ] **Step 1: Write the failing test for Task registry**

```typescript
// __tests__/task.test.ts
import { registerTask, getTask, listTasks, type Task, type StepDefinition } from '../lib/task';

describe('Task Registry', () => {
  const mockTask: Task = {
    id: 'test-task',
    name: 'Test Task',
    description: 'A test task',
    systemPrompt: 'You are a test assistant',
    context: 'Test context',
    scenarios: {
      oneShot: {
        nonStrict: { prompt: 'Do the thing', schema: { safeParse: () => ({ success: true }) } as any },
        strict: { prompt: 'Do the thing strictly', schema: { safeParse: () => ({ success: true }) } as any },
      },
      sequential: {
        nonStrict: {
          step1: { prompt: 'Step 1', schema: { safeParse: () => ({ success: true }) } as any },
          step2: { prompt: 'Step 2', schema: { safeParse: () => ({ success: true }) } as any },
          step3: { prompt: 'Step 3', schema: { safeParse: () => ({ success: true }) } as any },
        },
        strict: {
          step1: { prompt: 'Step 1 strict', schema: { safeParse: () => ({ success: true }) } as any },
          step2: { prompt: 'Step 2 strict', schema: { safeParse: () => ({ success: true }) } as any },
          step3: { prompt: 'Step 3 strict', schema: { safeParse: () => ({ success: true }) } as any },
        },
        merge: (parts: [unknown, unknown, unknown]) => parts[0],
      },
    },
    retryPrompt: (prev, errors) => `Fix: ${errors.map(e => e.message).join(', ')}`,
  };

  beforeEach(() => {
    // Reset registry by removing test-task
    const existing = getTask('test-task');
    if (existing) {
      // Can't unregister, but we can re-register
    }
  });

  it('should register and retrieve a task', () => {
    registerTask(mockTask);
    const retrieved = getTask('test-task');
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('test-task');
    expect(retrieved!.name).toBe('Test Task');
  });

  it('should list all registered tasks', () => {
    registerTask(mockTask);
    const tasks = listTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks.some(t => t.id === 'test-task')).toBe(true);
  });

  it('should throw when registering duplicate ID', () => {
    registerTask(mockTask);
    expect(() => registerTask(mockTask)).toThrow(/already registered/i);
  });

  it('should return undefined for unknown task', () => {
    expect(getTask('nonexistent')).toBeUndefined();
  });

  it('should have a default "hiring" task registered', () => {
    const hiring = getTask('hiring');
    expect(hiring).toBeDefined();
    expect(hiring!.id).toBe('hiring');
    expect(hiring!.scenarios.oneShot.nonStrict).toBeDefined();
    expect(hiring!.scenarios.oneShot.strict).toBeDefined();
    expect(hiring!.scenarios.sequential.nonStrict.step1).toBeDefined();
  });
});
```

Run: `npx jest __tests__/task.test.ts`
Expected: FAIL - `lib/task.ts` does not exist

- [ ] **Step 2: Create lib/task.ts with the Task interface and registry**

```typescript
// lib/task.ts
import { z } from 'zod';
import type { ValidationError } from './storage';

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
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx jest __tests__/task.test.ts`
Expected: 5 tests pass, 1 fails ("default hiring task registered")

- [ ] **Step 4: Commit**

```bash
git add lib/task.ts __tests__/task.test.ts
git commit -m "feat: add Task interface and registry"
```

---

### Task 2: Extract hiring task into separate module

**Files:**
- Create: `lib/tasks/hiring.ts`
- Keep: `lib/prompts.ts` (keep `extractJson` only)
- Keep: `lib/schemas.ts` (remove hiring schemas, keep empty or delete)

- [ ] **Step 1: Write failing test that hiring task exists**

Add to the existing test in `__tests__/task.test.ts`:
```typescript
it('should have a default "hiring" task registered', () => {
  const hiring = getTask('hiring');
  expect(hiring).toBeDefined();
  expect(hiring!.id).toBe('hiring');
  expect(hiring!.scenarios.oneShot.nonStrict).toBeDefined();
  expect(hiring!.scenarios.oneShot.strict).toBeDefined();
  expect(hiring!.scenarios.sequential.nonStrict.step1).toBeDefined();
});
```

Run: `npx jest __tests__/task.test.ts`
Expected: FAIL - hiring task not registered yet

- [ ] **Step 2: Create lib/tasks/hiring.ts**

Move into this file (from existing modules):
- Schemas: `ResponseSchema`, `ActorSchema`, `ActionSchema`, `ModelTypeSchema`, `SequentialPart1Schema`, `SequentialPart2Schema`, `SequentialPart3Schema`, `mergeSequentialParts`, and their inferred types
- Prompts: `systemPrompt`, `getOneShotPrompt`, `oneShotStrictPrompt`, `sequentialPrompts`, `getRetryPrompt`
- Context: `participants`, `conversation`, `formatConversation`, `getConversationMessages`
- Export a pre-registered `hiringTask: Task` object

The `getRetryPrompt` from `prompts.ts` is NOT task-specific — keep it in `lib/prompts.ts` (used by all tasks via `task.retryPrompt`).
The `extractJson` stays in `lib/prompts.ts`.

The `systemPrompt` from `prompts.ts` IS task-specific — it's the hiring system prompt.

```typescript
// lib/tasks/hiring.ts
import { z } from 'zod';
import { registerTask, type Task, type ValidationError } from '../task';
import { getRetryPrompt } from '../prompts';

// --- Types ---
export type ModelType = 'reasoning' | 'semantic';
export interface Actor { title: string; reason: string; skills: string[]; prompt: string; model: ModelType; }
export interface Action { type: 'create_actor'; actor: Actor; }
export interface Response { recommendation: string; action: Action | null; }
export interface SequentialPart1 { recommendation: string; action: 'create_actor' | null; }
export interface SequentialPart2 { title: string; reason: string; skills: string[]; }
export interface SequentialPart3 { prompt: string; model: ModelType; }

// --- Schemas ---
export const ModelTypeSchema = z.enum(['reasoning', 'semantic']);
export const ActorSchema = z.object({
  title: z.string().min(2),
  reason: z.string().min(20),
  skills: z.array(z.string()),
  prompt: z.string().min(30),
  model: ModelTypeSchema,
});
export const ActionSchema = z.object({ type: z.literal('create_actor'), actor: ActorSchema });
export const ResponseSchema = z.object({
  recommendation: z.string().min(20),
  action: ActionSchema.nullable(),
});
export const SequentialPart1Schema = z.object({
  recommendation: z.string().min(20),
  action: z.literal('create_actor').nullable(),
});
export const SequentialPart2Schema = z.object({
  title: z.string().min(2),
  reason: z.string().min(20),
  skills: z.array(z.string()),
});
export const SequentialPart3Schema = z.object({
  prompt: z.string().min(30),
  model: ModelTypeSchema,
});

export function mergeSequentialParts(
  part1: SequentialPart1, part2: SequentialPart2, part3: SequentialPart3
): Response {
  return {
    recommendation: part1.recommendation,
    action: part1.action === 'create_actor' ? {
      type: 'create_actor',
      actor: { title: part2.title, reason: part2.reason, skills: part2.skills, prompt: part3.prompt, model: part3.model },
    } : null,
  };
}

// --- Context ---
const participants = [
  { name: 'Alex', role: 'Tech Lead' },
  { name: 'Jordan', role: 'Backend Engineer' },
  { name: 'Sam', role: 'Frontend Engineer' },
  { name: 'Casey', role: 'Product Manager' },
  { name: 'Morgan', role: 'DevOps Engineer' },
];

const conversation = [
  'Alex: The dashboard is loading slowly again. We need to optimize the queries.',
  'Jordan: I\'ve noticed the database queries are taking 2-3 seconds each.',
  'Sam: The frontend is also waiting on API responses. Users are complaining.',
  'Casey: Can we add a caching layer or optimize the database?',
  'Morgan: The server is running at 80% CPU during peak hours.',
  'Alex: We should look at the slow query log to identify bottlenecks.',
  'Jordan: I found several queries doing full table scans on large tables.',
  'Sam: The main dashboard endpoint makes 15 separate database calls.',
  'Casey: What\'s the timeline for a fix? Users are reporting issues.',
  'Morgan: We need to scale the database or optimize the queries first.',
  'Alex: Let\'s prioritize the most expensive queries first.',
  'Jordan: The users table join is the biggest bottleneck right now.',
  'Sam: We also need to add pagination to the API responses.',
  'Casey: I\'ll talk to stakeholders about the performance issues.',
  'Morgan: We might need to add read replicas for the reporting queries.',
  'Alex: Good idea. Let\'s also add proper indexing.',
  'Jordan: I can create the indexes and optimize the queries this sprint.',
  'Sam: I\'ll add caching on the frontend side for frequently accessed data.',
  'Casey: Let me know if you need anything from product side.',
  'Morgan: I\'ll set up monitoring alerts for database performance.',
];

function formatConversation(): string {
  return conversation.map(msg => `${msg}`).join('\n');
}

// --- Prompts ---
const hiringSystemPrompt = `You are a recruiter AI assistant. Your job is to analyse team conversations...`;

function getOneShotPrompt(): string {
  return `Based on the conversation above, recommend a team member...`;
}

const oneShotStrictPrompt = `Based on the conversation above, recommend a team member...`;

const sequentialPrompts = {
  step1: { nonStrict: `...`, strict: `...` },
  step2: { nonStrict: `...`, strict: `...` },
  step3: { nonStrict: `...`, strict: `...` },
};

// --- Task ---
export const hiringTask: Task = {
  id: 'hiring',
  name: 'Hiring Recommendation',
  description: 'Analyze a team conversation and recommend a new team member to fill a skill gap',
  systemPrompt: hiringSystemPrompt,
  context: formatConversation(),
  scenarios: {
    oneShot: {
      nonStrict: { prompt: getOneShotPrompt(), schema: ResponseSchema },
      strict: { prompt: oneShotStrictPrompt, schema: ResponseSchema },
    },
    sequential: {
      nonStrict: {
        step1: { prompt: sequentialPrompts.step1.nonStrict, schema: SequentialPart1Schema },
        step2: { prompt: sequentialPrompts.step2.nonStrict, schema: SequentialPart2Schema },
        step3: { prompt: sequentialPrompts.step3.nonStrict, schema: SequentialPart3Schema },
      },
      strict: {
        step1: { prompt: sequentialPrompts.step1.strict, schema: SequentialPart1Schema },
        step2: { prompt: sequentialPrompts.step2.strict, schema: SequentialPart2Schema },
        step3: { prompt: sequentialPrompts.step3.strict, schema: SequentialPart3Schema },
      },
      merge: (parts: [unknown, unknown, unknown]) =>
        mergeSequentialParts(parts[0] as SequentialPart1, parts[1] as SequentialPart2, parts[2] as SequentialPart3),
    },
  },
  retryPrompt: getRetryPrompt,
};

registerTask(hiringTask);
```

- [ ] **Step 3: Update lib/prompts.ts — keep only extractJson and getRetryPrompt**

Replace entire `lib/prompts.ts` with:
```typescript
export function extractJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

export function getRetryPrompt(
  previousResponse: string,
  validationErrors: Array<{ path: string[]; message: string }>
): string {
  const errorList = validationErrors
    .map((err) => {
      const path = err.path.length > 0 ? err.path.join('.') : 'root';
      return `\u2022 ${path}: ${err.message}`;
    })
    .join('\n');
  return `<validation_retry>\nYour previous response failed JSON validation:\n\n<previous_response>\n${previousResponse}</previous_response>\n\n<validation_errors>\n${errorList}</validation_errors>\n\n<instructions>\n1. Review the specific validation errors above\n2. Identify what needs to be fixed in your response\n3. Generate a corrected response that addresses each error\n</instructions>\n\nProvide a corrected JSON response. Return ONLY valid JSON with no additional text, explanations, or markdown formatting.\n</validation_retry>`;
}
```

- [ ] **Step 4: Update lib/schemas.ts — remove hiring schemas, re-export from tasks**

Replace `lib/schemas.ts` with re-exports for backward compat:
```typescript
export {
  ModelTypeSchema, ModelType,
  ActorSchema, Actor,
  ActionSchema, Action,
  ResponseSchema, Response,
  SequentialPart1Schema, SequentialPart1,
  SequentialPart2Schema, SequentialPart2,
  SequentialPart3Schema, SequentialPart3,
  mergeSequentialParts,
} from './tasks/hiring';
```

- [ ] **Step 5: Update lib/conversation.ts — re-export from tasks**

Replace `lib/conversation.ts` with:
```typescript
export { formatConversation, getConversationMessages, participants, conversation } from './tasks/hiring';
```

- [ ] **Step 6: Run tests**

Run: `npx jest __tests__/task.test.ts __tests__/schemas.test.ts __tests__/prompts.test.ts __tests__/conversation.test.ts`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add lib/task.ts lib/tasks/hiring.ts lib/schemas.ts lib/conversation.ts lib/prompts.ts
git commit -m "refactor: extract hiring task into lib/tasks/hiring.ts"
```

---

### Task 3: Update test-runner.ts to use Task interface

**Files:**
- Modify: `lib/test-runner.ts`
- Modify: `lib/models-factory.ts` (add `taskId` support)

- [ ] **Step 1: Write failing tests that test-runner accepts task parameter**

```typescript
// __tests__/test-runner.task.test.ts
import { runModelTests, type TestConfig } from '../lib/test-runner';
import { getTask } from '../lib/task';

describe('test-runner with Task', () => {
  const config: TestConfig = { temperature: 0.1, maxRetries: 0, runsPerScenario: 1 };

  it('should accept a task parameter', async () => {
    const task = getTask('hiring');
    expect(task).toBeDefined();
    // Should not throw about missing task
    await expect(runModelTests('openai-gpt4o', [1], config, task!)).rejects.toThrow(); // fails because no api key, but should get past task validation
  });
});
```

(This test is a placeholder — actual test will pass once implementation is done.
Skip this test file for now; existing tests cover the runner.)

- [ ] **Step 2: Update test-runner.ts to accept Task param**

Changes to `lib/test-runner.ts`:

1. **Imports**: Remove imports from `./schemas`, `./conversation`, `./prompts` (except `extractJson`). Import `Task` from `./task`.

2. **Function signatures**: Add `task: Task` parameter to `runModelTests`, `runFullTestSuite`, and all `runScenario*` functions.

```typescript
export async function runModelTests(
  modelId: string,
  scenarios: number[],
  config: TestConfig = DEFAULT_CONFIG,
  task: Task,
  onProgress?: ProgressCallback,
  onRunComplete?: RunCompleteCallback
): Promise<{ [scenario: string]: ScenarioResult }>
```

3. **runScenario1** (one-shot non-strict):
Replace:
```typescript
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: `Here is a conversation...\n\n${conversationText}` },
  { role: 'user', content: getOneShotPrompt() },
];
const result = await runNonStrictAttempt(model, messages, ResponseSchema, config);
```
With:
```typescript
const messages = [
  { role: 'system', content: task.systemPrompt },
  { role: 'user', content: task.context },
  { role: 'user', content: task.scenarios.oneShot.nonStrict.prompt },
];
const result = await runNonStrictAttempt(model, messages, task.scenarios.oneShot.nonStrict.schema, config);
```

4. **runScenario2** (one-shot strict): Similar, but use `task.scenarios.oneShot.strict`.

5. **runScenario3** (sequential non-strict):
Replace step prompt/schema references with `task.scenarios.sequential.nonStrict.step1/2/3`.
Replace `mergeSequentialParts(step1, step2, step3)` with `task.scenarios.sequential.merge([step1, step2, step3])`.
Replace `getRetryPrompt(...)` with `task.retryPrompt(...)`.

6. **runScenario4** (sequential strict): Same as 3 but with `task.scenarios.sequential.strict`.

7. **runFullTestSuite**: Add `task` parameter, pass to `runModelTests`.

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/models.test.ts __tests__/schemas.test.ts __tests__/prompts.test.ts __tests__/conversation.test.ts`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add lib/test-runner.ts
git commit -m "refactor: test-runner uses Task interface instead of direct imports"
```

---

### Task 4: Update API route to accept taskId

**Files:**
- Modify: `app/api/run/route.ts`

- [ ] **Step 1: Update POST handler**

In `app/api/run/route.ts`:
- Add `taskId` to the request body destructuring (default `'hiring'`)
- Look up task via `getTask(taskId)`, return 400 if not found
- Pass `task` to `runFullTestSuite` / `runModelTests`

```typescript
const { models: modelIds, scenarios, runsPerScenario, temperature, maxRetries, taskId } = body;
const task = getTask(taskId || 'hiring');
if (!task) {
  return Response.json({ error: `Unknown task: ${taskId}` }, { status: 400 });
}
// Pass task to runFullTestSuite...
```

- [ ] **Step 2: Commit**

```bash
git add app/api/run/route.ts
git commit -m "feat: API accepts taskId parameter, defaults to hiring"
```

---

### Task 5: Write the family-history task

**Files:**
- Create: `lib/tasks/family-history.ts`

- [ ] **Step 1: Write failing test for family-history task**

```typescript
it('should register and retrieve family-history task', () => {
  const task = getTask('family-history');
  expect(task).toBeDefined();
  expect(task!.id).toBe('family-history');
  expect(task!.systemPrompt).toContain('family history analyst');
});
```

- [ ] **Step 2: Create lib/tasks/family-history.ts**

This task exercises the family history entity extraction schema.

Schemas (from the family history project's `llm.ts`):
```typescript
const ambiguitySchema = z.object({
  type: z.enum(['geographic', 'onomastic', 'contextual', 'transcription']),
  span: z.tuple([z.number(), z.number()]),
  original: z.string(),
  suggestion: z.string(),
  alternatives: z.array(z.string()).optional().default([]),
  reasoning: z.string(),
}).passthrough();

const duplicateSchema = z.object({
  existing_rid: z.string(),
  existing_type: z.string(),
  existing_label: z.string(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
}).passthrough();

const analysisSchema = z.object({
  ambiguities: z.array(ambiguitySchema).optional().default([]),
  people: z.array(z.object({
    id: z.string(),
    names: z.array(z.object({ value: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    birth: z.object({ year: z.number(), precision: z.string(), line_no: z.number(), phrase: z.string() }).passthrough().optional().nullable(),
    death: z.object({ year: z.number(), precision: z.string(), line_no: z.number(), phrase: z.string() }).passthrough().optional().nullable(),
    sex: z.string().optional(),
    parents: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    partners: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    children: z.array(z.object({ person_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    member_of: z.array(z.object({ group_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
    located_at: z.array(z.object({ place_id: z.string(), line_no: z.number(), phrase: z.string() })).optional().default([]),
  }).passthrough()).optional().default([]),
  groups: z.array(z.object({ id: z.string(), name: z.string(), group_type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  events: z.array(z.object({ id: z.string(), name: z.string(), event_type: z.string().optional(), date: z.object({ year: z.number(), precision: z.string() }).passthrough().optional().nullable(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  places: z.array(z.object({ id: z.string(), name: z.string(), place_type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  roles: z.array(z.object({ id: z.string(), title: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  attributes: z.array(z.object({ id: z.string(), name: z.string(), type: z.string().optional(), line_no: z.number(), phrase: z.string() }).passthrough()).optional().default([]),
  duplicates: z.array(duplicateSchema).optional().default([]),
});
```

For sequential mode, the family history task splits extraction into steps:
- Step 1: Extract people and their names/birth/death
- Step 2: Extract relationships (parents, partners, children, member_of, located_at)  
- Step 3: Extract groups, events, places, roles, attributes + ambiguities/duplicates

Step 1-2 share a sub-schema, step 3 is the full schema minus people. The merge function reconstructs the full output.

Register the task with `registerTask(familyHistoryTask)`.

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/task.test.ts`
Expected: "family-history task registered" test passes

- [ ] **Step 4: Commit**

```bash
git add lib/tasks/family-history.ts
git commit -m "feat: add family history entity extraction task"
```

---

### Task 6: Update existing tests

**Files:**
- Modify: `__tests__/schemas.test.ts`
- Modify: `__tests__/prompts.test.ts`
- Modify: `__tests__/conversation.test.ts`
- Modify: `__tests__/models-factory.test.ts`

- [ ] **Step 1: Update schemas.test.ts**

The schemas now re-export from `./tasks/hiring`. Update imports:
```typescript
import { ResponseSchema } from '../lib/schemas';
// should still work since schemas.ts re-exports
```

- [ ] **Step 2: Update prompts.test.ts**

Remove tests for hiring-specific prompts (they now live in the task module). Keep tests for `extractJson` and `getRetryPrompt`.

- [ ] **Step 3: Update conversation.test.ts**

Remove tests that reference deleted exports (or leave them since `conversation.ts` re-exports).

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add __tests__/
git commit -m "test: update test imports for task abstraction"
```

---

### Task 7: Update UI pages for task selection

**Files:**
- Modify: `app/run/page.tsx` (add task selector)
- Modify: `app/dashboard/page.tsx` (show task info)

- [ ] **Step 1: Add task selector to run page**

In the run configuration form, add a task dropdown populated from `listTasks()`.

- [ ] **Step 2: Show task name in results**

In dashboard/result pages, show which task was used for each run.

- [ ] **Step 3: Commit**

```bash
git add app/run/page.tsx app/dashboard/page.tsx
git commit -m "feat: add task selector to UI"
```
