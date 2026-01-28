# Context Sharing Guide

Use short, structured context so models can respond precisely without truncation.

## Recommended Brief

```ts
interface ContextBrief {
  goal: string;
  constraints: string[];
  relevant_facts: string[];
  avoid: string[];
}
```

## Practical Tips

- Lead with a 2–3 sentence summary.
- Include only the minimal files or excerpts needed.
- Provide exact error messages and repro steps.
- Reserve space for the model response (keep context tight).

## Example

```
Context:
- Goal: Review error handling for consult_llm_council responses
- Constraints: No API changes; preserve logging format
- Relevant facts: Responses include synthesis_data unless show_raw=true
Question: Are there missing edge cases in error redaction?
```

