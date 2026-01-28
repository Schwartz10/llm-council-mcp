# MCP Client Setup (Claude Code / Codex)

This guide shows how to connect the Council server to an MCP client.

## Prerequisites

- Server running locally (see `docs/SERVER.md`)
- At least one API key configured (see `docs/CONFIGURATION.md`)

## Claude Code MCP Config

Config file location:
- macOS/Linux: `~/.config/claude-code/mcp-config.json`
- Windows: `%APPDATA%\\claude-code\\mcp-config.json`

### Option 1: stdio Transport (recommended for local dev)

```json
{
  "mcpServers": {
    "llm-council": {
      "command": "node",
      "args": ["/path/to/llm-council-mcp/dist/src/server/stdio.js"],
      "description": "Consult frontier AI models for alternative perspectives"
    }
  }
}
```

Note: With stdio transport, the MCP client starts the server process for you, so you do not need to run `npm run server` separately.

### Option 2: Streamable HTTP Transport

```json
{
  "mcpServers": {
    "llm-council": {
      "url": "http://127.0.0.1:3000/mcp",
      "transport": "streamable-http",
      "description": "Consult frontier AI models for alternative perspectives"
    }
  }
}
```

### Option 3: SSE Transport (deprecated)

```json
{
  "mcpServers": {
    "llm-council": {
      "url": "http://127.0.0.1:3000/mcp",
      "transport": "sse",
      "description": "Consult frontier AI models (SSE transport - deprecated)"
    }
  }
}
```

## Available Tools

- `consult_llm_council` — consult all or a subset of models
- `list_models` — list configured model display names and IDs
