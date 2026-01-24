import { describe, it, expect, vi } from 'vitest';
import { Council } from './index.js';
import type { Provider, ProviderResponse } from '../providers/types.js';

describe('Council', () => {
  // Create mock providers for testing
  function createMockProvider(name: string, delay: number, shouldFail = false): Provider {
    return {
      name,
      query: async (prompt: string): Promise<ProviderResponse> => {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, delay));

        if (shouldFail) {
          throw new Error(`Mock error from ${name}`);
        }

        return {
          content: `Response from ${name} to: ${prompt}`,
          provider: name,
          latencyMs: delay,
        };
      },
      queryStream: async function* (): AsyncIterable<string> {
        await new Promise((resolve) => setTimeout(resolve, delay));
        yield `Streaming from ${name}`;
      },
    };
  }

  it('should create Council instance', () => {
    const providers = [createMockProvider('Provider1', 100), createMockProvider('Provider2', 100)];
    const council = new Council(providers);

    expect(council).toBeDefined();
    expect(council.getProviderCount()).toBe(2);
    expect(council.getProviderNames()).toEqual(['Provider1', 'Provider2']);
  });

  it('should query all providers in parallel', async () => {
    const providers = [
      createMockProvider('Fast', 50),
      createMockProvider('Medium', 100),
      createMockProvider('Slow', 150),
    ];
    const council = new Council(providers);

    const startTime = Date.now();
    const result = await council.deliberate('Test question');
    const totalTime = Date.now() - startTime;

    // All providers should complete
    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
    expect(result.responses).toHaveLength(3);

    // Should take roughly the time of the slowest provider (not sum of all)
    // Add some buffer for overhead
    expect(totalTime).toBeLessThan(300); // Should be ~150ms, not 300ms
    expect(totalTime).toBeGreaterThanOrEqual(140); // Allow small timer jitter

    // Check responses
    expect(result.responses[0].content).toContain('Fast');
    expect(result.responses[1].content).toContain('Medium');
    expect(result.responses[2].content).toContain('Slow');
  }, 10000);

  it('should handle partial failures gracefully', async () => {
    const providers = [
      createMockProvider('Success1', 50, false),
      createMockProvider('Failure', 50, true),
      createMockProvider('Success2', 50, false),
    ];
    const council = new Council(providers);

    const result = await council.deliberate('Test question');

    // Should have 2 successes and 1 failure
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.responses).toHaveLength(3);

    // Failed response should have error field
    const failedResponse = result.responses.find((r) => r.provider === 'Failure');
    expect(failedResponse).toBeDefined();
    expect(failedResponse?.error).toBeDefined();
    expect(failedResponse?.content).toBe('');
  });

  it('should handle timeout', async () => {
    // Create a provider that takes longer than timeout
    const slowProvider = createMockProvider('VerySlow', 2000);
    const council = new Council([slowProvider], { timeoutMs: 500 });

    const result = await council.deliberate('Test question');

    // Should fail due to timeout
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(1);
    expect(result.responses[0].error).toContain('Timeout');
  }, 10000);

  it('should call progress callback for each completion', async () => {
    const providers = [
      createMockProvider('P1', 50),
      createMockProvider('P2', 100),
      createMockProvider('P3', 150),
    ];
    const council = new Council(providers);

    const progressCalls: Array<{ name: string; success: boolean; completed: number }> = [];
    const onProgress = vi.fn(
      (params: { providerName: string; success: boolean; completed: number; total: number }) => {
        progressCalls.push({
          name: params.providerName,
          success: params.success,
          completed: params.completed,
        });
      }
    );

    await council.deliberate('Test question', { onProgress });

    // Should be called 3 times (once for each provider)
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(progressCalls).toHaveLength(3);

    // Check that completed count increases
    expect(progressCalls[0].completed).toBe(1);
    expect(progressCalls[1].completed).toBe(2);
    expect(progressCalls[2].completed).toBe(3);

    // All should be successful
    expect(progressCalls.every((p) => p.success)).toBe(true);
  });

  it('should report progress for failures too', async () => {
    const providers = [
      createMockProvider('Success', 50, false),
      createMockProvider('Failure', 50, true),
    ];
    const council = new Council(providers);

    const progressCalls: Array<{ name: string; success: boolean }> = [];
    const onProgress = vi.fn(
      (params: { providerName: string; success: boolean; completed: number; total: number }) => {
        progressCalls.push({
          name: params.providerName,
          success: params.success,
        });
      }
    );

    await council.deliberate('Test question', { onProgress });

    expect(onProgress).toHaveBeenCalledTimes(2);

    // Find the failure call
    const failureCall = progressCalls.find((p) => p.name === 'Failure');
    expect(failureCall).toBeDefined();
    expect(failureCall?.success).toBe(false);
  });

  it('should continue with remaining providers if one fails', async () => {
    const providers = [
      createMockProvider('P1', 50, true), // Fails immediately
      createMockProvider('P2', 100, false),
      createMockProvider('P3', 150, false),
      createMockProvider('P4', 200, false),
    ];
    const council = new Council(providers);

    const result = await council.deliberate('Test question');

    // Should have 3 successes and 1 failure
    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(1);

    // All 4 providers should have responded (3 success + 1 failure)
    expect(result.responses).toHaveLength(4);
  });

  it('should include original prompt in result', async () => {
    const providers = [createMockProvider('P1', 50)];
    const council = new Council(providers);

    const prompt = 'What is the meaning of life?';
    const result = await council.deliberate(prompt);

    expect(result.prompt).toBe(prompt);
  });
});
