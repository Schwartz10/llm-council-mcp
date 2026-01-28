import { describe, expect, test } from 'vitest';
import type { Provider } from '../providers/types.js';
import {
  consultCouncilWithProviders,
  listCouncilModels,
  selectCouncilProviders,
} from './shared.js';

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

describe('consult_llm_council response shaping', () => {
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

describe('consult_llm_council model selection', () => {
  test('returns all providers when models is omitted', () => {
    const providers: Provider[] = [
      createMockProvider('Claude Sonnet 4.5', 'claude-test', 'Claude'),
      createMockProvider('GPT', 'gpt-test', 'GPT'),
    ];

    const result = selectCouncilProviders(undefined, providers);

    expect(result).toEqual(providers);
  });

  test('selects a subset of providers by alias', () => {
    const providers: Provider[] = [
      createMockProvider('Claude Sonnet 4.5', 'claude-test', 'Claude'),
      createMockProvider('GPT', 'gpt-test', 'GPT'),
      createMockProvider('Grok', 'grok-test', 'Grok'),
    ];

    const result = selectCouncilProviders(['claude', 'gpt'], providers);

    expect(result.map((provider) => provider.name)).toEqual(['Claude Sonnet 4.5', 'GPT']);
  });

  test('selects a single model by name', () => {
    const providers: Provider[] = [
      createMockProvider('Claude Sonnet 4.5', 'claude-test', 'Claude'),
      createMockProvider('GPT', 'gpt-test', 'GPT'),
      createMockProvider('Grok', 'grok-test', 'Grok'),
    ];

    const result = selectCouncilProviders(['grok'], providers);

    expect(result.map((provider) => provider.name)).toEqual(['Grok']);
  });

  test('throws a helpful error for invalid or unavailable models', () => {
    const providers: Provider[] = [
      createMockProvider('Claude Sonnet 4.5', 'claude-test', 'Claude'),
      createMockProvider('GPT', 'gpt-test', 'GPT'),
    ];

    expect(() => selectCouncilProviders(['grok', 'unknown'], providers)).toThrowError(
      /Unknown model name\(s\): unknown.*Not configured or unavailable: Grok.*Available models: Claude Sonnet 4.5, GPT\./s
    );
  });
});

describe('list_models tool behavior', () => {
  test('lists all available council models by name', () => {
    const providers: Provider[] = [
      createMockProvider('Claude Sonnet 4.5', 'claude-test', 'Claude'),
      createMockProvider('GPT', 'gpt-test', 'GPT'),
    ];

    const models = listCouncilModels(providers);

    expect(models).toEqual([
      { name: 'Claude Sonnet 4.5', model_id: 'claude-test' },
      { name: 'GPT', model_id: 'gpt-test' },
    ]);
  });

  test('using listed model name selects only that model', () => {
    const providers: Provider[] = [
      createMockProvider('Claude Sonnet 4.5', 'claude-test', 'Claude'),
      createMockProvider('GPT', 'gpt-test', 'GPT'),
    ];

    const models = listCouncilModels(providers);
    const selected = selectCouncilProviders([models[0].name], providers);

    expect(selected.map((provider) => provider.name)).toEqual([models[0].name]);
  });
});
