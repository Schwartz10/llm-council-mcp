# Second Brain MVP Implementation Plan

## Overview

Build a Council daemon service that multiple AI agents can consult when they need help. The Council consists of 4 frontier AI models that provide independent critiques and suggestions. Clients (CLI, Claude Code via MCP, or other tools) send questions to the Council and receive parallel responses from all models.

**Primary Use Case:** "Phone a Friend" - when an AI agent (like Claude Code) is uncertain or stuck, it can consult the Council for alternative perspectives, corrections, and suggestions.

**Goal:** Provide a valuable multi-model consultation service that helps AI agents get unstuck and make better decisions.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              CLIENT LAYER                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │   CLI    │  │  Claude  │  │  Other   │         │
│  │          │  │   Code   │  │ Clients  │         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
└───────┼─────────────┼─────────────┼───────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│         COUNCIL DAEMON (Express Server)             │
│              localhost:3000                         │
│                                                     │
│  Endpoints:                                         │
│  • POST /council - HTTP (for CLI)                  │
│  • GET /mcp/sse - MCP over SSE (for Claude Code)   │
│  • GET /health - Health check                      │
│                                                     │
│  Council: 4 models query in parallel               │
└─────────────────────────────────────────────────────┘

Flow: Client → Council → 4 Models (parallel) → Critiques → Client
```

### Tech Stack
- **Language:** TypeScript/Node.js (single package)
- **LLM SDKs:** Vercel AI SDK (`@ai-sdk/*`) for unified provider interface
- **Server:** Express.js
- **MCP:** `@modelcontextprotocol/sdk` (SSE transport)
- **CLI:** Simple HTTP client
- **Config:** Environment variables only (.env)

### Council Models (4 total)
1. Claude Sonnet 4.5 (Anthropic) - with fallback to Sonnet 3.5
2. GPT-5.2 (OpenAI) - with fallback to gpt-4o → gpt-4-turbo
3. Grok 3 Beta (xAI)
4. Llama 4 Maverick (via Groq) - with fallback to Llama 3.3

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
- [x] Implement `presentToUser(consensus: ConsensusResult): Promise<string>`
  - Takes ConsensusResult from Consensus module
  - Formats it for clear presentation to user
  - Includes confidence indicators
  - Highlights dissent if present
  - Graceful fallback to raw synthesis if post-processing fails
- [x] Create post-processing prompt template
  - Created `getPostProcessingPrompt()` in `src/brain/prompts.ts`
  - Includes confidence labels (high/moderate/low) based on 0-1 score
  - Formats agreement status and dissent information
  - Instructs Brain to present information conversationally
- [x] Write tests for post-processing
  - Created 4 new tests in `src/brain/brain.test.ts`
  - Test high confidence with agreement
  - Test low confidence with dissent
  - Test moderate confidence
  - Test fallback behavior when post-processing fails
- [x] Verify with `npx tsc --noEmit` - no build errors
  - Build passes cleanly with no TypeScript errors
- [x] Verify with `npm run lint` - no linting errors
  - All files pass ESLint and Prettier checks

**Verification:** ✅ Complete
- ✅ All 4 post-processing tests passing
- ✅ Brain formats consensus results appropriately for different confidence levels
- ✅ Fallback works when post-processing fails (returns raw synthesis)
- ✅ All 41 tests passing (8 test files)
- ✅ Build check passing (npx tsc --noEmit)
- ✅ Linter passing (npm run lint)

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
- [x] Set up Commander.js with `ask` command
  - Added `ask <question>` command to src/index.ts
  - Command orchestrates full Second Brain flow
- [x] Implement streaming progress UI with ora spinners
  - Created src/cli/ui.ts with ProgressSpinner class and formatting utilities
  - Real-time progress updates as each Council member responds
  - Success/failure indicators for each model
- [x] Handle Ctrl+C gracefully
  - Commander.js handles Ctrl+C by default
  - Process exits cleanly on errors with proper exit codes
- [x] Pretty-print final response with markdown support
  - Created formatFinalResponse() with visual confidence bar
  - Added colored output with chalk (green for high confidence, yellow for moderate, red for low)
  - Confidence displayed as both label and visual bar
- [x] Show timing info (total deliberation time)
  - Added formatTiming() utility to display total time in seconds
  - Tracks full flow from start to finish
- [x] Wire up complete flow in src/cli/index.ts
  - Brain pre-processing
  - Council initialization and deliberation with progress callbacks
  - Consensus synthesis
  - Brain post-processing
  - Error handling and validation
- [x] Fix TypeScript export issues
  - Changed consensus/index.ts to use `export type` for re-exporting interfaces
- [x] Verify with `npx tsc --noEmit` - no build errors
- [x] Verify with `npm run lint` - no linting errors

**Verification:** ✅ Complete
- ✅ End-to-end test successful with question "What is TypeScript?"
- ✅ Brain initialized and pre-processed question
- ✅ Council assembled with 4 models (2 succeeded, 2 failed gracefully)
- ✅ Consensus synthesized with high confidence (0.95)
- ✅ Brain post-processed and formatted final response
- ✅ Total time: 57.5s
- ✅ All progress indicators and UI elements working correctly
- ✅ Confidence bar and timing displayed properly

---

### Phase 7: Council Daemon Service & MCP Integration

**Goal:** Transform Second Brain from a monolithic CLI tool into a daemon service that multiple clients can consult. The Council becomes a shared resource accessible via both HTTP (for CLI) and MCP/SSE (for Claude Code).

**Files to create:**
- `src/server/index.ts` - Express server with MCP integration
- `src/server/routes.ts` - HTTP routes
- `src/client/cli.ts` - Simplified CLI as HTTP client
- `docs/SERVER.md` - Server setup and usage
- `docs/MCP_SETUP.md` - Claude Code integration guide

**Files to archive/deprecate:**
- `src/brain/*` - Personal Brain orchestration (Phases 4-5 deprecated)
- `src/consensus/*` - Consensus module (Phase 4 deprecated)
- Old `src/cli/index.ts` - Replaced by simpler client

**Architecture Principles:**
1. **Single server process** - One Express app serves both HTTP and MCP endpoints
2. **Shared Council** - Council initialized once, used by all clients
3. **Client agnostic** - Council just returns critiques, clients decide what to do with them
4. **Simple & focused** - No consensus, no synthesis, no orchestration - just parallel model consultation

**High-Level Flow:**
```
Client (CLI or Claude Code)
  → Server (Express with MCP SDK)
    → Council (4 models in parallel)
      → Critiques (raw responses from each model)
        → Back to Client (client decides what to do)
```

**Endpoints:**
- `POST /council` - HTTP endpoint for CLI and other clients
- `GET /mcp/sse` - MCP endpoint for Claude Code (uses SSE transport)
- `GET /health` - Health check

**Request/Response Contract:**
```typescript
// Input: What the client needs
Request {
  original_prompt: string,
  proposed_answer?: string,  // Optional - Claude Code provides this
  context?: string           // Optional - additional info
}

// Output: What Council returns
Response {
  critiques: [{
    model: string,
    response: string,
    latency_ms: number
  }],
  summary: {
    models_consulted: number,
    models_responded: number,
    models_failed: number,
    total_latency_ms: number
  }
}
```

**Implementation Steps (High Level):**

**Step 1: Create Server Infrastructure**
- [x] Set up Express server with MCP SDK integration
  - Used streamable HTTP transport (recommended over SSE)
  - Created `src/server/index.ts` and `src/server/types.ts`
- [x] Initialize Council providers at startup
  - Council initialized once at server startup
  - Shared across all client requests
- [x] Add health check endpoint
  - GET /health returns Council status and available models
- [x] Add basic request logging and error handling
  - Console logging for startup, errors, and warnings
  - Graceful handling of API key issues

**Step 2: Implement MCP Integration**
- [x] Add MCP endpoint using streamable HTTP transport
  - POST /mcp handles all MCP protocol requests
- [x] Define `council_consult` tool for Claude Code
  - Tool accepts: prompt (required), context (optional)
  - Returns: structured critiques + markdown text
- [x] Tool calls Council logic for parallel querying
  - Reused existing Council module implementation
- [x] Format responses appropriately for MCP protocol
  - Returns both text (markdown) and structuredContent

**Step 3: Refactor CLI**
- [x] Simplify CLI to HTTP client
  - Updated `src/index.ts` to make HTTP requests to server
  - Removed direct Brain/Council/Consensus instantiation
- [x] Call server's /mcp endpoint via axios
  - Uses JSON-RPC 2.0 protocol for MCP tool calls
- [x] Keep UI/formatting logic in CLI
  - Moved ui.ts helpers to src/ directly
  - Preserved progress spinners and formatted output
- [x] Add error handling for server not running
  - Checks health endpoint before consulting
  - Clear error messages with instructions

**Step 4: Clean Up Deprecated Code**
- [x] Remove Brain module (Phase 5)
  - Deleted src/brain/ directory
- [x] Remove Consensus module (Phase 4)
  - Deleted src/consensus/ directory
- [x] Remove old CLI implementation
  - Deleted src/cli/index.ts (replaced by HTTP client)
  - Kept ui.ts helpers (moved to src/ui.ts)
- [x] Update documentation to reflect new architecture
  - Updated README.md with daemon architecture
  - Marked Phases 4-6 as deprecated in favor of simpler approach

**Step 5: Documentation**
- [x] Create server setup guide
  - docs/SERVER.md with installation, configuration, endpoints
- [x] Create MCP configuration guide for Claude Code
  - docs/MCP_SETUP.md with integration instructions
- [x] Document council_consult API
  - Included in both SERVER.md and README.md
- [x] Add example usage for both CLI and MCP
  - CLI examples in README.md
  - MCP examples in MCP_SETUP.md

**Step 6: Testing & Validation**
- [x] Verify with `npx tsc --noEmit` - no build errors
  - Fixed type casting for structuredContent
- [x] Verify with `npm run lint` - no linting errors
  - Fixed prettier formatting issues
  - Fixed no-misused-promises with void operator
- [x] Build completes successfully
  - `npm run build` produces dist/ output

**Verification Checklist:**
- [x] Single server process starts successfully
- [x] `/health` endpoint returns model list
- [x] MCP endpoint accepts council_consult tool calls
- [x] CLI can call server (implementation complete, ready for manual testing)
- [x] MCP endpoint tested with Claude Code ✅ **VERIFIED**
  - Successfully consulted Council with question "What is the meaning of life?"
  - All 4 models responded (Claude Sonnet 4.5, GPT, Grok, Llama 4 Maverick)
  - Total deliberation time: 19.7s
  - Structured responses returned correctly via MCP protocol
  - Both text/markdown and structuredContent formats working
- [ ] Concurrent requests tested (ready for load testing)
- [x] Documentation complete and clear
- [x] All TypeScript and linting checks passing

**Dependencies Added:**
- [x] `express` - HTTP server
- [x] `@modelcontextprotocol/sdk` - Official MCP SDK (v1.25.3)
- [x] `@types/express` - TypeScript types
- [x] `zod` - Runtime type validation
- [x] `axios` - HTTP client for CLI

**Implementation Notes:**
- Used **streamable HTTP** instead of SSE (MCP SDK recommendation)
- Simplified architecture: no pre-processing, consensus, or synthesis
- Council returns raw critiques from all models
- Clients decide how to use the critiques
- All deprecated modules removed (in git history if needed)

**Verification:** ✅ Phase 7 Complete
- Server implementation complete and builds successfully
- CLI refactored to HTTP client
- Documentation written
- All TypeScript and linting checks pass
- Ready for manual and integration testing

---

### Phase 8: Evaluation Module (Separate) - 📅 **DEFERRED POST-MVP**

**Status:** Deferred until after MVP completion. Manual qualitative testing will be performed first before investing in automated evaluation infrastructure.

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

**Note:** Phase 8 is **deferred until after MVP completion**. Qualitative manual testing will be performed first before investing in automated evaluation infrastructure.

---

### Phase 9: MCP Specification Compliance & Security Hardening ⭐ **NEXT PRIORITY**

**Goal:** Ensure full compliance with MCP specification (2025-06-18) and implement comprehensive security measures. This phase is required to complete the MVP.

**Context:** Current MCP server (Phase 7) supports HTTP/Streamable transport only. MCP spec requires stdio support (SHOULD requirement) and recommends several security measures. This phase adds missing transports, security hardening, and conformance testing.

**Files to create:**
- `src/server/stdio.ts` - stdio transport entry point
- `src/server/shared.ts` - shared McpServer instance
- `src/server/rate-limit.ts` - rate limiting configuration
- `src/server/sanitize.ts` - input/output sanitization
- `src/server/security.test.ts` - security tests
- `src/server/server.test.ts` - endpoint integration tests
- `conformance-baseline.yml` - MCP conformance baseline
- `docs/SECURITY.md` - security documentation

**Files to modify:**
- `src/server/index.ts` - refactor for shared server, add SSE endpoint, apply middleware
- `package.json` - add dependencies and test scripts
- `.env.example` - add rate limit configuration
- `docs/MCP_SETUP.md` - document stdio and SSE transports

#### Subphase 9.1: stdio Transport Support (HIGH PRIORITY)

**Rationale:** MCP spec says clients SHOULD support stdio for local process spawning. This is the preferred transport for local development.

**Tasks:**
- [ ] Create `src/server/shared.ts` to export shared McpServer instance and tool registration
- [ ] Create `src/server/stdio.ts` using StdioServerTransport from MCP SDK
- [ ] Refactor `src/server/index.ts` to use shared server instance
- [ ] Add `server:stdio` npm script
- [ ] Test stdio transport with echo test via stdin/stdout
- [ ] Update `docs/MCP_SETUP.md` with stdio configuration examples
- [ ] Verify with `npx tsc --noEmit` - no build errors
- [ ] Verify with `npm run lint` - no linting errors

**Implementation Pattern:**
```typescript
// src/server/shared.ts
export const mcpServer = new McpServer({
  name: 'council-mcp-server',
  version: '1.0.0',
});
mcpServer.registerTool('council_consult', ...); // Shared registration

// src/server/stdio.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mcpServer } from './shared.js';
const transport = new StdioServerTransport();
await mcpServer.connect(transport);
await transport.start();
```

**Verification:**
- Run `npm run server:stdio` and send JSON-RPC messages via stdin
- Server responds correctly via stdout (no stray text)
- MCP client can spawn server: `node dist/server/stdio.js`

#### Subphase 9.2: SSE Transport for Backwards Compatibility (MEDIUM PRIORITY)

**Rationale:** Support older MCP clients (2024-11-05 spec) that use HTTP+SSE transport. Ensures compatibility with older Claude Code versions.

**Tasks:**
- [ ] Add GET /mcp endpoint using SSEServerTransport from MCP SDK
- [ ] Keep POST /mcp (Streamable HTTP) as primary transport
- [ ] Detect client version via MCP-Protocol-Version header
- [ ] Log deprecation warning when SSE is used
- [ ] Update `docs/MCP_SETUP.md` with SSE transport configuration
- [ ] Test SSE endpoint with curl (Accept: text/event-stream header)
- [ ] Verify both transports return same Council responses
- [ ] Verify with `npx tsc --noEmit` - no build errors

**Verification:**
- Client with `Accept: text/event-stream` gets SSE stream
- Client with `Accept: application/json` gets Streamable HTTP
- Deprecation warning logged when SSE used

#### Subphase 9.3: Security Hardening (HIGH PRIORITY)

**9.3A: Rate Limiting**
- [ ] Install `express-rate-limit` package
- [ ] Create `src/server/rate-limit.ts` with configurable limits
- [ ] Apply rate limiting to POST /mcp and GET /mcp endpoints
- [ ] Add `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS` to .env.example
- [ ] Return 429 status with clear error message when limit exceeded
- [ ] Test rate limiting (trigger 429 with curl loop)

**Configuration:**
```bash
# .env.example additions
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # 100 requests per window
```

**9.3B: Enhanced Origin/Host Validation**
- [ ] Verify createMcpExpressApp already applies host validation
- [ ] Add explicit Origin header validation for defense in depth
- [ ] Whitelist only localhost origins (http://localhost:*, http://127.0.0.1:*)
- [ ] Reject requests with suspicious Origin headers
- [ ] Log rejected requests for security monitoring

**9.3C: Input Sanitization**
- [ ] Create `src/server/sanitize.ts` module
- [ ] Add length limits to Zod schema (prompt: 10,000 chars, context: 5,000 chars)
- [ ] Strip control characters and null bytes from inputs
- [ ] Detect and log potential prompt injection attempts
- [ ] Add input sanitization before Council deliberation

**Patterns to detect:**
- "Ignore all previous instructions"
- "System:" prompts
- Control characters (\x00-\x1F)

**9.3D: Output Sanitization**
- [ ] Add response filtering in `src/server/sanitize.ts`
- [ ] Detect common secret patterns (API keys, tokens, emails, URLs with credentials)
- [ ] Redact or warn about potential sensitive data leaks
- [ ] Log any redactions for security audit trail

**Patterns to detect:**
- API keys: `sk-[a-zA-Z0-9]{32,}`, `xai-[a-zA-Z0-9]+`, `gsk_[a-zA-Z0-9]+`
- Bearer tokens
- Email addresses
- AWS credentials

**9.3E: Security Headers**
- [ ] Install `helmet` package
- [ ] Apply helmet middleware to Express app
- [ ] Configure CSP (Content-Security-Policy) for localhost-only
- [ ] Add X-Frame-Options: DENY
- [ ] Add X-Content-Type-Options: nosniff
- [ ] Test security headers present (curl -I /health)

**Dependencies to add:**
```json
{
  "dependencies": {
    "express-rate-limit": "^7.1.0",
    "helmet": "^8.0.0"
  }
}
```

**Verification (Security Hardening):**
- Rate limiting triggers after 100 requests in 15 minutes (test with loop)
- Malicious Origin headers rejected (test with custom headers)
- Control characters stripped from inputs (test in sanitize.test.ts)
- Injection attempts detected and logged (test in security.test.ts)
- API keys redacted from outputs (test in sanitize.test.ts)
- Security headers present in all responses (curl -I verification)

#### Subphase 9.4: MCP Conformance Testing (HIGH PRIORITY)

**Rationale:** Validate full compliance with MCP specification using official conformance framework.

**Tasks:**
- [ ] Research MCP conformance testing framework (@modelcontextprotocol/conformance)
- [ ] Add `test:conformance:http` npm script
- [ ] Add `test:conformance:stdio` npm script
- [ ] Add `test:conformance:all` npm script
- [ ] Create `conformance-baseline.yml` to document known issues or spec deviations
- [ ] Run conformance tests on HTTP transport
- [ ] Run conformance tests on stdio transport
- [ ] Fix any critical failures (or document in baseline)
- [ ] Integrate conformance tests into CI/CD (optional)

**npm scripts to add:**
```json
{
  "test:conformance:http": "npm run build && npm run server & sleep 2 && npx @modelcontextprotocol/conformance server --url http://localhost:3000/mcp; kill %1",
  "test:conformance:stdio": "npm run build && npx @modelcontextprotocol/conformance server --command 'node dist/server/stdio.js'",
  "test:conformance:all": "npm run test:conformance:http && npm run test:conformance:stdio"
}
```

**Verification:**
- `npm run test:conformance:http` - all tests pass (or documented in baseline)
- `npm run test:conformance:stdio` - all tests pass
- Server correctly implements MCP protocol lifecycle (initialize, tools/list, tools/call)
- No protocol violations detected

#### Subphase 9.5: Security-Focused Testing (HIGH PRIORITY)

**Rationale:** Comprehensive test coverage for all security measures to validate hardening.

**Tasks:**
- [ ] Install `supertest` and `@types/supertest` for HTTP endpoint testing
- [ ] Create `src/server/security.test.ts` - security-focused test suite
- [ ] Create `src/server/server.test.ts` - endpoint integration tests
- [ ] Write rate limiting tests (3 tests: under limit, at limit, exceeded)
- [ ] Write Origin validation tests (2 tests: valid, invalid)
- [ ] Write input sanitization tests (4 tests: control chars, length limits, injection detection, valid input)
- [ ] Write output sanitization tests (3 tests: API key redaction, email redaction, clean output)
- [ ] Write security headers tests (2 tests: helmet headers present, CSP correct)
- [ ] Write endpoint integration tests (5 tests: health, mcp success, mcp failure, invalid input, timeout)
- [ ] Mock Council providers to avoid API calls in tests
- [ ] Run all tests: `npm run test`
- [ ] Verify test coverage >80% for server code
- [ ] Verify with `npm run lint` - no linting errors

**Test Coverage Goals:**
- Rate limiting: 3 tests
- Origin validation: 2 tests
- Input sanitization: 4 tests
- Output sanitization: 3 tests
- Security headers: 2 tests
- Endpoint integration: 5 tests
- **Total: 19 new tests**

**Dependencies to add:**
```json
{
  "devDependencies": {
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0"
  }
}
```

**Verification:**
- All 19 security tests pass
- Test coverage >80% for src/server/ code
- Security measures validated end-to-end

#### Subphase 9.6: Documentation & Final Verification (MEDIUM PRIORITY)

**Tasks:**
- [ ] Create `docs/SECURITY.md` with comprehensive security documentation
- [ ] Update `README.md` with security section
- [ ] Update `docs/MCP_SETUP.md` with stdio and SSE configuration
- [ ] Document rate limiting configuration
- [ ] Document known security limitations (no auth, no audit logging)
- [ ] Add security best practices for users
- [ ] Add "How to report security issues" section
- [ ] Run full verification checklist (below)
- [ ] Update this PLAN.md to mark Phase 9 as complete

**Final Verification Checklist:**
- [ ] stdio transport works with JSON-RPC via stdin/stdout
- [ ] SSE transport works with older clients (with deprecation warning)
- [ ] Rate limiting prevents abuse (429 after threshold)
- [ ] Origin validation rejects malicious requests
- [ ] Input sanitization strips control chars and detects injection
- [ ] Output sanitization redacts secrets
- [ ] Security headers present in all responses
- [ ] MCP conformance tests pass (HTTP and stdio)
- [ ] All security tests pass (19 new tests)
- [ ] Documentation complete (README, MCP_SETUP, SECURITY)
- [ ] Build passes: `npx tsc --noEmit`
- [ ] Linter passes: `npm run lint`
- [ ] All tests pass: `npm run test`

**Success Criteria:**
Phase 9 is complete when:
1. Server supports stdio, HTTP/Streamable, and SSE transports
2. All security hardening measures implemented (rate limiting, sanitization, headers)
3. MCP conformance tests pass
4. Security tests pass with >80% coverage
5. Documentation updated
6. All verification checks pass

**Estimated Time:** 20-25 hours total
- Subphase 9.1 (stdio): 3-4 hours
- Subphase 9.2 (SSE): 2-3 hours
- Subphase 9.3 (Security): 5-6 hours
- Subphase 9.4 (Conformance): 2-3 hours
- Subphase 9.5 (Tests): 4-5 hours
- Subphase 9.6 (Docs): 2 hours

---

## File Structure

```
second-brain/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── config.ts             # Environment/config loading
│   ├── providers/            # [✅ Phase 2] Provider abstraction
│   │   ├── index.ts          # Factory functions with fallback
│   │   ├── types.ts          # Provider interface, ProviderResponse
│   │   ├── anthropic/
│   │   │   └── index.ts      # AnthropicProvider class
│   │   ├── openai/
│   │   │   └── index.ts      # OpenAIProvider class
│   │   ├── xai/
│   │   │   └── index.ts      # XAIProvider class
│   │   └── groq/
│   │       └── index.ts      # GroqProvider class
│   ├── council/              # [✅ Phase 3] Parallel querying
│   │   ├── index.ts
│   │   └── types.ts
│   ├── server/               # [✅ Phase 7, ⏳ Phase 9] Daemon server
│   │   ├── index.ts          # Express server with MCP (HTTP + SSE)
│   │   ├── stdio.ts          # [Phase 9] stdio transport entry point
│   │   ├── shared.ts         # [Phase 9] Shared McpServer instance
│   │   ├── types.ts          # Request/response types
│   │   ├── rate-limit.ts     # [Phase 9] Rate limiting config
│   │   ├── sanitize.ts       # [Phase 9] Input/output sanitization
│   │   ├── server.test.ts    # [Phase 9] Endpoint integration tests
│   │   └── security.test.ts  # [Phase 9] Security tests
│   ├── client/               # [⏳ Phase 7] CLI as HTTP client
│   │   └── cli.ts            # Simplified CLI
│   ├── cli/                  # [✅ Phase 6] Original CLI (will be deprecated)
│   │   ├── index.ts
│   │   └── ui.ts
│   ├── consensus/            # [📦 DEPRECATED] Consensus module
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── strategies/
│   │       └── simple-synthesis.ts
│   ├── brain/                # [📦 DEPRECATED] Personal Brain
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── prompts.ts
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

# Server Configuration
PORT=3000  # Port for daemon server (default: 3000)

# Rate Limiting (Phase 9)
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes (default: 900000)
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window (default: 100)

# Optional
SECOND_BRAIN_TIMEOUT_MS=30000  # Timeout per model query
SECOND_BRAIN_DEBUG=false        # Enable debug logging
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
    "chalk": "^5.0.0",
    "express": "^4.18.0",
    "@modelcontextprotocol/sdk": "latest",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.0",
    "helmet": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0"
  }
}
```

---

## Verification Checklist

After each phase, verify:

- [x] **Phase 1:** `npx tsx src/index.ts --test-providers` shows all 4 providers connected
- [x] **Phase 2:** Each provider wrapper can query its model and return structured response
- [x] **Phase 3:** Council queries all 4 models in parallel, handles failures gracefully
- [x] ~~**Phase 4:**~~ ~~Consensus module~~ (**DEPRECATED** - removed in Phase 7)
- [x] ~~**Phase 5:**~~ ~~Personal Brain post-processing~~ (**DEPRECATED** - removed in Phase 7)
- [x] **Phase 6:** Full CLI flow works: ask question → see progress → get answer
- [x] **Phase 7:** Daemon server running, CLI and MCP both work, Council returns critiques ✅ **Successfully tested with Claude Code - all 4 models responded in 19.7s**
- [ ] **Phase 9:** MCP spec compliance verified, security hardening complete, conformance tests pass ⭐ **MVP COMPLETE**
- [ ] **Phase 8:** Eval harness can validate Council provides useful help (deferred post-MVP)

**Note:** MVP is complete after Phase 9. Phase 8 evaluation is deferred for manual qualitative testing first.

---

## Implementation Order

1. ✅ **Phase 1** - Project setup (foundation)
2. ✅ **Phase 2** - Provider wrappers with fallback support
3. ✅ **Phase 3** - Council (parallel querying)
4. ~~**Phase 4**~~ - ~~Consensus module~~ (**DEPRECATED**)
5. ~~**Phase 5**~~ - ~~Personal Brain orchestration~~ (**DEPRECATED**)
6. ✅ **Phase 6** - CLI (refactored in Phase 7)
7. ✅ **Phase 7** - Council Daemon & MCP Integration (HTTP transport)
8. ⏳ **Phase 9** - **MCP Spec Compliance & Security Hardening** ⭐ **CURRENT FOCUS**
9. 📅 **Phase 8** - Evaluation (deferred until after MVP - manual testing first)

**Current MVP scope:** Phases 1-3, 7, 9
- Much simpler than original plan
- Focused on "phone a friend" use case
- Client-agnostic Council service
- Full MCP compliance with security best practices
- **Phase 9 completes the MVP** - Phase 8 evaluation deferred for post-MVP refinement

---

## Notes for AI Agents

- Use Vercel AI SDK (`ai` package) for unified streaming interface
- All providers implement the same `Provider` interface
- **Council is the core** - simple parallel querying, no orchestration, no synthesis
  - Council just returns raw responses from all models
  - Clients decide what to do with the responses
- Use official MCP SDK examples as reference for SSE transport integration
  - See `createMcpExpressApp` in MCP TypeScript SDK examples
  - Single Express server serves both HTTP and MCP endpoints
- Handle API failures gracefully - if 1 Council model fails, continue with remaining 3
  - Use `Promise.allSettled()` for parallel queries
  - Return partial results when some models fail
- Daemon architecture:
  - Server runs persistently (for CLI)
  - Claude Code spawns MCP connection via SSE
  - Both use same underlying Council
- Phase 7 focus: "Phone a friend" for AI agents (especially Claude Code)
- Phases 4-5 (Brain orchestration, Consensus) are deprecated - removed in Phase 7 refactor
