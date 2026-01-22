import { describe, it, expect, beforeAll } from 'vitest';
import { Brain } from './index.js';
import type { Provider } from '../providers/types.js';
import { AnthropicProvider } from '../providers/anthropic/index.js';
import { loadConfig } from '../config.js';

describe('Brain', () => {
  let provider: Provider;
  let brain: Brain;

  beforeAll(() => {
    const config = loadConfig();

    // Skip if no Anthropic API key
    if (!config.anthropicApiKey) {
      console.warn('Skipping Brain tests: ANTHROPIC_API_KEY not set');
      return;
    }

    // Use Claude Sonnet for testing (cheaper than Opus)
    provider = new AnthropicProvider(
      config.anthropicApiKey,
      'claude-sonnet-4-5-20250929',
      'Claude Sonnet 4.5'
    );
    brain = new Brain({ provider, debug: false });
  });

  it('should create Brain instance', () => {
    const config = loadConfig();
    if (!config.anthropicApiKey) return; // Skip if no API key

    expect(brain).toBeDefined();
    expect(brain.getProviderName()).toBe('Claude Sonnet 4.5');
  });

  it('should pre-process a simple query', async () => {
    const config = loadConfig();
    if (!config.anthropicApiKey) return; // Skip if no API key

    const userQuery = 'What is TypeScript?';
    const processedPrompt = await brain.prepareForCouncil(userQuery);

    expect(processedPrompt).toBeDefined();
    expect(typeof processedPrompt).toBe('string');
    expect(processedPrompt.length).toBeGreaterThan(0);
  }, 30000); // 30s timeout for API call

  it('should pre-process an ambiguous query by adding clarity', async () => {
    const config = loadConfig();
    if (!config.anthropicApiKey) return; // Skip if no API key

    const ambiguousQuery = 'How do I use it?';
    const processedPrompt = await brain.prepareForCouncil(ambiguousQuery);

    expect(processedPrompt).toBeDefined();
    expect(typeof processedPrompt).toBe('string');
    // The pre-processed prompt should be different from the original
    // as it should add context/clarity
    expect(processedPrompt.length).toBeGreaterThan(ambiguousQuery.length);
  }, 30000);

  it('should handle complex technical queries', async () => {
    const config = loadConfig();
    if (!config.anthropicApiKey) return; // Skip if no API key

    const technicalQuery =
      'Compare async/await vs Promises vs callbacks for handling asynchronous operations in JavaScript';
    const processedPrompt = await brain.prepareForCouncil(technicalQuery);

    expect(processedPrompt).toBeDefined();
    expect(typeof processedPrompt).toBe('string');
    expect(processedPrompt.length).toBeGreaterThan(0);
  }, 30000);

  it('should fall back to original query if pre-processing fails', async () => {
    const config = loadConfig();
    if (!config.anthropicApiKey) return; // Skip if no API key

    // Create a mock provider that always fails
    const failingProvider: Provider = {
      name: 'Failing Provider',
      query: async (): Promise<never> => {
        return await Promise.reject(new Error('Mock failure'));
      },
      queryStream: async function* (): AsyncIterable<string> {
        await Promise.resolve();
        yield 'error';
        throw new Error('Mock failure');
      },
    };

    const failingBrain = new Brain({ provider: failingProvider });
    const userQuery = 'Test query';
    const result = await failingBrain.prepareForCouncil(userQuery);

    // Should return original query when pre-processing fails
    expect(result).toBe(userQuery);
  });
});
