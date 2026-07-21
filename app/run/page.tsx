'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, ProviderBadge, ScenarioBadge, SuccessRate } from '@/components/ui';
import { ActivityLog } from '@/components/ActivityLog';
import { SuccessRateChart } from '@/components/SuccessRateChart';
import { CostTimeScatterChart } from '@/components/CostTimeScatterChart';
import { modelPricing } from '@/lib/pricing';
import { useApiKeys, type ApiKeys } from '@/lib/api-keys-context';
import { listTasks } from '@/lib/task';
import type { ScenarioResult, RunResult } from '@/lib/storage';

interface Model {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  hasEnvKey: boolean;
}

type AttemptStatus = 'pending' | 'running' | 'failed' | 'success' | 'skipped';

interface StepProgress {
  stepNumber: number;
  stepName: string;
  attempts: AttemptStatus[];
}

interface RunProgress {
  run: number;
  attempts?: AttemptStatus[];
  steps?: StepProgress[];
  final: 'pending' | 'success' | 'failed' | 'skipped';
}

interface ScenarioProgress {
  modelId: string;
  modelName: string;
  scenario: number;
  isSequential: boolean;
  isSkipped?: boolean;
  runs: RunProgress[];
  completedRuns: number;
  totalRuns: number;
}

interface LogEntry {
  timestamp: string;
  modelId: string;
  modelName: string;
  scenario: number;
  runNumber: number;
  attemptNumber: number;
  type: 'request' | 'response' | 'validation';
  prompt?: string;
  response?: string;
  validationResult?: {
    success: boolean;
    errors?: Array<{ path: string[]; message: string; code: string }>;
  };
}

interface DetailedProgress {
  currentModel: string;
  currentModelName: string;
  currentScenario: number;
  currentRun: number;
  currentStep?: number;
  currentStepName?: string;
  currentAttempt: number;
  currentStatus: 'running' | 'success' | 'failed' | 'retrying';
  statusMessage: string;
  scenarios: ScenarioProgress[];
  totalScenarios: number;
  completedScenarios: number;
  maxAttempts: number;
  logEntries: LogEntry[];
}

interface RunStatus {
  id: string;
  status: 'running' | 'complete' | 'cancelled' | 'error';
  progress: DetailedProgress;
  error?: string;
  summary?: {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
  };
  results?: {
    [modelId: string]: {
      [scenarioNumber: string]: ScenarioResult;
    };
  };
  config?: {
    models: string[];
    scenarios: number[];
    runsPerScenario: number;
    temperature: number;
    maxRetries: number;
  };
}

const scenarioInfo = [
  { id: 1, name: 'One-shot, Non-strict', description: 'Single request with JSON format in prompt' },
  { id: 2, name: 'One-shot, Strict', description: 'Single request with generateObject' },
  { id: 3, name: 'Sequential, Non-strict', description: 'Multi-step with JSON format in prompt' },
  { id: 4, name: 'Sequential, Strict', description: 'Multi-step with generateObject' },
];

function AttemptCell({ status, title }: { status: AttemptStatus; title: string }) {
  const colors: Record<AttemptStatus, string> = {
    pending: 'bg-gray-200 dark:bg-gray-700',
    running: 'bg-blue-500 animate-pulse',
    failed: 'bg-red-500',
    success: 'bg-green-500',
    skipped: 'bg-gray-300 dark:bg-gray-600',
  };
  return (
    <div
      className={`h-4 flex-1 ${colors[status]} first:rounded-l last:rounded-r`}
      title={title}
    />
  );
}

function OneShotProgressRow({ run }: { run: RunProgress }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-10 shrink-0">R{run.run}</span>
      <div className="flex-1 flex gap-px">
        {run.attempts?.map((status, idx) => (
          <AttemptCell
            key={idx}
            status={status}
            title={`Run ${run.run}, Attempt ${idx + 1}: ${status}`}
          />
        ))}
      </div>
      <span className={`text-xs w-8 text-right ${run.final === 'success' ? 'text-green-600' : run.final === 'failed' ? 'text-red-600' : 'text-gray-400'}`}>
        {run.final === 'success' ? 'Pass' : run.final === 'failed' ? 'Fail' : '...'}
      </span>
    </div>
  );
}

function SequentialProgressRow({ run }: { run: RunProgress }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-10 shrink-0">R{run.run}</span>
      <div className="flex-1 flex gap-1">
        {run.steps?.map((step, stepIdx) => (
          <div key={stepIdx} className="flex-1">
            <div className="flex gap-px">
              {step.attempts.map((status, attemptIdx) => (
                <AttemptCell
                  key={attemptIdx}
                  status={status}
                  title={`Run ${run.run}, Step ${stepIdx + 1} (${step.stepName}), Attempt ${attemptIdx + 1}: ${status}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className={`text-xs w-8 text-right ${run.final === 'success' ? 'text-green-600' : run.final === 'failed' ? 'text-red-600' : 'text-gray-400'}`}>
        {run.final === 'success' ? 'Pass' : run.final === 'failed' ? 'Fail' : '...'}
      </span>
    </div>
  );
}

function ScenarioProgressCard({ scenarioProgress, isCurrent, isStarted }: { scenarioProgress: ScenarioProgress; isCurrent: boolean; isStarted: boolean }) {
  const hasAnyProgress = scenarioProgress.runs.some(r =>
    r.final !== 'pending' && r.final !== 'skipped' ||
    r.attempts?.some(a => a !== 'pending' && a !== 'skipped') ||
    r.steps?.some(s => s.attempts.some(a => a !== 'pending' && a !== 'skipped'))
  );
  const showAsNotStarted = !isStarted && !hasAnyProgress && !scenarioProgress.isSkipped;

  if (scenarioProgress.isSkipped) {
    return (
      <div className="border rounded-lg p-3 border-gray-200 dark:border-gray-700 opacity-50 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 px-2 py-1 rounded">
            Strict mode not supported
          </span>
        </div>
        <div className="flex items-center justify-between mb-2 opacity-50">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-900 dark:text-white">{scenarioProgress.modelName}</span>
            <ScenarioBadge scenario={scenarioProgress.scenario} />
          </div>
          <span className="text-xs text-gray-500">
            Skipped
          </span>
        </div>
        <div className="h-12"></div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 transition-all ${
      isCurrent
        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
        : showAsNotStarted
          ? 'border-gray-200 dark:border-gray-700 opacity-40'
          : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 dark:text-white">{scenarioProgress.modelName}</span>
          <ScenarioBadge scenario={scenarioProgress.scenario} />
        </div>
        <span className="text-xs text-gray-500">
          {scenarioProgress.completedRuns}/{scenarioProgress.totalRuns} runs
        </span>
      </div>

      {scenarioProgress.isSequential && (
        <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
          <span className="w-10 shrink-0"></span>
          <div className="flex-1 flex gap-1">
            <div className="flex-1 text-center">Step 1</div>
            <div className="flex-1 text-center">Step 2</div>
            <div className="flex-1 text-center">Step 3</div>
          </div>
          <span className="w-8"></span>
        </div>
      )}

      <div className="space-y-0.5">
        {scenarioProgress.runs.map((run) =>
          scenarioProgress.isSequential ? (
            <SequentialProgressRow key={run.run} run={run} />
          ) : (
            <OneShotProgressRow key={run.run} run={run} />
          )
        )}
      </div>
    </div>
  );
}

const scenarioLabelsMap: Record<number, string> = {
  1: 'One-Shot Non-Strict',
  2: 'One-Shot Strict',
  3: 'Sequential Non-Strict',
  4: 'Sequential Strict',
};

function calculateRunCost(modelId: string, runResult: RunResult): number {
  const pricing = modelPricing[modelId];
  if (!pricing) return 0;

  let totalCost = 0;

  if (runResult.steps) {
    for (const step of runResult.steps) {
      for (const attempt of step.attempts) {
        totalCost += (attempt.inputTokens || 0) * pricing.input;
        totalCost += (attempt.outputTokens || 0) * pricing.output;
      }
    }
  } else {
    for (const attempt of runResult.attempts) {
      totalCost += (attempt.inputTokens || 0) * pricing.input;
      totalCost += (attempt.outputTokens || 0) * pricing.output;
    }
  }

  return totalCost;
}

function LiveChartsSection({ runStatus, models }: { runStatus: RunStatus; models: Model[] }) {
  const chartData = useMemo(() => {
    if (!runStatus.results) return { successRateData: [], scatterData: [] };

    const allData: Array<{
      modelId: string;
      modelName: string;
      scenario: number;
      result: ScenarioResult;
    }> = [];

    for (const [modelId, modelResults] of Object.entries(runStatus.results)) {
      const model = models.find(m => m.id === modelId);
      if (!model) continue;

      for (const [scenario, result] of Object.entries(modelResults)) {
        if (result.runs.length > 0) {
          allData.push({
            modelId,
            modelName: model.name,
            scenario: parseInt(scenario),
            result,
          });
        }
      }
    }

    const scenarios = [...new Set(allData.map(d => d.scenario))].sort((a, b) => a - b);
    const modelIds = [...new Set(allData.map(d => d.modelId))];

    const successRateData = modelIds.map(modelId => {
      const model = models.find(m => m.id === modelId);
      const scenarioData: Record<number, { firstAttempt: number; afterRetry1: number; afterRetry2: number; afterRetry3: number }> = {};

      scenarios.forEach(scenario => {
        const d = allData.find(x => x.modelId === modelId && x.scenario === scenario);
        if (d) {
          scenarioData[scenario] = {
            firstAttempt: d.result.summary.firstAttemptSuccessRate,
            afterRetry1: d.result.summary.afterRetry1SuccessRate,
            afterRetry2: d.result.summary.afterRetry2SuccessRate,
            afterRetry3: d.result.summary.afterRetry3SuccessRate,
          };
        }
      });

      return {
        modelId,
        modelName: model?.name || modelId,
        scenarios: scenarioData,
      };
    });

    const scatterData = allData.map(d => {
      const totalCost = d.result.runs.reduce((sum, run) => sum + calculateRunCost(d.modelId, run), 0);
      const avgCost = d.result.runs.length > 0 ? totalCost / d.result.runs.length : 0;
      const avgTime = d.result.summary.averageDurationMs / 1000;

      return {
        modelId: d.modelId,
        modelName: d.modelName,
        scenario: d.scenario,
        scenarioLabel: scenarioLabelsMap[d.scenario],
        timeSeconds: avgTime,
        costDollars: avgCost,
        efficiency: avgTime > 0 ? avgCost / avgTime : 0,
        tokens: Math.round(d.result.summary.averageTokensPerSuccess || 0),
      };
    });

    return { successRateData, scatterData, scenarios };
  }, [runStatus.results, models]);

  if (chartData.successRateData.length === 0) return null;

  return (
    <>
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Live Success Rates
        </h2>
        <SuccessRateChart
          data={chartData.successRateData}
          scenariosToShow={chartData.scenarios || []}
        />
      </Card>

      {chartData.scatterData.length > 0 && chartData.scatterData.some(d => d.timeSeconds > 0) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Live Cost vs Time
          </h2>
          <CostTimeScatterChart data={chartData.scatterData} />
        </Card>
      )}
    </>
  );
}

export default function RunTestsPage() {
  const router = useRouter();
  const { getHeaders, hasKey } = useApiKeys();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [selectedScenarios, setSelectedScenarios] = useState<Set<number>>(new Set([1, 2, 3, 4]));
  const [runsPerScenario, setRunsPerScenario] = useState(3);
  const [isRunning, setIsRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tasks = useMemo(() => listTasks(), []);
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id || 'hiring');

  const modelHasKey = useCallback((model: Model) => {
    return model.hasEnvKey || hasKey(model.provider as keyof ApiKeys);
  }, [hasKey]);

  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => {
        setModels(data.models);
      })
      .catch((err) => {
        setError('Failed to load models');
        console.error(err);
      });

    fetch('/api/run')
      .then((res) => res.json())
      .then((data) => {
        const runningRun = data.runs?.find((r: { status: string }) => r.status === 'running');
        if (runningRun) {
          setRunId(runningRun.id);
          setIsRunning(true);
          setRunStatus(runningRun);
        }
      })
      .catch((err) => {
        console.error('Failed to check for active runs:', err);
      });
  }, []);

  useEffect(() => {
    if (models.length === 0) return;
    const modelsWithKeys = models.filter((m) => modelHasKey(m));
    setSelectedModels(new Set(modelsWithKeys.map((m) => m.id)));
  }, [models, modelHasKey]);

  useEffect(() => {
    if (!runId || !isRunning) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/run/${runId}`);
        const status: RunStatus = await res.json();
        setRunStatus(status);

        if (status.status === 'complete') {
          setIsRunning(false);
          setTimeout(() => {
            router.push(`/results/${runId}`);
          }, 1500);
        } else if (status.status === 'error' || status.status === 'cancelled') {
          setIsRunning(false);
          if (status.error) {
            setError(status.error);
          }
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [runId, isRunning, router]);

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  }, []);

  const toggleScenario = useCallback((scenarioId: number) => {
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) {
        next.delete(scenarioId);
      } else {
        next.add(scenarioId);
      }
      return next;
    });
  }, []);

  const selectAllModels = useCallback(() => {
    const modelsWithKeys = models.filter((m) => modelHasKey(m));
    setSelectedModels(new Set(modelsWithKeys.map((m) => m.id)));
  }, [models, modelHasKey]);

  const deselectAllModels = useCallback(() => {
    setSelectedModels(new Set());
  }, []);

  const startRun = async () => {
    if (selectedModels.size === 0 || selectedScenarios.size === 0) {
      setError('Please select at least one model and one scenario');
      return;
    }

    setError(null);
    setIsRunning(true);
    setRunStatus(null);

    try {
      const apiKeyHeaders = getHeaders();
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiKeyHeaders,
        },
        body: JSON.stringify({
          models: Array.from(selectedModels),
          scenarios: Array.from(selectedScenarios),
          runsPerScenario,
          taskId: selectedTaskId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start test run');
      }

      const data = await res.json();
      setRunId(data.runId);
    } catch (err) {
      setIsRunning(false);
      setError(err instanceof Error ? err.message : 'Failed to start test run');
    }
  };

  const cancelRun = async () => {
    if (!runId) return;

    try {
      await fetch(`/api/run/${runId}`, { method: 'DELETE' });
      setIsRunning(false);
    } catch (err) {
      console.error('Error cancelling run:', err);
    }
  };

  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, Model[]>);

  const totalTests = selectedModels.size * selectedScenarios.size * runsPerScenario;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Run Tests
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          {error}
          {error.includes('API keys') && (
            <Link href="/settings" className="ml-2 underline hover:no-underline">
              Go to Settings
            </Link>
          )}
        </div>
      )}

      {isRunning && runStatus && runStatus.progress?.scenarios && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Running Tests...
              </h2>
              <Button variant="danger" onClick={cancelRun}>
                Cancel
              </Button>
            </div>

            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                {runStatus.progress.completedScenarios} / {runStatus.progress.totalScenarios} scenarios complete
              </span>
              <span>
                Run {runStatus.progress.currentRun}
                {runStatus.progress.currentStep && ` • Step ${runStatus.progress.currentStep}`}
                {' '}• Attempt {runStatus.progress.currentAttempt}
              </span>
            </div>

            {/* Status chyron */}
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
              runStatus.progress.currentStatus === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
              runStatus.progress.currentStatus === 'retrying' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
              runStatus.progress.currentStatus === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
              'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {runStatus.progress.statusMessage}
            </div>

            {(() => {
              const uniqueScenarios = [...new Set(runStatus.progress.scenarios.map(s => s.scenario))];
              const numScenarios = uniqueScenarios.length;
              const gridCols = numScenarios === 1 ? 'grid-cols-1' :
                               numScenarios === 2 ? 'grid-cols-2' :
                               numScenarios === 3 ? 'grid-cols-3' :
                               'grid-cols-4';

              const scenarioOrder = runStatus.progress.scenarios.reduce((acc, s, idx) => {
                const key = `${s.modelId}-${s.scenario}`;
                if (!(key in acc)) acc[key] = idx;
                return acc;
              }, {} as Record<string, number>);

              const currentIdx = scenarioOrder[`${runStatus.progress.currentModel}-${runStatus.progress.currentScenario}`] ?? 0;

              return (
                <div className={`grid ${gridCols} gap-3 max-h-[60vh] overflow-y-auto`}>
                  {runStatus.progress.scenarios.map((sp) => {
                    const idx = scenarioOrder[`${sp.modelId}-${sp.scenario}`] ?? 0;
                    const isCurrent = sp.modelId === runStatus.progress.currentModel && sp.scenario === runStatus.progress.currentScenario;
                    const isStarted = idx <= currentIdx;

                    return (
                      <ScenarioProgressCard
                        key={`${sp.modelId}-${sp.scenario}`}
                        scenarioProgress={sp}
                        isCurrent={isCurrent}
                        isStarted={isStarted}
                      />
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span>Success</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span>Failed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span>Running</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded" />
                <span>Skipped</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                <span>Pending</span>
              </div>
            </div>

            {runStatus.status === 'complete' && runStatus.summary && (
              <div className="flex items-center gap-4 pt-2">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Complete!
                </span>
                <SuccessRate value={runStatus.summary.successRate} />
                <span className="text-gray-500 text-sm">
                  Redirecting to results...
                </span>
              </div>
            )}

            <div className="mt-4">
              <ActivityLog
                entries={runStatus.progress.logEntries || []}
                modelName={runStatus.progress.currentModel}
                scenario={runStatus.progress.currentScenario}
              />
            </div>
          </div>
        </Card>
      )}

      {isRunning && runStatus?.results && Object.keys(runStatus.results).length > 0 && (
        <LiveChartsSection runStatus={runStatus} models={models} />
      )}

      {!isRunning && (
        <>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Models
              </h2>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={selectAllModels}>
                  Select All
                </Button>
                <Button variant="secondary" size="sm" onClick={deselectAllModels}>
                  Deselect All
                </Button>
              </div>
            </div>

            {models.length > 0 && models.some((m) => !modelHasKey(m)) && (
              <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>
                  Some models are disabled because no API key is configured.{' '}
                  <Link href="/settings" className="underline hover:no-underline font-medium">
                    Add keys in Settings
                  </Link>
                  {' '}to enable them.
                </p>
              </div>
            )}

            <div className="space-y-6">
              {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                <div key={provider}>
                  <div className="flex items-center gap-2 mb-3">
                    <ProviderBadge provider={provider as 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter'} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {providerModels.map((model) => {
                      const hasApiKey = modelHasKey(model);
                      return (
                        <label
                          key={model.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            !hasApiKey
                              ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                              : selectedModels.has(model.id)
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedModels.has(model.id)}
                            onChange={() => hasApiKey && toggleModel(model.id)}
                            disabled={!hasApiKey}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {model.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {model.id}
                            </p>
                          </div>
                          {!hasApiKey && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              No API key
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Scenarios
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scenarioInfo.map((scenario) => (
                <label
                  key={scenario.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedScenarios.has(scenario.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedScenarios.has(scenario.id)}
                    onChange={() => toggleScenario(scenario.id)}
                    className="w-4 h-4 mt-1 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <ScenarioBadge scenario={scenario.id} />
                      <p className="font-medium text-gray-900 dark:text-white">
                        {scenario.name}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {scenario.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Configuration
            </h2>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2">
                <span className="text-gray-700 dark:text-gray-300">Task:</span>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-gray-700 dark:text-gray-300">Runs per scenario:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={runsPerScenario}
                  onChange={(e) => setRunsPerScenario(parseInt(e.target.value) || 3)}
                  className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </label>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {totalTests}
                </span>{' '}
                total tests ({selectedModels.size} models x {selectedScenarios.size} scenarios x {runsPerScenario} runs)
              </div>
              <Button
                size="lg"
                onClick={startRun}
                disabled={selectedModels.size === 0 || selectedScenarios.size === 0}
              >
                Start Benchmark
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
