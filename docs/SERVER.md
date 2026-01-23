# Council Server Setup Guide

The Council daemon is an Express server with MCP (Model Context Protocol) integration that provides parallel consultation with 4 frontier AI models as a shared service.

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
│  Council: 4 models query in parallel               │
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
XAI_API_KEY=xai-...
GROQ_API_KEY=gsk_...

# Optional Configuration
PORT=3000                        # Server port (default: 3000)
SECOND_BRAIN_TIMEOUT_MS=30000    # Timeout per model query (default: 30000ms)
SECOND_BRAIN_DEBUG=false         # Enable debug logging
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
second-brain server
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
    "models_available": 4,
    "model_names": [
      "Claude Sonnet 4.5",
      "GPT",
      "Grok",
      "Llama 4 Maverick"
    ]
  },
  "config": {
    "timeout_ms": 30000,
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
      "name": "council_consult",
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
          "response": "TypeScript is...",
          "latency_ms": 1234
        },
        ...
      ],
      "summary": {
        "models_consulted": 4,
        "models_responded": 4,
        "models_failed": 0,
        "total_latency_ms": 5678
      }
    }
  }
}
```

## The Council

The Council consists of 4 frontier AI models that provide independent critiques:

1. **Claude Sonnet 4.5** (Anthropic) - with fallback to Sonnet 3.5
2. **GPT-5.2 / GPT-4o** (OpenAI) - with automatic fallback chain
3. **Grok 3 Beta** (xAI)
4. **Llama 4 Maverick** (Groq) - with fallback to Llama 3.3

All models are queried in parallel (30s timeout per model by default). If individual models fail, the Council continues with remaining models.

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
- Debug information (if `SECOND_BRAIN_DEBUG=true`)

Example startup output:
```
✓ Council initialized with 4 models

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
- Try increasing timeout: `SECOND_BRAIN_TIMEOUT_MS=60000`
- Test individual providers: `npm run test:providers`

### MCP requests failing
- Ensure server is running: `curl http://localhost:3000/health`
- Check request format matches the MCP protocol spec
- Review server logs for error details

## Next Steps

- See [MCP_SETUP.md](./MCP_SETUP.md) for Claude Code integration
- Run the CLI: `second-brain ask "your question"`
- Check the main [README.md](../README.md) for usage examples
