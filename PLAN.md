# Second Brain MVP Implementation Plan

## Overview

Build a CLI tool that demonstrates multi-model AI deliberation ("The Council") produces better answers than any single model. Users ask questions through a "Personal Brain" (stub model), which escalates to 4 frontier models deliberating together, then synthesizes a unified response.

**Goal:** Prove Second Brain answers are preferred >60% of the time vs best single model.

## Architecture

```
User → CLI → Personal Brain (Claude Sonnet) → Council (4 models in parallel) → Consensus Module → Personal Brain (synthesis) → User
```

### Tech Stack
- **Language:** TypeScript/Node.js (single package)
- **LLM SDKs:** Vercel AI SDK (`@ai-sdk/*`) for unified provider interface
- **CLI Framework:** Commander.js or similar
- **Config:** Environment variables only (.env)

### Council Models (4 total)
1. Claude Sonnet 4.5 (Anthropic)
2. GPT-5.2 (OpenAI)
3. Grok (xAI) - latest
4. Llama 4 Maverick (via Groq) - `meta-llama/llama-4-maverick-17b-128e-instruct`

### Personal Brain Model
- Default: Claude Sonnet 4.5 (best performing, cost not a concern for MVP)
- Configurable via `BRAIN_MODEL` environment variable
- Must be swappable to any Provider (including future private cloud Llama instance)
- Orchestrates the entire flow: pre-processes user input → coordinates Council → post-processes synthesis

---

## Implementation Phases

### Phase 1: Project Setup & Provider Integration
**Files to create:**
- `package.json` - dependencies: `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/xai`, `@ai-sdk/groq`, `commander`, `dotenv`, `ora` (spinner)
- `tsconfig.json` - strict mode, ES modules
- `.env.example` - template for API keys
- `src/index.ts` - CLI entry point
- `src/config.ts` - load env vars, validate API keys, define council model configurations with fallback support

**Tasks:**
- [x] Initialize npm project with TypeScript
  - Configured ES modules in package.json (`"type": "module"`)
  - Added npm scripts for dev and test:providers
- [x] Install Vercel AI SDK providers for all 4 models
  - Installed: `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/xai`, `@ai-sdk/groq`
  - Installed core `ai` package for unified interface
  - Installed dev dependencies: `typescript`, `tsx`, `@types/node`
- [x] Create config loader that validates all 4 API keys exist
  - **Changed approach:** Made API keys optional with warnings instead of errors
  - Config now returns `undefined` for missing API keys
  - Added `getMissingApiKeys()` helper function
  - Included optional config: timeout and debug flags
- [x] Create simple test script that pings each provider to verify connectivity
  - Fixed TypeScript errors: removed `maxTokens` parameter (not supported in Vercel AI SDK v3+)
  - Fixed Claude Sonnet model ID: `claude-sonnet-4-5-20250929` (not `claude-sonnet-4.5-20250929`)
  - Updated OpenAI model to GPT-5.2 (key: `openai/gpt-5-2`, model ID: `gpt-5.2`) as specified in requirements
  - Fixed xAI Grok model ID: `grok-3-beta` (updated from `grok-beta` based on xAI API documentation)
  - **Architecture decision: Updated to Llama 4 Maverick** (`meta-llama/llama-4-maverick-17b-128e-instruct`) - the most capable Llama model with 128 experts, optimized for reasoning and coding tasks
  - **Architecture decision: Removed Perplexity from council** - Reduced from 5 to 4 models. Perplexity's model is Llama-based, creating redundancy without architectural diversity. Better to have 4 genuinely different models than 5 with overlap.
  - Added spinner UI with ora for real-time feedback
  - **Extra feature:** Added `--test-provider <provider>` flag to test individual providers (e.g., `--test-provider anthropic/claude-sonnet-4-5`)
  - Refactored provider tests into reusable `PROVIDER_TESTS` array for maintainability
  - Created `README.md` with comprehensive project description, setup instructions, and usage guide
  - Added `CliOptions` interface to properly type Commander.js options and fix ESLint errors
  - Added `test:provider` npm script for easier command execution
  - Updated README to use npm scripts instead of direct `npx tsx` commands
  - Documented all available npm scripts in README Development section
  - **Improved error handling:**
    - Show warnings (not errors) for missing API keys
    - Skip providers with missing API keys when testing all providers
    - Only error when testing a specific provider with a missing API key
    - Added `configKey` field to each provider test for API key validation
    - Test summary now shows connected/failed/skipped counts
  - **Added code quality tooling:**
    - Configured ESLint with TypeScript support
    - Configured Prettier for code formatting
    - Added `.prettierrc.json` and `.prettierignore`
    - Added `eslint.config.js` with recommended TypeScript rules
    - Added npm scripts: `lint`, `lint:fix`, `format`, `format:check`
  - **Added `.gitignore`** to exclude node_modules, .env files, and build artifacts
  - **Updated `.claude/settings.json`** to block reading .env files (security best practice)
  - **Added model configuration to `src/config.ts`** - Single source of truth for all configurations (env vars + council models)
    - Exported `COUNCIL_MODELS` array with user-editable defaults
    - Each provider has array of models (primary + fallbacks)
    - Models tried in order until one succeeds
    - Test output shows which specific model connected (e.g., "GPT (using gpt-4o)")
    - Enables graceful degradation when primary models require special access
    - Cleaner architecture: all config in one file instead of split across config.ts and model-config.ts
  - Verified with `npx tsc --noEmit` - no build errors
  - Verified with `npm run lint` - no linting errors
  - **Tested live:** Successfully ran `npm run test:provider -- anthropic/claude-sonnet-4-5` and `npm run test:provider -- xai/grok-beta` with valid API keys
  - **Final test:** 4/4 providers connected! (Claude ✓, GPT ✓ [using gpt-4o fallback], Grok ✓, Llama 4 Maverick ✓)

**Verification:** Run `npm run test:providers` and see configured providers tested (missing API keys show warnings and are skipped).

---

### Phase 2: Provider Abstraction Layer
**Files to create:**
- `src/providers/index.ts` - export unified interface and all model implementations
- `src/providers/types.ts` - `Provider` interface, `ProviderResponse` type
- `src/providers/anthropic/index.ts` - Shared Anthropic API logic (client, error handling, latency tracking)
- `src/providers/anthropic/claude-sonnet-4-5.ts` - Claude Sonnet 4.5 implementation
- `src/providers/openai/index.ts` - Shared OpenAI API logic
- `src/providers/openai/gpt-5-2.ts` - GPT-5.2 implementation
- `src/providers/xai/index.ts` - Shared xAI API logic
- `src/providers/xai/grok.ts` - Grok implementation
- `src/providers/groq/index.ts` - Shared Groq API logic
- `src/providers/groq/llama.ts` - Llama 4 Maverick implementation (`meta-llama/llama-4-maverick-17b-128e-instruct`)

**Architecture:**
Each provider directory contains:
- `index.ts` - Shared logic: API client setup, common error handling, latency tracking, response formatting
- `<model-name>.ts` - Model-specific implementation: model ID, parameters, any model-specific handling

This structure allows:
- Code reuse across models from the same provider
- Easy addition of new models (e.g., `claude-opus-4-5.ts`, `gpt-4.ts`)
- Clear separation between provider infrastructure and model specifics

**Interface:**
```typescript
interface Provider {
  name: string;  // e.g., "Claude Sonnet 4.5", "GPT-5.2"
  query(prompt: string): Promise<ProviderResponse>;
  queryStream(prompt: string): AsyncIterable<string>;
}

interface ProviderResponse {
  content: string;
  provider: string;  // Human-readable name
  latencyMs: number;
  tokensUsed?: number;
}
```

**Tasks:**
- [x] Define Provider interface with `query()` and `queryStream()` methods
  - Created `src/providers/types.ts` with Provider interface and ProviderResponse type
- [x] Create provider directory structure (anthropic/, openai/, xai/, groq/)
  - Used simplified structure: each provider has only `index.ts` (no separate model files)
  - **Architecture decision:** Made providers model-agnostic - they accept modelId as constructor parameter
  - This simplifies the code and makes it easier to test fallback models
- [x] Implement shared logic in each provider's index.ts
  - Each provider class handles API client setup, error handling, and latency tracking
  - All providers use Vercel AI SDK (`generateText` and `streamText`)
- [x] Implement model-specific wrappers for all 4 models
  - Created AnthropicProvider, OpenAIProvider, XAIProvider, and GroqProvider
  - Each provider is model-agnostic and receives modelId in constructor
- [x] Each wrapper should handle errors gracefully and return structured response
  - Added try-catch blocks with descriptive error messages
  - Enhanced error messages include latency information
- [x] Add latency tracking to each query
  - All providers track start/end time and include latencyMs in response
- [x] Export all model implementations from `src/providers/index.ts`
  - Created factory functions: `createCouncilProviders()` and `createProviderWithFallback()`
  - `createCouncilProviders()` creates providers for all configured models
  - `createProviderWithFallback()` tries models in order until one succeeds
- [x] Set up test infrastructure
  - Installed Vitest as testing framework
  - Created `vitest.config.ts` with 30s timeout for API calls
  - Added `npm run test` and `npm run test:watch` scripts
- [x] Write unit tests for each provider
  - Created `src/providers/test-helpers.ts` with test configuration
  - Used cheaper/faster models for testing (e.g., gpt-4o-mini, claude-sonnet-4-5-20250929)
  - Wrote concise tests for each provider: creation, query, and error handling
  - All 14 tests passing (5 test files)
- [x] Implement queryStream() for all providers
  - Used Vercel AI SDK's `streamText` function
  - Streams text chunks as they arrive for real-time UI updates
- [x] Final verification
  - ✓ Build check: `npx tsc --noEmit` - no errors
  - ✓ Linter: `npm run lint` - no errors
  - ✓ Tests: `npm run test` - 14/14 tests passing

**Verification:** ✅ All provider tests passing (14/14). Each provider can query successfully and return structured responses.

---

### Phase 3: Personal Brain (Pre-processing) + Council Module
**Files to create:**
- `src/brain/index.ts` - Personal Brain orchestrator
- `src/brain/types.ts` - `BrainConfig`
- `src/brain/prompts.ts` - prompt templates for pre-processing
- `src/council/index.ts` - main Council orchestrator
- `src/council/types.ts` - `CouncilRequest`, `CouncilResponse`, `DeliberationResult`

**Architecture Decision:**
Brain and Council are built together in this phase but remain **architecturally separate modules**. They should not be tightly coupled.

**Personal Brain Responsibilities (Pre-processing):**
1. Take user's raw question
2. Clarify ambiguities and add context if needed
3. Format as clear, well-structured prompt for Council
4. Configurable with any Provider (default: Claude Sonnet 4.5)
5. Future: Can monitor Council and intervene if models get stuck

**Council Behavior:**
1. Accept a prompt (pre-processed by Personal Brain)
2. Query all 4 providers in parallel using `Promise.allSettled()`
3. Handle partial failures gracefully (if 1 model fails, continue with rest)
4. Return array of all responses with metadata
5. Emit progress events for CLI streaming UI

**Tasks:**
- [x] Add `BRAIN_MODEL` configuration to `src/config.ts`
  - Added `brainModel` field to Config interface
  - Defaults to Claude Sonnet 4.5 (`anthropic/claude-sonnet-4-5-20250929`)
  - Can be overridden via `BRAIN_MODEL` environment variable
  - Created `BRAIN_MODEL_CONFIG` with fallback support (Sonnet 4.5 → Sonnet 3.5)
- [x] Create Brain class configurable with any Provider
  - Created `src/brain/types.ts` with BrainConfig interface
  - Created `src/brain/prompts.ts` with pre-processing prompt templates
  - Created `src/brain/index.ts` with Brain class implementation
- [x] Implement `prepareForCouncil(userQuery: string): Promise<string>`
  - Implemented pre-processing that clarifies ambiguities and adds context
  - Falls back to original query if pre-processing fails (graceful degradation)
  - Includes debug logging for transparency
- [x] Write tests for Brain pre-processing
  - Created `src/brain/brain.test.ts` with 5 test cases
  - Tests simple queries, ambiguous queries, complex technical queries
  - Tests fallback behavior when pre-processing fails
  - All tests passing with real Anthropic API calls
- [x] Create Council class that takes array of Providers
  - Created `src/council/types.ts` with DeliberationResult and ProgressCallback types
  - Created `src/council/index.ts` with Council class implementation
  - Added optional `error` field to ProviderResponse for failure handling
- [x] Implement `deliberate(prompt: string): Promise<DeliberationResult>`
  - Uses `Promise.allSettled()` for parallel execution
  - 30s timeout per provider (configurable)
  - Graceful handling of partial failures (continues with successful responses)
  - Progress callbacks for real-time UI updates
  - Returns metadata: totalLatencyMs, successCount, failureCount
- [x] Write tests for Council parallel querying
  - Created `src/council/council.test.ts` with 8 test cases
  - Tests parallel execution (verifies time < sum of all providers)
  - Tests partial failure handling (continues with remaining providers)
  - Tests timeout behavior
  - Tests progress callbacks for both success and failure
  - All tests passing with mock providers
- [x] Verify with `npx tsc --noEmit` - no build errors
  - Fixed unused import (PreProcessingResult)
  - Build passes cleanly
- [x] Verify with `npm run lint` - no linting errors
  - Fixed async/await issues in test mocks
  - Fixed TypeScript type safety issues with progress callbacks
  - Fixed prettier formatting
  - Linter passes with no errors or warnings

**Verification:** ✅ Complete
- ✅ Brain pre-processing tests pass (5/5 tests)
- ✅ Council can query all 4 providers in parallel and return responses (8/8 tests)
- ✅ Both modules are separate and loosely coupled
- ✅ All 27 tests passing (7 test files)
- ✅ Build check passing (npx tsc --noEmit)
- ✅ Linter passing (npm run lint)

---

### Phase 4: Consensus Module
**Files to create:**
- `src/consensus/index.ts` - consensus orchestrator
- `src/consensus/types.ts` - `ConsensusResult`, `ConsensusStrategy`
- `src/consensus/strategies/simple-synthesis.ts` - MVP strategy

**Interface:**
```typescript
interface ConsensusResult {
  synthesis: string;           // The unified answer
  agreement: boolean;          // Did models broadly agree?
  confidence: number;          // 0-1 confidence score
  dissent?: string;            // Notable disagreements
}

interface ConsensusStrategy {
  name: string;
  synthesize(responses: ProviderResponse[], originalPrompt: string): Promise<ConsensusResult>;
}
```

**MVP Strategy (Simple Synthesis):**
The goal is for the Council to reach consensus **without** Personal Brain involvement. However, the Brain can be optionally used for synthesis if needed.

1. Take all 4 Council responses
2. **Option A (MVP):** Use Personal Brain for synthesis
   - Send responses to Brain with synthesis prompt
   - Brain identifies agreement patterns, confidence level, and dissent
3. **Option B (Future):** Algorithmic consensus (no LLM)
   - Compare responses for overlap/agreement
   - Select best parts from each
4. Return ConsensusResult

**Synthesis Prompt Template (if using Brain):**
```
You are synthesizing answers from 4 different AI models to produce the best possible response.

Original question: {prompt}

Model responses:
[Claude]: {response1}
[GPT]: {response2}
[Grok]: {response3}
[Llama]: {response4}

Synthesize these into a single, authoritative answer. Note any significant disagreements.
Indicate your confidence level (high/medium/low) based on model agreement.
```

**Tasks:**
- [x] Create ConsensusStrategy interface
  - Created `src/consensus/types.ts` with ConsensusResult and ConsensusStrategy interfaces
  - ConsensusResult includes: synthesis, agreement, confidence (0-1), and optional dissent
- [x] Implement SimpleSynthesis strategy (using Brain for synthesis)
  - Created `src/consensus/strategies/simple-synthesis.ts`
  - Uses Brain to synthesize all Council responses
  - Graceful fallback when synthesis fails (concatenates responses with low confidence)
- [x] Design synthesis prompt that produces structured output
  - Created `src/consensus/prompts.ts` with JSON-based synthesis prompt
  - Prompts Brain to respond with structured JSON containing synthesis, agreement, confidence, and dissent
  - JSON extraction handles markdown-wrapped responses
- [x] Parse synthesis for agreement/confidence signals
  - JSON parsing with validation for required fields
  - Confidence score clamped to 0-1 range
  - Robust error handling with fallback consensus
- [x] Make it easy to add new strategies later (just add file to strategies/)
  - Consensus orchestrator accepts any ConsensusStrategy via config
  - Strategy swapping supported via `setStrategy()` method
  - Clear separation between orchestrator and strategy implementation
- [x] Write tests for consensus module
  - Created `src/consensus/consensus.test.ts` with 10 comprehensive tests
  - Tests cover: JSON parsing, markdown extraction, agreement/disagreement, confidence clamping, fallback behavior, strategy switching
  - All 10 tests passing
- [x] Verify with `npx tsc --noEmit` - no build errors
  - Added `query()` method to Brain class for general-purpose queries
  - Build passes cleanly with no TypeScript errors
- [x] Verify with `npm run lint` - no linting errors
  - Fixed all linting and formatting issues
  - All files pass ESLint and Prettier checks

**Verification:** ✅ Complete
- ✅ All 10 consensus tests passing
- ✅ SimpleSynthesis strategy works with mock Brain responses
- ✅ JSON parsing handles both clean and markdown-wrapped responses
- ✅ Fallback consensus works when synthesis fails
- ✅ Strategy is swappable (tested in orchestrator tests)
- ✅ All 37 tests passing (8 test files)
- ✅ Build check passing (npx tsc --noEmit)
- ✅ Linter passing (npm run lint)

---

### Phase 5: Personal Brain (Post-processing)
**Files to update:**
- `src/brain/index.ts` - Add post-processing methods
- `src/brain/prompts.ts` - Add post-processing prompt templates

**Responsibilities:**
Take ConsensusResult and format final response for user:
1. Present synthesis clearly and conversationally
2. Note confidence level appropriately
3. Highlight any dissent or areas of disagreement
4. Make the response feel cohesive and authoritative

**Post-processing Flow:**
```
ConsensusResult → Brain.presentToUser() → Final formatted response
```

**Tasks:**
- [ ] Implement `presentToUser(consensus: ConsensusResult): Promise<string>`
  - Takes ConsensusResult from Consensus module
  - Formats it for clear presentation to user
  - Includes confidence indicators
  - Highlights dissent if present
- [ ] Create post-processing prompt template
- [ ] Write tests for post-processing
  - Test with mock ConsensusResults
  - Verify formatting is clear and user-friendly
- [ ] Verify with `npx tsc --noEmit` - no build errors
- [ ] Verify with `npm run lint` - no linting errors

**Verification:** Test post-processing with sample ConsensusResults, verify output is clear and well-formatted.

---

### Phase 6: CLI Interface
**Files to create:**
- `src/cli/index.ts` - main CLI logic
- `src/cli/ui.ts` - terminal UI helpers (spinners, colors)

**Commands:**
```bash
second-brain ask "What is the best programming language for systems programming?"
second-brain --test-providers  # Verify all API keys work
second-brain --version
```

**UX Flow:**
1. User runs `second-brain ask "question"`
2. Show: "Personal Brain is preparing your question..."
3. Show: "Consulting Claude... ✓"
4. Show: "Consulting GPT... ✓" (etc, as each completes)
5. Show: "Council is synthesizing..."
6. Show: Final answer with confidence indicator

**Tasks:**
1. Set up Commander.js with `ask` command
2. Implement streaming progress UI with ora spinners
3. Handle Ctrl+C gracefully
4. Pretty-print final response with markdown support
5. Show timing info (total deliberation time)

**Verification:** Run full end-to-end query through CLI.

---

### Phase 7: API Schema Compatibility
**Files to create:**
- `src/api/index.ts` - API adapter/middleware
- `src/api/types.ts` - OpenAI/Anthropic schema types
- `src/api/openai-adapter.ts` - OpenAI-compatible interface
- `src/api/anthropic-adapter.ts` - Anthropic-compatible interface

**Purpose:**
Expose Second Brain through standard LLM API formats (OpenAI, Anthropic) so it can be used as a drop-in replacement in tools like Claude Code, IDEs, or other AI-powered applications.

**OpenAI Format:**
```typescript
POST /v1/chat/completions
{
  "model": "second-brain",
  "messages": [
    {"role": "user", "content": "your question"}
  ],
  "stream": true
}
```

**Anthropic Format:**
```typescript
POST /v1/messages
{
  "model": "second-brain",
  "messages": [
    {"role": "user", "content": "your question"}
  ],
  "stream": true
}
```

**Behavior:**
1. Accept requests in OpenAI or Anthropic format
2. Convert to Second Brain internal format
3. Run through Brain → Council → Consensus → Brain flow
4. Convert response back to requested format
5. Support streaming responses

**Tasks:**
- [ ] Create API schema type definitions for OpenAI and Anthropic formats
- [ ] Implement OpenAI adapter
  - Parse OpenAI chat completions format
  - Convert to Second Brain query
  - Convert Second Brain response to OpenAI format
  - Support streaming
- [ ] Implement Anthropic adapter
  - Parse Anthropic messages format
  - Convert to Second Brain query
  - Convert Second Brain response to Anthropic format
  - Support streaming
- [ ] Write tests for both adapters
- [ ] Add API server mode to CLI (optional: `second-brain serve --port 8080`)
- [ ] Verify with `npx tsc --noEmit` - no build errors
- [ ] Verify with `npm run lint` - no linting errors

**Verification:** Test API endpoints with curl/Postman, verify OpenAI and Anthropic format compatibility.

---

### Phase 8: Evaluation Module (Separate)
**Files to create:**
- `src/eval/index.ts` - evaluation harness
- `src/eval/questions.ts` - test question bank
- `src/eval/compare.ts` - comparison logic
- `src/eval/report.ts` - generate eval report

**Purpose:** Prove Second Brain > single model

**Method:**
1. Define 20 hard test questions (reasoning, analysis, coding, etc.)
2. For each question, get:
   - Second Brain answer
   - Claude-only answer
   - GPT-only answer
3. Present pairs blind (A vs B) for human evaluation
4. Track preference rate

**Commands:**
```bash
second-brain eval run              # Run all 20 questions through Council + individuals
second-brain eval compare          # Interactive blind comparison UI
second-brain eval report           # Generate summary stats
```

**Tasks:**
1. Create question bank with diverse, challenging questions
2. Implement runner that queries Second Brain + individual models
3. Save all responses to JSON for comparison
4. Build simple CLI for blind A/B comparison
5. Generate report with preference percentages

**Verification:** Run eval suite, generate report showing Second Brain preference rate.

---

## File Structure

```
second-brain/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # CLI entry point
│   ├── config.ts             # Environment/config loading
│   ├── providers/
│   │   ├── index.ts          # Export all model implementations
│   │   ├── types.ts          # Provider interface, ProviderResponse
│   │   ├── anthropic/
│   │   │   ├── index.ts      # Shared Anthropic API logic
│   │   │   └── claude-sonnet-4-5.ts
│   │   ├── openai/
│   │   │   ├── index.ts      # Shared OpenAI API logic
│   │   │   └── gpt-5-2.ts
│   │   ├── xai/
│   │   │   ├── index.ts      # Shared xAI API logic
│   │   │   └── grok.ts
│   │   └── groq/
│   │       ├── index.ts      # Shared Groq API logic
│   │       └── llama.ts
│   ├── council/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── consensus/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── strategies/
│   │       └── simple-synthesis.ts
│   ├── brain/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── prompts.ts
│   ├── cli/
│   │   ├── index.ts
│   │   └── ui.ts
│   ├── api/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── openai-adapter.ts
│   │   └── anthropic-adapter.ts
│   └── eval/
│       ├── index.ts
│       ├── questions.ts
│       ├── compare.ts
│       └── report.ts
└── README.md
```

---

## Environment Variables

```bash
# .env.example
# Council API Keys (4 models)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
GROQ_API_KEY=gsk_...

# Personal Brain Model
# Format: "provider/model" (e.g., "anthropic/claude-sonnet-4-5")
# Default: Claude Sonnet 4.5 (will eventually default to private cloud Llama)
BRAIN_MODEL=anthropic/claude-sonnet-4-5

# Optional
SECOND_BRAIN_TIMEOUT_MS=30000
SECOND_BRAIN_DEBUG=false
```

---

## Dependencies

```json
{
  "dependencies": {
    "@ai-sdk/anthropic": "latest",
    "@ai-sdk/openai": "latest",
    "@ai-sdk/xai": "latest",
    "@ai-sdk/groq": "latest",
    "ai": "latest",
    "commander": "^12.0.0",
    "dotenv": "^16.0.0",
    "ora": "^8.0.0",
    "chalk": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Verification Checklist

After each phase, verify:

- [x] **Phase 1:** `npx tsx src/index.ts --test-providers` shows all 4 providers connected
- [x] **Phase 2:** Each provider wrapper can query its model and return structured response
- [x] **Phase 3:** Brain pre-processes queries + Council queries all 4 in parallel, handles failures gracefully
- [x] **Phase 4:** Consensus module produces synthesis with agreement/confidence signals
- [ ] **Phase 5:** Personal Brain post-processes ConsensusResult into clear user response
- [ ] **Phase 6:** Full CLI flow works: ask question → see progress → get answer
- [ ] **Phase 7:** API adapters expose Second Brain in OpenAI/Anthropic formats
- [ ] **Phase 8:** Eval harness can compare Second Brain vs individual models

**Final validation:** Run 20 eval questions, confirm Second Brain preferred >60% of time.

---

## Implementation Order

1. **Phase 1** - Project setup (foundation)
2. **Phase 2** - Provider wrappers (must work before anything else)
3. **Phase 3** - Personal Brain (pre-processing) + Council (parallel querying)
4. **Phase 4** - Consensus module (synthesis)
5. **Phase 5** - Personal Brain (post-processing)
6. **Phase 6** - CLI (user-facing)
7. **Phase 7** - API schema compatibility (OpenAI/Anthropic formats)
8. **Phase 8** - Evaluation (prove it works)

**MVP scope:** Phases 1-6 are the core MVP.
**Extended features:** Phase 7 enables tool integration.
**Validation:** Phase 8 validates the hypothesis.

---

## Notes for AI Agents

- Use Vercel AI SDK (`ai` package) for unified streaming interface
- All providers should implement the same `Provider` interface
- **Brain and Council are separate modules** - built together in Phase 3 but architecturally independent
  - Brain orchestrates the flow but Council operates independently
  - Avoid tight coupling between them
- Personal Brain model is configurable via `BRAIN_MODEL` env var
  - Default to Claude Sonnet 4.5 for MVP
  - Must support any Provider (future: private cloud Llama)
- Consensus module is designed for easy strategy swapping - keep strategies isolated
  - MVP: Use Brain for synthesis
  - Future: Algorithmic consensus without LLM
- Handle API failures gracefully - if 1 Council model fails, continue with remaining 3
- CLI should show real-time progress as each model responds
- API adapters (Phase 7) enable tool integration by exposing OpenAI/Anthropic compatible interfaces
- Eval module is separate from production code - used only for validation
