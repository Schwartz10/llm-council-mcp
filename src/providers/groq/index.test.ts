import { describe, expect, it } from 'vitest';
import { GroqProvider } from './index.js';
import { getTestApiKeys, skipIfNoApiKey, TEST_MODELS, TEST_PROMPT } from '../test-helpers.js';

describe('GroqProvider', () => {
  const apiKeys = getTestApiKeys();

  it('should create provider instance', () => {
    if (skipIfNoApiKey(apiKeys.groq, 'Groq')) return;

    const provider = new GroqProvider(apiKeys.groq!, TEST_MODELS.groq);

    expect(provider).toBeDefined();
    expect(provider.name).toContain('Groq');
    expect(provider.modelId).toBe(TEST_MODELS.groq);
  });

  it('should query successfully and return ProviderResponse', async () => {
    if (skipIfNoApiKey(apiKeys.groq, 'Groq')) return;

    const provider = new GroqProvider(apiKeys.groq!, TEST_MODELS.groq, 'Test Llama');

    const response = await provider.query(TEST_PROMPT);

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.provider).toBe('Test Llama');
    expect(response.modelId).toBe(TEST_MODELS.groq);
    expect(response.latencyMs).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    // Use invalid API key to trigger error
    const provider = new GroqProvider('invalid-key', TEST_MODELS.groq);

    await expect(provider.query(TEST_PROMPT)).rejects.toThrow();
  });
});
