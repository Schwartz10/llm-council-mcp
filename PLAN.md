# Second Brain MVP Implementation Plan

## Overview

Build a CLI tool that demonstrates multi-model AI deliberation ("The Council") produces better answers than any single model. Users ask questions through a "Personal Brain" (stub model), which escalates to 5 frontier models deliberating together, then synthesizes a unified response.

**Goal:** Prove Second Brain answers are preferred >60% of the time vs best single model.

## Architecture

```
User → CLI → Personal Brain (Claude Sonnet) → Council (5 models in parallel) → Consensus Module → Personal Brain (synthesis) → User
```

### Tech Stack
- **Language:** TypeScript/Node.js (single package)
- **LLM SDKs:** Vercel AI SDK (`@ai-sdk/*`) for unified provider interface
- **CLI Framework:** Commander.js or similar
- **Config:** Environment variables only (.env)

### Council Models (5 total)
1. Claude Sonnet 4.5 (Anthropic)
2. GPT-5.2 (OpenAI)
3. Grok (xAI) - latest
4. Llama (via Groq) - latest
5. Perplexity - latest

### Personal Brain Model
- Use Claude Sonnet 4.5 (best performing, cost not a concern for MVP)
- Must be designed for easy swap to any model (including local) later

---

## Implementation Phases

### Phase 1: Project Setup & Provider Integration
**Files to create:**
- `package.json` - dependencies: `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/xai`, `@ai-sdk/groq`, `@ai-sdk/perplexity`, `commander`, `dotenv`, `ora` (spinner)
- `tsconfig.json` - strict mode, ES modules
- `.env.example` - template for API keys
- `src/index.ts` - CLI entry point
- `src/config.ts` - load env vars, validate API keys present

**Tasks:**
1. Initialize npm project with TypeScript
2. Install Vercel AI SDK providers for all 5 models
3. Create config loader that validates all 5 API keys exist
4. Create simple test script that pings each provider to verify connectivity

**Verification:** Run `npx tsx src/index.ts --test-providers` and see all 5 providers respond.

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
- `src/providers/groq/llama.ts` - Llama implementation
- `src/providers/perplexity/index.ts` - Shared Perplexity API logic
- `src/providers/perplexity/perplexity.ts` - Perplexity implementation

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
1. Define Provider interface with `query()` and `queryStream()` methods
2. Create provider directory structure (anthropic/, openai/, xai/, groq/, perplexity/)
3. Implement shared logic in each provider's index.ts
4. Implement model-specific wrappers for all 5 models
5. Each wrapper should handle errors gracefully and return structured response
6. Add latency tracking to each query
7. Export all model implementations from `src/providers/index.ts`

**Verification:** Unit test each provider wrapper individually.

---

### Phase 3: Council Module (Parallel Querying)
**Files to create:**
- `src/council/index.ts` - main Council orchestrator
- `src/council/types.ts` - `CouncilRequest`, `CouncilResponse`, `DeliberationResult`

**Behavior:**
1. Accept a prompt (pre-processed by Personal Brain)
2. Query all 5 providers in parallel using `Promise.allSettled()`
3. Handle partial failures gracefully (if 1-2 models fail, continue with rest)
4. Return array of all responses with metadata

**Tasks:**
1. Create Council class that takes array of Providers
2. Implement `deliberate(prompt: string)` method
3. Run all providers in parallel with timeout (30s per provider)
4. Collect results, mark failed providers
5. Emit progress events for CLI streaming UI

**Verification:** Query Council with test prompt, see 5 responses returned.

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
1. Take all 5 model responses
2. Send to Personal Brain model with synthesis prompt:
   ```
   You are synthesizing answers from 5 different AI models to produce the best possible response.

   Original question: {prompt}

   Model responses:
   [Claude]: {response1}
   [GPT]: {response2}
   [Grok]: {response3}
   [Llama]: {response4}
   [Perplexity]: {response5}

   Synthesize these into a single, authoritative answer. Note any significant disagreements.
   Indicate your confidence level (high/medium/low) based on model agreement.
   ```
3. Parse synthesis response for agreement/confidence indicators
4. Return ConsensusResult

**Tasks:**
1. Create ConsensusStrategy interface
2. Implement SimpleSynthesis strategy
3. Design synthesis prompt that produces structured output
4. Parse synthesis for agreement/confidence signals
5. Make it easy to add new strategies later (just add file to strategies/)

**Verification:** Pass mock responses to consensus module, verify synthesis output.

---

### Phase 5: Personal Brain Module
**Files to create:**
- `src/brain/index.ts` - Personal Brain orchestrator
- `src/brain/types.ts` - `BrainConfig`
- `src/brain/prompts.ts` - prompt templates

**Responsibilities:**
1. **Pre-processing:** Take user's raw question, prepare it for Council
   - Clarify ambiguities
   - Add context if needed
   - Format as clear prompt
2. **Post-processing:** Take ConsensusResult, format final response for user
   - Present synthesis clearly
   - Note confidence level
   - Highlight any dissent

**Tasks:**
1. Create Brain class configurable with any Provider
2. Implement `prepareForCouncil(userQuery: string): string`
3. Implement `presentToUser(consensus: ConsensusResult): string`
4. Default to Claude Sonnet, but accept any Provider

**Verification:** Test pre/post processing with sample queries.

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

### Phase 7: Evaluation Module (Separate)
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
│   │   ├── groq/
│   │   │   ├── index.ts      # Shared Groq API logic
│   │   │   └── llama.ts
│   │   └── perplexity/
│   │       ├── index.ts      # Shared Perplexity API logic
│   │       └── perplexity.ts
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
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
GROQ_API_KEY=gsk_...
PERPLEXITY_API_KEY=pplx-...

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
    "@ai-sdk/perplexity": "latest",
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

- [ ] **Phase 1:** `npx tsx src/index.ts --test-providers` shows all 5 providers connected
- [ ] **Phase 2:** Each provider wrapper can query its model and return structured response
- [ ] **Phase 3:** Council queries all 5 in parallel, handles failures gracefully
- [ ] **Phase 4:** Consensus module produces synthesis with agreement/confidence signals
- [ ] **Phase 5:** Personal Brain pre/post processes queries correctly
- [ ] **Phase 6:** Full CLI flow works: ask question → see progress → get answer
- [ ] **Phase 7:** Eval harness can compare Second Brain vs individual models

**Final validation:** Run 20 eval questions, confirm Second Brain preferred >60% of time.

---

## Implementation Order

1. **Phase 1** - Project setup (foundation)
2. **Phase 2** - Provider wrappers (must work before anything else)
3. **Phase 3** - Council parallel querying (core value)
4. **Phase 4** - Consensus module (the secret sauce)
5. **Phase 5** - Personal Brain (polish layer)
6. **Phase 6** - CLI (user-facing)
7. **Phase 7** - Evaluation (prove it works)

Phases 1-6 are the MVP. Phase 7 validates the hypothesis.

---

## Notes for AI Agents

- Use Vercel AI SDK (`ai` package) for unified streaming interface
- All providers should implement the same `Provider` interface
- Consensus module is designed for easy strategy swapping - keep strategies isolated
- Personal Brain model is configurable - default to Claude but any Provider works
- Handle API failures gracefully - if 1 model fails, continue with remaining 4
- CLI should show real-time progress as each model responds
- Eval module is separate from production code - used only for validation
