import { describe, expect, test } from 'vitest';
import type { ModelCritique } from './types.js';
import { extractSynthesisData } from './synthesis.js';

function critique(model: string, response: string): ModelCritique {
  return {
    model,
    model_id: `${model.toLowerCase()}-model`,
    response,
    latency_ms: 100,
  };
}

describe('extractSynthesisData', () => {
  test('identifies agreement points across models', () => {
    const critiques: ModelCritique[] = [
      critique('Claude', 'Use TypeScript for type safety. Prefer explicit interfaces.'),
      critique('GPT', 'Use TypeScript for type safety. Prefer explicit interfaces.'),
      critique('Grok', 'Use TypeScript for type safety. Prefer explicit interfaces.'),
    ];

    const synthesis = extractSynthesisData(critiques);

    expect(synthesis.agreement_points.length).toBeGreaterThan(0);
    expect(synthesis.agreement_points.join(' ')).toContain('Use TypeScript for type safety');
    expect(synthesis.disagreements).toHaveLength(0);
    expect(synthesis.confidence).toBeGreaterThan(0.6);
  });

  test('detects disagreements with opposing polarity on the same topic', () => {
    const critiques: ModelCritique[] = [
      critique('Claude', 'Use MongoDB for flexibility in this project.'),
      critique('GPT', 'Do not use MongoDB here. Use Postgres for strong consistency.'),
      critique('Grok', 'Use MongoDB for flexibility in this project.'),
    ];

    const synthesis = extractSynthesisData(critiques);

    expect(synthesis.disagreements.length).toBeGreaterThan(0);
    expect(JSON.stringify(synthesis.disagreements).toLowerCase()).toContain('mongodb');
    expect(synthesis.confidence).toBeLessThan(0.7);
  });

  test('attributes key insights to specific models', () => {
    const critiques: ModelCritique[] = [
      critique('Claude', 'Add input validation at the boundary. This prevents unsafe states.'),
      critique('GPT', 'Introduce a shared schema and parse early. This improves reliability.'),
    ];

    const synthesis = extractSynthesisData(critiques);

    const models = synthesis.key_insights.map((item) => item.model);
    expect(models).toContain('Claude');
    expect(models).toContain('GPT');
  });
});
