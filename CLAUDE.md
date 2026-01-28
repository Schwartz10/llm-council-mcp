# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM Council MCP is a CLI + MCP server that queries a council of frontier models in parallel and returns independent critiques plus structured synthesis.

**Goal:** Provide a reliable local MCP server for multi-model consultation with clear, structured outputs.

**Current Status:** Council daemon with structured synthesis and MCP tool improvements.

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

# Ask a question via the Council
llm-council ask "your question here"
```

## Architecture

```
User → CLI → Council (models in parallel) → Structured results → User
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

## Environment Variables

Required API keys (see `.env.example`):
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude models
- `OPENAI_API_KEY` - OpenAI API key for GPT models
- `GEMINI_API_KEY` - Google API key for Gemini models
- `XAI_API_KEY` - xAI API key for Grok models
- `GROQ_API_KEY` - Groq API key for Llama models

Optional:
- `LLM_COUNCIL_DEBUG` (default: `false`) - Enable debug logging
- `LLM_COUNCIL_TIMEOUT_MS` (default: `30000`) - Provider request timeout

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

## Key Design Principles

### Error Handling
- API failures must be graceful
- If 1-2 council models fail, continue with remaining models
- Never crash the CLI due to a single provider error

### Extensibility Points
1. **Consensus strategies:** Add new files to `src/consensus/strategies/`
2. **New providers:** Implement the Provider interface

### Progress Transparency
The CLI should show real-time progress:
```
Consulting Claude... ✓
Consulting GPT... ✓
Consulting Grok... ✓
Consulting Llama... ✓
Synthesis complete.
```

### Use Vercel AI SDK
All LLM interactions go through the `ai` package for unified streaming interface.
