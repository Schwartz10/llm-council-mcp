/**
 * Response from a provider query
 */
export interface ProviderResponse {
  content: string; // The model's response
  provider: string; // Human-readable provider name (e.g., "Claude Sonnet 4.5")
  latencyMs: number; // Time taken to complete the query
  tokensUsed?: number; // Optional token usage information
}

/**
 * Provider interface that all LLM providers must implement
 */
export interface Provider {
  name: string; // Human-readable name (e.g., "Claude Sonnet 4.5", "GPT-5.2")

  /**
   * Query the provider with a prompt and get a complete response
   */
  query(prompt: string): Promise<ProviderResponse>;

  /**
   * Query the provider with streaming response
   * Yields chunks of text as they arrive
   */
  queryStream(prompt: string): AsyncIterable<string>;
}
