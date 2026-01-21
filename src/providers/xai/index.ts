import { createXai } from '@ai-sdk/xai';
import { generateText, streamText } from 'ai';
import { Provider, ProviderResponse } from '../types.js';

/**
 * xAI provider - model-agnostic wrapper for any xAI model (Grok)
 */
export class XAIProvider implements Provider {
  public readonly name: string;
  private readonly client: ReturnType<typeof createXai>;
  private readonly modelId: string;

  constructor(apiKey: string, modelId: string, displayName?: string) {
    this.client = createXai({ apiKey });
    this.modelId = modelId;
    this.name = displayName || `xAI (${modelId})`;
  }

  async query(prompt: string): Promise<ProviderResponse> {
    const startTime = Date.now();

    try {
      const result = await generateText({
        model: this.client(this.modelId),
        prompt,
      });

      const latencyMs = Date.now() - startTime;

      return {
        content: result.text,
        provider: this.name,
        latencyMs,
        tokensUsed: result.usage?.totalTokens,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      throw new Error(
        `xAI query failed (${latencyMs}ms): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async *queryStream(prompt: string): AsyncIterable<string> {
    try {
      const result = streamText({
        model: this.client(this.modelId),
        prompt,
      });

      // Stream text chunks as they arrive
      for await (const chunk of result.textStream) {
        yield chunk;
      }
    } catch (error) {
      throw new Error(
        `xAI stream failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
