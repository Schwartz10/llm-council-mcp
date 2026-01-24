import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { Provider, ProviderResponse } from '../types.js';

/**
 * Gemini provider - model-agnostic wrapper for any Gemini model
 */
export class GeminiProvider implements Provider {
  public readonly name: string;
  private readonly client: ReturnType<typeof createGoogleGenerativeAI>;
  private readonly modelId: string;

  constructor(apiKey: string, modelId: string, displayName?: string) {
    this.client = createGoogleGenerativeAI({ apiKey });
    this.modelId = modelId;
    this.name = displayName || `Gemini (${modelId})`;
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
        `Gemini query failed (${latencyMs}ms): ${error instanceof Error ? error.message : String(error)}`
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
        `Gemini stream failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
