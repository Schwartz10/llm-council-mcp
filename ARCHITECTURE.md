# Second Brain - Technical Architecture Specification

## Overview

Second Brain is a CLI tool that demonstrates multi-model AI deliberation. It uses a "Personal Brain" (orchestrator) that coordinates a "Council" of 4 frontier AI models deliberating in parallel, then synthesizes their responses into a unified answer.

**Status:** Phase 6 Complete - MVP READY (Full end-to-end CLI with all modules integrated)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                  │
│                         "What is the best..."                            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLI INTERFACE                                   │
│                        ✅ Phase 6 Complete                              │
│                                                                          │
│  Files: src/cli/index.ts, src/cli/ui.ts, src/index.ts                  │
│  - Command parsing (Commander.js) - "ask" command                       │
│  - Progress UI (ora spinners) with real-time updates                   │
│  - Response formatting with confidence bars                             │
│  - Timing information and error handling                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
╔═════════════════════════════════════════════════════════════════════════╗
║                         PERSONAL BRAIN                                  ║
║                    (Orchestrator & Processor)                           ║
╠═════════════════════════════════════════════════════════════════════════╣
║                                                                         ║
║  ┌─────────────────────────────────────────────────────────────┐       ║
║  │         PRE-PROCESSING (✅ Phase 3 Complete)                 │       ║
║  │                                                              │       ║
║  │  Files:                                                      │       ║
║  │   • src/brain/index.ts (Brain class)                        │       ║
║  │   • src/brain/types.ts (BrainConfig, interfaces)            │       ║
║  │   • src/brain/prompts.ts (pre-processing templates)         │       ║
║  │                                                              │       ║
║  │  Responsibilities:                                           │       ║
║  │   • Clarify ambiguities in user query                       │       ║
║  │   • Add helpful context                                     │       ║
║  │   • Structure query for optimal Council performance         │       ║
║  │   • Graceful fallback on failure                            │       ║
║  │                                                              │       ║
║  │  Method: prepareForCouncil(userQuery) → formattedPrompt    │       ║
║  └──────────────────────────┬───────────────────────────────────┘       ║
║                             │                                           ║
║                             ▼                                           ║
║                    [Formatted Prompt]                                   ║
║                             │                                           ║
║                             ▼                                           ║
║  ┌─────────────────────────────────────────────────────────────┐       ║
║  │         POST-PROCESSING (✅ Phase 5 Complete)                │       ║
║  │                                                              │       ║
║  │  Files:                                                      │       ║
║  │   • src/brain/index.ts (presentToUser method)               │       ║
║  │   • src/brain/prompts.ts (post-processing templates)        │       ║
║  │                                                              │       ║
║  │  Responsibilities:                                           │       ║
║  │   • Format consensus result for user presentation           │       ║
║  │   • Add confidence indicators (high/moderate/low)           │       ║
║  │   • Highlight dissenting opinions                           │       ║
║  │   • Make response conversational and cohesive               │       ║
║  │   • Graceful fallback on failure                            │       ║
║  │                                                              │       ║
║  │  Method: presentToUser(consensus) → finalResponse           │       ║
║  └─────────────────────────────────────────────────────────────┘       ║
║                                                                         ║
║  Configuration:                                                         ║
║   • Default: Claude Sonnet 4.5                                         ║
║   • Configurable via BRAIN_MODEL env var                               ║
║   • Supports any Provider implementation                               ║
╚═════════════════════════════╦═══════════════════════════════════════════╝
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    COUNCIL (Parallel Querying)                          │
│                        ✅ Phase 3 Complete                              │
│                                                                         │
│  Files:                                                                 │
│   • src/council/index.ts (Council class)                               │
│   • src/council/types.ts (DeliberationResult, ProgressCallback)        │
│                                                                         │
│  Responsibilities:                                                      │
│   • Query all 4 providers in parallel (Promise.allSettled)             │
│   • 30s timeout per provider (configurable)                            │
│   • Handle partial failures gracefully                                 │
│   • Emit progress events for UI                                        │
│   • Return DeliberationResult with all responses + metadata            │
│                                                                         │
│  Method: deliberate(prompt, onProgress?) → DeliberationResult          │
└────────┬────────────┬────────────┬────────────┬─────────────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
    │Provider│  │Provider│  │Provider│  │Provider│
    │   1    │  │   2    │  │   3    │  │   4    │
    └────────┘  └────────┘  └────────┘  └────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
  ┌──────────────────────────────────────────────────┐
  │                                                   │
  │  [Response 1]  [Response 2]  [Response 3]  [Resp4]
  │                                                   │
  └────────────────────┬──────────────────────────────┘
                       │
                       ▼
              [DeliberationResult]
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONSENSUS MODULE                                     │
│                        ✅ Phase 4 Complete                              │
│                                                                         │
│  Files:                                                                 │
│   • src/consensus/index.ts (Consensus orchestrator)                    │
│   • src/consensus/types.ts (ConsensusResult, ConsensusStrategy)        │
│   • src/consensus/strategies/simple-synthesis.ts (SimpleSynthesis)     │
│   • src/consensus/prompts.ts (synthesis prompt templates)              │
│                                                                         │
│  Responsibilities:                                                      │
│   • Synthesize 4 Council responses into unified answer                 │
│   • Identify agreement vs disagreement patterns                        │
│   • Calculate confidence score (0-1) based on consensus                │
│   • Note significant dissent                                           │
│   • Extensible strategy pattern (strategies can be swapped)            │
│   • Graceful fallback on synthesis failure                             │
│                                                                         │
│  Method: consensus.synthesize(responses, prompt) → ConsensusResult     │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
  [ConsensusResult]
         │
         └──────────────> Back to Personal Brain (post-processing)
                                      │
                                      ▼
                              [Final Response]
                                      │
                                      ▼
                                  CLI → User
```

---

## Provider Abstraction Layer (✅ Phase 2 Complete)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROVIDER INTERFACE                              │
│                                                                         │
│  File: src/providers/types.ts                                          │
│                                                                         │
│  interface Provider {                                                   │
│    name: string                                                         │
│    query(prompt: string): Promise<ProviderResponse>                    │
│    queryStream(prompt: string): AsyncIterable<string>                  │
│  }                                                                      │
│                                                                         │
│  interface ProviderResponse {                                           │
│    content: string                                                      │
│    provider: string                                                     │
│    latencyMs: number                                                    │
│    tokensUsed?: number                                                  │
│    error?: string                                                       │
│  }                                                                      │
└────────┬────────────┬────────────┬────────────┬─────────────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
    │Anthropic│  │ OpenAI  │  │   xAI   │  │  Groq   │
    │Provider │  │Provider │  │Provider │  │Provider │
    └─────────┘  └─────────┘  └─────────┘  └─────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
    │ Claude  │  │   GPT   │  │  Grok   │  │ Llama 4 │
    │Sonnet   │  │  5.2    │  │ 3 Beta  │  │Maverick │
    │  4.5    │  │         │  │         │  │         │
    └─────────┘  └─────────┘  └─────────┘  └─────────┘

Files:
  • src/providers/anthropic/index.ts (AnthropicProvider class)
  • src/providers/openai/index.ts (OpenAIProvider class)
  • src/providers/xai/index.ts (XAIProvider class)
  • src/providers/groq/index.ts (GroqProvider class)

Each provider:
  • Implements Provider interface
  • Uses Vercel AI SDK (@ai-sdk/*)
  • Handles errors gracefully
  • Tracks latency
  • Returns structured responses

Provider Factory:
  • src/providers/index.ts
  • createCouncilProviders() - creates all 4 council providers
  • createProviderWithFallback() - tries models in order until success
```

---

## Configuration Layer (✅ Phase 1 Complete)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CONFIGURATION SYSTEM                              │
│                                                                         │
│  File: src/config.ts                                                   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                    Environment Config                         │     │
│  │                                                               │     │
│  │  interface Config {                                           │     │
│  │    anthropicApiKey?: string                                   │     │
│  │    openaiApiKey?: string                                      │     │
│  │    xaiApiKey?: string                                         │     │
│  │    groqApiKey?: string                                        │     │
│  │    timeoutMs: number (default: 30000)                         │     │
│  │    debug: boolean (default: false)                            │     │
│  │    brainModel: string (default: anthropic/claude-sonnet-4-5)  │     │
│  │  }                                                             │     │
│  │                                                               │     │
│  │  Source: .env file (dotenv)                                   │     │
│  │  Validation: getMissingApiKeys()                              │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                    Model Config (Council)                     │     │
│  │                                                               │     │
│  │  interface ModelConfig {                                      │     │
│  │    name: string        // "Claude Sonnet 4.5"                 │     │
│  │    provider: string    // "anthropic"                         │     │
│  │    apiKey?: string     // From env config                     │     │
│  │    models: string[]    // ["primary", "fallback1", ...]       │     │
│  │  }                                                             │     │
│  │                                                               │     │
│  │  export const COUNCIL_MODELS: ModelConfig[] = [               │     │
│  │    { Claude Sonnet 4.5, fallback to 3.5 },                    │     │
│  │    { GPT-5.2, fallback to 4o, fallback to 4-turbo },          │     │
│  │    { Grok 3 Beta },                                            │     │
│  │    { Llama 4 Maverick, fallback to 3.3 }                      │     │
│  │  ]                                                             │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                 Model Config (Personal Brain)                 │     │
│  │                                                               │     │
│  │  export const BRAIN_MODEL_CONFIG: ModelConfig = {             │     │
│  │    name: "Personal Brain",                                    │     │
│  │    provider: "anthropic",                                     │     │
│  │    models: ["claude-sonnet-4-5", "claude-sonnet-3-5"]         │     │
│  │  }                                                             │     │
│  │                                                               │     │
│  │  Overridable via BRAIN_MODEL env var                          │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  Features:                                                              │
│   • Single source of truth for all config                              │
│   • User-editable model arrays                                         │
│   • Automatic fallback support                                         │
│   • Graceful degradation when models unavailable                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Consensus Module (✅ Phase 4 Complete)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONSENSUS ARCHITECTURE                             │
│                                                                         │
│  Strategy Pattern for Extensibility                                     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                   ConsensusStrategy Interface                 │     │
│  │                                                               │     │
│  │  interface ConsensusStrategy {                                │     │
│  │    name: string                                               │     │
│  │    synthesize(                                                │     │
│  │      responses: ProviderResponse[],                           │     │
│  │      originalPrompt: string                                   │     │
│  │    ): Promise<ConsensusResult>                                │     │
│  │  }                                                             │     │
│  │                                                               │     │
│  │  interface ConsensusResult {                                  │     │
│  │    synthesis: string      // Unified answer                   │     │
│  │    agreement: boolean     // Broad agreement?                 │     │
│  │    confidence: number     // 0-1 score                        │     │
│  │    dissent?: string       // Notable disagreements            │     │
│  │  }                                                             │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │             SimpleSynthesis Strategy (MVP)                    │     │
│  │                                                               │     │
│  │  Files: src/consensus/strategies/simple-synthesis.ts          │     │
│  │         src/consensus/prompts.ts                              │     │
│  │                                                               │     │
│  │  Approach:                                                     │     │
│  │   1. Use Personal Brain for synthesis                         │     │
│  │   2. Send all Council responses with synthesis prompt         │     │
│  │   3. Brain produces JSON with:                                │     │
│  │      • synthesis (unified answer)                             │     │
│  │      • agreement (boolean)                                    │     │
│  │      • confidence (0-1)                                       │     │
│  │      • dissent (optional string)                              │     │
│  │   4. Parse and validate JSON response                         │     │
│  │   5. Fallback on parse failure (concatenate with low conf)    │     │
│  │                                                               │     │
│  │  Features:                                                     │     │
│  │   • Robust JSON extraction (handles markdown wrapping)        │     │
│  │   • Confidence clamping (0-1 range)                           │     │
│  │   • Graceful fallback when synthesis fails                    │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                  Consensus Orchestrator                       │     │
│  │                                                               │     │
│  │  File: src/consensus/index.ts                                 │     │
│  │                                                               │     │
│  │  class Consensus {                                            │     │
│  │    constructor(config: { strategy: ConsensusStrategy })       │     │
│  │    synthesize(responses, prompt): Promise<ConsensusResult>    │     │
│  │    setStrategy(strategy): void // Strategy swapping           │     │
│  │    getStrategyName(): string                                  │     │
│  │  }                                                             │     │
│  │                                                               │     │
│  │  Future Strategies:                                            │     │
│  │   • AlgorithmicConsensus (no LLM, pure logic)                 │     │
│  │   • WeightedSynthesis (weight by model reputation)            │     │
│  │   • IterativeRefinement (multi-round deliberation)            │     │
│  └───────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## CLI Interface (✅ Phase 6 Complete)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLI ARCHITECTURE                                │
│                                                                         │
│  User-Facing Interface for Second Brain                                │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                    Commands                                   │     │
│  │                                                               │     │
│  │  $ second-brain ask "<question>"                              │     │
│  │    → Full Second Brain deliberation flow                      │     │
│  │    → Real-time progress indicators                            │     │
│  │    → Formatted response with confidence                       │     │
│  │                                                               │     │
│  │  $ second-brain --test-providers                              │     │
│  │    → Test all 4 Council providers                             │     │
│  │    → Show connectivity status                                 │     │
│  │                                                               │     │
│  │  $ second-brain --test-provider <name>                        │     │
│  │    → Test specific provider                                   │     │
│  │                                                               │     │
│  │  $ second-brain --version                                     │     │
│  │    → Show version information                                 │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │              Main Flow (handleAskCommand)                     │     │
│  │                                                               │     │
│  │  File: src/cli/index.ts                                       │     │
│  │                                                               │     │
│  │  async function handleAskCommand(question: string) {          │     │
│  │    1. Validate input and API keys                            │     │
│  │    2. Initialize Personal Brain (with fallback)              │     │
│  │    3. Pre-process question                                   │     │
│  │    4. Initialize Council (all available providers)           │     │
│  │    5. Deliberate with progress callbacks                     │     │
│  │    6. Synthesize consensus                                   │     │
│  │    7. Post-process with Brain                                │     │
│  │    8. Format and display result                              │     │
│  │    9. Show timing information                                │     │
│  │  }                                                            │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                 UI Utilities (src/cli/ui.ts)                  │     │
│  │                                                               │     │
│  │  • ProgressSpinner - ora-based spinners                       │     │
│  │    - update(message) - update spinner text                    │     │
│  │    - succeed(message) - mark success                          │     │
│  │    - fail(message) - mark failure                             │     │
│  │    - warn(message) - show warning                             │     │
│  │                                                               │     │
│  │  • formatFinalResponse(response, confidence)                  │     │
│  │    - Visual confidence bar (█████░░░░░)                       │     │
│  │    - Colored confidence label                                 │     │
│  │    - Formatted response text                                  │     │
│  │                                                               │     │
│  │  • formatTiming(totalMs) - display elapsed time               │     │
│  │  • formatError(error) - format error messages                 │     │
│  │  • showHeader/Success/Warning/Error - status messages         │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                    UX Features                                │     │
│  │                                                               │     │
│  │  ✅ Real-time progress updates                                │     │
│  │     - Show as each Council member responds                    │     │
│  │     - Success (✓) and failure (✗) indicators                  │     │
│  │     - Completion counter (e.g., "2/4 completed")              │     │
│  │                                                               │     │
│  │  ✅ Confidence visualization                                  │     │
│  │     - Color-coded: green (high), yellow (mod), red (low)      │     │
│  │     - Visual bar: ██████████ (0.0 - 1.0)                      │     │
│  │     - Numeric value displayed                                 │     │
│  │                                                               │     │
│  │  ✅ Error handling                                            │     │
│  │     - Graceful provider failures                              │     │
│  │     - Missing API key warnings                                │     │
│  │     - Clear error messages with context                       │     │
│  │                                                               │     │
│  │  ✅ Timing information                                        │     │
│  │     - Total deliberation time                                 │     │
│  │     - Displayed in seconds (e.g., "57.5s")                    │     │
│  └───────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow (Full Implementation)

```
1. User Question (raw input)
        │
        ▼
2. Personal Brain.prepareForCouncil()
        │
        ├─> Query provider with pre-processing prompt
        │
        ▼
3. Formatted Prompt (clarified, contextualized)
        │
        ▼
4. Council.deliberate(formattedPrompt, onProgress)
        │
        ├─> Promise.allSettled([
        │       provider1.query(prompt),
        │       provider2.query(prompt),
        │       provider3.query(prompt),
        │       provider4.query(prompt)
        │   ])
        │
        ├─> Each provider:
        │   ├─> Vercel AI SDK generateText()
        │   ├─> Track latency
        │   └─> Return ProviderResponse or error
        │
        ▼
5. DeliberationResult
        {
          responses: ProviderResponse[],
          totalLatencyMs: number,
          successCount: number,
          failureCount: number,
          prompt: string
        }
        │
        ▼
6. Consensus.synthesize(responses, originalPrompt) ✅
        │
        ├─> SimpleSynthesis strategy
        │   ├─> Generate synthesis prompt
        │   ├─> Query Personal Brain
        │   ├─> Parse JSON response
        │   └─> Extract: synthesis, agreement, confidence, dissent
        │
        ▼
7. ConsensusResult ✅
        {
          synthesis: string,
          agreement: boolean,
          confidence: number (0-1),
          dissent?: string
        }
        │
        ▼
8. Brain.presentToUser(consensus) ✅
        │
        ├─> Query provider with post-processing prompt
        │   ├─> Includes consensus data
        │   ├─> Includes confidence labels
        │   ├─> Includes agreement status
        │   └─> Includes dissent if present
        │
        ├─> Format response conversationally
        │   ├─> Lead with main answer
        │   ├─> Note confidence appropriately
        │   └─> Mention alternative viewpoints if relevant
        │
        ▼
9. Final Formatted Response ✅
        │
        ▼
10. CLI Display ✅
        │
        ├─> formatFinalResponse()
        │   ├─> Add visual confidence bar
        │   ├─> Format with colored output
        │   └─> Display timing information
        │
        ▼
    User sees formatted answer with confidence indicator
```

---

## Error Handling Strategy

### Graceful Degradation

```
Provider Level:
  • API errors caught and returned as ProviderResponse with error field
  • Timeout handled per-provider (30s default)
  • Stack traces included for debugging

Council Level:
  • Promise.allSettled() ensures all providers complete/timeout
  • Partial failures allowed (continue with remaining providers)
  • Minimum 1 success required for useful result
  • Progress callbacks report both success and failure

Brain Level:
  • Pre-processing failure falls back to original user query
  • Post-processing failure falls back to raw consensus synthesis
  • Warning logged but processing continues
  • Graceful degradation ensures user always gets an answer

Config Level:
  • Missing API keys warn but don't error
  • Providers with missing keys skipped in tests
  • Fallback models tried in order until success
```

### Error Flow

```
Provider API Failure
        │
        ├─> Caught in provider.query()
        │
        ├─> Returned as ProviderResponse { error: "..." }
        │
        ▼
Council receives failed response
        │
        ├─> Marked as failure in DeliberationResult
        │
        ├─> failureCount incremented
        │
        ▼
Consensus Module (future)
        │
        ├─> Synthesizes only successful responses
        │
        ├─> Notes missing perspectives in synthesis
        │
        ▼
User sees result (may be lower confidence due to failures)
```

---

## Testing Strategy

### Unit Tests (✅ Phase 2-3)

```
Provider Tests (src/providers/*/index.test.ts):
  • Test provider creation
  • Test successful query with real API
  • Test error handling
  • Uses cheaper/faster models for testing

Brain Tests (src/brain/brain.test.ts):
  • Test Brain creation
  • Test pre-processing with simple query
  • Test pre-processing with ambiguous query
  • Test pre-processing with complex query
  • Test pre-processing fallback on failure
  • Test post-processing with high confidence and agreement
  • Test post-processing with low confidence and dissent
  • Test post-processing with moderate confidence
  • Test post-processing fallback on failure
  • Uses real Anthropic API

Council Tests (src/council/council.test.ts):
  • Test Council creation
  • Test parallel execution (verify timing)
  • Test partial failure handling
  • Test timeout behavior
  • Test progress callbacks
  • Uses mock providers (no API calls)

Factory Tests (src/providers/index.test.ts):
  • Test createCouncilProviders()
  • Test provider instantiation

Consensus Tests (src/consensus/consensus.test.ts):
  • Test consensus orchestrator creation
  • Test SimpleSynthesis strategy
  • Test JSON parsing (clean and markdown-wrapped)
  • Test agreement/disagreement scenarios
  • Test confidence clamping
  • Test fallback on synthesis failure
  • Test strategy switching
```

### Test Coverage

```
Total: 41/41 tests passing
  • 8 test files
  • Provider tests: 14 tests
  • Brain tests: 9 tests (5 pre-processing + 4 post-processing)
  • Council tests: 8 tests
  • Consensus tests: 10 tests

Build: ✅ No TypeScript errors
Lint: ✅ No ESLint/Prettier errors
```

---

## File Structure

```
second-brain/
├── src/
│   ├── config.ts                    [✅ Config system]
│   │
│   ├── providers/                   [✅ Provider abstraction]
│   │   ├── types.ts                 [Provider interface]
│   │   ├── index.ts                 [Factory functions]
│   │   ├── test-helpers.ts          [Test configuration]
│   │   │
│   │   ├── anthropic/
│   │   │   ├── index.ts             [AnthropicProvider class]
│   │   │   └── index.test.ts
│   │   │
│   │   ├── openai/
│   │   │   ├── index.ts             [OpenAIProvider class]
│   │   │   └── index.test.ts
│   │   │
│   │   ├── xai/
│   │   │   ├── index.ts             [XAIProvider class]
│   │   │   └── index.test.ts
│   │   │
│   │   └── groq/
│   │       ├── index.ts             [GroqProvider class]
│   │       └── index.test.ts
│   │
│   ├── brain/                       [✅ Personal Brain pre & post-processing]
│   │   ├── types.ts                 [BrainConfig, interfaces]
│   │   ├── prompts.ts               [Pre & post-processing templates]
│   │   ├── index.ts                 [Brain class]
│   │   └── brain.test.ts
│   │
│   ├── council/                     [✅ Parallel querying]
│   │   ├── types.ts                 [DeliberationResult, ProgressCallback]
│   │   ├── index.ts                 [Council class]
│   │   └── council.test.ts
│   │
│   ├── consensus/                   [✅ Consensus synthesis]
│   │   ├── index.ts                 [Consensus orchestrator]
│   │   ├── types.ts                 [ConsensusResult, ConsensusStrategy]
│   │   ├── prompts.ts               [Synthesis prompt templates]
│   │   ├── consensus.test.ts
│   │   └── strategies/
│   │       └── simple-synthesis.ts  [SimpleSynthesis strategy]
│   │
│   ├── cli/                         [✅ CLI Interface]
│   │   ├── index.ts                 [handleAskCommand orchestration]
│   │   └── ui.ts                    [ProgressSpinner, formatting utilities]
│   │
│   ├── api/                         [⏳ Phase 7 - Not implemented]
│   │   ├── index.ts                 [API adapter/middleware]
│   │   ├── types.ts                 [OpenAI/Anthropic schemas]
│   │   ├── openai-adapter.ts        [OpenAI-compatible interface]
│   │   └── anthropic-adapter.ts     [Anthropic-compatible interface]
│   │
│   ├── eval/                        [⏳ Phase 8 - Not implemented]
│   │   ├── index.ts                 [Evaluation harness]
│   │   ├── questions.ts             [Test question bank]
│   │   ├── compare.ts               [Comparison logic]
│   │   └── report.ts                [Generate eval report]
│   │
│   └── index.ts                     [✅ CLI entry point, test commands]
│
├── PLAN.md                          [Implementation plan & progress]
├── CLAUDE.md                        [Project instructions for Claude Code]
├── ARCHITECTURE.md                  [This file - technical spec]
├── README.md                        [User-facing documentation]
│
├── package.json                     [Dependencies & scripts]
├── tsconfig.json                    [TypeScript config]
├── vitest.config.ts                 [Test config]
├── eslint.config.js                 [ESLint config]
├── .prettierrc.json                 [Prettier config]
│
├── .env                             [API keys (gitignored)]
└── .env.example                     [API key template]
```

---

## Technology Stack

### Core Dependencies

```
Language & Runtime:
  • TypeScript 5.x
  • Node.js (ES Modules)

LLM Integration:
  • ai (Vercel AI SDK core)
  • @ai-sdk/anthropic (Claude models)
  • @ai-sdk/openai (GPT models)
  • @ai-sdk/xai (Grok models)
  • @ai-sdk/groq (Llama models via Groq)

CLI Framework:
  • commander (command parsing)
  • ora (spinners & progress)
  • chalk (terminal colors)

Configuration:
  • dotenv (environment variables)

Testing:
  • vitest (test runner)
  • @types/node (TypeScript types)

Development:
  • tsx (TypeScript execution)
  • eslint (linting)
  • prettier (formatting)
```

### Design Patterns

```
1. Provider Pattern
   • Unified Provider interface
   • Multiple implementations (Anthropic, OpenAI, xAI, Groq)
   • Model-agnostic provider classes

2. Strategy Pattern
   • ConsensusStrategy interface (future)
   • Pluggable synthesis strategies
   • Easy to add new strategies

3. Factory Pattern
   • createCouncilProviders() - creates all providers
   • createProviderWithFallback() - automatic fallback

4. Observer Pattern
   • ProgressCallback for Council progress
   • Real-time UI updates

5. Graceful Degradation
   • Fallback models
   • Partial failure tolerance
   • Original query fallback
```

---

## Next Steps (Phase 7+)

**MVP Complete!** Phases 1-6 are fully implemented. Second Brain can now:
- Accept user questions via CLI (`second-brain ask "question"`)
- Pre-process with Personal Brain
- Query 4 AI models in parallel (Council)
- Synthesize consensus from responses
- Post-process and format final answer
- Display with confidence indicators and timing

Remaining phases add extended features and validation:

### Phase 7: API Schema Compatibility
Expose Second Brain through OpenAI/Anthropic-compatible APIs.

### Phase 8: Evaluation Module
Validate that Second Brain answers are preferred >60% vs single models.

---

## Performance Characteristics

### Current Performance (Phase 3)

```
Pre-processing (Brain):
  • Latency: ~1-3s (single LLM call)
  • Model: Claude Sonnet 4.5
  • Fallback on failure: instant (returns original query)

Parallel Querying (Council):
  • Latency: max(all_providers) + overhead
  • Typical: 2-5s (slowest provider wins)
  • Timeout: 30s per provider
  • Failures don't block other providers

Total (Pre-processing + Council):
  • Best case: ~3-6s (all providers fast)
  • Worst case: ~30-33s (some providers timeout)
  • Typical: ~5-10s
```

### Future Performance (Post Phase 6)

```
End-to-End Flow:
  1. Pre-processing: 1-3s
  2. Council: 2-5s
  3. Consensus: 1-3s (synthesis LLM call)
  4. Post-processing: 1-3s

Total: ~5-14s typical, ~40s worst case
```

---

## Configuration & Customization

### Model Customization

Users can edit `src/config.ts` to:
- Change primary models
- Adjust fallback order
- Add new models
- Remove models

### Environment Variables

```bash
# Required (at least one provider)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
GROQ_API_KEY=gsk_...

# Optional
BRAIN_MODEL=anthropic/claude-sonnet-4-5-20250929
SECOND_BRAIN_TIMEOUT_MS=30000
SECOND_BRAIN_DEBUG=false
```

### Adding New Providers

1. Create `src/providers/{provider}/index.ts`
2. Implement `Provider` interface
3. Add to `COUNCIL_MODELS` in `config.ts`
4. Add API key to env config

---

## Architectural Principles

### 1. Modularity
Each module (Brain, Council, Consensus, Providers) is independent and loosely coupled.

### 2. Extensibility
- New providers via Provider interface
- New consensus strategies via strategy pattern
- Brain model is swappable

### 3. Graceful Degradation
- Missing API keys → skip provider
- Provider failures → continue with rest
- Pre-processing failure → use original query

### 4. Transparency
- Debug logging at each layer
- Progress callbacks for UI
- Latency tracking everywhere

### 5. Testability
- All modules unit tested
- Mock providers for testing
- Real API tests where appropriate

---

**Document Version:** 1.2
**Last Updated:** Phase 6 Complete - MVP READY (2025-01-21)
**Status:** MVP Complete - Extended Features In Progress
