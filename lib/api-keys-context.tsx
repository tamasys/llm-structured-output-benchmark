'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  groq?: string;
  openrouter?: string;
  opencode_go?: string;
  opencode_zen?: string;
  nvidia?: string;
  ollama_cloud?: string;
}

interface ApiKeysContextType {
  keys: ApiKeys;
  setKey: (provider: keyof ApiKeys, key: string) => void;
  clearKeys: () => void;
  hasKey: (provider: keyof ApiKeys) => boolean;
  getHeaders: () => Record<string, string>;
}

const ApiKeysContext = createContext<ApiKeysContextType | null>(null);

function loadKeys(): ApiKeys {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem('api-keys');
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<ApiKeys>(loadKeys);

  const setKey = useCallback((provider: keyof ApiKeys, key: string) => {
    setKeys(prev => {
      const next = { ...prev, [provider]: key || undefined };
      if (typeof window !== 'undefined') {
        localStorage.setItem('api-keys', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const clearKeys = useCallback(() => {
    setKeys({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('api-keys');
    }
  }, []);

  const hasKey = useCallback((provider: keyof ApiKeys) => {
    return !!keys[provider];
  }, [keys]);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (keys.openai) headers['x-openai-api-key'] = keys.openai;
    if (keys.anthropic) headers['x-anthropic-api-key'] = keys.anthropic;
    if (keys.google) headers['x-google-api-key'] = keys.google;
    if (keys.groq) headers['x-groq-api-key'] = keys.groq;
    if (keys.openrouter) headers['x-openrouter-api-key'] = keys.openrouter;
    if (keys.opencode_go) headers['x-opencode-go-api-key'] = keys.opencode_go;
    if (keys.opencode_zen) headers['x-opencode-zen-api-key'] = keys.opencode_zen;
    if (keys.nvidia) headers['x-nvidia-api-key'] = keys.nvidia;
    if (keys.ollama_cloud) headers['x-ollama-cloud-api-key'] = keys.ollama_cloud;
    return headers;
  }, [keys]);

  return (
    <ApiKeysContext.Provider value={{ keys, setKey, clearKeys, hasKey, getHeaders }}>
      {children}
    </ApiKeysContext.Provider>
  );
}

export function useApiKeys() {
  const context = useContext(ApiKeysContext);
  if (!context) {
    throw new Error('useApiKeys must be used within an ApiKeysProvider');
  }
  return context;
}
