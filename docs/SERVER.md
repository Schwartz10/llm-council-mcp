# Server Operations

This document covers running the MCP server locally. Configuration is documented in `docs/CONFIGURATION.md`.

## Run (Development)

```bash
npm run server
```

## Run (Production Build)

```bash
npm run build
npm run server:build
```

## Health Check

```bash
curl http://localhost:3000/health
```

## MCP Endpoint

The MCP endpoint is available at:

```
http://127.0.0.1:3000/mcp
```

For client setup examples, see `docs/MCP_SETUP.md`.

