import { describe, expect, it } from 'vitest';
import { OpenAIProvider } from './index.js';
import { getTestApiKeys, skipIfNoApiKey, TEST_MODELS, TEST_PROMPT } from '../test-helpers.js';

describe('OpenAIProvider', () => {
  const apiKeys = getTestApiKeys();

  it('should create provider instance', () => {
    if (skipIfNoApiKey(apiKeys.openai, 'OpenAI')) return;

    const provider = new OpenAIProvider(apiKeys.openai!, TEST_MODELS.openai);

    expect(provider).toBeDefined();
    expect(provider.name).toContain('OpenAI');
  });

  it('should query successfully and return ProviderResponse', async () => {
    if (skipIfNoApiKey(apiKeys.openai, 'OpenAI')) return;

    const provider = new OpenAIProvider(apiKeys.openai!, TEST_MODELS.openai, 'Test GPT');

    const response = await provider.query(TEST_PROMPT);

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.provider).toBe('Test GPT');
    expect(response.latencyMs).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    // Use invalid API key to trigger error
    const provider = new OpenAIProvider('invalid-key', TEST_MODELS.openai);

    await expect(provider.query(TEST_PROMPT)).rejects.toThrow();
  });
});
