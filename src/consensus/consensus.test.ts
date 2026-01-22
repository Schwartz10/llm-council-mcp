import { describe, it, expect, vi } from 'vitest';
import { Consensus } from './index.js';
import { SimpleSynthesis } from './strategies/simple-synthesis.js';
import { Brain } from '../brain/index.js';
import { Provider, ProviderResponse } from '../providers/types.js';

// Mock Provider for testing
class MockProvider implements Provider {
  name = 'MockProvider';

  // Mock implementation must match async Provider interface signature, but doesn't need actual async operations in tests
  // eslint-disable-next-line @typescript-eslint/require-await
  async query(): Promise<ProviderResponse> {
    return {
      content: '',
      provider: this.name,
      latencyMs: 0,
    };
  }

  // Mock async generator must match Provider interface signature, but doesn't need actual async operations in tests
  // eslint-disable-next-line @typescript-eslint/require-await
  async *queryStream(): AsyncIterable<string> {
    yield '';
  }
}

// Mock Brain class
class MockBrain extends Brain {
  private mockResponse: string;

  constructor(mockResponse: string) {
    super({ provider: new MockProvider() });
    this.mockResponse = mockResponse;
  }

  query(): Promise<string> {
    return Promise.resolve(this.mockResponse);
  }
}

// Helper to create mock provider responses
function createMockResponses(contents: string[]): ProviderResponse[] {
  return contents.map((content, i) => ({
    content,
    provider: `Provider${i + 1}`,
    latencyMs: 100,
  }));
}

describe('SimpleSynthesis Strategy', () => {
  it('should synthesize responses with valid JSON from Brain', async () => {
    const mockBrainResponse = JSON.stringify({
      synthesis: 'This is the unified answer combining all insights.',
      agreement: true,
      confidence: 0.9,
      dissent: undefined,
    });

    const brain = new MockBrain(mockBrainResponse);
    const strategy = new SimpleSynthesis(brain);

    const responses = createMockResponses([
      'Response 1: TypeScript is great',
      'Response 2: TypeScript is awesome',
    ]);

    const result = await strategy.synthesize(responses, 'What is TypeScript?');

    expect(result.synthesis).toBe('This is the unified answer combining all insights.');
    expect(result.agreement).toBe(true);
    expect(result.confidence).toBe(0.9);
    expect(result.dissent).toBeUndefined();
  });

  it('should extract JSON from markdown-formatted response', async () => {
    // Brain might return JSON wrapped in markdown code blocks
    const mockBrainResponse = `Here is the synthesis:
\`\`\`json
{
  "synthesis": "Extracted from markdown",
  "agreement": true,
  "confidence": 0.85
}
\`\`\``;

    const brain = new MockBrain(mockBrainResponse);
    const strategy = new SimpleSynthesis(brain);

    const responses = createMockResponses(['Response 1']);

    const result = await strategy.synthesize(responses, 'Test prompt');

    expect(result.synthesis).toBe('Extracted from markdown');
    expect(result.agreement).toBe(true);
    expect(result.confidence).toBe(0.85);
  });

  it('should handle disagreement and dissent', async () => {
    const mockBrainResponse = JSON.stringify({
      synthesis: 'Models disagree on the best approach.',
      agreement: false,
      confidence: 0.4,
      dissent: 'Model 1 prefers X while Models 2-4 prefer Y for performance reasons.',
    });

    const brain = new MockBrain(mockBrainResponse);
    const strategy = new SimpleSynthesis(brain);

    const responses = createMockResponses([
      'Use approach X',
      'Use approach Y',
      'Use approach Y',
      'Use approach Y',
    ]);

    const result = await strategy.synthesize(responses, 'Which approach?');

    expect(result.synthesis).toContain('disagree');
    expect(result.agreement).toBe(false);
    expect(result.confidence).toBe(0.4);
    expect(result.dissent).toContain('Model 1 prefers X');
  });

  it('should clamp confidence to 0-1 range', async () => {
    const mockBrainResponse = JSON.stringify({
      synthesis: 'Answer',
      agreement: true,
      confidence: 1.5, // Invalid: > 1
    });

    const brain = new MockBrain(mockBrainResponse);
    const strategy = new SimpleSynthesis(brain);

    const responses = createMockResponses(['Response']);

    const result = await strategy.synthesize(responses, 'Question');

    expect(result.confidence).toBe(1.0); // Should be clamped to 1
  });

  it('should use fallback consensus when Brain fails', async () => {
    // Mock Brain that throws error
    const brain = new MockBrain('Invalid JSON response');
    const strategy = new SimpleSynthesis(brain);

    const responses = createMockResponses(['Answer from Model 1', 'Answer from Model 2']);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await strategy.synthesize(responses, 'Test question');

    // Should create fallback consensus
    expect(result.synthesis).toContain('Multiple perspectives');
    expect(result.synthesis).toContain('Provider1');
    expect(result.synthesis).toContain('Provider2');
    expect(result.agreement).toBe(false);
    expect(result.confidence).toBe(0.3); // Low confidence for fallback
    expect(result.dissent).toContain('Unable to synthesize');

    consoleSpy.mockRestore();
  });

  it('should throw error for empty responses array', async () => {
    const brain = new MockBrain('{}');
    const strategy = new SimpleSynthesis(brain);

    await expect(strategy.synthesize([], 'Question')).rejects.toThrow('no responses provided');
  });
});

describe('Consensus Orchestrator', () => {
  it('should synthesize using configured strategy', async () => {
    const mockBrainResponse = JSON.stringify({
      synthesis: 'Orchestrated synthesis',
      agreement: true,
      confidence: 0.95,
    });

    const brain = new MockBrain(mockBrainResponse);
    const strategy = new SimpleSynthesis(brain);
    const consensus = new Consensus({ strategy });

    const responses = createMockResponses(['Response 1', 'Response 2']);

    const result = await consensus.synthesize(responses, 'Test prompt');

    expect(result.synthesis).toBe('Orchestrated synthesis');
    expect(result.confidence).toBe(0.95);
  });

  it('should return current strategy name', () => {
    const brain = new MockBrain('{}');
    const strategy = new SimpleSynthesis(brain);
    const consensus = new Consensus({ strategy });

    expect(consensus.getStrategyName()).toBe('SimpleSynthesis');
  });

  it('should allow strategy switching', async () => {
    const brain1 = new MockBrain(
      JSON.stringify({
        synthesis: 'Strategy 1',
        agreement: true,
        confidence: 0.8,
      })
    );
    const strategy1 = new SimpleSynthesis(brain1);
    const consensus = new Consensus({ strategy: strategy1 });

    // Use first strategy
    let result = await consensus.synthesize(createMockResponses(['R1']), 'Q');
    expect(result.synthesis).toBe('Strategy 1');

    // Switch to second strategy
    const brain2 = new MockBrain(
      JSON.stringify({
        synthesis: 'Strategy 2',
        agreement: true,
        confidence: 0.9,
      })
    );
    const strategy2 = new SimpleSynthesis(brain2);
    consensus.setStrategy(strategy2);

    result = await consensus.synthesize(createMockResponses(['R2']), 'Q');
    expect(result.synthesis).toBe('Strategy 2');
  });

  it('should throw error for empty responses', async () => {
    const brain = new MockBrain('{}');
    const strategy = new SimpleSynthesis(brain);
    const consensus = new Consensus({ strategy });

    await expect(consensus.synthesize([], 'Question')).rejects.toThrow('no responses provided');
  });
});
