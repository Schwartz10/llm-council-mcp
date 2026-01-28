# Council Server Setup Guide

The Council daemon is an Express server with MCP (Model Context Protocol) integration that provides parallel consultation with frontier AI models as a shared service.

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

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (see Configuration section below)

3. Build the project:
```bash
npm run build
```

## Configuration

Create a `.env` file in the project root with your API keys:

```bash
# Required API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
XAI_API_KEY=xai-...
GROQ_API_KEY=gsk_...

# Optional Configuration
PORT=3000                        # Server port (default: 3000)
LLM_COUNCIL_DEBUG=false         # Enable debug logging
LLM_COUNCIL_TIMEOUT_MS=30000    # Request timeout for providers
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window
LLM_COUNCIL_REDACT_EMAILS=true
LLM_COUNCIL_ATTACHMENT_MAX_BYTES=5000000
LLM_COUNCIL_ATTACHMENT_MAX_TOTAL_BYTES=20000000
LLM_COUNCIL_ATTACHMENT_MAX_COUNT=5
LLM_COUNCIL_ATTACHMENT_ALLOWED_MEDIA_TYPES=text/*,application/json,application/pdf,application/zip,image/*
LLM_COUNCIL_ATTACHMENT_ALLOW_URLS=false
LLM_COUNCIL_FALLBACK_COOLDOWN_MS=120000
```

You need at least one API key configured. The Council will work with whatever models have valid API keys.

## Running the Server

### Development Mode (with auto-reload)
```bash
npm run server
```

### Production Mode (requires build first)
```bash
npm run build
npm run server:build
```

### Using CLI Command
```bash
llm-council server
```

## Server Endpoints

### Health Check: GET /health

Check server status and see which Council models are available.

**Request:**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "council": {
    "initialized": true,
    "models_available": 5,
    "model_names": [
      "Claude Sonnet 4.5",
      "GPT",
      "Gemini",
      "Grok",
      "Llama 4 Maverick"
    ]
  },
  "config": {
    "debug": false
  }
}
```

### MCP Tool: POST /mcp

Consult the Council using the Model Context Protocol.

**Request:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "consult_llm_council",
      "arguments": {
        "prompt": "What is TypeScript?",
        "context": "I am learning web development"
      }
    }
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "# Council Consultation Results\n\n..."
      }
    ],
    "structuredContent": {
      "critiques": [
        {
          "model": "Claude Sonnet 4.5",
          "model_id": "claude-sonnet-4-5-20250929",
          "response": "TypeScript is...",
          "latency_ms": 1234
        },
        ...
      ],
      "summary": {
        "models_consulted": 5,
        "models_responded": 5,
        "models_failed": 0,
        "total_latency_ms": 5678
      },
      "synthesis_data": {
        "agreement_points": ["..."],
        "disagreements": [],
        "key_insights": [{ "model": "Claude Sonnet 4.5", "insight": "..." }],
        "confidence": 0.82
      },
      "synthesis_instruction": "Read the council responses..."
    }
  }
}
```

## The Council

The Council consists of frontier AI models that provide independent critiques:

1. **Claude Sonnet 4.5** (Anthropic) - with fallback to Sonnet 3.5
2. **GPT-5.2 / GPT-4o** (OpenAI) - with automatic fallback chain
3. **Gemini** (Google) - with fallback to Gemini 1.5 Pro
4. **Grok 3 Beta** (xAI)
5. **Llama 4 Maverick** (Groq) - with fallback to Llama 3.3

All models are queried in parallel. There is no automatic per-model timeout; queries continue until completion or user cancellation. If individual models fail, the Council continues with remaining models.

## Error Handling

The server handles errors gracefully:

- **Missing API keys**: Server starts but warns about unavailable models
- **Individual model failures**: Council continues with remaining models
- **Timeouts**: Models that take too long are marked as failed
- **Network errors**: Clear error messages returned to clients

## Monitoring

Check server logs for:
- Startup messages showing which models initialized
- Request/response timing
- Model failures and errors
- Debug information (if `LLM_COUNCIL_DEBUG=true`)

Example startup output:
```
✓ Council initialized with 5 models

✓ Council daemon server running on http://127.0.0.1:3000
  - Health check: http://127.0.0.1:3000/health
  - MCP endpoint: http://127.0.0.1:3000/mcp

Ready to receive Council consultation requests.
```

## Security Notes

- Server binds to `127.0.0.1` (localhost only) by default
- No authentication is implemented (local development only)
- API keys are stored in environment variables only
- Never commit `.env` file to version control

## Troubleshooting

### Server won't start
- Check that port 3000 is not already in use
- Verify at least one API key is configured
- Check for TypeScript build errors: `npm run build`

### Models failing
- Verify API keys are correct in `.env`
- Check API key permissions and quota limits
- Try increasing timeout: `LLM_COUNCIL_TIMEOUT_MS=60000`
- Test individual providers: `npm run test:providers`

### MCP requests failing
- Ensure server is running: `curl http://localhost:3000/health`
- Check request format matches the MCP protocol spec
- Review server logs for error details

## Next Steps

- See [MCP_SETUP.md](./MCP_SETUP.md) for Claude Code integration
- Run the CLI: `llm-council ask "your question"`
- Check the main [README.md](../README.md) for usage examples
