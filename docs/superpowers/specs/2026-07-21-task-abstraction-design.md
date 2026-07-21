# Task Abstraction Design

## Goal

Make the benchmark tool task-agnostic by defining a pluggable `Task` interface, so
different structured output tasks (hiring recommendation, family history entity
extraction, etc.) can be swapped in without modifying the test runner.

## Interface

```typescript
interface Task {
  id: string;
  name: string;
  description: string;

  systemPrompt: string;

  /** Contextual information provided to the LLM (conversation, transcript, etc.) */
  context(): string;

  scenarios: {
    /** One-shot, non-strict mode: generateText then parse JSON */
    oneShot: {
      nonStrict: { prompt: string; schema: ZodType };
      strict:    { prompt: string; schema: ZodType };
    };
    /** Sequential (3-step), with merge function */
    sequential: {
      nonStrict: {
        step1: { prompt: string; schema: ZodType };
        step2: { prompt: string; schema: ZodType };
        step3: { prompt: string; schema: ZodType };
      };
      strict: {
        step1: { prompt: string; schema: ZodType };
        step2: { prompt: string; schema: ZodType };
        step3: { prompt: string; schema: ZodType };
      };
      merge(step1: unknown, step2: unknown, step3: unknown): unknown;
    };
  };

  /** Format a retry prompt given the previous response and validation errors */
  retryPrompt(previousResponse: string, validationErrors: ValidationError[]): string;
}
```

## File Layout

```
lib/
  task.ts               — Task interface definition + registry (getTask, listTasks)
  tasks/
    hiring.ts            — Existing hiring recommendation task
    family-history.ts    — New family history extraction task
```

## Changes to Existing Files

### `lib/test-runner.ts`
- Import `Task` instead of `schemas`, `prompts`, `conversation` directly.
- Accept a `task: Task` parameter in `runModelTests` and `runFullTestSuite`.
- All schema/prompt/context references go through `task.scenarios.*`.

### `lib/prompts.ts`
- Keep `extractJson` (utility, not task-specific).
- Move hiring-specific prompts into `lib/tasks/hiring.ts`.

### `lib/schemas.ts`
- Keep nothing task-specific here.
- Move hiring schemas into `lib/tasks/hiring.ts`.

### `lib/conversation.ts`
- Move into `lib/tasks/hiring.ts` as a private helper.

### `app/api/run/route.ts`
- Accept optional `taskId` parameter in the request body.
- Default to `'hiring'` for backward compatibility.

## What Stays in `lib/test-runner.ts`

- Run orchestration (loop over models, scenarios, runs, attempts)
- Rate limiting and backoff
- Progress callbacks
- Everything that is *not* task-specific

## Migration Steps

1. Define `Task` interface in `lib/task.ts` with registry functions.
2. Extract hiring task into `lib/tasks/hiring.ts` implementing the interface.
3. Update `lib/test-runner.ts` to accept and use a `Task` parameter.
4. Update `app/api/run/route.ts` to accept `taskId` and pass the task.
5. Write `lib/tasks/family-history.ts` — the family history extraction task.
6. Update UI pages to show task selector where relevant.
7. Update tests.

Each step is a separate commit.
