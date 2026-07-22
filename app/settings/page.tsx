'use client';

import { useState, useCallback, useRef } from 'react';
import { useApiKeys, type ApiKeys } from '@/lib/api-keys-context';
import { Card, Button } from '@/components/ui';

type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

const providers: Array<{
  key: keyof ApiKeys;
  name: string;
  envVar: string;
  placeholder: string;
}> = [
  {
    key: 'openai',
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    placeholder: 'sk-...',
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    placeholder: 'sk-ant-...',
  },
  {
    key: 'google',
    name: 'Google',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    placeholder: 'AIza...',
  },
  {
    key: 'groq',
    name: 'Groq',
    envVar: 'GROQ_API_KEY',
    placeholder: 'gsk_...',
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    placeholder: 'sk-or-...',
  },
  {
    key: 'opencode_go',
    name: 'OpenCode Go',
    envVar: 'OPENCODE_API_KEY',
    placeholder: 'oc_...',
  },
  {
    key: 'opencode_zen',
    name: 'OpenCode Zen',
    envVar: 'OPENCODE_API_KEY',
    placeholder: 'oc_...',
  },
  {
    key: 'nvidia',
    name: 'NVIDIA',
    envVar: 'NVIDIA_API_KEY',
    placeholder: 'nvapi-...',
  },
  {
    key: 'ollama_cloud',
    name: 'Ollama Cloud',
    envVar: 'OLLAMA_CLOUD_API_KEY',
    placeholder: 'ollama_...',
  },
];

export default function SettingsPage() {
  const { keys, setKey, clearKeys } = useApiKeys();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validationStatus, setValidationStatus] = useState<Record<string, ValidationStatus>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const validateKey = useCallback(async (provider: keyof ApiKeys, key: string) => {
    if (!key || key.length < 10) {
      setValidationStatus(prev => ({ ...prev, [provider]: 'idle' }));
      setValidationErrors(prev => ({ ...prev, [provider]: '' }));
      return;
    }

    setValidationStatus(prev => ({ ...prev, [provider]: 'validating' }));

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key }),
      });
      const data = await res.json();

      if (data.valid) {
        setValidationStatus(prev => ({ ...prev, [provider]: 'valid' }));
        setValidationErrors(prev => ({ ...prev, [provider]: '' }));
      } else {
        setValidationStatus(prev => ({ ...prev, [provider]: 'invalid' }));
        setValidationErrors(prev => ({ ...prev, [provider]: data.error || 'Invalid key' }));
      }
    } catch {
      setValidationStatus(prev => ({ ...prev, [provider]: 'invalid' }));
      setValidationErrors(prev => ({ ...prev, [provider]: 'Validation failed' }));
    }
  }, []);

  const handleKeyChange = useCallback((provider: keyof ApiKeys, value: string) => {
    setKey(provider, value);

    if (debounceTimers.current[provider]) {
      clearTimeout(debounceTimers.current[provider]);
    }

    if (!value) {
      setValidationStatus(prev => ({ ...prev, [provider]: 'idle' }));
      setValidationErrors(prev => ({ ...prev, [provider]: '' }));
      return;
    }

    debounceTimers.current[provider] = setTimeout(() => {
      validateKey(provider, value);
    }, 500);
  }, [setKey, validateKey]);

  const configuredCount = Object.values(keys).filter(Boolean).length;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure API keys to run benchmarks
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              API Keys
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {configuredCount} of {providers.length} providers configured
            </p>
          </div>
          {configuredCount > 0 && (
            <Button variant="secondary" onClick={clearKeys}>
              Clear All
            </Button>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Your keys are handled securely</p>
              <p className="text-blue-700 dark:text-blue-300">
                Keys are stored in browser memory only and are never saved to disk or logged. When you run a test, keys are transmitted to our backend server which forwards them to the respective API providers. Closing or refreshing this page will clear all keys. This project is{' '}
                <a
                  href="https://github.com/bendechrai/llm-structured-output-benchmark"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  open source
                </a>
                {' '}so you can verify the code or run it locally.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {providers.map(provider => {
            const status = validationStatus[provider.key] || 'idle';
            const error = validationErrors[provider.key];

            return (
              <div key={provider.key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-medium text-gray-900 dark:text-white">
                    {provider.name}
                  </label>
                  {status === 'validating' && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Validating...
                    </span>
                  )}
                  {status === 'valid' && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Valid
                    </span>
                  )}
                  {status === 'invalid' && (
                    <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Invalid
                    </span>
                  )}
                  {status === 'idle' && keys[provider.key] && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Not validated
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type={showKeys[provider.key] ? 'text' : 'password'}
                    value={keys[provider.key] || ''}
                    onChange={e => handleKeyChange(provider.key, e.target.value)}
                    placeholder={provider.placeholder}
                    className={`flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      status === 'invalid'
                        ? 'border-red-300 dark:border-red-600'
                        : status === 'valid'
                          ? 'border-green-300 dark:border-green-600'
                          : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey(provider.key)}
                    className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    {showKeys[provider.key] ? 'Hide' : 'Show'}
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    {error}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Environment variable: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{provider.envVar}</code>
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Usage Notes
        </h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex gap-2">
            <span className="text-gray-400">•</span>
            <span>You only need to configure keys for the providers you want to test</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">•</span>
            <span>Keys entered here override any server-side environment variables</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">•</span>
            <span>For local development, you can also set keys in a <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.env.local</code> file</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">•</span>
            <span>Running tests will incur costs on your API accounts</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
