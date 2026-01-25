# Second Brain - Council Daemon Service

A daemon service that provides parallel consultation with frontier AI models. Multiple clients (CLI, Claude Code via MCP, or custom tools) can consult the Council when they need alternative perspectives, critiques, or help getting unstuck.

**Primary Use Case:** "Phone a Friend" - when an AI agent (like Claude Code) is uncertain or stuck, it can consult the Council for independent perspectives from multiple models.

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

1. Clone the repository:
```bash
git clone https://github.com/Schwartz10/second-brain.git
cd second-brain
```

2. Install dependencies:
```bash
npm install
```

3. Set up your API keys:
```bash
cp .env.example .env
# Edit .env and add your API keys
```

Required API keys (you need at least one):
- `ANTHROPIC_API_KEY` - Get from [Anthropic Console](https://console.anthropic.com/)
- `OPENAI_API_KEY` - Get from [OpenAI Platform](https://platform.openai.com/)
- `GEMINI_API_KEY` - Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
- `XAI_API_KEY` - Get from [xAI Console](https://console.x.ai/)
- `GROQ_API_KEY` - Get from [Groq Console](https://console.groq.com/)

4. Build the project:
```bash
npm run build
```

## Quick Start

### 1. Start the Council Server

```bash
npm run server
```

The server will start on http://localhost:3000 by default.

### 2. Consult the Council via CLI

In a new terminal:

```bash
second-brain ask "What is the best way to handle errors in TypeScript?"
```

The CLI will:
1. Connect to the Council server
2. Send your question to all configured models in parallel
3. Display independent responses from each model
4. Show timing and success metrics

### 3. Integrate with Claude Code

See [docs/MCP_SETUP.md](./docs/MCP_SETUP.md) for instructions on integrating with Claude Code.

Once configured, Claude Code can consult the Council directly when working on your code.

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
second-brain server
```

The server supports three transport modes:
- **HTTP (POST /mcp)**: Streamable HTTP transport for modern MCP clients
- **SSE (GET /mcp)**: Server-Sent Events for older MCP clients (deprecated)
- **stdio**: Process-based communication for local MCP clients (recommended for development)

### Client Commands

```bash
# Consult the Council
second-brain ask "your question here"

# With custom server URL
second-brain ask "your question" --server http://localhost:8080

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

# Council Configuration
SECOND_BRAIN_DEBUG=false         # Enable debug logging
```

## Development

### Project Structure

```
second-brain/
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

### MCP Tool: phone_council

Consult the Council via the Model Context Protocol. The old `council_consult` name remains as a deprecated alias.

**Parameters:**
- `prompt` (string, required): The question or problem to consult about
- `context` (string, optional): Additional context to help models understand
- `show_raw` (boolean, optional): If true, omit synthesis fields and return only raw responses

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

**Note:** Phases 4-6 (Personal Brain, Consensus, original CLI) were deprecated in favor of the simpler daemon service architecture.

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

ISC
