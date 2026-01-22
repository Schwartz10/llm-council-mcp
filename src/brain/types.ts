import type { Provider } from '../providers/types.js';

/**
 * Configuration for the Personal Brain
 */
export interface BrainConfig {
  /**
   * The provider to use for Brain operations
   * Default: Claude Sonnet 4.5
   * Can be any Provider implementation
   */
  provider: Provider;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;
}

/**
 * Result of pre-processing a user query
 */
export interface PreProcessingResult {
  /**
   * The formatted prompt ready for Council deliberation
   */
  prompt: string;

  /**
   * Original user query for reference
   */
  originalQuery: string;

  /**
   * Any additional context added during pre-processing
   */
  contextAdded?: string;
}
