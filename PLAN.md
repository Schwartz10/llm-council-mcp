# Second Brain Implementation Plan

## Overview

A Council daemon service that multiple AI agents can consult when they need help. The Council consists of 4 frontier AI models that provide independent critiques and suggestions via MCP protocol.

**Primary Use Case:** "Phone a Friend" - when an AI agent (like Claude Code) is uncertain or stuck, it can consult the Council for alternative perspectives, corrections, and suggestions.

**Current Status:** ✅ **MVP COMPLETE** - All core functionality implemented, tested, and documented

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
- **MCP:** `@modelcontextprotocol/sdk` (stdio, HTTP streamable, SSE transports)
- **CLI:** Simple HTTP client
- **Config:** Environment variables only (.env)

### Council Models (4 total)
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
- 30s configurable timeout per provider
- Progress callbacks for real-time UI updates
- 8 passing tests

### ✅ Phase 7: Daemon Server & MCP Integration
- Express server with MCP SDK integration
- HTTP Streamable transport (POST /mcp)
- Shared Council accessible to all clients
- Health check endpoint (GET /health)
- `council_consult` tool for MCP clients
- Refactored CLI as HTTP client
- Verified with Claude Code integration (19.7s for 4 models)

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

### 📦 Deprecated Phases
- **Phase 4 (Consensus)** - Removed in favor of simpler client-side synthesis
- **Phase 5 (Brain Post-processing)** - Removed in favor of raw critique responses
- **Phase 6 (Original CLI)** - Replaced with HTTP client in Phase 7

---

## Next Steps / Active Development

### Phase 11: Council Tool Improvements 🚀 **IN PROGRESS**

**Timeline:** Today (focused sprint)
**Goal:** Fix timeout issue and enhance council tool with synthesis and context validation

**📋 Plan Review** (2026-01-24)

Council consultation recommended enhancements:
- **Task 11.2 (phone_council)**: Added structured synthesis extraction (agreement/disagreement/insights, confidence scoring)
- **Task 11.3 (context sharing)**: Upgraded from docs-only to implementation + validation tools
- **Individual model tool (phone_friend)**: Deferred to Phase 14 due to fuzzy matching complexity

---

#### Task 11.1: Fix Timeout Issue ⚡ **HIGHEST PRIORITY**
**Problem:** 30s timeout causes failures on long responses, especially with complex prompts

**Solution:** Remove automatic timeout, only respect user cancellation

**Implementation:**
- Remove hardcoded timeout from Council deliberation
- Add AbortController support for user cancellation (Ctrl+C)
- Update all provider calls to accept and respect AbortSignal
- Providers continue until completion or user cancels
- Test with long prompts (1000+ line files, complex analyses)

**Files to modify:**
- `src/council/index.ts` - Remove timeout parameter, add abort signal support
- `src/providers/anthropic/index.ts` - Accept AbortSignal, pass to API
- `src/providers/openai/index.ts` - Accept AbortSignal, pass to API
- `src/providers/xai/index.ts` - Accept AbortSignal, pass to API
- `src/providers/groq/index.ts` - Accept AbortSignal, pass to API
- `src/server/shared.ts` - Pass abort capability through MCP

**Acceptance criteria:**
- [x] No automatic timeout on council deliberation
- [x] Ctrl+C cleanly cancels in-progress requests (via AbortSignal)
- [x] Models can take as long as needed to respond
- [x] Test with AbortSignal cancellation (test added and passing)

**Implementation notes:**
- Removed `timeoutMs` parameter from Council constructor
- Updated Council.deliberate() to accept optional `signal?: AbortSignal` in options
- Removed automatic timeout logic (Promise.race with timeout)
- Updated consultCouncil() to pass AbortSignal from MCP request
- Updated MCP tool handler to extract signal from `extra.signal`
- All providers already support AbortSignal via Vercel AI SDK
- Added test for user cancellation via AbortSignal
- All 80 tests passing

**Estimated time:** 2-3 hours ✅ **COMPLETE**

---

#### Task 11.2: Rename & Enhance Council Tool 🧠 `phone_council`

**Goal:** Rename `council_consult` to `phone_council` and add AI learning behavior with structured synthesis
**Tool Rename:**
- `council_consult` → `phone_council` (better naming consistency)
- Maintains backward compatibility initially, deprecate old name

**Current flow:**
```
User asks question
  → Claude Code gives answer
  → User calls council_consult
  → Raw council responses shown (no learning)
```

**New flow:**
```
User asks question
  → Claude Code gives initial answer
  → Claude Code calls phone_council (when uncertain or user requests it)
  → Council responds with critiques
  → Claude Code reads responses
  → Claude Code synthesizes and improves answer
  → Shows improved answer + explanation of changes
  → User can request raw responses if desired
```

**Tool Design:**
```typescript
phone_council({
  prompt: string,
  context?: string,
  attachments?: Attachment[],
  show_raw?: boolean  // Optional: set to true to skip synthesis, just show raw responses
})
```

**Enhanced Response Format (Structured Synthesis):**

```typescript
{
  critiques: [
    { model: "Claude Sonnet 4.5", model_id: "anthropic/...", response: "...", latency_ms: 1234 },
    { model: "GPT-5.2", model_id: "openai/gpt-5-2", response: "...", latency_ms: 2345 },
    { model: "Grok 3 Beta", model_id: "xai/grok-3-beta", response: "...", latency_ms: 3456 },
    { model: "Llama 4 Maverick", model_id: "groq/...", response: "...", latency_ms: 4567 }
  ],
  summary: {
    models_consulted: 4,
    models_responded: 4,
    total_latency_ms: 11602
  },
  synthesis_data: {
    agreement_points: ["Topic 1", "Topic 2"],
    disagreements: [
      {
        topic: "Topic name",
        positions: [
          { models: ["Model A"], view: "View 1" },
          { models: ["Model B", "Model C"], view: "View 2" }
        ]
      }
    ],
    key_insights: [
      { model: "Model name", insight: "Key insight text" }
    ],
    confidence: 0.85  // Overall agreement level (0-1)
  },
  synthesis_instruction: "Read the council responses and structured synthesis_data. Use it to: (1) identify areas of consensus, (2) highlight disagreements, (3) extract key insights and attribute them, (4) form your updated position, (5) explain what changed your mind. Present a synthesized answer that shows you learned from the council.",
  // Both synthesis_data and synthesis_instruction are omitted if show_raw=true
}
```

**AI Behavior Examples:**

**Scenario 1: Agreement**
```
"After consulting the council, I'm confident in my original approach.
All four models (Claude, GPT, Grok, Llama) agree that [X].
Claude specifically highlighted [detail], which I'll add here..."
```

**Scenario 2: Correction**
```
"I need to correct my earlier answer. After consulting the council:

What I initially said: [X]
What changed: GPT and Claude both pointed out [Y]
Corrected answer: [Z]

This changed my mind because [reasoning]."
```

**Scenario 3: Disagreement**
```
"The council raised valuable concerns, though there's some disagreement:

My updated position: [synthesis incorporating valid points]

However, Grok suggests an alternative approach: [alternative]

Here are both perspectives:
1. [My view + council majority]: [explanation]
2. [Alternative view]: [explanation]

I lean toward option 1 because [reasoning], but option 2 could work if [conditions]."
```

**Scenario 4: Raw view requested** (`show_raw=true`)
```
Just show the raw council responses without synthesis instruction.
User wants to see unfiltered critiques.
```

**Implementation:**
- Rename tool from `council_consult` to `phone_council`
- Add `show_raw` parameter (optional, default false)
- Extract structured synthesis data from council responses:
  - Identify agreement points (all models say the same thing)
  - Identify disagreements (models contradict each other)
  - Extract key insights and attribute to specific models
  - Calculate confidence score based on agreement level
- Include model_id in each critique for auditability
- Include both `synthesis_data` and `synthesis_instruction` when `show_raw=false`
- Omit both when `show_raw=true`
- Maintain backward compatibility (support both names initially)

**Files to create/modify:**
- `src/server/shared.ts` - Rename tool, add show_raw parameter, synthesis extraction
- `src/server/types.ts` - Add SynthesisData type, update PhoneCouncilResponse
- `src/server/synthesis.ts` - Synthesis extraction logic (agreement/disagreement analysis)
- `docs/MCP_SETUP.md` - Document new name and behavior

**Acceptance criteria:**
- [ ] Tool renamed to `phone_council`
- [ ] `show_raw` parameter works correctly
- [ ] Structured synthesis_data extracted from responses
- [ ] Agreement points identified automatically
- [ ] Disagreements detected and grouped by topic
- [ ] Key insights attributed to specific models
- [ ] Confidence score calculated (0-1)
- [ ] model_id included in each critique
- [ ] Synthesis instruction included when show_raw=false
- [ ] AI reads and learns from council responses
- [ ] AI explains what changed (if anything)
- [ ] AI presents counter-arguments when disagreeing
- [ ] Test scenarios: agreement, disagreement, correction, raw view

**Estimated time:** 5-6 hours (with structured synthesis extraction)

---

#### Task 11.3: Improve Context Sharing 📎

**Goal:** Implement context validation and sharing tools (not just documentation)

**Phase 11.3a: Context Validation & Testing** (2 hours)
- Build context validation tools
  - Create helper to validate context before sending to council
  - Warn if context will be truncated by provider limits
  - Test what context actually reaches each model
  - Document context limits per provider (Claude: 200k, GPT: 128k, etc.)
- Test with real scenarios:
  - Code review: share file + related files
  - PR review: share git diff + description
  - Architecture question: share PLAN.md + ARCHITECTURE.md
  - Large file: test truncation warnings
- Gather feedback on what context is missing

**Phase 11.3b: Context Budget Controls** (1.5 hours)
- Implement context management tools
  - Max tokens/fields limits per request
  - Automatic truncation with warnings
  - Redaction helpers (strip secrets, emails, etc.)
  - Context size estimation before sending
- Recommended brief schema
  ```typescript
  interface ContextBrief {
    goal: string;           // What you're trying to achieve
    constraints: string[];  // Known limitations
    relevant_facts: string[]; // Key information models need
    avoid: string[];        // What NOT to consider
  }
  ```

**Phase 11.3c: Document Best Practices** (1 hour)
- Create `docs/CONTEXT_GUIDE.md`
- Examples of good context for different scenarios:
  - **Code review:** File path, related files, project structure, error messages
  - **PR review:** Description, changed files, test results, deployment context
  - **Architecture decision:** Existing docs, constraints, requirements
  - **Bug fix:** Stack trace, reproduction steps, environment info
  - **Feature request:** User story, acceptance criteria, related features
- Context truncation examples
- Budget management guidance

**Phase 11.3d: Smart Context Detection** (Future phase - deferred)
- Auto-detect context type from prompt
- Suggest relevant files based on imports/dependencies
- Parse project structure automatically
- Include error traces when debugging
- *Deferred until we have usage data*

**Files to create:**
- `src/server/context-validator.ts` - Context validation and budget controls
- `src/server/types.ts` - Add ContextBrief interface
- `docs/CONTEXT_GUIDE.md` - Best practices with validation examples

**Files to modify:**
- `src/server/shared.ts` - Add context validation before council queries

**Acceptance criteria:**
- [ ] Context validation helper warns about truncation
- [ ] Provider context limits documented (tokens/model)
- [ ] Context budget controls enforce limits
- [ ] Redaction helpers strip sensitive data
- [ ] Context brief schema available for structured input
- [ ] Test attachments with 5+ real scenarios including large files
- [ ] Test validation warnings trigger correctly
- [ ] Document what works well
- [ ] Identify gaps for future improvement
- [ ] Create usage examples with validation

**Estimated time:** 4-5 hours (implementation + validation, not just docs)

**Note:** Can work in parallel with 11.2 development and testing

---

### Phase 12: Hosting & Authentication 🏢 **NEXT WEEK**

**Timeline:** Next week (3-4 days)
**Goal:** Deploy for team usage with proper auth

#### Task 12.1: Dockerize Server 🐳

**Goal:** Run server in container for easy deployment

**Implementation:**

**Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy built code
COPY dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run server
CMD ["node", "dist/server/index.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: phone_a_friend
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: phone_a_friend
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  phone-a-friend:
    build: .
    depends_on:
      - postgres
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://phone_a_friend:${DB_PASSWORD}@postgres:5432/phone_a_friend
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - XAI_API_KEY=${XAI_API_KEY}
      - GROQ_API_KEY=${GROQ_API_KEY}
      - PORT=3000
      - RATE_LIMIT_WINDOW_MS=900000
      - RATE_LIMIT_MAX_REQUESTS=100
    restart: unless-stopped

volumes:
  postgres_data:
```

**Files to create:**
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `docs/DEPLOYMENT.md`

**Acceptance criteria:**
- [ ] Docker image builds successfully
- [ ] Container runs and serves requests
- [ ] Health check works
- [ ] Environment variables injected properly
- [ ] Can connect from host machine

**Estimated time:** 2 hours

---

#### Task 12.2: API Key Authentication 🔑

**Goal:** Protect hosted server with API keys

**Database:** PostgreSQL (production-ready from the start)

**Database Schema:**
```sql
CREATE TABLE api_keys (
  key VARCHAR(64) PRIMARY KEY,        -- e.g., "paf_sk_1234567890abcdef"
  name VARCHAR(255) NOT NULL,         -- e.g., "Jonathan's Key"
  organization VARCHAR(255),          -- e.g., "Glif"
  created_at TIMESTAMP DEFAULT NOW(),
  rate_limit INTEGER DEFAULT 100,     -- Requests per window
  enabled BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP
);

CREATE TABLE usage_logs (
  id SERIAL PRIMARY KEY,
  api_key VARCHAR(64) NOT NULL,
  endpoint VARCHAR(50) NOT NULL,      -- "phone_council" or "phone_friend"
  model VARCHAR(100),                 -- Which model(s) used
  tokens_used INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (api_key) REFERENCES api_keys(key) ON DELETE CASCADE
);

CREATE INDEX idx_usage_logs_api_key ON usage_logs(api_key);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_api_keys_enabled ON api_keys(enabled);
```

**Implementation:**
- Generate API keys with prefix `paf_sk_` (Phone A Friend Secret Key)
- Store in PostgreSQL database
- Use connection pooling for performance
- Add `Authorization: Bearer <key>` header validation middleware
- Rate limiting per API key (separate from IP-based rate limiting)
- Usage tracking for monitoring and future billing
- Admin CLI to manage keys

**Connection:**
```typescript
// Database URL format
DATABASE_URL=postgresql://user:password@localhost:5432/phone_a_friend
```

**Files to create:**
- `src/server/auth.ts` - API key validation, generation
- `src/server/db.ts` - PostgreSQL connection pool wrapper
- `src/server/middleware/auth.ts` - Auth middleware
- `src/cli/admin.ts` - Admin commands for key management
- `migrations/001_initial_schema.sql` - Database schema

**Admin CLI commands:**
```bash
phone-a-friend admin create-key --name "Jonathan" --org "Glif"
phone-a-friend admin list-keys
phone-a-friend admin revoke-key paf_sk_...
phone-a-friend admin enable-key paf_sk_...
phone-a-friend admin disable-key paf_sk_...
phone-a-friend admin usage --key paf_sk_... [--days 7]
phone-a-friend admin stats  # Overall usage statistics
```

**Files to modify:**
- `src/server/index.ts` - Add auth middleware to protected routes
- `docker-compose.yml` - Add PostgreSQL service
- `package.json` - Add `pg` dependency

**Updated docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: phone_a_friend
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: phone_a_friend
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  phone-a-friend:
    build: .
    depends_on:
      - postgres
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://phone_a_friend:${DB_PASSWORD}@postgres:5432/phone_a_friend
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - XAI_API_KEY=${XAI_API_KEY}
      - GROQ_API_KEY=${GROQ_API_KEY}
      - PORT=3000
    restart: unless-stopped

volumes:
  postgres_data:
```

**Acceptance criteria:**
- [ ] PostgreSQL connection works
- [ ] API keys can be generated
- [ ] Requests require valid API key
- [ ] Invalid keys return 401 Unauthorized
- [ ] Disabled keys return 403 Forbidden
- [ ] Rate limiting enforced per key
- [ ] Usage tracked in database with proper indexes
- [ ] Admin CLI works for all operations
- [ ] Connection pooling configured properly

**Estimated time:** 5 hours (PostgreSQL setup + auth)

---

#### Task 12.3: Deploy for Team 🚀

**Goal:** Host on cloud for team access

**Deployment options:**
- DigitalOcean App Platform (easiest)
- AWS ECS/Fargate
- Fly.io (good for containers)
- Railway

**Recommended: DigitalOcean App Platform** (simple, affordable)

**Steps:**
1. Push Docker image to registry (Docker Hub or GitHub Container Registry)
2. Create DigitalOcean app
3. Configure environment variables
4. Set up custom domain (e.g., `api.phone-a-friend.com`)
5. Configure SSL/TLS (automatic with DO)
6. Generate team API keys
7. Document connection instructions

**Files to create:**
- `docs/DEPLOYMENT.md` - Step-by-step deployment guide
- `docs/TEAM_SETUP.md` - How team members connect to hosted service

**Acceptance criteria:**
- [ ] Server running on public URL
- [ ] HTTPS enabled
- [ ] Team members can connect with API keys
- [ ] Monitoring/logging configured
- [ ] Cost tracking set up

**Estimated time:** 3 hours

---

### Phase 13: Rename & Onboarding 🎨 **LATER**

**Timeline:** After Phase 12 (lower priority)

#### Task 13.1: Rename to "Phone a Friend" 🏷️

**Scope:** Complete rename across codebase and infrastructure

**Changes:**
- npm package: `second-brain` → `@glif/phone-a-friend`
- CLI command: `second-brain` → `phone-a-friend`
- Repository name
- All code references (100+ files)
- Documentation
- Environment variables: `SECOND_BRAIN_*` → `PHONE_A_FRIEND_*`
- MCP server name: `council-mcp-server` → `phone-a-friend-mcp`
- Database name, Docker image name, etc.

**Migration strategy:**
- Create `@glif/phone-a-friend` package
- Deprecate `second-brain` package
- Add compatibility shim for old env vars
- Update all documentation

**Acceptance criteria:**
- [ ] All references renamed
- [ ] Package published to npm
- [ ] GitHub repo renamed
- [ ] Documentation updated
- [ ] Backward compatibility maintained

**Estimated time:** 3-4 hours

---

#### Task 13.2: Onboarding TUI ✨

**Goal:** Smooth first-run experience for new users

**Library:** `inquirer` (simple, well-maintained)

**First-run flow:**
```
$ phone-a-friend ask "help me code"

Welcome to Phone a Friend! 🎯

It looks like this is your first time running Phone a Friend.
Let's get you set up!

? How do you want to use Phone a Friend?
  > Connect to cloud (recommended) - api.phone-a-friend.com
    Run locally - host your own server

[If cloud selected]
? Enter your API key: paf_sk_...
✓ Connected to Phone a Friend cloud!
✓ Testing connection... 4 models available

[If local selected]
Let's configure your AI providers.

? Add AI provider?
  > Yes, add Anthropic (Claude)
    Skip for now

? Anthropic API Key: sk-ant-...
? Select Claude models:
  [x] claude-sonnet-4-5 (primary)
  [x] claude-sonnet-3-5 (fallback)
  [ ] claude-opus-4-5

✓ Anthropic configured!

? Add another provider?
  > Yes, add OpenAI (GPT)
    No, I'm done

? OpenAI API Key: sk-...
? Select GPT models:
  [x] gpt-5-2 (primary)
  [x] gpt-4o (fallback)
  [ ] gpt-4-turbo

✓ OpenAI configured!

? Add another provider?
  > Yes, add xAI (Grok)
    Yes, add Groq (Llama)
    No, I'm done

[Continue for all providers]

✓ Setup complete!

Your configuration:
  • 4 providers configured
  • 8 models available
  • Server starting on localhost:3000...

Ready to phone a friend! 🎉

Try: phone-a-friend ask "What is TypeScript?"
```

**Configuration storage:**
- Local mode: `~/.phone-a-friend/config.json`
- Cloud mode: `~/.phone-a-friend/credentials.json` (just API key)

**Additional commands:**
```bash
phone-a-friend setup         # Re-run onboarding
phone-a-friend settings      # Manage configuration
phone-a-friend test          # Test provider connectivity
phone-a-friend status        # Show current config
phone-a-friend switch        # Switch between local/cloud
```

**Settings manager UI:**
```
Phone a Friend Settings

Current mode: Local
Models configured: 8
Server: localhost:3000

[1] Add/remove AI providers
[2] Test connectivity
[3] Switch to cloud mode
[4] View usage statistics
[5] Back to main menu
```

**Files to create:**
- `src/cli/onboarding.ts` - First-run flow
- `src/cli/settings.ts` - Settings manager
- `src/config/storage.ts` - Config file management
- `src/cli/commands/setup.ts` - Setup command
- `src/cli/commands/settings.ts` - Settings command
- `src/cli/commands/status.ts` - Status command

**Files to modify:**
- `src/index.ts` - Check for first run, trigger onboarding
- `package.json` - Add inquirer dependency

**Acceptance criteria:**
- [ ] First-run triggers onboarding automatically
- [ ] Can configure for cloud or local mode
- [ ] Can add/remove providers easily
- [ ] Settings manager works
- [ ] Config persists between runs
- [ ] Can switch modes without losing config

**Estimated time:** 6 hours

---

### Phase 14: Individual Model Tool 🎯 **FUTURE**

**Timeline:** After Phase 11-13 (deferred due to complexity)
**Goal:** Add `phone_friend` tool for consulting specific models

---

#### Task 14.1: Add Individual Model Tool `phone_friend`

**Goal:** Let users consult specific models instead of full council

**Tool Design:**
```typescript
phone_friend({
  model: string,  // Fuzzy-matched model identifier
  prompt: string,
  context?: string,
  attachments?: Attachment[]
})
```

**Model Matching Strategy:**

The tool accepts flexible input and intelligently matches to available models:

1. **Full ID with provider:** `"anthropic/claude-sonnet-4-5-20250929"` ✓ (canonical)
2. **Short name:** `"claude-sonnet-4-5"`, `"gpt-5-2"`, `"grok-3-beta"` ✓ (aliases)
3. **Fuzzy variations:** `"GPT 5 2"`, `"GPT5-2"`, `"gpt_5_2"` → normalized to `"gpt-5-2"` ✓
4. **Provider defaults:** `"gpt"`, `"claude"`, `"grok"`, `"llama"` → use primary model ✓

**Fuzzy Matching Logic:**
- Normalize input (lowercase, remove spaces/underscores, standardize separators)
- Try exact match against stable IDs and aliases
- Try fuzzy match with confidence scoring (Levenshtein distance)
- Confidence >= 80%: auto-accept
- Confidence 50-80%: return "did you mean?" with top 3 suggestions
- Confidence < 50%: reject with error and list available models
- Log matches for debugging

**Implementation:**
- Add `phone_friend` tool to MCP server
- Create fuzzy matching function with confidence scoring
- Support full IDs, short names, and fuzzy variants
- Expose all model options in tool schema
- Return helpful suggestions for ambiguous matches
- Reuse existing provider infrastructure

**Files to create/modify:**
- `src/server/shared.ts` - Add phone_friend tool registration
- `src/server/types.ts` - Add PhoneFriendRequest type
- `src/server/model-matcher.ts` - Fuzzy matching logic
- `src/config.ts` - Add getAllAvailableModels() helper

**Response format:**
```typescript
{
  model: string,           // Full ID of model that responded
  response: string,        // The model's answer
  latency_ms: number,
  tokens_used?: number
}
```

**Acceptance criteria:**
- [ ] Stable IDs work as canonical identifiers
- [ ] Provider defaults work ("gpt" → gpt-5-2)
- [ ] Short names and full IDs work
- [ ] Fuzzy matching with confidence thresholds
- [ ] "Did you mean?" suggestions for ambiguous matches
- [ ] Match logging for debugging
- [ ] Comprehensive tests for variations and edge cases

**Estimated time:** 4-5 hours

---

### Phase 15: Evaluation Module 📊 **FUTURE**

**Status:** Deferred until after Phase 11-13 completion

**Purpose:** Validate that Phone a Friend provides value

**Planned approach:**
- Manual testing first (Phase 11-12)
- Gather user feedback from team usage
- Build automated evaluation later if needed

---

### Potential Future Enhancements (Backlog)

**Advanced Features:**
- Specialized councils (coding-focused, security-focused, etc.)
- Streaming responses for real-time feedback
- Multi-turn conversations with council
- Model confidence scores and uncertainty quantification
- Auto-escalation (start with one model, escalate to council if uncertain)

**Infrastructure:**
- Redis caching for repeated questions
- PostgreSQL for production database
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
│   ├── server/               # [✅ Phase 7, 9, 10] Daemon server
│   │   ├── index.ts          # Express server with MCP (HTTP + SSE)
│   │   ├── stdio.ts          # [Phase 9] stdio transport entry point
│   │   ├── shared.ts         # [Phase 9] Shared McpServer instance
│   │   ├── types.ts          # Request/response types
│   │   ├── rate-limit.ts     # [Phase 9] Rate limiting config
│   │   ├── sanitize.ts       # [Phase 9] Input/output sanitization
│   │   ├── origin.ts         # [Phase 10] Origin validation
│   │   ├── attachments.ts    # [Phase 10] Attachment handling
│   │   ├── mcp-errors.ts     # [Phase 10] MCP error handling
│   │   ├── server.test.ts    # [Phase 9] Endpoint integration tests
│   │   └── security.test.ts  # [Phase 9] Security tests
│   ├── ui.ts                 # Terminal UI helpers
│   ├── index.ts              # CLI entry point (HTTP client)
│   └── eval/                 # [📅 Phase 8 - Deferred]
│       ├── index.ts
│       ├── questions.ts
│       ├── compare.ts
│       └── report.ts
├── docs/
│   ├── SERVER.md             # Server setup and usage
│   ├── MCP_SETUP.md          # Claude Code integration
│   ├── SECURITY.md           # Security documentation
│   └── ARCHITECTURE.md       # Technical specifications
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

After each phase, verify:

- [x] **Phase 1:** `npm run test:providers` shows all 4 providers connected
- [x] **Phase 2:** Each provider wrapper can query its model and return structured response
- [x] **Phase 3:** Council queries all 4 models in parallel, handles failures gracefully
- [x] **Phase 7:** Daemon server running, CLI and MCP both work, Council returns critiques
- [x] **Phase 9:** MCP spec compliance verified, security hardening complete, 62 tests passing
- [x] **Phase 10:** MCP hardening, attachments, JSON-RPC error normalization
- [ ] **Phase 8:** Eval harness can validate Council provides useful help (deferred post-MVP)

**🎉 MVP COMPLETE!** Phases 1-3, 7, 9, 10
- ✅ stdio, HTTP/Streamable, and SSE transport support
- ✅ Comprehensive security hardening (rate limiting, sanitization, security headers)
- ✅ 62 tests passing (40 security tests)
- ✅ Full MCP spec compliance
- ✅ Complete documentation (README, SECURITY, MCP_SETUP, ARCHITECTURE)
- ✅ Successfully tested with Claude Code integration
- 📅 Phase 8 evaluation deferred for post-MVP refinement

---

## Implementation Order

1. ✅ **Phase 1** - Project setup (foundation)
2. ✅ **Phase 2** - Provider wrappers with fallback support
3. ✅ **Phase 3** - Council (parallel querying)
4. ~~**Phase 4**~~ - ~~Consensus module~~ (**DEPRECATED**)
5. ~~**Phase 5**~~ - ~~Personal Brain orchestration~~ (**DEPRECATED**)
6. ~~**Phase 6**~~ - ~~Original CLI~~ (**DEPRECATED**)
7. ✅ **Phase 7** - Council Daemon & MCP Integration (HTTP transport)
8. 📅 **Phase 8** - Evaluation (deferred until after MVP - manual testing first)
9. ✅ **Phase 9** - MCP Spec Compliance & Security Hardening ✅ **MVP COMPLETE**
10. ✅ **Phase 10** - MCP hardening, attachments, JSON-RPC errors

---

## Notes for AI Agents

- Use Vercel AI SDK (`ai` package) for unified streaming interface
- All providers implement the same `Provider` interface
- **Council is the core** - simple parallel querying, no orchestration, no synthesis
  - Council just returns raw responses from all models
  - Clients decide what to do with the responses
- Use official MCP SDK examples as reference for transport integration
  - See `createMcpExpressApp` in MCP TypeScript SDK examples
  - Single Express server serves both HTTP and MCP endpoints
- Handle API failures gracefully - if 1 Council model fails, continue with remaining 3
  - Use `Promise.allSettled()` for parallel queries
  - Return partial results when some models fail
- Daemon architecture:
  - Server runs persistently (for MCP clients)
  - CLI makes HTTP requests to server
  - Claude Code connects via stdio or HTTP MCP transport
  - All use same underlying Council
- Focus: "Phone a friend" for AI agents (especially Claude Code)
- Phases 4-6 (Brain orchestration, Consensus, original CLI) are deprecated
