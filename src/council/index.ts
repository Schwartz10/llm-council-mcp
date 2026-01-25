import type { Provider, ProviderAttachment, ProviderResponse } from '../providers/types.js';
import type { DeliberationResult, ProgressCallback } from './types.js';

/**
 * Council of AI Models
 *
 * Orchestrates parallel querying of multiple AI models (the "Council")
 * All models deliberate simultaneously on the same question.
 *
 * Features:
 * - Parallel execution with Promise.allSettled()
 * - Graceful handling of partial failures
 * - Progress callbacks for real-time UI updates
 * - User-cancellable via AbortSignal (no automatic timeout)
 */
export class Council {
  private providers: Provider[];
  private debug: boolean;

  constructor(providers: Provider[], options?: { debug?: boolean }) {
    this.providers = providers;
    this.debug = options?.debug || false;
  }

  /**
   * Queries all Council members in parallel
   *
   * @param prompt - The question to ask all Council members
   * @param options - Optional configuration for deliberation
   * @param options.onProgress - Optional progress callback for UI updates
   * @param options.attachments - Optional file attachments to include
   * @param options.signal - Optional AbortSignal for user cancellation (no automatic timeout)
   * @returns Deliberation result with all responses and metadata
   */
  async deliberate(
    prompt: string,
    options?: {
      onProgress?: ProgressCallback;
      attachments?: ProviderAttachment[];
      signal?: AbortSignal;
    }
  ): Promise<DeliberationResult> {
    if (this.debug) {
      console.log(`[Council] Starting deliberation with ${this.providers.length} providers`);
    }

    const startTime = Date.now();
    let completedCount = 0;
    const total = this.providers.length;
    const attachments = options?.attachments;
    const signal = options?.signal;

    // Create queries for each provider (no automatic timeout, only user cancellation)
    const queries = this.providers.map(async (provider) => {
      try {
        const response = await provider.query(prompt, { signal, attachments });

        // Report progress
        completedCount++;
        if (options?.onProgress) {
          options.onProgress({
            providerName: provider.name,
            success: true,
            completed: completedCount,
            total,
          });
        }

        if (this.debug) {
          console.log(`[Council] ${provider.name} completed (${response.latencyMs}ms)`);
        }

        return { status: 'fulfilled' as const, value: response };
      } catch (error) {
        // Report progress for failure too
        completedCount++;
        if (options?.onProgress) {
          options.onProgress({
            providerName: provider.name,
            success: false,
            completed: completedCount,
            total,
          });
        }

        if (this.debug) {
          console.log(
            `[Council] ${provider.name} failed:`,
            error instanceof Error ? error.message : String(error)
          );
        }

        // Return a failure response with error information
        const errorResponse: ProviderResponse = {
          content: '',
          provider: provider.name,
          modelId: provider.modelId,
          latencyMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        };
        return { status: 'rejected' as const, reason: errorResponse };
      }
    });

    // Wait for all providers to complete (or timeout)
    const results = await Promise.allSettled(queries);

    // Collect responses
    const responses: ProviderResponse[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
        responses.push(result.value.value);
        successCount++;
      } else if (result.status === 'fulfilled' && result.value.status === 'rejected') {
        responses.push(result.value.reason);
        failureCount++;
      } else if (result.status === 'rejected') {
        // This shouldn't happen since we handle errors inside queries, but just in case
        responses.push({
          content: '',
          provider: 'Unknown',
          modelId: 'unknown',
          latencyMs: 0,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
        failureCount++;
      }
    }

    const totalLatencyMs = Date.now() - startTime;

    if (this.debug) {
      console.log(
        `[Council] Deliberation complete: ${successCount} succeeded, ${failureCount} failed (${totalLatencyMs}ms total)`
      );
    }

    return {
      responses,
      totalLatencyMs,
      successCount,
      failureCount,
      prompt,
    };
  }

  /**
   * Gets the list of provider names in the Council
   */
  getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  /**
   * Gets the number of providers in the Council
   */
  getProviderCount(): number {
    return this.providers.length;
  }
}
