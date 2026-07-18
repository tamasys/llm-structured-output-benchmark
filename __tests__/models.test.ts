// @ai-sdk/openai-compatible is ESM-only; other AI SDK packages are CJS
jest.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: jest.fn(() => ({
    chatModel: jest.fn(() => ({ id: 'lm-studio-model', provider: 'lm_studio' })),
  })),
}));

jest.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: jest.fn(() => ({
    chatModel: jest.fn(() => ({ id: 'lm-studio-model', provider: 'lm_studio' })),
  })),
}));

import {
  models,
  getModel,
  getModelsByProvider,
  getEnabledModels,
  providers,
} from '../lib/models';

describe('Model Configuration', () => {
  describe('models array', () => {
    it('should contain expected number of models', () => {
      expect(models).toHaveLength(15);
    });

    it('should have models from all providers', () => {
      const providerCounts = models.reduce((acc, model) => {
        acc[model.provider] = (acc[model.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(providerCounts.openai).toBe(2);
      expect(providerCounts.anthropic).toBe(2);
      expect(providerCounts.google).toBe(2);
      expect(providerCounts.groq).toBe(3);
      expect(providerCounts.openrouter).toBe(1);
      expect(providerCounts.lm_studio).toBe(1);
      expect(providerCounts.ollama_local).toBe(1);
      expect(providerCounts.ollama_cloud).toBe(1);
      expect(providerCounts.opencode_go).toBe(1);
      expect(providerCounts.opencode_zen).toBe(1);
    });

    it('should contain an LM Studio model', () => {
      const lmStudio = models.find(m => m.provider === 'lm_studio');
      expect(lmStudio).toBeDefined();
      expect(lmStudio!.id).toBe('lm-studio');
    });

    it('should have correct strict mode support', () => {
      const strictModeModels = models.filter(m => m.supportsStrictMode);
      const nonStrictModeModels = models.filter(m => !m.supportsStrictMode);

      expect(strictModeModels.length).toBeGreaterThan(0);
      expect(nonStrictModeModels.every(m => ['groq', 'openrouter', 'ollama_local', 'ollama_cloud'].includes(m.provider))).toBe(true);
    });

    it('should have unique model IDs', () => {
      const ids = models.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid model structure', () => {
      models.forEach((model) => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('model');
        expect(model).toHaveProperty('supportsStrictMode');

        expect(typeof model.id).toBe('string');
        expect(typeof model.name).toBe('string');
        expect(['openai', 'anthropic', 'google', 'groq', 'openrouter', 'lm_studio', 'ollama_local', 'ollama_cloud', 'opencode_go', 'opencode_zen']).toContain(model.provider);
        expect(typeof model.supportsStrictMode).toBe('boolean');
      });
    });

    it('should have LM Studio model with strict mode support', () => {
      const lmStudio = models.find(m => m.provider === 'lm_studio');
      expect(lmStudio).toBeDefined();
      expect(lmStudio!.supportsStrictMode).toBe(true);
    });

    it('should contain an Ollama Local model', () => {
      const ollama = models.find(m => m.provider === 'ollama_local');
      expect(ollama).toBeDefined();
      expect(ollama!.id).toBe('ollama-local');
      expect(ollama!.supportsStrictMode).toBe(false);
    });

    it('should contain an Ollama Cloud model', () => {
      const cloud = models.find(m => m.provider === 'ollama_cloud');
      expect(cloud).toBeDefined();
      expect(cloud!.id).toBe('ollama-cloud');
      expect(cloud!.supportsStrictMode).toBe(false);
    });

    it('should contain an OpenCode Go model', () => {
      const go = models.find(m => m.provider === 'opencode_go');
      expect(go).toBeDefined();
      expect(go!.id).toBe('opencode-go');
      expect(go!.supportsStrictMode).toBe(true);
    });

    it('should contain an OpenCode Zen model', () => {
      const zen = models.find(m => m.provider === 'opencode_zen');
      expect(zen).toBeDefined();
      expect(zen!.id).toBe('opencode-zen');
      expect(zen!.supportsStrictMode).toBe(true);
    });
  });

  describe('getModel', () => {
    it('should return model by ID', () => {
      const model = getModel('openai-gpt4o');
      expect(model).toBeDefined();
      expect(model?.id).toBe('openai-gpt4o');
      expect(model?.name).toBe('GPT-4o');
      expect(model?.provider).toBe('openai');
    });

    it('should return undefined for invalid ID', () => {
      const model = getModel('invalid-model');
      expect(model).toBeUndefined();
    });
  });

  describe('getModelsByProvider', () => {
    it('should return models for OpenAI', () => {
      const openaiModels = getModelsByProvider('openai');
      expect(openaiModels).toHaveLength(2);
      openaiModels.forEach((model) => {
        expect(model.provider).toBe('openai');
      });
    });

    it('should return models for Anthropic', () => {
      const anthropicModels = getModelsByProvider('anthropic');
      expect(anthropicModels).toHaveLength(2);
      anthropicModels.forEach((model) => {
        expect(model.provider).toBe('anthropic');
      });
    });

    it('should return models for Google', () => {
      const googleModels = getModelsByProvider('google');
      expect(googleModels).toHaveLength(2);
      googleModels.forEach((model) => {
        expect(model.provider).toBe('google');
      });
    });
  });

  describe('getEnabledModels', () => {
    it('should return all models (all enabled)', () => {
      const enabledModels = getEnabledModels();
      expect(enabledModels).toHaveLength(models.length);
      expect(enabledModels).toEqual(models);
    });
  });

  describe('providers', () => {
    it('should have correct provider metadata', () => {
      expect(providers.openai).toEqual({
        name: 'OpenAI',
        color: '#10a37f',
      });
      expect(providers.anthropic).toEqual({
        name: 'Anthropic',
        color: '#d97706',
      });
      expect(providers.google).toEqual({
        name: 'Google',
        color: '#4285f4',
      });
      expect(providers.groq).toEqual({
        name: 'Groq',
        color: '#f55036',
      });
      expect(providers.openrouter).toEqual({
        name: 'OpenRouter',
        color: '#6366f1',
      });
      expect(providers.lm_studio).toEqual({
        name: 'LM Studio',
        color: '#a0784a',
      });
      expect(providers.ollama_local).toEqual({
        name: 'Ollama (Local)',
        color: '#7c3aed',
      });
      expect(providers.ollama_cloud).toEqual({
        name: 'Ollama Cloud',
        color: '#9333ea',
      });
      expect(providers.opencode_go).toEqual({
        name: 'OpenCode Go',
        color: '#e11d48',
      });
      expect(providers.opencode_zen).toEqual({
        name: 'OpenCode Zen',
        color: '#be185d',
      });
    });
  });

  describe('Expected Models', () => {
    it('should include expected OpenAI models', () => {
      const gpt5 = getModel('openai-gpt5');
      const gpt4o = getModel('openai-gpt4o');

      expect(gpt5?.name).toBe('GPT-5');
      expect(gpt4o?.name).toBe('GPT-4o');
    });

    it('should include expected Anthropic models', () => {
      const sonnet = getModel('anthropic-sonnet');
      const opus = getModel('anthropic-opus');

      expect(sonnet?.name).toBe('Claude Sonnet 4.5');
      expect(opus?.name).toBe('Claude Opus 4.5');
    });

    it('should include expected Google models', () => {
      const flash = getModel('google-flash');
      const pro = getModel('google-pro');

      expect(flash?.name).toBe('Gemini 2.5 Flash');
      expect(pro?.name).toBe('Gemini 3 Pro');
    });

    it('should include expected Groq models', () => {
      const gptOss = getModel('groq-gpt-oss-120b');
      const kimiK2 = getModel('groq-kimi-k2');
      const llama = getModel('groq-llama-3.3-70b');

      expect(gptOss?.name).toBe('GPT-OSS 120B');
      expect(kimiK2?.name).toBe('Kimi K2');
      expect(llama?.name).toBe('Llama 3.3 70B');
    });
  });

  describe('getModelsByProvider for Groq', () => {
    it('should return models for Groq', () => {
      const groqModels = getModelsByProvider('groq');
      expect(groqModels).toHaveLength(3);
      groqModels.forEach((model) => {
        expect(model.provider).toBe('groq');
      });
    });
  });

  describe('getModelsByProvider for LM Studio', () => {
    it('should return models for LM Studio', () => {
      const lmStudioModels = getModelsByProvider('lm_studio');
      expect(lmStudioModels).toHaveLength(1);
      lmStudioModels.forEach((model) => {
        expect(model.provider).toBe('lm_studio');
      });
    });
  });

  describe('getModelsByProvider for Ollama Local', () => {
    it('should return models for Ollama Local', () => {
      const ollamaModels = getModelsByProvider('ollama_local');
      expect(ollamaModels).toHaveLength(1);
      ollamaModels.forEach((model) => {
        expect(model.provider).toBe('ollama_local');
      });
    });
  });

  describe('getModelsByProvider for Ollama Cloud', () => {
    it('should return models for Ollama Cloud', () => {
      const cloudModels = getModelsByProvider('ollama_cloud');
      expect(cloudModels).toHaveLength(1);
      cloudModels.forEach((model) => {
        expect(model.provider).toBe('ollama_cloud');
      });
    });
  });

  describe('getModelsByProvider for OpenCode Go', () => {
    it('should return models for OpenCode Go', () => {
      const goModels = getModelsByProvider('opencode_go');
      expect(goModels).toHaveLength(1);
      goModels.forEach((model) => {
        expect(model.provider).toBe('opencode_go');
      });
    });
  });

  describe('getModelsByProvider for OpenCode Zen', () => {
    it('should return models for OpenCode Zen', () => {
      const zenModels = getModelsByProvider('opencode_zen');
      expect(zenModels).toHaveLength(1);
      zenModels.forEach((model) => {
        expect(model.provider).toBe('opencode_zen');
      });
    });
  });

  describe('getModelsByProvider for OpenRouter', () => {
    it('should return models for OpenRouter', () => {
      const openrouterModels = getModelsByProvider('openrouter');
      expect(openrouterModels).toHaveLength(1);
      expect(openrouterModels[0].id).toBe('openrouter-qwen3-235b');
    });
  });
});