import { createAnthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'lm_studio';
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
    name: 'LM Studio',
    provider: 'lm_studio',
    model: lmStudio.chatModel(''),
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
];

export type ModelId = typeof models[number]['id'];

export function getModel(id: string): ModelConfig | undefined {
  return models.find(m => m.id === id);
}

export function getModelsByProvider(provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'lm_studio'): ModelConfig[] {
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
} as const;
