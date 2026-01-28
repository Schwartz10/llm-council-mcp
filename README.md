# LLM Council MCP - Council Daemon for AI Agents

When an AI agent gets stuck, it should be able to consult a few expert models. LLM Council MCP makes that real: it runs a local MCP server that queries a council of frontier models in parallel and returns independent critiques plus structured synthesis.

**Primary Use Case:** Consult the LLM Council MCP server for AI agents (Claude Code, Codex, or custom clients) that need alternative perspectives, code reviews, or help getting unstuck.

## Why This Exists

AI agents are strong but brittle on complex decisions. LLM Council MCP adds a fast, low‑friction way to:
- Validate architectural choices before you commit
- Catch blind spots through multi‑model critique
- Compare solutions quickly without manual prompting
- Get unstuck when a single model is uncertain

## How It Works

Clients call the MCP tool `consult_llm_council`, which fans out to the configured Council models in parallel, then returns raw responses plus structured synthesis data. You can also query a subset of models or list available models for precise selection.

## Get Started

### 1. Download and Install

```bash
git clone https://github.com/Schwartz10/llm-council-mcp.git
cd llm-council-mcp
npm install
cp .env.example .env
```

Add at least one API key in `.env`:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `XAI_API_KEY`
- `GROQ_API_KEY`

Build the server:

```bash
npm run build
```

### 2. Run the MCP Server

```bash
npm run server
```

The server listens on `http://localhost:3000` by default.

### 3. Install the Context Skill (Optional)

The repo includes an associated Codex skill to help craft strong `consult_llm_council` context:

- Skill source: `.agents/skills/llm-council-context`

Install by copying that folder into your Codex skills directory, or package it with your skill tooling if you prefer distributing a `.skill` file.

### 4. Use the Council

CLI:

```bash
llm-council ask "What is the best way to handle errors in TypeScript?"
```

Claude Code integration:
- See `docs/MCP_SETUP.md` for MCP setup steps.

## Using the Context Skill in Your Projects

This repo includes a Codex/Claude Code skill that helps craft high‑signal context for council consultations.

To use it in another repo:

```bash
# From your project directory
cp -r /path/to/llm-council-mcp/.agents/skills/llm-council-context ./.agents/skills/
```

What the skill provides:
- Guidance for concise, structured context briefs
- Examples for common consultation scenarios
- Tips to avoid context truncation

See `.agents/skills/llm-council-context/SKILL.md` for details.

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
│  • POST /mcp - MCP over streamable HTTP            │
│  • GET /health - Health check                      │
│                                                     │
│  Council: models query in parallel                 │
└─────────────────────────────────────────────────────┘
```

### The Council

The Council consists of frontier AI models that provide independent critiques:

1. **Claude Sonnet 4.5** (Anthropic) - with fallback to Sonnet 3.5
2. **GPT-5.2 / GPT-4o** (OpenAI) - with automatic fallback chain
3. **Gemini** (Google) - with fallback to Gemini 1.5 Pro
4. **Grok 3 Beta** (xAI)
5. **Llama 4 Maverick** (Groq) - with fallback to Llama 3.3

All models are queried in parallel. If individual models fail, the Council continues with remaining models.

## Installation
Installation and quick start are covered in **Get Started** above.

## Usage

### Server Commands

```bash
# Start HTTP server (development mode with auto-reload)
npm run server

# Start HTTP server (production mode, requires build first)
npm run build
npm run server:build

# Start stdio server (for MCP stdio transport)
npm run server:stdio

# Using CLI
llm-council server
```

The server supports three transport modes:
- **HTTP (POST /mcp)**: Streamable HTTP transport for modern MCP clients
- **SSE (GET /mcp)**: Server-Sent Events for older MCP clients (deprecated)
- **stdio**: Process-based communication for local MCP clients (recommended for development)

### Client Commands

```bash
# Consult the Council
llm-council ask "your question here"

# With custom server URL
llm-council ask "your question" --server http://localhost:8080

# Test provider connectivity
npm run test:providers

# Test individual provider
npm run test:provider -- "GPT"
```

### Health Check

Check server status and available models:

```bash
curl http://localhost:3000/health
```

## Model Configuration

The Council models are configured in `src/config.ts` via the `COUNCIL_MODELS` array. Each provider has:
- Primary model (tried first)
- Fallback models (automatically tried if primary fails)
- API key from environment variables

Example configuration:
```typescript
{
  name: 'GPT',
  provider: 'openai',
  apiKey: env.openaiApiKey,
  models: [
    'gpt-5.2',      // Primary (requires org verification)
    'gpt-4o',       // Fallback 1 (widely available)
    'gpt-4-turbo'   // Fallback 2
  ]
}
```

You can edit `COUNCIL_MODELS` to customize which models the Council uses.

## Configuration

Environment variables (`.env` file):

```bash
# Server Configuration
PORT=3000                        # Server port (default: 3000)

# Debugging
LLM_COUNCIL_DEBUG=false         # Enable debug logging

# Timeouts
LLM_COUNCIL_TIMEOUT_MS=30000    # Request timeout for providers

# Rate Limiting (server)
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window

# Output Redaction
LLM_COUNCIL_REDACT_EMAILS=true

# Attachments
LLM_COUNCIL_ATTACHMENT_MAX_BYTES=5000000
LLM_COUNCIL_ATTACHMENT_MAX_TOTAL_BYTES=20000000
LLM_COUNCIL_ATTACHMENT_MAX_COUNT=5
LLM_COUNCIL_ATTACHMENT_ALLOWED_MEDIA_TYPES=text/*,application/json,application/pdf,application/zip,image/*
LLM_COUNCIL_ATTACHMENT_ALLOW_URLS=false

# Fallbacks
LLM_COUNCIL_FALLBACK_COOLDOWN_MS=120000
```

## Development

### Project Structure

```
llm-council-mcp/
├── src/
│   ├── index.ts         # CLI entry point
│   ├── config.ts        # Configuration: env vars + council model configs
│   ├── ui.ts            # Terminal UI helpers
│   ├── providers/       # Provider abstraction layer
│   ├── council/         # Parallel querying module
│   ├── server/          # Express server with MCP integration
│   │   ├── index.ts     # Main server
│   │   └── types.ts     # Request/response types
│   └── eval/            # Evaluation harness (future)
├── docs/
│   ├── SERVER.md        # Server setup guide
│   └── MCP_SETUP.md     # Claude Code integration guide
├── dist/                # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
└── .env
```

### Available Scripts

```bash
npm run build            # Build TypeScript to JavaScript
npm run dev              # Run CLI in development mode
npm run server           # Start Council server (dev mode)
npm run server:build     # Start Council server (production mode)
npm run test:providers   # Test all provider connections
npm run test:provider    # Test single provider (pass provider key after --)
npm run lint             # Check for linting errors
npm run lint:fix         # Fix auto-fixable linting errors
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting
```

### Type Checking

```bash
npx tsc --noEmit
```

## API Documentation

### MCP Tool: consult_llm_council

Consult the Council via the Model Context Protocol.

**Parameters:**
- `prompt` (string, required): The question or problem to consult about
- `context` (string, optional): Additional context to help models understand
- `show_raw` (boolean, optional): If true, omit synthesis fields and return only raw responses
- `models` (string[], optional): Subset of models to consult (e.g., `["claude", "gpt"]`)

Allowed model identifiers: `claude`, `gpt`, `gemini`, `grok`, `llama` (case-insensitive), or full display names.

**Returns:**
```typescript
  {
  critiques: [
    {
      model: string,        // Model name (e.g., "Claude Sonnet 4.5")
      model_id: string,     // Concrete model identifier used (e.g., "gpt-4o")
      response: string,     // The model's response
      latency_ms: number,   // Response time in milliseconds
      error?: string        // Error message if model failed
    }
  ],
  summary: {
    models_consulted: number,  // Total models queried
    models_responded: number,  // Models that succeeded
    models_failed: number,     // Models that failed
    total_latency_ms: number   // Total deliberation time
  },
  synthesis_data?: {
    agreement_points: string[],
    disagreements: Array<{
      topic: string,
      positions: Array<{ models: string[], view: string }>
    }>,
    key_insights: Array<{ model: string, insight: string }>,
    confidence: number
  },
  synthesis_instruction?: string
}
```

### MCP Tool: list_models

List the currently available Council models by name and model id.

**Returns:**
```typescript
{
  models: Array<{
    name: string,     // Display name (e.g., "Claude Sonnet 4.5")
    model_id: string  // Concrete model identifier (e.g., "claude-sonnet-4-5-20250929")
  }>
}
```

## Documentation

- **[Server Setup Guide](./docs/SERVER.md)** - Detailed server configuration and deployment
- **[MCP Integration Guide](./docs/MCP_SETUP.md)** - Integrate with Claude Code (stdio, HTTP, SSE transports)
- **[Security Guide](./docs/SECURITY.md)** - Comprehensive security documentation and best practices
- **[Architecture Document](./ARCHITECTURE.md)** - Technical design and data flows
- **[Implementation Plan](./PLAN.md)** - Development phases and progress

## Implementation Status

- [x] Phase 1: Project Setup & Provider Integration
- [x] Phase 2: Provider Abstraction Layer
- [x] Phase 3: Council Module (Parallel Querying)
- [x] Phase 7: Council Daemon Service & MCP Integration
- [ ] Phase 8: Evaluation Module (optional)

**Note:** Phases 4-6 (consensus and the original CLI) were deprecated in favor of the simpler daemon service architecture.

## Use Cases

### For AI Agents (like Claude Code)
- Get unstuck on difficult problems
- Validate architectural decisions
- Review code for potential issues
- Explore multiple solution approaches
- Debug complex bugs

### For Developers
- Quick CLI access to multiple frontier models
- Compare how different models approach the same problem
- Get diverse perspectives on technical decisions
- Validate assumptions with multiple AI opinions

## Performance

- **Parallel execution**: All configured models queried simultaneously
- **Typical response time**: 5-15 seconds for all models
- **Partial results**: Continues even if some models fail

## Tech Stack

- **Language:** TypeScript/Node.js
- **LLM SDKs:** Vercel AI SDK (`@ai-sdk/*`) for unified provider interface
- **Server:** Express.js with MCP SDK
- **MCP:** Model Context Protocol (streamable HTTP transport)
- **CLI Framework:** Commander.js
- **UI:** ora (spinners), chalk (colors)
- **Validation:** Zod (runtime type checking)

## Security

The Council server implements comprehensive security measures:

### Network Security
- **Localhost binding**: Server binds to `127.0.0.1` only (no external access)
- **Origin validation**: Requests validated to ensure localhost origin
- **DNS rebinding protection**: Host header validation

### Request Protection
- **Rate limiting**: 100 requests per 15 minutes (configurable via `RATE_LIMIT_*` env vars)
- **Input sanitization**: Control character removal, length limits
- **Injection detection**: Monitors for prompt injection attempts

### Data Protection
- **Output sanitization**: Automatic detection and redaction of sensitive data (API keys, credentials, private keys)
- **Security headers**: Helmet middleware with CSP, X-Frame-Options, etc.
- **API keys**: Stored securely in environment variables only

### Configuration

Rate limiting can be configured via environment variables:

```bash
# .env
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes (default)
RATE_LIMIT_MAX_REQUESTS=100       # Max requests per window (default)
```

### Best Practices

- ✅ Never commit `.env` file to version control
- ✅ Use stdio transport for local development (lowest attack surface)
- ✅ Monitor server logs for injection detection warnings
- ✅ Rotate API keys periodically
- ⚠️ **Do NOT expose server to internet without adding authentication**

See [docs/SECURITY.md](./docs/SECURITY.md) for comprehensive security documentation.

## Troubleshooting

### Server won't start
- Check port 3000 is not in use
- Verify at least one API key is configured
- Check build completed: `npm run build`

### Models failing
- Verify API keys in `.env`
- Test providers: `npm run test:providers`
- Check API key permissions and quotas

### CLI can't connect
- Ensure server is running: `npm run server`
- Check server URL: `curl http://localhost:3000/health`
- Verify correct port in CLI command: `--server http://localhost:PORT`

## License

MIT
