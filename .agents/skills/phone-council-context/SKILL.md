---
name: phone-council-context
description: Guidance for crafting high-quality context when using the phone_council MCP tool. Use when a user wants help preparing context, summarizing files, or structuring prompts for council consultations.
---

# Phone Council Context Skill

## Overview

Provide concise, high-signal context for `phone_council` requests. This skill focuses on context budgeting, structuring information, and avoiding truncation or irrelevant details.

## Core Guidance

- Prefer a short, structured summary over raw dumps.
- Lead with the goal and constraints.
- Include only the most relevant excerpts.
- Reserve budget for the model response.

## Recommended Brief

Use a concise schema for repeatable structure:

```typescript
interface ContextBrief {
  goal: string;
  constraints: string[];
  relevant_facts: string[];
  avoid: string[];
}
```

## When To Load The Reference Guide

Open `references/CONTEXT_GUIDE.md` when:

- The user asks how to share context or what to include
- You need concrete examples (code review, PR review, architecture decision, bug fix, feature request)
- You need truncation/budget examples or provider context limits

## How To Use This Skill

1. Gather the user’s goal, constraints, and the minimal relevant facts.
2. Propose a concise ContextBrief if none is provided.
3. Suggest what to omit or summarize to stay within budget.
4. If the context is large, include a short summary + targeted excerpts.

## Resources

- `references/CONTEXT_GUIDE.md`: Full context-sharing guide with budgets, truncation examples, and scenario templates.
