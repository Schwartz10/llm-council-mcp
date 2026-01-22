import { ProviderResponse } from '../providers/types.js';
import { ConsensusResult, ConsensusStrategy } from './types.js';

/**
 * Configuration for Consensus module
 */
export interface ConsensusConfig {
  /**
   * Strategy to use for synthesizing responses
   */
  strategy: ConsensusStrategy;
}

/**
 * Consensus orchestrator that synthesizes multiple model responses into a unified answer
 *
 * The Consensus module takes responses from the Council (4 different AI models)
 * and uses a ConsensusStrategy to produce a single, unified answer with confidence
 * and agreement indicators.
 */
export class Consensus {
  private strategy: ConsensusStrategy;

  constructor(config: ConsensusConfig) {
    this.strategy = config.strategy;
  }

  /**
   * Synthesize multiple provider responses into a unified consensus
   *
   * @param responses - Array of responses from different providers (from Council)
   * @param originalPrompt - The original user question/prompt
   * @returns A consensus result with synthesis, agreement, confidence, and dissent
   */
  async synthesize(
    responses: ProviderResponse[],
    originalPrompt: string
  ): Promise<ConsensusResult> {
    if (responses.length === 0) {
      throw new Error('Cannot create consensus: no responses provided');
    }

    return this.strategy.synthesize(responses, originalPrompt);
  }

  /**
   * Get the current strategy name
   */
  getStrategyName(): string {
    return this.strategy.name;
  }

  /**
   * Switch to a different consensus strategy (for future extensibility)
   *
   * @param strategy - New strategy to use
   */
  setStrategy(strategy: ConsensusStrategy): void {
    this.strategy = strategy;
  }
}

// Re-export types and strategy for convenience
export { ConsensusResult, ConsensusStrategy } from './types.js';
export { SimpleSynthesis } from './strategies/simple-synthesis.js';
