jest.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: jest.fn(() => ({
    chatModel: jest.fn(() => ({ id: 'lm-studio-model', provider: 'lm_studio' })),
  })),
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
