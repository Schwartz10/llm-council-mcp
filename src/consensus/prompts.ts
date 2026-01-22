import { ProviderResponse } from '../providers/types.js';

/**
 * Generate synthesis prompt for combining multiple model responses
 */
export function generateSynthesisPrompt(
  originalPrompt: string,
  responses: ProviderResponse[]
): string {
  const modelResponses = responses
    .map(
      (r, i) => `
**Model ${i + 1} (${r.provider}):**
${r.content}
`
    )
    .join('\n');

  return `You are synthesizing answers from ${responses.length} different AI models to produce the best possible response.

**Original question:**
${originalPrompt}

**Model responses:**
${modelResponses}

Your task is to create a unified synthesis that:
1. Combines the best insights from all models
2. Identifies areas of agreement and disagreement
3. Produces a confidence assessment based on consensus
4. Highlights any significant dissent or alternative viewpoints

Respond with a JSON object in the following format:
{
  "synthesis": "The unified, synthesized answer combining insights from all models",
  "agreement": true/false (did models broadly agree?),
  "confidence": 0.0-1.0 (confidence score based on model consensus),
  "dissent": "Notable disagreements, if any (optional)"
}

IMPORTANT: Respond ONLY with valid JSON. Do not include any other text or markdown formatting.`;
}
