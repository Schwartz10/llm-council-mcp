import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText } from 'ai';
import { buildUserContent } from '../message.js';
import { Provider, ProviderResponse, ProviderRequestOptions } from '../types.js';

/**
 * Anthropic provider - model-agnostic wrapper for any Anthropic model
 */
export class AnthropicProvider implements Provider {
  public readonly name: string;
  public readonly modelId: string;
  private readonly client: ReturnType<typeof createAnthropic>;

  constructor(apiKey: string, modelId: string, displayName?: string) {
    this.client = createAnthropic({ apiKey });
    this.modelId = modelId;
    this.name = displayName || `Anthropic (${modelId})`;
  }

  async query(prompt: string, options?: ProviderRequestOptions): Promise<ProviderResponse> {
    const startTime = Date.now();

    try {
      const content = buildUserContent(prompt, options?.attachments);
      const result = await generateText({
        model: this.client(this.modelId),
        ...(Array.isArray(content)
          ? { messages: [{ role: 'user', content }] }
          : { prompt: content }),
        abortSignal: options?.signal,
      });

      const latencyMs = Date.now() - startTime;

      return {
        content: result.text,
        provider: this.name,
        modelId: this.modelId,
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

  async *queryStream(prompt: string, options?: ProviderRequestOptions): AsyncIterable<string> {
    try {
      const content = buildUserContent(prompt, options?.attachments);
      const result = streamText({
        model: this.client(this.modelId),
        ...(Array.isArray(content)
          ? { messages: [{ role: 'user', content }] }
          : { prompt: content }),
        abortSignal: options?.signal,
      });

      // Stream text chunks as they arrive
      for await (const chunk of result.textStream) {
        yield chunk;
      }
    } catch (error) {
      throw new Error(
        `Anthropic stream failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
