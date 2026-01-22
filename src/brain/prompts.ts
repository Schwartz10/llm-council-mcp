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
