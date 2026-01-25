/**
 * Council Server Types
 *
 * Request/response interfaces for the Council daemon server.
 */

import type { ProviderAttachment } from '../providers/types.js';

/**
 * Council consultation request
 */
export interface CouncilRequest {
  prompt: string; // The question or prompt to consult Council about
  context?: string; // Optional additional context
  attachments?: ProviderAttachment[]; // Optional file attachments
  signal?: AbortSignal; // Optional abort signal for user cancellation
  show_raw?: boolean; // Optional flag to skip synthesis data and instruction
}

/**
 * Individual model critique
 */
export interface ModelCritique {
  model: string; // Model name (e.g., "Claude Sonnet 4.5")
  model_id: string; // Concrete model identifier (e.g., "gpt-4o")
  response: string; // The model's critique/response
  latency_ms: number; // Time taken for this model to respond
  error?: string; // Error message if the model failed
  redacted?: boolean; // True if sensitive data was redacted from the response
  warnings?: string[]; // Security warnings (e.g., sensitive data detected)
}

/**
 * Structured synthesis data extracted from Council responses
 */
export interface SynthesisData {
  agreement_points: string[];
  disagreements: Array<{
    topic: string;
    positions: Array<{
      models: string[];
      view: string;
    }>;
  }>;
  key_insights: Array<{
    model: string;
    insight: string;
  }>;
  confidence: number; // 0-1 score representing agreement level
}

/**
 * Council consultation response
 */
export interface CouncilResponse {
  critiques: ModelCritique[]; // Array of responses from each model
  summary: {
    models_consulted: number; // Total number of models queried
    models_responded: number; // Number of models that successfully responded
    models_failed: number; // Number of models that failed
    total_latency_ms: number; // Total time for all queries
  };
  synthesis_data?: SynthesisData;
  synthesis_instruction?: string;
}
