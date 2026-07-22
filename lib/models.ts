import { createAnthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'lm_studio' | 'ollama_local' | 'ollama_cloud' | 'opencode_go' | 'opencode_zen' | 'nvidia';
  model: LanguageModel;
  supportsStrictMode: boolean;
  isReasoningModel?: boolean;
}

// Create Anthropic client with structured outputs beta header
const anthropic = createAnthropic({
  headers: {
    'anthropic-beta': 'structured-outputs-2025-11-13',
  },
});

// OpenAI models
const openaiModels: ModelConfig[] = [
  {
    id: 'openai-gpt5',
    name: 'GPT-5',
    provider: 'openai',
    model: openai('gpt-5'),
    supportsStrictMode: true,
    isReasoningModel: true,
  },
  {
    id: 'openai-gpt4o',
    name: 'GPT-4o',
    provider: 'openai',
    model: openai('gpt-4o'),
    supportsStrictMode: true,
  },
];

// Anthropic models
const anthropicModels: ModelConfig[] = [
  {
    id: 'anthropic-sonnet',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    model: anthropic('claude-sonnet-4-5-20250929'),
    supportsStrictMode: true,
  },
  {
    id: 'anthropic-opus',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    model: anthropic('claude-opus-4-5-20251101'),
    supportsStrictMode: true,
  },
];

// Google models
const googleModels: ModelConfig[] = [
  {
    id: 'google-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    model: google('gemini-2.5-flash'),
    supportsStrictMode: true,
  },
  {
    id: 'google-pro',
    name: 'Gemini 3 Pro',
    provider: 'google',
    model: google('gemini-3-pro-preview'),
    supportsStrictMode: true,
  },
];

const groq = createGroq();

const groqModels: ModelConfig[] = [
  {
    id: 'groq-gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'groq',
    model: groq('openai/gpt-oss-120b'),
    supportsStrictMode: false,
  },
  {
    id: 'groq-kimi-k2',
    name: 'Kimi K2',
    provider: 'groq',
    model: groq('moonshotai/kimi-k2-instruct-0905'),
    supportsStrictMode: false,
  },
  {
    id: 'groq-llama-3.3-70b',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    model: groq('llama-3.3-70b-versatile'),
    supportsStrictMode: false,
  },
];

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const openrouterModels: ModelConfig[] = [
  {
    id: 'openrouter-qwen3-235b',
    name: 'Qwen3 235B',
    provider: 'openrouter',
    model: openrouter.chat('qwen/qwen3-235b-a22b'),
    supportsStrictMode: false,
  },
];

// LM Studio models (local, no API key needed)
const lmStudio = createOpenAICompatible({
  baseURL: process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1',
  name: 'lm_studio',
});

const lmStudioModels: ModelConfig[] = [
  {
    id: 'lm-studio',
    name: 'LM Studio (local)',
    provider: 'lm_studio',
    model: lmStudio.chatModel(''),
    supportsStrictMode: true,
  },
];

// Ollama Local models (local, no API key needed)
const ollamaLocal = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

const ollamaLocalModels: ModelConfig[] = [
  {
    id: 'ollama-local',
    name: 'Ollama (Local)',
    provider: 'ollama_local',
    model: ollamaLocal.chat(''),
    supportsStrictMode: false,
  },
];

// Ollama Cloud models (requires API key)
const ollamaCloudKey = process.env.OLLAMA_CLOUD_API_KEY;
const ollamaCloud = createOllama(
  ollamaCloudKey
    ? { baseURL: 'https://ollama.com/api', headers: { Authorization: `Bearer ${ollamaCloudKey}` } }
    : { baseURL: 'https://ollama.com/api' }
);

const ollamaCloudModels: ModelConfig[] = [
  {
    id: 'ollama-cloud-llama3',
    name: 'Llama 3.2',
    provider: 'ollama_cloud',
    model: ollamaCloud.chat('llama3.2'),
    supportsStrictMode: false,
  },
  {
    id: 'ollama-cloud-qwen25',
    name: 'Qwen 2.5',
    provider: 'ollama_cloud',
    model: ollamaCloud.chat('qwen2.5'),
    supportsStrictMode: false,
  },
];

// OpenCode Go models (requires OPENCODE_API_KEY)
const opencodeKey = process.env.OPENCODE_API_KEY;
const opencodeGo = createOpenAICompatible({
  baseURL: 'https://opencode.ai/zen/go/v1',
  name: 'opencode_go',
  headers: opencodeKey ? { Authorization: `Bearer ${opencodeKey}` } : undefined,
});

const opencodeGoModels: ModelConfig[] = [
  {
    id: 'opencode-go-deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'opencode_go',
    model: opencodeGo.chatModel('deepseek-v4-flash'),
    supportsStrictMode: true,
  },
  {
    id: 'opencode-go-kimi-k3',
    name: 'Kimi K3',
    provider: 'opencode_go',
    model: opencodeGo.chatModel('kimi-k3'),
    supportsStrictMode: true,
  },
];

// OpenCode Zen models (requires OPENCODE_API_KEY)
const opencodeZen = createOpenAICompatible({
  baseURL: 'https://opencode.ai/zen/v1',
  name: 'opencode_zen',
  headers: opencodeKey ? { Authorization: `Bearer ${opencodeKey}` } : undefined,
});

const opencodeZenModels: ModelConfig[] = [
  {
    id: 'opencode-zen-deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'opencode_zen',
    model: opencodeZen.chatModel('deepseek-v4-flash'),
    supportsStrictMode: true,
  },
];

// NVIDIA models (requires NVIDIA_API_KEY)
const nvidiaKey = process.env.NVIDIA_API_KEY;
const nvidia = createOpenAICompatible({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  name: 'nvidia',
  headers: nvidiaKey ? { Authorization: `Bearer ${nvidiaKey}` } : undefined,
});

const nvidiaModels: ModelConfig[] = [
  {
    id: 'nvidia-nemotron-ultra',
    name: 'Nemotron 3 Ultra',
    provider: 'nvidia',
    model: nvidia.chatModel('nvidia/nemotron-3-ultra-550b-a55b'),
    supportsStrictMode: true,
  },
  {
    id: 'nvidia-llama-nemotron',
    name: 'Llama 3.3 Nemotron Super',
    provider: 'nvidia',
    model: nvidia.chatModel('nvidia/llama-3.3-nemotron-super-49b-v1'),
    supportsStrictMode: true,
  },
];

// All models
export const models: ModelConfig[] = [
  ...openaiModels,
  ...anthropicModels,
  ...googleModels,
  ...groqModels,
  ...openrouterModels,
  ...lmStudioModels,
  ...ollamaLocalModels,
  ...ollamaCloudModels,
  ...opencodeGoModels,
  ...opencodeZenModels,
  ...nvidiaModels,
];

export type ModelId = typeof models[number]['id'];

export function getModel(id: string): ModelConfig | undefined {
  return models.find(m => m.id === id);
}

export function getModelsByProvider(provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'lm_studio' | 'ollama_local' | 'ollama_cloud' | 'opencode_go' | 'opencode_zen' | 'nvidia'): ModelConfig[] {
  return models.filter(m => m.provider === provider);
}

export function getEnabledModels(): ModelConfig[] {
  // For now, all models are enabled
  // Later we can add a config to disable specific models
  return models;
}

// Provider metadata for UI
export const providers = {
  openai: {
    name: 'OpenAI',
    color: '#10a37f',
  },
  anthropic: {
    name: 'Anthropic',
    color: '#d97706',
  },
  google: {
    name: 'Google',
    color: '#4285f4',
  },
  groq: {
    name: 'Groq',
    color: '#f55036',
  },
  openrouter: {
    name: 'OpenRouter',
    color: '#6366f1',
  },
  lm_studio: {
    name: 'LM Studio',
    color: '#a0784a',
  },
  ollama_local: {
    name: 'Ollama (Local)',
    color: '#7c3aed',
  },
  ollama_cloud: {
    name: 'Ollama Cloud',
    color: '#9333ea',
  },
  opencode_go: {
    name: 'OpenCode Go',
    color: '#e11d48',
  },
  opencode_zen: {
    name: 'OpenCode Zen',
    color: '#be185d',
  },
  nvidia: {
    name: 'NVIDIA',
    color: '#76b900',
  },
} as const;
