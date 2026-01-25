import { describe, expect, test } from 'vitest';
import type { Provider } from '../providers/types.js';
import { consultCouncilWithProviders } from './shared.js';

function createMockProvider(name: string, modelId: string, responseText: string): Provider {
  return {
    name,
    modelId,
    async query() {
      await Promise.resolve();
      return {
        content: responseText,
        provider: name,
        modelId,
        latencyMs: 10,
      };
    },
    async *queryStream() {
      await Promise.resolve();
      yield responseText;
    },
  };
}

describe('phone_council response shaping', () => {
  test('omits synthesis fields when show_raw=true', async () => {
    const providers: Provider[] = [
      createMockProvider('Claude', 'claude-test', 'Use TypeScript for type safety.'),
      createMockProvider('GPT', 'gpt-test', 'Use TypeScript for type safety.'),
    ];

    const result = await consultCouncilWithProviders(
      {
        prompt: 'Test prompt',
        show_raw: true,
      },
      providers
    );

    expect(result.synthesis_data).toBeUndefined();
    expect(result.synthesis_instruction).toBeUndefined();
    expect(result.critiques[0].model_id).toBe('claude-test');
    expect(result.critiques[1].model_id).toBe('gpt-test');
  });

  test('includes synthesis fields by default', async () => {
    const providers: Provider[] = [
      createMockProvider('Claude', 'claude-test', 'Use TypeScript for type safety.'),
      createMockProvider('GPT', 'gpt-test', 'Use TypeScript for type safety.'),
    ];

    const result = await consultCouncilWithProviders(
      {
        prompt: 'Test prompt',
      },
      providers
    );

    expect(result.synthesis_data).toBeDefined();
    expect(result.synthesis_instruction).toContain('structured synthesis_data');
    expect(result.synthesis_data?.confidence).toBeGreaterThanOrEqual(0);
    expect(result.synthesis_data?.confidence).toBeLessThanOrEqual(1);
  });
});
