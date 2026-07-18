jest.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: jest.fn(() => ({
    chatModel: jest.fn(() => ({ id: 'lm-studio-model', provider: 'lm_studio' })),
  })),
}));

jest.mock('ollama-ai-provider-v2', () => ({
  createOllama: jest.fn(() => ({
    chat: jest.fn(() => ({ id: 'ollama-model', provider: 'ollama_local' })),
  })),
  ollama: jest.fn(() => ({ id: 'ollama-model', provider: 'ollama_local' })),
}));

import {
  modelDefinitions,
  createModelWithKeys,
  getModelDefinition,
  getModelWithKeys,
  getAvailableModels,
  providers,
} from '../lib/models-factory';

describe('Model Factory - LM Studio', () => {
  describe('modelDefinitions', () => {
    it('should contain an LM Studio entry', () => {
      const def = modelDefinitions.find(m => m.provider === 'lm_studio');
      expect(def).toBeDefined();
      expect(def!.id).toBe('lm-studio');
      expect(def!.name).toBe('LM Studio');
      expect(def!.supportsStrictMode).toBe(true);
    });
  });

  describe('createModelWithKeys', () => {
    it('should create an LM Studio model config without API key', () => {
      const def = getModelDefinition('lm-studio');
      expect(def).toBeDefined();
      const config = createModelWithKeys(def!, {});
      expect(config).not.toBeNull();
      expect(config!.id).toBe('lm-studio');
      expect(config!.provider).toBe('lm_studio');
      expect(config!.supportsStrictMode).toBe(true);
    });
  });

  describe('getModelWithKeys', () => {
    it('should return LM Studio model by ID', () => {
      const model = getModelWithKeys('lm-studio', {});
      expect(model).not.toBeNull();
      expect(model!.provider).toBe('lm_studio');
    });

    it('should return null for unknown model', () => {
      const model = getModelWithKeys('unknown-model', {});
      expect(model).toBeNull();
    });
  });

  describe('getAvailableModels', () => {
    it('should include LM Studio', () => {
      const available = getAvailableModels({});
      const lmStudio = available.find(m => m.provider === 'lm_studio');
      expect(lmStudio).toBeDefined();
    });
  });

  describe('providers', () => {
    it('should include LM Studio metadata', () => {
      expect(providers.lm_studio).toEqual({
        name: 'LM Studio',
        color: '#a0784a',
      });
    });
  });
});

describe('Model Factory - Ollama Local', () => {
  describe('modelDefinitions', () => {
    it('should contain an Ollama Local entry', () => {
      const def = modelDefinitions.find(m => m.provider === 'ollama_local');
      expect(def).toBeDefined();
      expect(def!.id).toBe('ollama-local');
      expect(def!.name).toBe('Ollama (Local)');
      expect(def!.supportsStrictMode).toBe(false);
    });
  });

  describe('createModelWithKeys', () => {
    it('should create an Ollama Local model config without API key', () => {
      const def = getModelDefinition('ollama-local');
      expect(def).toBeDefined();
      const config = createModelWithKeys(def!, {});
      expect(config).not.toBeNull();
      expect(config!.id).toBe('ollama-local');
      expect(config!.provider).toBe('ollama_local');
      expect(config!.supportsStrictMode).toBe(false);
    });
  });

  describe('getModelWithKeys', () => {
    it('should return Ollama Local model by ID', () => {
      const model = getModelWithKeys('ollama-local', {});
      expect(model).not.toBeNull();
      expect(model!.provider).toBe('ollama_local');
    });
  });

  describe('getAvailableModels', () => {
    it('should include Ollama Local', () => {
      const available = getAvailableModels({});
      const ollama = available.find(m => m.provider === 'ollama_local');
      expect(ollama).toBeDefined();
    });
  });

  describe('providers', () => {
    it('should include Ollama Local metadata', () => {
      expect(providers.ollama_local).toEqual({
        name: 'Ollama (Local)',
        color: '#7c3aed',
      });
    });
  });
});

describe('Model Factory - Ollama Cloud', () => {
  describe('modelDefinitions', () => {
    it('should contain an Ollama Cloud entry', () => {
      const def = modelDefinitions.find(m => m.provider === 'ollama_cloud');
      expect(def).toBeDefined();
      expect(def!.id).toBe('ollama-cloud');
      expect(def!.name).toBe('Ollama Cloud');
      expect(def!.supportsStrictMode).toBe(false);
    });
  });

  describe('createModelWithKeys', () => {
    it('should create an Ollama Cloud model config with API key', () => {
      const def = getModelDefinition('ollama-cloud');
      expect(def).toBeDefined();
      const config = createModelWithKeys(def!, { ollama_cloud: 'test-key' });
      expect(config).not.toBeNull();
      expect(config!.id).toBe('ollama-cloud');
      expect(config!.provider).toBe('ollama_cloud');
      expect(config!.supportsStrictMode).toBe(false);
    });

    it('should return null without API key', () => {
      const def = getModelDefinition('ollama-cloud');
      expect(def).toBeDefined();
      const config = createModelWithKeys(def!, {});
      expect(config).toBeNull();
    });
  });

  describe('getModelWithKeys', () => {
    it('should return null without API key', () => {
      const model = getModelWithKeys('ollama-cloud', {});
      expect(model).toBeNull();
    });

    it('should return model with API key', () => {
      const model = getModelWithKeys('ollama-cloud', { ollama_cloud: 'test-key' });
      expect(model).not.toBeNull();
      expect(model!.provider).toBe('ollama_cloud');
    });
  });

  describe('providers', () => {
    it('should include Ollama Cloud metadata', () => {
      expect(providers.ollama_cloud).toEqual({
        name: 'Ollama Cloud',
        color: '#9333ea',
      });
    });
  });
});

describe('Model Factory - OpenCode Go', () => {
  describe('modelDefinitions', () => {
    it('should contain an OpenCode Go entry', () => {
      const def = modelDefinitions.find(m => m.provider === 'opencode_go');
      expect(def).toBeDefined();
      expect(def!.id).toBe('opencode-go');
      expect(def!.name).toBe('OpenCode Go');
      expect(def!.supportsStrictMode).toBe(true);
    });
  });

  describe('createModelWithKeys', () => {
    it('should create an OpenCode Go model config with API key', () => {
      const def = getModelDefinition('opencode-go');
      expect(def).toBeDefined();
      const config = createModelWithKeys(def!, { opencode_go: 'test-key' });
      expect(config).not.toBeNull();
      expect(config!.id).toBe('opencode-go');
      expect(config!.provider).toBe('opencode_go');
      expect(config!.supportsStrictMode).toBe(true);
    });

    it('should return null without API key', () => {
      const def = getModelDefinition('opencode-go');
      expect(def).toBeDefined();
      const config = createModelWithKeys(def!, {});
      expect(config).toBeNull();
    });
  });

  describe('getModelWithKeys', () => {
    it('should return null without API key', () => {
      const model = getModelWithKeys('opencode-go', {});
      expect(model).toBeNull();
    });

    it('should return model with API key', () => {
      const model = getModelWithKeys('opencode-go', { opencode_go: 'test-key' });
      expect(model).not.toBeNull();
      expect(model!.provider).toBe('opencode_go');
    });
  });

  describe('providers', () => {
    it('should include OpenCode Go metadata', () => {
      expect(providers.opencode_go).toEqual({
        name: 'OpenCode Go',
        color: '#e11d48',
      });
    });
  });
});

describe('Model Factory - OpenCode Zen', () => {
  describe('modelDefinitions', () => {
    it('should contain an OpenCode Zen entry', () => {
      const def = modelDefinitions.find(m => m.provider === 'opencode_zen');
      expect(def).toBeDefined();
      expect(def!.id).toBe('opencode-zen');
      expect(def!.name).toBe('OpenCode Zen');
      expect(def!.supportsStrictMode).toBe(true);
    });
  });

  describe('createModelWithKeys', () => {
    it('should create an OpenCode Zen model config with API key', () => {
      const def = getModelDefinition('opencode-zen');
      expect(def).toBeDefined();
      const config = createModelWithKeys(def!, { opencode_zen: 'test-key' });
      expect(config).not.toBeNull();
      expect(config!.id).toBe('opencode-zen');
      expect(config!.provider).toBe('opencode_zen');
      expect(config!.supportsStrictMode).toBe(true);
    });

    it('should return null without API key', () => {
      const def = getModelDefinition('opencode-zen');
      expect(def).toBeDefined();
      const config = createModelWithKeys(def!, {});
      expect(config).toBeNull();
    });
  });

  describe('getModelWithKeys', () => {
    it('should return null without API key', () => {
      const model = getModelWithKeys('opencode-zen', {});
      expect(model).toBeNull();
    });

    it('should return model with API key', () => {
      const model = getModelWithKeys('opencode-zen', { opencode_zen: 'test-key' });
      expect(model).not.toBeNull();
      expect(model!.provider).toBe('opencode_zen');
    });
  });

  describe('providers', () => {
    it('should include OpenCode Zen metadata', () => {
      expect(providers.opencode_zen).toEqual({
        name: 'OpenCode Zen',
        color: '#be185d',
      });
    });
  });
});
