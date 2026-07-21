import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadTestRun, calculateScenarioSummary, type ScenarioResult, type RunResult } from '@/lib/storage';
import { models } from '@/lib/models';
import { Card, SuccessRate, Button, ScenarioBadge } from '@/components/ui';
import { ResultsActivityLog } from '@/components/ResultsActivityLog';
import { RunProgressBars } from '@/components/RunProgressBars';
import { SuccessRateChart } from '@/components/SuccessRateChart';
import { CostTimeScatterChart } from '@/components/CostTimeScatterChart';
import { modelPricing } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

interface ModelScenarioData {
  modelId: string;
  modelName: string;
  provider: string;
  scenario: number;
  result: ScenarioResult;
}

function ResultCard({
  modelName,
  scenario,
  result,
  maxRetries
}: {
  modelName: string;
  scenario: number;
  result: ScenarioResult;
  maxRetries: number;
}) {
  const isSequential = scenario === 3 || scenario === 4;
  const successCount = result.runs.filter(r => r.success).length;
  const totalRuns = result.runs.length;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 dark:text-white">{modelName}</span>
          <ScenarioBadge scenario={scenario} />
        </div>
        <span className="text-xs text-gray-500">
          {successCount}/{totalRuns} passed
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div>
          <span className="text-gray-500">1st try:</span>
          <span className="ml-1 font-medium">{result.summary.firstAttemptSuccessRate.toFixed(0)}%</span>
        </div>
        <div>
          <span className="text-gray-500">Time:</span>
          <span className="ml-1 font-medium">{(result.summary.averageDurationMs / 1000).toFixed(1)}s</span>
        </div>
        <div>
          <span className="text-gray-500">Tokens:</span>
          <span className="ml-1 font-medium">{result.summary.averageTokensPerSuccess.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      <RunProgressBars
        runs={result.runs}
        maxRetries={maxRetries}
        isSequential={isSequential}
      />
    </div>
  );
}

export default async function ResultsPage({ params }: Props) {
  const { id } = await params;
  const run = loadTestRun(id);

  if (!run) {
    notFound();
  }

  const allData: ModelScenarioData[] = [];
  for (const [modelId, modelResults] of Object.entries(run.results)) {
    const model = models.find(m => m.id === modelId);
    if (!model) continue;

    for (const [scenario, result] of Object.entries(modelResults)) {
      allData.push({
        modelId,
        modelName: model.name,
        provider: model.provider,
        scenario: parseInt(scenario),
        result,
      });
    }
  }

  const scenarios = [...new Set(allData.map(d => d.scenario))].sort((a, b) => a - b);
  const modelIds = [...new Set(allData.map(d => d.modelId))];

  const scenarioLabels: Record<number, string> = {
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

  const scatterData = allData.map(d => {
    const totalCost = d.result.runs.reduce((sum, run) => sum + calculateRunCost(d.modelId, run), 0);
    const avgCost = totalCost / d.result.runs.length;
    const avgTime = d.result.summary.averageDurationMs / 1000;

    return {
      modelId: d.modelId,
      modelName: d.modelName,
      scenario: d.scenario,
      scenarioLabel: scenarioLabels[d.scenario],
      timeSeconds: avgTime,
      costDollars: avgCost,
      efficiency: avgTime > 0 ? avgCost / avgTime : 0,
      tokens: Math.round(d.result.summary.averageTokensPerSuccess),
    };
  });

  const numScenarios = scenarios.length;
  const gridCols = numScenarios === 1 ? 'grid-cols-1' :
                   numScenarios === 2 ? 'grid-cols-2' :
                   numScenarios === 3 ? 'grid-cols-3' :
                   'grid-cols-4';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Test Results
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {new Date(run.timestamp).toLocaleString()} • {run.duration ? `${(run.duration / 1000).toFixed(1)}s total` : 'N/A'}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/run">
            <Button variant="secondary">Run Again</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Tests</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {run.summary.totalTests}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Passed</p>
            <p className="text-2xl font-bold text-green-600">
              {run.summary.passed}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
            <p className="text-2xl font-bold text-red-600">
              {run.summary.failed}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Success Rate</p>
            <SuccessRate value={run.summary.successRate} showLabel={false} />
          </div>
        </div>

        {allData.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
              Success Rate by Model & Scenario
            </h3>
            <SuccessRateChart
              data={modelIds.map(modelId => {
                const model = models.find(m => m.id === modelId);
                const scenarioData: Record<number, { firstAttempt: number; afterRetry1: number; afterRetry2: number; afterRetry3: number }> = {};

                scenarios.forEach(scenario => {
                  const d = allData.find(x => x.modelId === modelId && x.scenario === scenario);
                  if (d) {
                    const isSequential = scenario === 3 || scenario === 4;
                    const recalculated = calculateScenarioSummary(d.result.runs, isSequential);
                    scenarioData[scenario] = {
                      firstAttempt: recalculated.firstAttemptSuccessRate,
                      afterRetry1: recalculated.afterRetry1SuccessRate,
                      afterRetry2: recalculated.afterRetry2SuccessRate,
                      afterRetry3: recalculated.afterRetry3SuccessRate,
                    };
                  }
                });

                return {
                  modelId,
                  modelName: model?.name || modelId,
                  scenarios: scenarioData,
                };
              })}
              scenariosToShow={scenarios}
            />
          </div>
        )}

        {scatterData.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
            <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
              Cost vs Time
            </h3>
            <CostTimeScatterChart data={scatterData} />
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Results by Model
        </h2>

        <div className={`grid ${gridCols} gap-3`}>
          {modelIds.map(modelId =>
            scenarios.map(scenario => {
              const data = allData.find(d => d.modelId === modelId && d.scenario === scenario);
              if (!data) return <div key={`${modelId}-${scenario}`} className="border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-3 opacity-30" />;

              return (
                <ResultCard
                  key={`${modelId}-${scenario}`}
                  modelName={data.modelName}
                  scenario={scenario}
                  result={data.result}
                  maxRetries={run.config.maxRetries}
                />
              );
            })
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Configuration
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Models:</span>
            <span className="ml-2 text-gray-900 dark:text-white">
              {run.config.models.length}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Scenarios:</span>
            <span className="ml-2 text-gray-900 dark:text-white">
              {run.config.scenarios.join(', ')}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Runs/scenario:</span>
            <span className="ml-2 text-gray-900 dark:text-white">
              {run.config.runsPerScenario}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Temperature:</span>
            <span className="ml-2 text-gray-900 dark:text-white">
              {run.config.temperature}
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Activity Log
        </h2>
        <ResultsActivityLog
          results={run.results}
          models={models.map((m) => ({ id: m.id, name: m.name }))}
        />
      </Card>
    </div>
  );
}
