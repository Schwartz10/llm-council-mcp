# LLM Council MCP Implementation Plan

## Overview

A Council daemon service that AI agents can consult when they need help. The Council consists of frontier AI models that provide independent critiques and suggestions via MCP protocol.

**Primary Use Case:** Consult the LLM Council MCP server when an AI agent (like Claude Code) is uncertain or stuck and needs alternative perspectives, corrections, and suggestions.

**Current Status:** 🚀 **Finalizing MVP for Open Source Release**

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
│  Council: models query in parallel                 │
└─────────────────────────────────────────────────────┘

Flow: Client → Council → Models (parallel) → Critiques → Client
```

### Tech Stack
- **Language:** TypeScript/Node.js (single package)
- **LLM SDKs:** Vercel AI SDK (`@ai-sdk/*`) for unified provider interface
- **Server:** Express.js
- **MCP:** `@modelcontextprotocol/sdk` (stdio, HTTP streamable, SSE transports)
- **CLI:** HTTP client with ora spinners
- **Config:** Environment variables only (.env)

### Council Models
1. Claude Sonnet 4.5 (Anthropic) - with fallback to Sonnet 3.5
2. GPT-5.2 (OpenAI) - with fallback to gpt-4o → gpt-4-turbo
3. Grok 3 Beta (xAI)
4. Llama 4 Maverick (via Groq) - with fallback to Llama 3.3

---

## Completed Phases Summary

### ✅ Phase 1: Project Setup & Provider Integration
- TypeScript project with ES modules
- 4 AI provider integrations (Anthropic, OpenAI, xAI, Groq) with fallback support
- Configuration system with graceful API key handling
- Code quality tooling (ESLint, Prettier)

### ✅ Phase 2: Provider Abstraction Layer
- Unified `Provider` interface for all LLM providers
- Model-agnostic provider classes (accept modelId in constructor)
- Factory functions with automatic fallback (`createProviderWithFallback`)
- Both `query()` and `queryStream()` methods
- 14 passing tests with Vitest

### ✅ Phase 3: Council Module
- Parallel querying of all Council models using `Promise.allSettled()`
- Graceful handling of partial failures (continues with remaining models)
- User cancellation support via AbortSignal (no automatic timeout)
- Progress callbacks for real-time UI updates
- 8 passing tests

### ✅ Phase 7: Daemon Server & MCP Integration
- Express server with MCP SDK integration
- HTTP Streamable transport (POST /mcp)
- Shared Council accessible to all clients
- Health check endpoint (GET /health)
- `consult_llm_council` tool for MCP clients
- Refactored CLI as HTTP client
- Verified with Claude Code integration

### ✅ Phase 9: MCP Compliance & Security
- stdio transport (preferred for local development)
- SSE transport (backwards compatibility)
- Rate limiting (100 req/15min default)
- Input/output sanitization (control chars, prompt injection, secret redaction)
- Security headers via Helmet
- Origin/Host validation
- 40 security tests
- Complete documentation (SECURITY.md, MCP_SETUP.md)
- 62 total tests passing

### ✅ Phase 10: MCP Hardening & Attachments
- Cancellable timeouts with AbortController
- JSON-RPC error normalization
- Enhanced Origin/Host validation
- Attachment support in Council tool
- Email redaction (configurable)

### ✅ Phase 11: Council Tool Improvements
**Task 11.1:** ✅ Removed automatic timeout, added AbortSignal support for user cancellation
**Task 11.2:** ✅ Renamed to `consult_llm_council`, added structured synthesis data extraction, confidence scoring
**Task 11.3:** ✅ Context sharing documentation (CONTEXT_GUIDE.md)

### 📦 Deprecated Phases
- **Phase 4 (Consensus)** - Removed in favor of simpler client-side synthesis
- **Phase 5 (Post-processing)** - Removed in favor of raw critique responses
- **Phase 6 (Original CLI)** - Replaced with HTTP client in Phase 7

---

## 🎯 MVP: Open Source Release

**Goal:** Prepare the repository for public open source release with essential features and excellent documentation.

**Timeline:** This week (focused sprint)

---

### Phase 12: Subset Council Selection 🎯 **HIGHEST PRIORITY**

**Status:** Complete
**Goal:** Allow users to query specific models instead of always querying all council members

**Use Cases:**
- **Specialization:** Only consult coding-focused models (Claude + GPT)
- **Cost control:** Query fewer models to reduce API costs
- **Speed:** Faster responses with 1-2 models instead of 4
- **Testing:** Debug individual model behavior

**Implementation:**

Add `models` parameter to `consult_llm_council` tool:

```typescript
consult_llm_council({
  prompt: string,
  context?: string,
  attachments?: Attachment[],
  show_raw?: boolean,
  models?: string[]  // NEW: Array of model names to query (e.g., ["claude", "gpt"])
})
```

**Model Matching:**
- Accept flexible identifiers: `"claude"`, `"gpt"`, `"grok"`, `"llama"`
- Map to configured providers in `COUNCIL_MODELS`
- If `models` is omitted or empty, query all configured models (current behavior)
- If `models` is specified, only query those providers
- Return helpful error if specified model is not configured

**Examples:**

```typescript
// Query all models (current default behavior)
consult_llm_council({ prompt: "How should I handle errors?" })

// Query only Claude and GPT
consult_llm_council({
  prompt: "Review this TypeScript code",
  models: ["claude", "gpt"]
})

// Query single model
consult_llm_council({
  prompt: "Quick question about React hooks",
  models: ["gpt"]
})
```

**Response Format:**
Response structure remains the same, but `critiques` array only includes requested models:

```typescript
{
  critiques: [
    { model: "Claude Sonnet 4.5", model_id: "...", response: "...", latency_ms: 1234 },
    { model: "GPT-5.2", model_id: "...", response: "...", latency_ms: 2345 }
  ],
  summary: {
    models_consulted: 2,    // Only consulted 2 models
    models_responded: 2,
    total_latency_ms: 3579
  },
  synthesis_data: { ... }   // Synthesis based on subset
}
```

**Files to modify:**
- `src/server/shared.ts` - Add `models` parameter to tool schema, filter council providers
- `src/server/types.ts` - Add `models?: string[]` to CouncilRequest
- `src/council/index.ts` - Accept subset of providers in `deliberate()` method
- `docs/MCP_SETUP.md` - Document the `models` parameter with examples

**Acceptance criteria:**
- [x] `consult_llm_council` accepts optional `models` parameter
- [x] Omitting `models` queries all configured models (backward compatible)
- [x] Specifying `models: ["claude", "gpt"]` only queries those two
- [x] Invalid model names return helpful error message
- [x] Synthesis data correctly reflects subset of models
- [x] Summary counts match actual models queried
- [x] Documentation includes examples of subset usage
- [x] Tests cover: all models, subset, single model, invalid model names
- [x] `list_models` tool returns all available Council model names and ids
- [x] `list_models` output names can be used directly in `consult_llm_council` `models`

**Estimated time:** 3-4 hours

Extra steps taken:
- Reviewed direct dependency licenses from installed packages (all MIT/Apache-2.0/BSD-2-Clause).
- Verified install/build flow by running `npm run build`.
- Swept repo for TODO/FIXME markers (none found) and confirmed console output is intentional (CLI/server logs).

---

### Phase 13: Documentation & Open Source Preparation 📚

**Status:** In progress
**Goal:** Polish documentation and prepare repository for public release

---

#### Task 13.1: Update README.md

**Status:** Complete
**Goal:** Rewrite opening paragraphs to clearly communicate what this project does and why it exists

**Current issue:** README starts with "A daemon service..." which is accurate but doesn't explain the *why* or the *value proposition*.

**New opening should answer:**
1. What problem does this solve?
2. Who is this for?
3. What makes it unique/valuable?
4. How does it work (high level)?

**Example structure:**

```markdown
# LLM Council MCP - Council Daemon for AI Agents

When Claude Code (or any AI agent) gets stuck, it can consult the LLM Council MCP server. It can ask a council of frontier AI models that deliberate on your problem in parallel.

## Why This Exists

AI agents are powerful but can get stuck, make mistakes, or lack confidence on complex decisions. LLM Council MCP gives them a way to:
- Get unstuck by consulting multiple expert models
- Validate architectural decisions before committing
- Review code through multiple lenses simultaneously
- Explore alternative approaches they hadn't considered

Think of it as a "council of experts" your AI can summon on-demand.

## How It Works

[Current architecture diagram and explanation]

## Get Started

[Current installation instructions]
```

**Files to modify:**
- `README.md` - Rewrite opening paragraphs, improve flow

**Acceptance criteria:**
- [x] Opening clearly explains the problem being solved
- [x] Value proposition is obvious within first 3 paragraphs
- [x] Target audience is clear (AI agents, Claude Code users, developers)
- [x] Technical details come after the "why"
- [x] Installation steps remain clear and accurate

**Estimated time:** 1 hour

---

#### Task 13.2: Skill Distribution Documentation

**Status:** Complete
**Goal:** Document how to use the included Claude Code skill in other repositories

**Current state:** Skill exists at `.agents/skills/llm-council-context/` but no instructions for using it elsewhere

**Add to README:**

```markdown
## Using the Context Skill in Your Projects

This repository includes a Claude Code skill that helps craft effective context for council consultations.

**To use it in your project:**

1. Copy the skill to your project's skills directory:
   ```bash
   # From your project directory
   cp -r /path/to/llm-council-mcp/.agents/skills/llm-council-context ./.agents/skills/
   ```

2. The skill will now be available to Claude Code when working in your project

3. The skill provides:
   - Guidance on crafting concise, high-signal context
   - Examples for common scenarios (code review, bug fix, architecture decisions)
   - Context budget management tips
   - See `.agents/skills/llm-council-context/SKILL.md` for details

**What the skill does:**
- Helps structure context using a recommended brief schema
- Prevents context truncation by provider limits
- Provides examples for different consultation scenarios
- References full guide at `references/CONTEXT_GUIDE.md`
```

**Files to modify:**
- `README.md` - Add "Using the Context Skill in Your Projects" section
- `.agents/skills/llm-council-context/README.md` - Create simple readme for the skill itself

**Acceptance criteria:**
- [x] Clear instructions for copying skill to other repos
- [x] Explains what the skill does and why it's useful
- [x] Links to skill documentation for more details
- [x] Copy command is accurate and tested

**Estimated time:** 30 minutes

---

#### Task 13.3: Open Source Checklist

**Status:** In progress
**Goal:** Review and prepare repository for public open source release

**Checklist:**

**Legal & Licensing:**
- [x] Choose license (recommend MIT or Apache 2.0 for maximum adoption)
- [x] Add LICENSE file to repository root
- [x] Review all dependencies for license compatibility
- [ ] Ensure no proprietary or sensitive code remains

**Documentation:**
- [x] README.md is clear and compelling ✅ (Task 13.1)
- [x] Installation instructions are tested and work
- [x] All configuration options documented
- [ ] Security best practices documented ✅ (SECURITY.md exists)
- [ ] Architecture documented ✅ (ARCHITECTURE.md exists)
- [ ] MCP setup guide exists ✅ (MCP_SETUP.md exists)

**Code Quality:**
- [x] Run `npx tsc --noEmit` - no TypeScript errors
- [x] Run `npm run lint` - no linter errors/warnings
- [x] Run `npm test` - all tests passing
- [x] Remove any debug code, console.logs, or TODOs
- [x] Remove any hardcoded values specific to development

**Repository Setup:**
- [ ] Add .gitignore (ensure .env is ignored) ✅
- [x] Add CONTRIBUTING.md (how to contribute)
- [x] Add CODE_OF_CONDUCT.md (community guidelines)
- [ ] Configure GitHub repository settings:
  - [ ] Add description and topics/tags
  - [ ] Add website URL (if applicable)
  - [ ] Enable issues
  - [ ] Enable discussions (optional)
- [ ] Create GitHub templates:
  - [x] Issue template
  - [x] Pull request template

**Package Configuration:**
- [ ] Update package.json with correct repository URL
- [x] Add keywords for npm discoverability
- [x] Set correct author and license fields
- [ ] Decide on npm package name and availability
- [ ] Test installation from npm (if publishing)

**Security:**
- [ ] Review SECURITY.md for accuracy
- [ ] Ensure no API keys or secrets in git history
- [ ] Add security policy (vulnerability reporting)
- [ ] Document security best practices in README

**Examples & Demos:**
- [ ] Add example queries and expected outputs
- [ ] Consider adding screenshots or GIFs of CLI usage
- [ ] Document common use cases with examples

**Community:**
- [ ] Add badges to README (build status, license, npm version)
- [ ] Consider adding a ROADMAP.md for future plans
- [ ] Add acknowledgments/credits if applicable

**Files to create/modify:**
- `LICENSE` - Add chosen license
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Community standards
- `.github/ISSUE_TEMPLATE/bug_report.md` - Bug report template
- `.github/ISSUE_TEMPLATE/feature_request.md` - Feature request template
- `.github/PULL_REQUEST_TEMPLATE.md` - PR template
- `package.json` - Update metadata
- `README.md` - Add badges, polish

**Estimated time:** 3-4 hours

---

## 🎉 MVP Definition

After completing Phases 12-13, the MVP is ready for open source release:

**Core Features:**
- ✅ Council daemon with 4 frontier AI models
- ✅ MCP integration (stdio, HTTP, SSE transports)
- ✅ Structured synthesis with agreement/disagreement analysis
- ✅ Attachment support for sharing files
- ✅ Security hardening (rate limiting, sanitization, validation)
- ✅ CLI for direct council consultation
- 🎯 Subset model selection for specialized consultations
- 📚 Clear, compelling documentation
- 📚 Skill distribution for other projects
- 📚 Open source preparation complete

**Quality Bar:**
- All TypeScript builds without errors
- All tests passing
- No linter warnings
- Security best practices documented
- Installation tested and works
- Clear contribution guidelines

---

## Post-MVP Roadmap

### Phase 14: Individual Model Tool `consult_model` 🎯

**Status:** Deferred (post-MVP)
**Goal:** Add tool for consulting specific models with fuzzy matching

**Why deferred:** Subset selection (Phase 12) covers the primary use case. Individual model tool adds complexity (fuzzy matching, "did you mean?" suggestions) that's not essential for MVP.

**Future implementation:**
- Add `consult_model` tool with single model queries
- Fuzzy matching for model names ("GPT 5 2" → "gpt-5.2")
- Confidence scoring for ambiguous matches
- "Did you mean?" suggestions

**Estimated time:** 4-5 hours

---

### Phase 15: Hosting & Authentication 🏢

**Status:** Deferred (post-MVP)
**Goal:** Deploy as hosted service with API key authentication

**Why deferred:** MVP focuses on self-hosted local usage. Hosting adds significant complexity (Docker, PostgreSQL, auth, deployment) that's not needed for initial open source release.

**Future implementation:**

**Task 15.1: Dockerize Server**
- Create Dockerfile for containerized deployment
- Add docker-compose.yml with PostgreSQL
- Health checks and restart policies
- Deployment documentation

**Task 15.2: API Key Authentication**
- PostgreSQL database for API key storage
- Key generation with `paf_sk_` prefix
- Usage tracking and rate limiting per key
- Admin CLI for key management
- Auth middleware for protected routes

**Task 15.3: Cloud Deployment**
- Deploy to cloud platform (DigitalOcean, AWS, Fly.io)
- Configure SSL/TLS
- Set up monitoring and logging
- Team access documentation

**Estimated time:** 10-12 hours total

---

### Phase 16: Enhanced Onboarding 🎨

**Status:** Deferred (post-MVP)
**Goal:** Interactive setup wizard for first-time users

**Why deferred:** Good README documentation is sufficient for MVP. Interactive TUI adds dependency (inquirer) and complexity that can be added once there's user feedback.

**Future implementation:**
- Interactive setup wizard with inquirer
- API key prompts with validation
- Model selection interface
- Configuration persistence (~/.llm-council/config.json)
- Settings management TUI
- Cloud vs local mode switcher

**Estimated time:** 6-8 hours

---

### Phase 17: Naming Finalization 🏷️

**Status:** Complete
**Goal:** Finalize "LLM Council MCP" naming across codebase, tools, and docs

**Completed work:**
- MCP tool name is `consult_llm_council`
- Documentation and skills use "LLM Council MCP" naming
- Deprecated legacy naming removed

---

### Phase 18: Evaluation Module 📊

**Status:** Deferred (post-MVP)
**Goal:** Validate that council provides better answers than single models

**Why deferred:** Manual testing and real-world usage will provide better feedback initially. Automated evaluation can be built once there's sufficient usage data.

**Future implementation:**
- Test question bank (20 hard questions)
- Automated comparison framework
- Blind A/B evaluation interface
- Preference tracking (target: >60% preference for council)
- Statistical analysis and reporting

**Estimated time:** 8-10 hours

---

### Future Enhancements (Backlog)

**Advanced Features:**
- Streaming responses for real-time feedback
- Multi-turn conversations with council
- Specialized councils (coding-focused, security-focused, etc.)
- Model confidence scores and uncertainty quantification
- Auto-escalation (start with one model, escalate if uncertain)

**Infrastructure:**
- Redis caching for repeated questions
- Metrics and analytics dashboard
- Load balancing for high traffic
- Multi-region deployment

**Integrations:**
- VSCode extension
- Slack bot
- Discord bot
- Web UI for human users
- Python/JavaScript SDK

**Monetization:**
- Public API with tiered pricing
- Usage-based billing
- Team/organization plans
- White-label deployment options

---

## File Structure

```
llm-council-mcp/
├── package.json
├── tsconfig.json
├── .env.example
├── LICENSE                  # [✅ Phase 13.3]
├── CONTRIBUTING.md          # [✅ Phase 13.3]
├── CODE_OF_CONDUCT.md      # [✅ Phase 13.3]
├── src/
│   ├── config.ts           # Environment/config loading
│   ├── providers/          # [✅ Phase 2] Provider abstraction
│   │   ├── index.ts        # Factory functions with fallback
│   │   ├── types.ts        # Provider interface, ProviderResponse
│   │   ├── anthropic/
│   │   │   └── index.ts    # AnthropicProvider class
│   │   ├── openai/
│   │   │   └── index.ts    # OpenAIProvider class
│   │   ├── xai/
│   │   │   └── index.ts    # XAIProvider class
│   │   └── groq/
│   │       └── index.ts    # GroqProvider class
│   ├── council/            # [✅ Phase 3] Parallel querying
│   │   ├── index.ts
│   │   └── types.ts
│   ├── server/             # [✅ Phase 7, 9, 10] Daemon server
│   │   ├── index.ts        # Express server with MCP
│   │   ├── stdio.ts        # stdio transport entry point
│   │   ├── shared.ts       # [Phase 12] Add models parameter
│   │   ├── types.ts        # [Phase 12] Add models to CouncilRequest
│   │   ├── rate-limit.ts   # Rate limiting config
│   │   ├── sanitize.ts     # Input/output sanitization
│   │   ├── origin.ts       # Origin validation
│   │   ├── attachments.ts  # Attachment handling
│   │   ├── mcp-errors.ts   # MCP error handling
│   │   ├── server.test.ts  # Endpoint integration tests
│   │   └── security.test.ts # Security tests
│   ├── ui.ts               # Terminal UI helpers
│   └── index.ts            # CLI entry point (HTTP client)
├── .agents/
│   └── skills/
│       └── llm-council-context/  # [✅ Phase 11.3] Context skill
│           ├── SKILL.md
│           ├── README.md           # [✅ Phase 13.2]
│           └── references/
│               └── CONTEXT_GUIDE.md
├── .github/                # [✅ Phase 13.3]
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── SERVER.md           # Server setup and usage
│   ├── MCP_SETUP.md        # [Phase 12] Document models parameter
│   ├── SECURITY.md         # Security documentation
│   └── ARCHITECTURE.md     # Technical specifications
└── README.md               # [Phase 13.1, 13.2] Update opening + skill docs
```

---

## Environment Variables

```bash
# .env.example
# Council API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
GROQ_API_KEY=gsk_...

# Server Configuration
PORT=3000  # Port for daemon server (default: 3000)

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes (default: 900000)
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window (default: 100)

# Optional
LLM_COUNCIL_DEBUG=false         # Enable debug logging
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
    "zod": "latest",
    "axios": "latest",
    "express-rate-limit": "^7.1.0",
    "helmet": "^8.0.0",
    "formidable": "^3.5.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/formidable": "^3.4.0",
    "vitest": "latest",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0",
    "eslint": "latest",
    "prettier": "latest"
  }
}
```

---

## Verification Checklist

**Before marking MVP complete:**

- [ ] **Phase 12:** Subset council selection works, tests pass
- [x] **Phase 13.1:** README opening is clear and compelling
- [x] **Phase 13.2:** Skill distribution documented
- [ ] **Phase 13.3:** Open source checklist complete
- [ ] **Build:** `npx tsc --noEmit` - no errors
- [ ] **Lint:** `npm run lint` - no errors/warnings
- [ ] **Tests:** All tests passing
- [ ] **Docs:** All documentation accurate and up-to-date

**🎉 MVP READY FOR OPEN SOURCE RELEASE!**

---

## Notes for AI Agents

- Use Vercel AI SDK (`ai` package) for unified streaming interface
- All providers implement the same `Provider` interface
- **Council is the core** - simple parallel querying, no orchestration
  - Council returns raw responses from all models
  - Clients decide what to do with the responses
- Use official MCP SDK examples as reference for transport integration
- Handle API failures gracefully - if 1 Council model fails, continue with remaining
  - Use `Promise.allSettled()` for parallel queries
  - Return partial results when some models fail
- Daemon architecture:
  - Server runs persistently (for MCP clients)
  - CLI makes HTTP requests to server
  - Claude Code connects via stdio or HTTP MCP transport
  - All use same underlying Council
- Focus: LLM Council MCP for AI agents (especially Claude Code)
