import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText } from 'ai';
import { Provider, ProviderResponse } from '../types.js';

/**
 * Anthropic provider - model-agnostic wrapper for any Anthropic model
 */
export class AnthropicProvider implements Provider {
  public readonly name: string;
  private readonly client: ReturnType<typeof createAnthropic>;
  private readonly modelId: string;

  constructor(apiKey: string, modelId: string, displayName?: string) {
    this.client = createAnthropic({ apiKey });
    this.modelId = modelId;
    this.name = displayName || `Anthropic (${modelId})`;
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
      // Get detailed error message
      let errorMsg = 'Unknown error';
      if (error instanceof Error) {
        errorMsg = error.message;
        // Include stack for debugging if available
        if (error.stack && error.stack.includes('Error:')) {
          const stackLines = error.stack.split('\n');
          if (stackLines.length > 1) {
            errorMsg += ` (${stackLines[1].trim()})`;
          }
        }
      } else {
        errorMsg = String(error);
      }
      throw new Error(`Anthropic query failed (${latencyMs}ms): ${errorMsg}`);
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
        `Anthropic stream failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
