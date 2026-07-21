import { registerTask, getTask, listTasks, clearTasks, type Task } from '../lib/task';
import '../lib/tasks/hiring';
import '../lib/tasks/family-history';
import { hiringTask } from '../lib/tasks/hiring';
import { familyHistoryTask } from '../lib/tasks/family-history';

describe('Task Registry', () => {
  beforeEach(() => {
    clearTasks();
  });
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
});

describe('Default Tasks', () => {
  beforeEach(() => {
    clearTasks();
    registerTask(hiringTask);
    registerTask(familyHistoryTask);
  });

  it('should have a default "hiring" task registered', () => {
    const hiring = getTask('hiring');
    expect(hiring).toBeDefined();
    expect(hiring!.id).toBe('hiring');
    expect(hiring!.scenarios.oneShot.nonStrict).toBeDefined();
    expect(hiring!.scenarios.sequential.nonStrict.step1).toBeDefined();
  });

  it('should register and retrieve the family-history task', () => {
    const task = getTask('family-history');
    expect(task).toBeDefined();
    expect(task!.id).toBe('family-history');
    expect(task!.name).toBe('Family History Extraction');
    expect(task!.systemPrompt).toContain('family history analyst');
  });
});
