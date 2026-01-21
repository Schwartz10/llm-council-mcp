import { describe, expect, it } from 'vitest';
import { AnthropicProvider } from './index.js';
import { getTestApiKeys, skipIfNoApiKey, TEST_MODELS, TEST_PROMPT } from '../test-helpers.js';

describe('AnthropicProvider', () => {
  const apiKeys = getTestApiKeys();

  it('should create provider instance', () => {
    if (skipIfNoApiKey(apiKeys.anthropic, 'Anthropic')) return;

    const provider = new AnthropicProvider(apiKeys.anthropic!, TEST_MODELS.anthropic);

    expect(provider).toBeDefined();
    expect(provider.name).toContain('Anthropic');
  });

  it('should query successfully and return ProviderResponse', async () => {
    if (skipIfNoApiKey(apiKeys.anthropic, 'Anthropic')) return;

    const provider = new AnthropicProvider(apiKeys.anthropic!, TEST_MODELS.anthropic, 'Test Claude');

    const response = await provider.query(TEST_PROMPT);

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.provider).toBe('Test Claude');
    expect(response.latencyMs).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    // Use invalid API key to trigger error
    const provider = new AnthropicProvider('invalid-key', TEST_MODELS.anthropic);

    await expect(provider.query(TEST_PROMPT)).rejects.toThrow();
  });
});
