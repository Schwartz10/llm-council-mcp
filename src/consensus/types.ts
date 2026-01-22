import { ProviderResponse } from '../providers/types.js';

/**
 * Result of consensus synthesis from multiple model responses
 */
export interface ConsensusResult {
  /**
   * The unified, synthesized answer combining insights from all models
   */
  synthesis: string;

  /**
   * Whether the models broadly agreed on the answer
   */
  agreement: boolean;

  /**
   * Confidence score from 0 (low) to 1 (high) based on model consensus
   */
  confidence: number;

  /**
   * Notable disagreements or dissenting viewpoints, if any
   */
  dissent?: string;
}

/**
 * Strategy for synthesizing multiple model responses into a unified answer
 */
export interface ConsensusStrategy {
  /**
   * Human-readable name of the strategy
   */
  name: string;

  /**
   * Synthesize multiple provider responses into a unified consensus
   *
   * @param responses - Array of responses from different providers
   * @param originalPrompt - The original user question/prompt
   * @returns A consensus result with synthesis, agreement, confidence, and dissent
   */
  synthesize(responses: ProviderResponse[], originalPrompt: string): Promise<ConsensusResult>;
}
