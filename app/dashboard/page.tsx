import Link from 'next/link';
import { listRecentRuns, loadTestRun } from '@/lib/storage';
import { models, providers } from '@/lib/models';
import { Card, SuccessRate, ProviderBadge, Button, ScenarioBadge } from '@/components/ui';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const recentRuns = listRecentRuns(5);
  const latestRun = recentRuns.length > 0 ? loadTestRun(recentRuns[0].id) : null;
  const previousRun = recentRuns.length > 1 ? loadTestRun(recentRuns[1].id) : null;

  // Calculate per-model stats from latest run
  const modelStats = models.map((model) => {
    if (!latestRun?.results[model.id]) {
      return {
        ...model,
        providerName: providers[model.provider].name,
        providerColor: providers[model.provider].color,
        hasData: false,
        overallSuccess: 0,
        bestScenario: null as number | null,
        worstScenario: null as number | null,
        previousSuccess: null as number | null,
      };
    }

    const modelResults = latestRun.results[model.id];
    let totalRuns = 0;
    let successfulRuns = 0;
    let bestScenario: { num: number; rate: number; time: number } | null = null;
    let worstScenario: { num: number; rate: number; time: number } | null = null;

    for (const [scenario, result] of Object.entries(modelResults)) {
      const scenarioNum = parseInt(scenario);
      totalRuns += result.runs.length;
      successfulRuns += result.runs.filter((r) => r.success).length;

      const rate = result.summary.successRate;
      const time = result.summary.averageDurationMs;

      const isBetter = !bestScenario ||
        rate > bestScenario.rate ||
        (rate === bestScenario.rate && time < bestScenario.time);

      const isWorse = !worstScenario ||
        rate < worstScenario.rate ||
        (rate === worstScenario.rate && time > worstScenario.time);

      if (isBetter) {
        bestScenario = { num: scenarioNum, rate, time };
      }
      if (isWorse) {
        worstScenario = { num: scenarioNum, rate, time };
      }
    }

    const overallSuccess = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

    // Get previous run stats for trend
    let previousSuccess: number | null = null;
    if (previousRun?.results[model.id]) {
      const prevResults = previousRun.results[model.id];
      let prevTotal = 0;
      let prevSuccess = 0;
      for (const result of Object.values(prevResults)) {
        prevTotal += result.runs.length;
        prevSuccess += result.runs.filter((r) => r.success).length;
      }
      previousSuccess = prevTotal > 0 ? (prevSuccess / prevTotal) * 100 : 0;
    }

    return {
      ...model,
      providerName: providers[model.provider].name,
      providerColor: providers[model.provider].color,
      hasData: true,
      overallSuccess,
      bestScenario: bestScenario?.num ?? null,
      worstScenario: worstScenario?.num ?? null,
      previousSuccess,
    };
  });

  // Group models by provider
  const modelsByProvider = modelStats.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<string, typeof modelStats>);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {latestRun
              ? `Last run: ${new Date(latestRun.timestamp).toLocaleString()}`
              : 'No test runs yet'}
          </p>
        </div>
        <Link href="/run">
          <Button size="lg">Run Tests</Button>
        </Link>
      </div>

      {/* Recent Runs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Test Runs
        </h2>
        {recentRuns.length > 0 ? (
          <Card>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/results/${run.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {new Date(run.timestamp).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(run.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {run.summary.models.slice(0, 3).map((modelId) => {
                        const model = models.find((m) => m.id === modelId);
                        return model ? (
                          <ProviderBadge
                            key={modelId}
                            provider={model.provider}
                            size="sm"
                          />
                        ) : null;
                      })}
                      {run.summary.models.length > 3 && (
                        <span className="text-sm text-gray-500">
                          +{run.summary.models.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {run.summary.totalTests} tests
                    </span>
                    <SuccessRate value={run.summary.successRate} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No test runs yet. Start your first benchmark!
            </p>
            <Link href="/run">
              <Button>Run Tests</Button>
            </Link>
          </Card>
        )}
      </div>

      {/* Model Cards by Provider */}
      {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
        <div key={provider}>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {providers[provider as keyof typeof providers].name}
            </h2>
            <div
              className="h-1 flex-1 rounded"
              style={{
                backgroundColor: `${providers[provider as keyof typeof providers].color}30`,
              }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providerModels.map((model) => (
              <Card key={model.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {model.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {model.id}
                    </p>
                  </div>
                  {model.hasData && (
                    <SuccessRate value={model.overallSuccess} showLabel={false} />
                  )}
                </div>

                {model.hasData ? (
                  <div className="space-y-3">
                    {model.bestScenario !== model.worstScenario ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Best scenario:
                          </span>
                          {model.bestScenario && (
                            <ScenarioBadge scenario={model.bestScenario} />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Worst scenario:
                          </span>
                          {model.worstScenario && (
                            <ScenarioBadge scenario={model.worstScenario} />
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        All scenarios: {model.overallSuccess.toFixed(0)}%
                      </div>
                    )}
                    {model.previousSuccess !== null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          vs previous:
                        </span>
                        <span
                          className={
                            model.overallSuccess > model.previousSuccess
                              ? 'text-green-600'
                              : model.overallSuccess < model.previousSuccess
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }
                        >
                          {model.overallSuccess > model.previousSuccess && '+'}
                          {(model.overallSuccess - model.previousSuccess).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No data yet. Run tests to see results.
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
