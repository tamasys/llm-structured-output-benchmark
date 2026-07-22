import { NextResponse } from 'next/server';
import { models, providers } from '@/lib/models';

const envVarMap: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  opencode_go: 'OPENCODE_API_KEY',
  opencode_zen: 'OPENCODE_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  ollama_cloud: 'OLLAMA_CLOUD_API_KEY',
};

export async function GET() {
  const modelList = models.map((m) => {
    const p = m.provider as string;
    const envVar = envVarMap[p];
    const hasEnvKey = envVar ? !!process.env[envVar] : true;

    const providerInfo = (providers as Record<string, { name: string; color: string }>)[p];

    return {
      id: m.id,
      name: m.name,
      provider: p,
      providerName: providerInfo?.name || p,
      providerColor: providerInfo?.color || '#888888',
      supportsStrictMode: m.supportsStrictMode,
      hasEnvKey,
    };
  });

  return NextResponse.json({
    models: modelList,
    providers: Object.entries(providers as Record<string, { name: string; color: string }>).map(([id, data]) => ({
      id,
      ...data,
    })),
    envKeys: Object.fromEntries(
      Object.entries(envVarMap).map(([provider, envVar]) => [provider, !!process.env[envVar]])
    ),
  });
}
