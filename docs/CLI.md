# CLI Reference

The CLI entry point is `llm-council`.

## Commands

### Ask the Council

```bash
llm-council ask "your question"
```

Options:
- `--server <url>`: MCP server URL (default: `http://127.0.0.1:3000`)

### Start the Server (Production Build)

```bash
llm-council server
```

This command expects a built server (`npm run build`) and runs `dist/src/server/index.js`.

### Test Providers

```bash
npm run test:providers
npm run test:provider -- "GPT"
```

Live provider tests are skipped unless `LLM_COUNCIL_LIVE_TESTS=true`.

