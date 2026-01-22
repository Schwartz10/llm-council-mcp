import type { ProviderResponse } from '../providers/types.js';

/**
 * Result of a Council deliberation
 */
export interface DeliberationResult {
  /**
   * Array of responses from each Council member
   * Successful responses will have content
   * Failed responses will have error information in the provider field
   */
  responses: ProviderResponse[];

  /**
   * Total deliberation time in milliseconds
   */
  totalLatencyMs: number;

  /**
   * Number of successful responses
   */
  successCount: number;

  /**
   * Number of failed responses
   */
  failureCount: number;

  /**
   * The original prompt sent to Council
   */
  prompt: string;
}

/**
 * Progress callback for Council deliberation
 * Called when each provider completes (success or failure)
 */
export type ProgressCallback = (params: {
  providerName: string;
  success: boolean;
  completed: number;
  total: number;
}) => void;
