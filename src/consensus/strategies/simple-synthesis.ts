import { Brain } from '../../brain/index.js';
import { ProviderResponse } from '../../providers/types.js';
import { ConsensusResult, ConsensusStrategy } from '../types.js';
import { generateSynthesisPrompt } from '../prompts.js';

/**
 * Simple synthesis strategy that uses the Personal Brain to combine responses
 *
 * This MVP strategy sends all model responses to the Brain with a synthesis prompt,
 * which identifies agreement patterns, confidence levels, and dissent.
 */
export class SimpleSynthesis implements ConsensusStrategy {
  public readonly name = 'SimpleSynthesis';

  constructor(private brain: Brain) {}

  async synthesize(
    responses: ProviderResponse[],
    originalPrompt: string
  ): Promise<ConsensusResult> {
    if (responses.length === 0) {
      throw new Error('Cannot synthesize consensus: no responses provided');
    }

    const synthesisPrompt = generateSynthesisPrompt(originalPrompt, responses);

    try {
      // Ask Brain to synthesize the responses
      const brainResponse = await this.brain.query(synthesisPrompt);

      // Parse JSON response from Brain
      const parsed = this.parseConsensusJson(brainResponse);

      return parsed;
    } catch (error) {
      // Fallback: if synthesis fails, create a basic consensus result
      console.warn('Synthesis failed, using fallback consensus:', error);
      return this.createFallbackConsensus(responses, originalPrompt);
    }
  }

  /**
   * Parse JSON response from Brain into ConsensusResult
   */
  private parseConsensusJson(response: string): ConsensusResult {
    // Extract JSON from response (in case Brain added markdown formatting)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Brain response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (
      typeof parsed.synthesis !== 'string' ||
      typeof parsed.agreement !== 'boolean' ||
      typeof parsed.confidence !== 'number'
    ) {
      throw new Error('Invalid JSON structure from Brain');
    }

    // Ensure confidence is in valid range
    const confidence = Math.max(0, Math.min(1, parsed.confidence));

    return {
      synthesis: parsed.synthesis,
      agreement: parsed.agreement,
      confidence,
      dissent: parsed.dissent || undefined,
    };
  }

  /**
   * Create fallback consensus when synthesis fails
   *
   * Returns a basic consensus that simply concatenates all responses
   * with low confidence to indicate we couldn't properly synthesize.
   */
  private createFallbackConsensus(
    responses: ProviderResponse[],
    originalPrompt: string
  ): ConsensusResult {
    // Combine all responses with source attribution
    const synthesis = responses.map((r) => `**${r.provider}:**\n${r.content}`).join('\n\n---\n\n');

    return {
      synthesis: `Multiple perspectives on: "${originalPrompt}"\n\n${synthesis}`,
      agreement: false,
      confidence: 0.3, // Low confidence for fallback
      dissent: 'Unable to synthesize responses automatically. Showing all perspectives.',
    };
  }
}
