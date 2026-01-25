import { describe, expect, it } from 'vitest';
import { XAIProvider } from './index.js';
import { getTestApiKeys, skipIfNoApiKey, TEST_MODELS, TEST_PROMPT } from '../test-helpers.js';

describe('XAIProvider', () => {
  const apiKeys = getTestApiKeys();

  it('should create provider instance', () => {
    if (skipIfNoApiKey(apiKeys.xai, 'xAI')) return;

    const provider = new XAIProvider(apiKeys.xai!, TEST_MODELS.xai);

    expect(provider).toBeDefined();
    expect(provider.name).toContain('xAI');
    expect(provider.modelId).toBe(TEST_MODELS.xai);
  });

  it('should query successfully and return ProviderResponse', async () => {
    if (skipIfNoApiKey(apiKeys.xai, 'xAI')) return;

    const provider = new XAIProvider(apiKeys.xai!, TEST_MODELS.xai, 'Test Grok');

    const response = await provider.query(TEST_PROMPT);

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.provider).toBe('Test Grok');
    expect(response.modelId).toBe(TEST_MODELS.xai);
    expect(response.latencyMs).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    // Use invalid API key to trigger error
    const provider = new XAIProvider('invalid-key', TEST_MODELS.xai);

    await expect(provider.query(TEST_PROMPT)).rejects.toThrow();
  });
});
