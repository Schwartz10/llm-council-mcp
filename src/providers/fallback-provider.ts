import type { Provider, ProviderRequestOptions, ProviderResponse } from './types.js';

export class FallbackProvider implements Provider {
  public readonly name: string;
  private readonly providers: Provider[];
  private readonly failureTimestamps: Array<number | undefined>;
  private readonly cooldownMs: number;
  private lastSuccessIndex: number;

  constructor(name: string, providers: Provider[], cooldownMs: number) {
    if (providers.length === 0) {
      throw new Error('FallbackProvider requires at least one provider');
    }
    this.name = name;
    this.providers = providers;
    this.cooldownMs = cooldownMs;
    this.failureTimestamps = new Array(providers.length).fill(undefined);
    this.lastSuccessIndex = 0;
  }

  private isHealthy(index: number): boolean {
    const lastFailure = this.failureTimestamps[index];
    if (!lastFailure) {
      return true;
    }
    return Date.now() - lastFailure > this.cooldownMs;
  }

  private markFailure(index: number): void {
    this.failureTimestamps[index] = Date.now();
  }

  private getCandidateIndexes(): number[] {
    const indexes = Array.from({ length: this.providers.length }, (_, i) => i);
    const rotated = indexes
      .slice(this.lastSuccessIndex)
      .concat(indexes.slice(0, this.lastSuccessIndex));
    const healthy = rotated.filter((index) => this.isHealthy(index));
    if (healthy.length > 0) {
      return healthy;
    }
    return rotated;
  }

  async query(prompt: string, options?: ProviderRequestOptions): Promise<ProviderResponse> {
    let lastError: unknown;

    for (const index of this.getCandidateIndexes()) {
      try {
        const response = await this.providers[index].query(prompt, options);
        this.lastSuccessIndex = index;
        return response;
      } catch (error) {
        if (options?.signal?.aborted) {
          throw error;
        }
        this.markFailure(index);
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error('All fallback providers failed');
  }

  async *queryStream(prompt: string, options?: ProviderRequestOptions): AsyncIterable<string> {
    let lastError: unknown;

    for (const index of this.getCandidateIndexes()) {
      let yielded = false;
      try {
        for await (const chunk of this.providers[index].queryStream(prompt, options)) {
          yielded = true;
          yield chunk;
        }
        this.lastSuccessIndex = index;
        return;
      } catch (error) {
        if (options?.signal?.aborted || yielded) {
          throw error;
        }
        this.markFailure(index);
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error('All fallback providers failed');
  }
}
