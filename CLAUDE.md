# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "second brain" - a CLI tool that demonstrates multi-model AI deliberation produces better answers than any single model. Users ask questions through a Personal Brain (Claude Sonnet 4.5), which escalates to frontier models deliberating in parallel, then synthesizes a unified response.

**Goal:** Prove second brain answers are preferred >60% of the time vs best single model.

**Current Status:** Phase 11.2 Complete (Council daemon with structured synthesis and MCP tool improvements)

## Documentation

- **PLAN.md** - Implementation plan with task tracking and progress
- **ARCHITECTURE.md** - Technical specification with ASCII diagrams, data flows, and architecture details
- **README.md** - User-facing documentation for installation and usage

**IMPORTANT:** As you complete phases and make architectural changes, update both PLAN.md (task completion) and ARCHITECTURE.md (technical specification).

## Development Commands

```bash
# Run CLI with TypeScript
npx tsx src/index.ts

# Test provider connectivity
npx tsx src/index.ts --test-providers

# Ask a question through second brain
second-brain ask "your question here"

# Evaluation commands (Phase 7)
second-brain eval run              # Run all test questions
second-brain eval compare          # Interactive blind A/B comparison
second-brain eval report           # Generate preference stats
```

## Architecture

```
User → CLI → Personal Brain (pre-processing) → Council (models in parallel) → Consensus Module → Personal Brain (post-processing) → User
```

**See ARCHITECTURE.md for detailed ASCII diagrams and technical specifications.**

### Tech Stack
- **Language:** TypeScript/Node.js (single package)
- **LLM SDKs:** Vercel AI SDK (`@ai-sdk/*`) for unified provider interface
- **CLI Framework:** Commander.js
- **Testing:** Vitest
- **Code Quality:** ESLint + Prettier

### Council Models
1. Claude Sonnet 4.5 (Anthropic) - with fallback to Sonnet 3.5
2. GPT-5.2 (OpenAI) - with fallback to GPT-4o → GPT-4 Turbo
3. Gemini (Google) - with fallback to Gemini 1.5 Pro
4. Grok 3 Beta (xAI)
5. Llama 4 Maverick (via Groq) - `meta-llama/llama-4-maverick-17b-128e-instruct` with fallback to Llama 3.3

### Personal Brain
- Default: Claude Sonnet 4.5 (with fallback to Sonnet 3.5)
- Configurable via `BRAIN_MODEL` environment variable
- Must be swappable to any Provider (designed for future flexibility)
- Handles both pre-processing (Phase 3 ✅) and post-processing (Phase 5 ⏳)

## Code Architecture

### Configuration (`src/config.ts`)
Single source of truth for all configurations - both environment variables and council model definitions.

**Environment Config:**
- Loads API keys from .env file
- Optional timeout and debug settings
- Graceful handling of missing API keys

**Model Config (`COUNCIL_MODELS` array):**
```typescript
interface ModelConfig {
  name: string;           // Display name (e.g., "GPT")
  provider: string;       // Provider type (e.g., "openai")
  apiKey?: string;        // From env
  models: string[];       // Array of model IDs to try (first = primary, rest = fallbacks)
}
```

**Key Features:**
- User-editable with good defaults
- Automatic fallback: models tried in order until one succeeds
- Test output shows which specific model connected
- Enables graceful degradation (e.g., GPT-5.2 → gpt-4o → gpt-4-turbo)

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

**Implementation (Phase 2 ✅):**
Each provider has its own directory with a model-agnostic implementation:
- `providers/anthropic/index.ts` - AnthropicProvider class
- `providers/openai/index.ts` - OpenAIProvider class
- `providers/gemini/index.ts` - GeminiProvider class
- `providers/xai/index.ts` - XAIProvider class
- `providers/groq/index.ts` - GroqProvider class

Each provider class:
- Accepts modelId as constructor parameter (model-agnostic design)
- API client setup via Vercel AI SDK
- Common error handling and graceful degradation
- Latency tracking
- Structured response formatting
- Supports both `query()` and `queryStream()` methods

Factory functions (`src/providers/index.ts`):
- `createCouncilProviders()` - creates all configured council providers with fallback support
- `createProviderWithFallback()` - tries models in order until one succeeds

### Council Module (`src/council/`) - Phase 3 ✅
Orchestrates parallel querying of the Council models:
- Uses `Promise.allSettled()` to query all configured providers simultaneously
- No automatic timeout; supports user cancellation via AbortSignal
- Handles partial failures gracefully (continues if providers fail)
- Emits progress events via callbacks for real-time UI updates
- Returns `DeliberationResult` with all responses and metadata (latency, success/failure counts)

**Implementation:**
- `src/council/types.ts` - DeliberationResult and ProgressCallback interfaces
- `src/council/index.ts` - Council class with `deliberate()` method
- `src/council/council.test.ts` - 8 comprehensive tests (parallel execution, failures, timeouts, progress)

### Consensus Module (`src/consensus/`) - Phase 4 ⏳
Synthesizes multiple responses from Council into one unified answer:

```typescript
interface ConsensusResult {
  synthesis: string;           // The unified answer
  agreement: boolean;          // Did models broadly agree?
  confidence: number;          // 0-1 confidence score
  dissent?: string;            // Notable disagreements
}
```

**MVP Strategy (to be implemented):** SimpleSynthesis sends all responses to Personal Brain with a synthesis prompt that:
1. Combines insights from all models
2. Identifies agreement vs disagreement patterns
3. Produces confidence level based on consensus
4. Highlights any significant dissent

**Extensibility:** New strategies can be added as files in `src/consensus/strategies/`

**Files to create:**
- `src/consensus/index.ts` - consensus orchestrator
- `src/consensus/types.ts` - ConsensusResult, ConsensusStrategy interfaces
- `src/consensus/strategies/simple-synthesis.ts` - MVP strategy

### Personal Brain (`src/brain/`)
Two-stage processing:
1. **Pre-processing (Phase 3 ✅):** Clarifies user questions, adds context, formats for Council
   - Implemented via `prepareForCouncil(userQuery)` method
   - Falls back to original query on failure
   - Uses prompt templates from `src/brain/prompts.ts`

2. **Post-processing (Phase 5 ⏳):** Takes ConsensusResult, formats final response with confidence indicators and dissent notes
   - To be implemented via `presentToUser(consensus)` method

Configurable with any Provider but defaults to Claude Sonnet 4.5.

**Implementation:**
- `src/brain/types.ts` - BrainConfig interface
- `src/brain/prompts.ts` - Pre-processing prompt templates
- `src/brain/index.ts` - Brain class
- `src/brain/brain.test.ts` - 5 comprehensive tests (simple, ambiguous, complex queries, fallback)

### CLI Interface (`src/cli/`) - Phase 6 ⏳
To be implemented with Commander.js + ora spinners for:
- Real-time progress as each model responds
- Pretty-printed markdown responses
- Timing information
- Graceful Ctrl+C handling

**Files to create:**
- `src/cli/index.ts` - CLI commands
- `src/cli/ui.ts` - Terminal UI helpers

### Evaluation Module (`src/eval/`) - Phase 8 ⏳
**Purpose:** Validate that second brain > single model

**Method:**
1. 20 hard test questions (reasoning, analysis, coding)
2. For each: get second brain answer + individual model answers
3. Blind A/B comparison for human evaluation
4. Track preference rate (target: >60% for second brain)

This module is separate from production code and used only for validation.

**Files to create:**
- `src/eval/index.ts` - evaluation harness
- `src/eval/questions.ts` - test question bank
- `src/eval/compare.ts` - comparison logic
- `src/eval/report.ts` - generate eval report

## Environment Variables

Required API keys (see `.env.example`):
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude models
- `OPENAI_API_KEY` - OpenAI API key for GPT models
- `GEMINI_API_KEY` - Google API key for Gemini models
- `XAI_API_KEY` - xAI API key for Grok models
- `GROQ_API_KEY` - Groq API key for Llama models

Optional:
- `BRAIN_MODEL` (default: `anthropic/claude-sonnet-4-5-20250929`) - Personal Brain model identifier
- `SECOND_BRAIN_DEBUG` (default: `false`) - Enable debug logging

## Working with PLAN.md

### MVP Scope Discipline
MVPs must be tight in scope. Each task within phases should be highly testable.

### Task Tracking in PLAN.md
When implementing phases:

1. **Check for build errors FIRST:** Before marking any phase as complete, ALWAYS run `npx tsc --noEmit` to check for TypeScript build errors. ALWAYS run `npm run lint` to check for linter errors or warnings. Fix all errors, compiler warnings, and linter issues before proceeding. Linter errors can attempted to be fixed with `npm run format` and `npm run lint:fix`
2. **Mark completed tasks:** Check off tasks as you finish them using checkboxes
3. **Document extra steps:** If you had to do additional work beyond what was planned to complete a task, document those extra steps in PLAN.md under the relevant task
4. **Keep it testable:** Each task should have clear verification criteria
5. **Update ARCHITECTURE.md:** When completing a phase, update ARCHITECTURE.md to:
   - Add ✅ status indicators for completed modules
   - Update data flow diagrams if the implementation differs from the plan
   - Add any new files or components to the file structure diagram
   - Update performance characteristics if relevant
   - Document any architectural decisions or changes made during implementation
6. **Update README.md:** Whenever you add a feature that has implications for how end users interact with the system (new CLI commands, flags, configuration options, etc.), update the README.md with clear documentation and usage examples

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
Follow phases 1-8 in sequence. Each phase builds on the previous:

**Completed:**
1. ✅ Project Setup & Provider Integration (Phase 1)
2. ✅ Provider Abstraction Layer (Phase 2)
3. ✅ Personal Brain Pre-processing + Council Module (Phase 3)

**Remaining:**
4. ⏳ Consensus Module (Phase 4)
5. ⏳ Personal Brain Post-processing (Phase 5)
6. ⏳ CLI Interface (Phase 6)
7. ⏳ API Schema Compatibility - OpenAI/Anthropic formats (Phase 7)
8. ⏳ Evaluation Module (Phase 8)

Phases 1-6 are the MVP. Phases 7-8 add extensibility and validation.

## Key Design Principles

### Error Handling
- API failures must be graceful
- If 1-2 second brain models fail, continue with remaining models
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
second brain is synthesizing...
```

### Use Vercel AI SDK
All LLM interactions go through the `ai` package for unified streaming interface.
