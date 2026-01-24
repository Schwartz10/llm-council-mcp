import { describe, it, expect } from 'vitest';
import { GeminiProvider } from './index.js';
import { TEST_MODELS, TEST_PROMPT, getTestApiKeys, skipIfNoApiKey } from '../test-helpers.js';

describe('GeminiProvider', () => {
  const apiKeys = getTestApiKeys();

  it('should create provider instance', () => {
    if (skipIfNoApiKey(apiKeys.gemini, 'Gemini')) return;

    const provider = new GeminiProvider(apiKeys.gemini!, TEST_MODELS.gemini);
    expect(provider).toBeDefined();
    expect(provider.name).toContain('Gemini');
  });

  it('should query model successfully', async () => {
    if (skipIfNoApiKey(apiKeys.gemini, 'Gemini')) return;

    const provider = new GeminiProvider(apiKeys.gemini!, TEST_MODELS.gemini, 'Test Gemini');
    const response = await provider.query(TEST_PROMPT);

    expect(response).toBeDefined();
    expect(response.content).toBeTruthy();
    expect(response.provider).toBe('Test Gemini');
    expect(response.latencyMs).toBeGreaterThan(0);
  });

  it('should handle API errors', async () => {
    const provider = new GeminiProvider('invalid-key', TEST_MODELS.gemini);

    await expect(provider.query(TEST_PROMPT)).rejects.toThrow();
  });
});
