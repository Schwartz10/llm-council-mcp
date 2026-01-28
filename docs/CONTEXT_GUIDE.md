# Context Sharing Guide

This guide explains how to provide effective context to the `consult_second_brain` MCP tool while staying within model limits. It includes a recommended brief schema, budget guidance, truncation examples, and scenario-specific examples.

## Goals

- Provide just enough context for accurate responses
- Avoid overwhelming the models with irrelevant data
- Prevent truncation of critical details
- Share sensitive data responsibly

## Recommended Context Brief Schema

Use a concise, structured summary when you can.

```typescript
interface ContextBrief {
  goal: string; // What you're trying to achieve
  constraints: string[]; // Known limitations or requirements
  relevant_facts: string[]; // Key information models must know
  avoid: string[]; // What NOT to consider or do
}
```

Example:

```json
{
  "goal": "Review the CLI's error handling for the council tool",
  "constraints": ["Do not change public API", "Preserve existing log format"],
  "relevant_facts": [
    "Tool name is consult_second_brain",
    "Response includes structured synthesis_data when show_raw=false"
  ],
  "avoid": ["Rewriting unrelated files", "Adding new dependencies"]
}
```

## Provider Context Limits (Approximate)

These are common limits. Always verify if you rely on exact thresholds.

- Claude Sonnet: ~200k tokens
- GPT-5.2 / GPT-4o: ~128k tokens
- Gemini 1.5 Pro: ~128k tokens
- Grok 3 Beta: ~128k tokens
- Llama 4 Maverick: ~128k tokens

Practical guidance: treat these as budgets that include your prompt, context, and attachments. Always leave room for the model response.

## Budget Management

- Estimate tokens at ~4 characters per token (rough rule of thumb).
- Reserve at least 20% of the window for the response.
- Prefer summaries over raw logs or entire files.
- When sharing files, include:
  - File path and purpose
  - Relevant sections or functions only
  - Specific questions about behavior
- If you must include long content, lead with a summary and then include excerpts.

### Truncation Example

**Before (risky):**

```
Context: Entire 5000-line file pasted without summary.
Question: Why is the tool timing out?
```

**After (better):**

```
Context:
- Summary: The council tool times out when attachments exceed ~5MB.
- Relevant file: src/server/attachments.ts (lines related to size checks)
- Observed error: "Attachment exceeds max size of 5000000 bytes."
Question: How should we adjust size validation or messaging?
```

## Scenario Examples

### Code Review

Provide just enough to understand the diff and intent.

```
Context:
- File: src/server/shared.ts
- Change summary: Added synthesis_data to tool response
- Concern: We might be missing redaction on errors
- Related files: src/server/sanitize.ts
Question: Is the response sanitization sufficient and consistent?
```

### PR Review

Include the intent, changed files, and test status.

```
Context:
- PR intent: Add context validation warnings
- Changed files: src/server/context-validator.ts, src/server/shared.ts
- Tests: npm test (pass), npm run lint (pass)
- Risk: New warnings might break consumers
Question: Any compatibility risks or missing tests?
```

### Architecture Decision

Include the relevant documents and constraints.

```
Context:
- Docs: PLAN.md, ARCHITECTURE.md
- Goal: Add context budget controls without altering CLI UX
- Constraints: Maintain current tool schema
Question: Which module should own context validation and why?
```

### Bug Fix

Give a minimal reproduction with exact error text.

```
Context:
- Error: "Attachment mediaType not allowed: image/heic"
- Repro: Send image/heic with data URL to consult_second_brain
- Config: attachmentAllowedMediaTypes defaults
Question: How should we handle this media type?
```

### Feature Request

Share a user story and acceptance criteria.

```
Context:
- User story: Users want to include structured constraints in requests
- Acceptance: Support a ContextBrief schema
- Avoid: Changing output structure
Question: How should we layer ContextBrief into the existing prompt?
```

## Validation Notes (What to Expect)

When validation tooling is in place, expect warnings when:

- Context exceeds provider limits
- Attachments are too large
- Content looks like prompt injection
- Sensitive data (keys, credentials, emails) appears in outputs

Even without automated validation, you can manually scan for:

- Excessively long raw logs or entire files
- Missing summaries for large inputs
- Unnecessary files included "just in case"

## What Works Well

- Tight summaries paired with targeted excerpts
- Clear constraints and explicit “avoid” lists
- Reproducible error text and environment details
- Intent + expected outcome in one or two sentences

## Gaps to Track for Future Improvement

- Automatic context type detection (code review vs bug fix)
- Smart file selection based on imports
- More accurate token estimation per provider
*** End Patch
