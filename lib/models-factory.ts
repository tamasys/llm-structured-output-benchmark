import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'lm_studio' | 'ollama_local' | 'ollama_cloud';
  model: LanguageModel;
  supportsStrictMode: boolean;
  isReasoningModel?: boolean;
}

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  groq?: string;
  openrouter?: string;
  lm_studio?: string;
  ollama_local?: string;
  ollama_cloud?: string;
}

export interface ModelDefinition {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'lm_studio' | 'ollama_local' | 'ollama_cloud';
  modelName: string;
  supportsStrictMode: boolean;
  isReasoningModel?: boolean;
}

export const modelDefinitions: ModelDefinition[] = [
  {
    id: 'openai-gpt5',
    name: 'GPT-5',
    provider: 'openai',
    modelName: 'gpt-5',
    supportsStrictMode: true,
    isReasoningModel: true,
  },
  {
    id: 'openai-gpt4o',
    name: 'GPT-4o',
    provider: 'openai',
    modelName: 'gpt-4o',
    supportsStrictMode: true,
  },
  {
    id: 'anthropic-sonnet',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    modelName: 'claude-sonnet-4-5-20250929',
    supportsStrictMode: true,
  },
  {
    id: 'anthropic-opus',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    modelName: 'claude-opus-4-5-20251101',
    supportsStrictMode: true,
  },
  {
    id: 'google-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    modelName: 'gemini-2.5-flash',
    supportsStrictMode: true,
  },
  {
    id: 'google-pro',
    name: 'Gemini 3 Pro',
    provider: 'google',
    modelName: 'gemini-3-pro-preview',
    supportsStrictMode: true,
  },
  {
    id: 'groq-gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'groq',
    modelName: 'openai/gpt-oss-120b',
    supportsStrictMode: false,
  },
  {
    id: 'groq-kimi-k2',
    name: 'Kimi K2',
    provider: 'groq',
    modelName: 'moonshotai/kimi-k2-instruct-0905',
    supportsStrictMode: false,
  },
  {
    id: 'groq-llama-3.3-70b',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    modelName: 'llama-3.3-70b-versatile',
    supportsStrictMode: false,
  },
  {
    id: 'openrouter-qwen3-235b',
    name: 'Qwen3 235B',
    provider: 'openrouter',
    modelName: 'qwen/qwen3-235b-a22b',
    supportsStrictMode: false,
  },
  {
    id: 'lm-studio',
    name: 'LM Studio',
    provider: 'lm_studio',
    modelName: '',
    supportsStrictMode: true,
  },
  {
    id: 'ollama-local',
    name: 'Ollama (Local)',
    provider: 'ollama_local',
    modelName: '',
    supportsStrictMode: false,
  },
  {
    id: 'ollama-cloud',
    name: 'Ollama Cloud',
    provider: 'ollama_cloud',
    modelName: '',
    supportsStrictMode: false,
  },
];

export function createModelWithKeys(definition: ModelDefinition, apiKeys: ApiKeys): ModelConfig | null {
  let model: LanguageModel;

  switch (definition.provider) {
    case 'openai': {
      const key = apiKeys.openai || process.env.OPENAI_API_KEY;
      if (!key) return null;
      const client = createOpenAI({ apiKey: key });
      model = client(definition.modelName);
      break;
    }
    case 'anthropic': {
      const key = apiKeys.anthropic || process.env.ANTHROPIC_API_KEY;
      if (!key) return null;
      const client = createAnthropic({
        apiKey: key,
        headers: {
          'anthropic-beta': 'structured-outputs-2025-11-13',
        },
      });
      model = client(definition.modelName);
      break;
    }
    case 'google': {
      const key = apiKeys.google || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!key) return null;
      const client = createGoogleGenerativeAI({ apiKey: key });
      model = client(definition.modelName);
      break;
    }
    case 'groq': {
      const key = apiKeys.groq || process.env.GROQ_API_KEY;
      if (!key) return null;
      const client = createGroq({ apiKey: key });
      model = client(definition.modelName);
      break;
    }
    case 'openrouter': {
      const key = apiKeys.openrouter || process.env.OPENROUTER_API_KEY;
      if (!key) return null;
      const client = createOpenRouter({ apiKey: key });
      model = client.chat(definition.modelName);
      break;
    }
    case 'lm_studio': {
      const baseURL = process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1';
      const client = createOpenAICompatible({ baseURL, name: 'lm_studio' });
      model = client.chatModel(definition.modelName);
      break;
    }
    case 'ollama_local': {
      const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api';
      const client = createOllama({ baseURL });
      model = client.chat(definition.modelName);
      break;
    }
    case 'ollama_cloud': {
      const key = apiKeys.ollama_cloud || process.env.OLLAMA_CLOUD_API_KEY;
      if (!key) return null;
      const client = createOllama({
        baseURL: 'https://ollama.com/api',
        headers: { Authorization: `Bearer ${key}` },
      });
      model = client.chat(definition.modelName);
      break;
    }
    default:
      return null;
  }

  return {
    id: definition.id,
    name: definition.name,
    provider: definition.provider,
    model,
    supportsStrictMode: definition.supportsStrictMode,
    isReasoningModel: definition.isReasoningModel,
  };
}

export function getModelDefinition(id: string): ModelDefinition | undefined {
  return modelDefinitions.find(m => m.id === id);
}

export function getAvailableModels(apiKeys: ApiKeys): ModelConfig[] {
  const models: ModelConfig[] = [];

  for (const definition of modelDefinitions) {
    const model = createModelWithKeys(definition, apiKeys);
    if (model) {
      models.push(model);
    }
  }

  return models;
}

export function getModelWithKeys(id: string, apiKeys: ApiKeys): ModelConfig | null {
  const definition = getModelDefinition(id);
  if (!definition) return null;
  return createModelWithKeys(definition, apiKeys);
}

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
} as const;
