import { createGroq } from '@ai-sdk/groq';
import { generateText, streamText } from 'ai';
import { buildUserContent } from '../message.js';
import { Provider, ProviderResponse, ProviderRequestOptions } from '../types.js';

/**
 * Groq provider - model-agnostic wrapper for any Groq model
 */
export class GroqProvider implements Provider {
  public readonly name: string;
  public readonly modelId: string;
  private readonly client: ReturnType<typeof createGroq>;

  constructor(apiKey: string, modelId: string, displayName?: string) {
    this.client = createGroq({ apiKey });
    this.modelId = modelId;
    this.name = displayName || `Groq (${modelId})`;
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
      throw new Error(
        `Groq query failed (${latencyMs}ms): ${error instanceof Error ? error.message : String(error)}`
      );
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
        `Groq stream failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
