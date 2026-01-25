import type { ModelCritique, SynthesisData } from './types.js';

type Claim = {
  raw: string;
  tokens: string[];
  key: string;
  polarity: 'positive' | 'negative';
};

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'with',
  'this',
  'from',
  'your',
  'about',
  'into',
  'then',
  'than',
  'they',
  'them',
  'have',
  'has',
  'had',
  'will',
  'would',
  'could',
  'should',
  'must',
  'can',
  'use',
  'using',
  'you',
  'are',
  'was',
  'were',
  'been',
  'being',
  'not',
  'but',
  'all',
  'any',
  'its',
  'their',
  'there',
  'here',
  'also',
  'very',
  'more',
  'most',
  'some',
  'such',
  'only',
  'just',
  'over',
  'under',
  'when',
  'where',
  'what',
  'which',
  'while',
]);

const NEGATION_TOKENS = new Set(['not', "don't", 'dont', 'no', 'never', 'avoid', 'against']);

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function splitIntoSentences(text: string): string[] {
  // Split on newlines first to respect bullet lists, then split on punctuation.
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 0);

  const sentences: string[] = [];
  for (const line of lines) {
    const parts = line
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    sentences.push(...parts);
  }

  return sentences.slice(0, 12);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function detectPolarity(raw: string, tokens: string[]): 'positive' | 'negative' {
  const rawLower = raw.toLowerCase();
  if (
    rawLower.includes('do not') ||
    rawLower.includes("don't") ||
    rawLower.includes('should not')
  ) {
    return 'negative';
  }
  if (tokens.some((token) => NEGATION_TOKENS.has(token))) {
    return 'negative';
  }
  return 'positive';
}

function toClaim(sentence: string): Claim | null {
  const tokens = tokenize(sentence);
  if (tokens.length === 0) return null;

  const uniqueSortedTokens = Array.from(new Set(tokens)).sort();
  const key = uniqueSortedTokens.join(' ');

  return {
    raw: sentence,
    tokens: uniqueSortedTokens,
    key,
    polarity: detectPolarity(sentence, uniqueSortedTokens),
  };
}

function extractClaims(text: string): Claim[] {
  const sentences = splitIntoSentences(text);
  const claims = sentences
    .map((sentence) => toClaim(sentence))
    .filter((claim): claim is Claim => claim !== null);

  return claims.slice(0, 8);
}

function overlapRatio(a: string[], b: string[]): { ratio: number; shared: string[] } {
  const bSet = new Set(b);
  const shared = a.filter((token) => bSet.has(token));
  const minSize = Math.min(a.length, b.length);
  if (minSize === 0) return { ratio: 0, shared: [] };
  return { ratio: shared.length / minSize, shared };
}

function topicFromSharedTokens(tokens: string[]): string {
  if (tokens.length === 0) {
    return 'Conflicting recommendations';
  }
  const topTokens = tokens.slice(0, 4);
  return topTokens.join(' ');
}

function pickKeyInsight(claims: Claim[]): string {
  if (claims.length === 0) return '';
  // Prefer the most information-dense claim (most tokens).
  const sorted = [...claims].sort((a, b) => b.tokens.length - a.tokens.length);
  return sorted[0].raw;
}

export function extractSynthesisData(critiques: ModelCritique[]): SynthesisData {
  const successful = critiques.filter((critique) => !critique.error && critique.response.trim());
  if (successful.length === 0) {
    return {
      agreement_points: [],
      disagreements: [],
      key_insights: [],
      confidence: 0,
    };
  }

  const claimsByModel = new Map<string, Claim[]>();
  const claimSetsByModel = new Map<string, Set<string>>();

  for (const critique of successful) {
    const claims = extractClaims(critique.response);
    claimsByModel.set(critique.model, claims);
    claimSetsByModel.set(critique.model, new Set(claims.map((claim) => claim.key)));
  }

  // Agreement points: claims present across all successful models.
  const models = Array.from(claimSetsByModel.keys());
  const [firstModel, ...restModels] = models;
  const firstSet = claimSetsByModel.get(firstModel) ?? new Set<string>();
  const agreementKeys = Array.from(firstSet).filter((key) =>
    restModels.every((model) => claimSetsByModel.get(model)?.has(key))
  );

  const agreement_points: string[] = [];
  for (const key of agreementKeys.slice(0, 5)) {
    // Recover a representative raw sentence from the first model.
    const representative = claimsByModel.get(firstModel)?.find((claim) => claim.key === key);
    if (representative?.raw) {
      agreement_points.push(representative.raw);
    }
  }

  // Disagreements: similar topics with opposite polarity.
  const disagreementsMap = new Map<
    string,
    {
      topicTokens: string[];
      positions: Map<'positive' | 'negative', { models: Set<string>; views: string[] }>;
    }
  >();

  let agreementPairs = 0;
  let disagreementPairs = 0;

  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      const modelA = models[i];
      const modelB = models[j];
      const claimsA = claimsByModel.get(modelA) ?? [];
      const claimsB = claimsByModel.get(modelB) ?? [];

      for (const claimA of claimsA) {
        for (const claimB of claimsB) {
          const { ratio, shared } = overlapRatio(claimA.tokens, claimB.tokens);
          if (ratio < 0.5) continue;

          if (claimA.polarity === claimB.polarity) {
            agreementPairs++;
            continue;
          }

          disagreementPairs++;
          const topicKey = topicFromSharedTokens(shared);
          const existing = disagreementsMap.get(topicKey);
          if (!existing) {
            disagreementsMap.set(topicKey, {
              topicTokens: shared,
              positions: new Map([
                ['positive', { models: new Set<string>(), views: [] }],
                ['negative', { models: new Set<string>(), views: [] }],
              ]),
            });
          }

          const entry = disagreementsMap.get(topicKey);
          if (!entry) continue;

          const posA = entry.positions.get(claimA.polarity);
          const posB = entry.positions.get(claimB.polarity);
          if (posA) {
            posA.models.add(modelA);
            if (posA.views.length < 2) posA.views.push(claimA.raw);
          }
          if (posB) {
            posB.models.add(modelB);
            if (posB.views.length < 2) posB.views.push(claimB.raw);
          }
        }
      }
    }
  }

  const disagreements = Array.from(disagreementsMap.entries())
    .slice(0, 5)
    .map(([topic, data]) => {
      const positions = Array.from(data.positions.entries())
        .filter(([, value]) => value.models.size > 0)
        .map(([, value]) => ({
          models: Array.from(value.models),
          view: value.views[0] ?? topic,
        }));

      return {
        topic,
        positions,
      };
    })
    .filter((item) => item.positions.length >= 2);

  const key_insights = successful
    .map((critique) => {
      const claims = claimsByModel.get(critique.model) ?? [];
      const insight = pickKeyInsight(claims);
      if (!insight) return null;
      return {
        model: critique.model,
        insight,
      };
    })
    .filter((item): item is { model: string; insight: string } => item !== null)
    .slice(0, 6);

  // Confidence: balance of pairwise agreement vs disagreement.
  const totalPairs = (models.length * (models.length - 1)) / 2;
  const rawScore = totalPairs > 0 ? (agreementPairs - disagreementPairs) / totalPairs : 0;
  const confidence = clamp01((rawScore + 1) / 2);

  return {
    agreement_points,
    disagreements,
    key_insights,
    confidence,
  };
}
