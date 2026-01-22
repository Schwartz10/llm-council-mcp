import type { BrainConfig } from './types.js';
import { getPreProcessingPrompt } from './prompts.js';

/**
 * Personal Brain
 *
 * Orchestrates the entire Second Brain flow:
 * 1. Pre-processes user queries (adds clarity and context)
 * 2. Coordinates with Council for deliberation
 * 3. Post-processes consensus results for final presentation
 *
 * The Brain is configurable with any Provider (default: Claude Sonnet 4.5)
 */
export class Brain {
  private config: BrainConfig;

  constructor(config: BrainConfig) {
    this.config = config;
  }

  /**
   * Pre-processes a user's raw query to prepare it for Council deliberation
   *
   * @param userQuery - The raw user question
   * @returns Pre-processed prompt ready for Council
   */
  async prepareForCouncil(userQuery: string): Promise<string> {
    if (this.config.debug) {
      console.log('[Brain] Pre-processing query:', userQuery);
    }

    try {
      // Get the pre-processing prompt
      const prompt = getPreProcessingPrompt(userQuery);

      // Query the provider to pre-process the user's question
      const response = await this.config.provider.query(prompt);

      // The response content is the formatted question for Council
      const formattedPrompt = response.content.trim();

      if (this.config.debug) {
        console.log('[Brain] Pre-processed prompt:', formattedPrompt);
        console.log(`[Brain] Pre-processing took ${response.latencyMs}ms`);
      }

      return formattedPrompt;
    } catch (error) {
      // If pre-processing fails, fall back to original query
      console.warn(
        '[Brain] Pre-processing failed, using original query:',
        error instanceof Error ? error.message : String(error)
      );
      return userQuery;
    }
  }

  /**
   * General-purpose query method for the Brain
   *
   * This allows the Brain to query its provider for any purpose
   * (synthesis, post-processing, etc.)
   *
   * @param prompt - The prompt to send to the provider
   * @returns The provider's response content
   */
  async query(prompt: string): Promise<string> {
    const response = await this.config.provider.query(prompt);
    return response.content;
  }

  /**
   * Gets the provider name for debugging/logging
   */
  getProviderName(): string {
    return this.config.provider.name;
  }
}
