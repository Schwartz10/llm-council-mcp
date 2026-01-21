# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Second Brain" - a CLI tool that demonstrates multi-model AI deliberation produces better answers than any single model. Users ask questions through a Personal Brain (Claude Sonnet 4.5), which escalates to 4 frontier models deliberating in parallel, then synthesizes a unified response.

**Goal:** Prove Second Brain answers are preferred >60% of the time vs best single model.

## Development Commands

```bash
# Run CLI with TypeScript
npx tsx src/index.ts

# Test provider connectivity
npx tsx src/index.ts --test-providers

# Ask a question through Second Brain
second-brain ask "your question here"

# Evaluation commands (Phase 7)
second-brain eval run              # Run all test questions
second-brain eval compare          # Interactive blind A/B comparison
second-brain eval report           # Generate preference stats
```

## Architecture

```
User → CLI → Personal Brain (Claude Sonnet) → Second Brain (5 models in parallel) → Consensus Module → Personal Brain (synthesis) → User
```

### Tech Stack
- **Language:** TypeScript/Node.js (single package)
- **LLM SDKs:** Vercel AI SDK (`@ai-sdk/*`) for unified provider interface
- **CLI Framework:** Commander.js

### The Four Second Brain Models
1. Claude Sonnet 4.5 (Anthropic)
2. GPT-5.2 (OpenAI)
3. Grok (xAI)
4. Llama 4 Maverick (via Groq) - `meta-llama/llama-4-maverick-17b-128e-instruct`

### Personal Brain
- Default: Claude Sonnet 4.5
- Must be swappable to any Provider (designed for future flexibility)

## Code Architecture

### Provider Abstraction (`src/providers/`)
All LLM providers implement the same interface:

```typescript
interface Provider {
  name: string;  // e.g., "Claude Sonnet 4.5", "GPT-5.2"
  query(prompt: string): Promise<ProviderResponse>;
  queryStream(prompt: string): AsyncIterable<string>;
}

interface ProviderResponse {
  content: string;
  provider: string;
  latencyMs: number;
  tokensUsed?: number;
}
```

**Hierarchical Structure:**
Each provider has its own directory with shared logic and model-specific implementations:
- `providers/anthropic/` - Shared Anthropic logic + claude-sonnet-4-5.ts
- `providers/openai/` - Shared OpenAI logic + gpt-5-2.ts
- `providers/xai/` - Shared xAI logic + grok.ts
- `providers/groq/` - Shared Groq logic + llama.ts

Each provider's `index.ts` handles:
- API client setup via Vercel AI SDK
- Common error handling and graceful degradation
- Latency tracking
- Structured response formatting

Each model-specific file handles:
- Model ID and parameters
- Any model-specific configuration

### Second Brain Module (`src/second-brain/`)
Orchestrates parallel querying:
- Uses `Promise.allSettled()` to query all 4 providers simultaneously
- 30s timeout per provider
- Handles partial failures (continues if 1 model fails)
- Emits progress events for CLI streaming UI

### Consensus Module (`src/consensus/`)
Synthesizes multiple responses into one unified answer:

```typescript
interface ConsensusResult {
  synthesis: string;           // The unified answer
  agreement: boolean;          // Did models broadly agree?
  confidence: number;          // 0-1 confidence score
  dissent?: string;            // Notable disagreements
}
```

**MVP Strategy:** SimpleSynthesis sends all 4 responses to Personal Brain with a synthesis prompt that:
1. Combines insights from all models
2. Identifies agreement vs disagreement patterns
3. Produces confidence level based on consensus
4. Highlights any significant dissent

**Extensibility:** New strategies can be added as files in `src/consensus/strategies/`

### Personal Brain (`src/brain/`)
Two-stage processing:
1. **Pre-processing:** Clarifies user questions, adds context, formats for Second Brain
2. **Post-processing:** Takes ConsensusResult, formats final response with confidence indicators and dissent notes

Configurable with any Provider but defaults to Claude Sonnet 4.5.

### CLI Interface (`src/cli/`)
Uses Commander.js + ora spinners for:
- Real-time progress as each model responds
- Pretty-printed markdown responses
- Timing information
- Graceful Ctrl+C handling

### Evaluation Module (`src/eval/`)
**Purpose:** Validate that Second Brain > single model

**Method:**
1. 20 hard test questions (reasoning, analysis, coding)
2. For each: get Second Brain answer + individual model answers
3. Blind A/B comparison for human evaluation
4. Track preference rate (target: >60% for Second Brain)

This module is separate from production code and used only for validation.

## Environment Variables

Required API keys (see `.env.example`):
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `XAI_API_KEY`
- `GROQ_API_KEY`

Optional:
- `SECOND_BRAIN_TIMEOUT_MS` (default: 30000)
- `SECOND_BRAIN_DEBUG` (default: false)

## Working with PLAN.md

### MVP Scope Discipline
MVPs must be tight in scope. Each task within phases should be highly testable.

### Task Tracking in PLAN.md
When implementing phases:

1. **Check for build errors FIRST:** Before marking any phase as complete, ALWAYS run `npx tsc --noEmit` to check for TypeScript build errors. ALWAYS run `npm run lint` to check for linter errors or warnings. Fix all errors, compiler warnings, and linter issues before proceeding. Linter errors can attempted to be fixed with `npm run format` and `npm run lint:fix`
2. **Mark completed tasks:** Check off tasks as you finish them using checkboxes
3. **Document extra steps:** If you had to do additional work beyond what was planned to complete a task, document those extra steps in PLAN.md under the relevant task
4. **Keep it testable:** Each task should have clear verification criteria
5. **Update README.md:** Whenever you add a feature that has implications for how end users interact with the system (new CLI commands, flags, configuration options, etc.), update the README.md with clear documentation and usage examples

**CRITICAL:** Never mark a phase as "finished" if there are build errors, compiler errors, or linter warnings.

Example:
```markdown
**Tasks:**
- [x] Initialize npm project with TypeScript
  - Extra steps taken: Had to configure ES modules in tsconfig.json due to Vercel AI SDK requirements
- [x] Install Vercel AI SDK providers for all 5 models
- [ ] Create config loader that validates all 5 API keys exist
```

### Implementation Order
Follow phases 1-7 in sequence. Each phase builds on the previous:
1. Project Setup & Provider Integration
2. Provider Abstraction Layer
3. Second Brain Module (Parallel Querying)
4. Consensus Module
5. Personal Brain Module
6. CLI Interface
7. Evaluation Module

Phases 1-6 are the MVP. Phase 7 validates the hypothesis.

## Key Design Principles

### Error Handling
- API failures must be graceful
- If 1-2 Second Brain models fail, continue with remaining models
- Never crash the CLI due to a single provider error

### Extensibility Points
1. **Consensus strategies:** Add new files to `src/consensus/strategies/`
2. **Personal Brain model:** Configurable via any Provider implementation
3. **New providers:** Implement the Provider interface

### Progress Transparency
The CLI should show real-time progress:
```
Personal Brain is preparing your question...
Consulting Claude... ✓
Consulting GPT... ✓
Consulting Grok... ✓
Consulting Llama... ✓
Second Brain is synthesizing...
```

### Use Vercel AI SDK
All LLM interactions go through the `ai` package for unified streaming interface.
