/**
 * Prompt templates for Personal Brain operations
 */

/**
 * Pre-processing prompt template
 * Takes a raw user query and prepares it for Council deliberation
 *
 * Goals:
 * 1. Clarify any ambiguities
 * 2. Add helpful context
 * 3. Structure the query for optimal Council performance
 * 4. Maintain the user's intent
 */
export function getPreProcessingPrompt(userQuery: string): string {
  return `You are the Personal Brain, preparing a user's question for deliberation by a Council of 4 expert AI models.

Your task is to:
1. Clarify any ambiguities in the question
2. Add helpful context if needed (e.g., "This is a technical question about...")
3. Structure the query clearly and concisely
4. Preserve the user's original intent

User's question: "${userQuery}"

Respond with ONLY the formatted question ready for the Council. Do not add explanations or meta-commentary. Keep it concise and focused.`;
}

/**
 * Post-processing prompt template
 * Takes a ConsensusResult and formats it for clear presentation to the user
 *
 * Goals:
 * 1. Present the synthesis clearly and conversationally
 * 2. Note confidence level appropriately
 * 3. Highlight any dissent or areas of disagreement
 * 4. Make the response feel cohesive and authoritative
 */
export function getPostProcessingPrompt(
  synthesis: string,
  agreement: boolean,
  confidence: number,
  dissent?: string
): string {
  const confidenceLabel =
    confidence >= 0.8
      ? 'high confidence'
      : confidence >= 0.5
        ? 'moderate confidence'
        : 'low confidence';

  const agreementNote = agreement
    ? 'The Council models were in strong agreement.'
    : 'The Council models had some divergent perspectives.';

  return `You are the Personal Brain, presenting the final answer to the user after consulting with a Council of 4 expert AI models.

Council Synthesis:
${synthesis}

Agreement Status: ${agreementNote}
Confidence Level: ${confidenceLabel} (${confidence.toFixed(2)})
${dissent ? `Notable Dissent: ${dissent}` : ''}

Your task is to format this information into a clear, conversational response for the user:

1. Lead with the main answer (the synthesis)
2. If confidence is moderate or low, acknowledge uncertainty appropriately
3. If there was dissent, mention the alternative viewpoints briefly
4. Keep the tone authoritative but honest about limitations
5. Make it feel cohesive - don't just list bullet points

Respond with the formatted answer ready to present to the user.`;
}
