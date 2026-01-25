/**
 * Response from a provider query
 */
export interface ProviderResponse {
  content: string; // The model's response
  provider: string; // Human-readable provider name (e.g., "Claude Sonnet 4.5")
  modelId: string; // Concrete model identifier used (e.g., "gpt-4o")
  latencyMs: number; // Time taken to complete the query
  tokensUsed?: number; // Optional token usage information
  error?: string; // Optional error message if query failed
}

export interface ProviderAttachment {
  filename?: string; // Optional filename for the attachment
  mediaType: string; // IANA media type (e.g., "application/zip")
  data?: string; // Base64 or data URL
  url?: string; // http(s) URL to the file
}

export interface ProviderRequestOptions {
  signal?: AbortSignal;
  attachments?: ProviderAttachment[];
}

/**
 * Provider interface that all LLM providers must implement
 */
export interface Provider {
  name: string; // Human-readable name (e.g., "Claude Sonnet 4.5", "GPT-5.2")
  modelId: string; // Concrete model identifier (primary or last successful fallback)

  /**
   * Query the provider with a prompt and get a complete response
   */
  query(prompt: string, options?: ProviderRequestOptions): Promise<ProviderResponse>;

  /**
   * Query the provider with streaming response
   * Yields chunks of text as they arrive
   */
  queryStream(prompt: string, options?: ProviderRequestOptions): AsyncIterable<string>;
}
