# Claude Code MCP Integration Guide

This guide shows how to integrate the Council server with Claude Code using the Model Context Protocol (MCP). Once configured, Claude Code can consult the Council when it needs alternative perspectives or gets stuck.

## What is MCP?

The Model Context Protocol (MCP) is a standard way for AI assistants like Claude Code to access external tools and services. By exposing the Council as an MCP server, Claude Code can:

- Consult multiple AI models when uncertain
- Get alternative perspectives on complex problems
- Receive critiques of proposed solutions
- "Phone a friend" when stuck on difficult tasks

## Prerequisites

1. **Council server is running**: See [SERVER.md](./SERVER.md) for setup instructions
2. **Claude Code is installed**: You have Claude Code (cli) installed
3. **API keys configured**: At least one Council model has a valid API key

## Configuration

### Step 1: Start the Council Server

In your project directory:

```bash
# Development mode
npm run server

# Or production mode
npm run build
npm run server:build
```

Verify the server is running:
```bash
curl http://localhost:3000/health
```

### Step 2: Configure Claude Code MCP Settings

Create or update your Claude Code MCP configuration file. The location depends on your setup:

**For Claude Code CLI:**
- **macOS/Linux**: `~/.config/claude-code/mcp-config.json`
- **Windows**: `%APPDATA%\claude-code\mcp-config.json`

**Example Configurations:**

The Council server supports three transport modes:

**Option 1: stdio Transport (Recommended for Local Development)**

stdio transport spawns the server as a subprocess and communicates via stdin/stdout. This is the preferred method for local development as it eliminates HTTP overhead.

```json
{
  "mcpServers": {
    "council": {
      "command": "node",
      "args": ["/path/to/second-brain/dist/server/stdio.js"],
      "description": "Consult 4 frontier AI models for alternative perspectives"
    }
  }
}
```

**Option 2: Streamable HTTP Transport (Modern MCP)**

HTTP transport connects to a running server instance.

```json
{
  "mcpServers": {
    "council": {
      "url": "http://127.0.0.1:3000/mcp",
      "transport": "streamable-http",
      "description": "Consult 4 frontier AI models for alternative perspectives"
    }
  }
}
```

**Option 3: SSE Transport (Backwards Compatibility)**

For older MCP clients (2024-11-05 spec), the server also supports Server-Sent Events (SSE) transport on GET /mcp. This transport is deprecated and will show a warning in server logs.

```json
{
  "mcpServers": {
    "council": {
      "url": "http://127.0.0.1:3000/mcp",
      "transport": "sse",
      "description": "Consult 4 frontier AI models (SSE transport - deprecated)"
    }
  }
}
```

### Step 3: Restart Claude Code

After updating the configuration, restart Claude Code to load the new MCP server connection.

### Step 4: Verify Integration

In Claude Code, try using the Council:

```
Can you consult the Council about: "What is the best way to implement authentication in a Node.js app?"
```

Claude Code should automatically invoke the `council_consult` tool and present you with responses from all 4 models.

## Using the Council in Claude Code

### When to Consult the Council

The Council is most valuable for:

1. **Complex decisions**: "Should I use REST or GraphQL for this API?"
2. **Debugging hard problems**: "Why might this code be causing memory leaks?"
3. **Architecture choices**: "How should I structure this microservices system?"
4. **Code review**: "Are there any issues with this implementation?"
5. **Getting unstuck**: "I've tried X and Y, what else could I try?"

### How Claude Code Uses the Council

When you ask Claude Code to consult the Council:

1. Claude Code formulates a clear question
2. Sends the question to all 4 Council models in parallel
3. Receives independent responses from each model
4. Synthesizes the responses for you
5. Uses the Council's feedback to improve its answer

### Example Interactions

**Direct consultation:**
```
User: "Consult the Council: What are the security implications of using JWT tokens?"
```

**Implicit consultation (Claude Code decides when to use it):**
```
User: "I'm getting strange behavior in my React component. Can you help debug it?"
Claude: "Let me consult the Council for different debugging approaches..."
```

## Tool Details

### Tool Name
`council_consult`

### Tool Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | The question or problem to consult about |
| `context` | string | No | Additional context to help models understand |

### Tool Response

The tool returns structured data with:

```typescript
{
  critiques: [
    {
      model: string,        // Model name (e.g., "Claude Sonnet 4.5")
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
  }
}
```

## Transport Selection Guide

### stdio Transport vs HTTP Transport

**Use stdio transport when:**
- Running locally for development
- You want lower latency (no HTTP overhead)
- You prefer the server to start/stop automatically with Claude Code
- You don't need to share the server across multiple clients

**Use HTTP transport when:**
- You want to run one server instance shared by multiple clients
- You need to monitor server logs continuously
- You want the server to persist across Claude Code restarts
- You're connecting from a remote machine (not recommended for security)

**Use SSE transport when:**
- You're using an older MCP client (pre-2024-11-05)
- You need backwards compatibility
- Note: This transport is deprecated and will show warnings

## Configuration Options

### Custom Port

If your Council server runs on a different port:

```json
{
  "mcpServers": {
    "council": {
      "url": "http://127.0.0.1:8080/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Multiple Council Instances

You can run multiple Council servers with different configurations:

```json
{
  "mcpServers": {
    "council-fast": {
      "url": "http://127.0.0.1:3000/mcp",
      "description": "Fast Council (30s timeout)"
    },
    "council-thorough": {
      "url": "http://127.0.0.1:3001/mcp",
      "description": "Thorough Council (120s timeout)"
    }
  }
}
```

## Troubleshooting

### "Council server not available"

**Cause**: The Council server is not running or not reachable.

**Fix**:
1. Start the server: `npm run server`
2. Verify it's running: `curl http://localhost:3000/health`
3. Check the URL in your MCP config matches the server address

### "No models available"

**Cause**: No API keys are configured or all models failed.

**Fix**:
1. Check your `.env` file has at least one API key
2. Test providers: `npm run test:providers`
3. Review server logs for error messages

### "Request timeout"

**Cause**: Council models are taking too long to respond.

**Fix**:
1. Increase timeout: Set `SECOND_BRAIN_TIMEOUT_MS=60000` in `.env`
2. Restart the server
3. Check your internet connection
4. Verify API keys are valid

### Claude Code doesn't see the tool

**Cause**: MCP configuration not loaded or incorrect format.

**Fix**:
1. Verify MCP config file location is correct
2. Check JSON syntax is valid
3. Restart Claude Code completely
4. Check Claude Code logs for MCP connection errors

## Security Considerations

- **Local only**: Default configuration binds to `127.0.0.1` (localhost)
- **No authentication**: Server has no auth (intended for local dev only)
- **API keys**: Stored in `.env` file, never exposed to clients
- **Network**: Do NOT expose the server to the internet without adding authentication

## Best Practices

1. **Keep the server running**: Start it once and leave it running during development
2. **Clear questions**: When consulting, provide clear, specific questions
3. **Add context**: Use the `context` parameter to give models relevant background
4. **Review all responses**: Don't just use the first answer - consider all perspectives
5. **Monitor costs**: Each consultation queries 4 models - be mindful of API usage

## Performance

- **Parallel execution**: All 4 models are queried simultaneously
- **Typical response time**: 5-15 seconds for all models to respond
- **Timeout**: 30 seconds per model by default (configurable)
- **Partial results**: If some models fail, you still get responses from others

## Next Steps

- Review the [SERVER.md](./SERVER.md) for server configuration options
- Check the main [README.md](../README.md) for CLI usage
- Try the Council: `second-brain ask "your question"`
- Monitor server logs to see Council activity

## Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Claude Code Documentation](https://claude.ai/code)
- [Council Architecture](../ARCHITECTURE.md)
