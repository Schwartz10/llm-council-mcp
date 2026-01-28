# LLM Council MCP - CLI Setup

This repository provides a local MCP server + CLI for consulting multiple frontier models in parallel. This README focuses only on getting the CLI running.

## Get Started

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

Run the MCP server:

```bash
npm run server
```

## Model Selection (council.config.ts)

You can customize which models and fallbacks the Council uses in `council.config.ts` at the repo root. Models are tried in order, so the first entry in `models` is the primary and the rest are fallbacks.

Example configuration:
```typescript
{
  name: 'GPT',
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  models: [
    'gpt-5.2',      // Primary
    'gpt-4o',       // Fallback 1
    'gpt-4-turbo'   // Fallback 2
  ]
}
```

## Context Skill (Optional)

This repo includes a Codex/Claude Code skill to help craft high‑signal context for council consultations.

To use it in another repo:

```bash
cp -r /path/to/llm-council-mcp/.agents/skills/second-brain-context ./.agents/skills/
```

See `.agents/skills/second-brain-context/SKILL.md` for details.

## Use the CLI

```bash
llm-council ask "What is the best way to handle errors in TypeScript?"
```

Claude Code integration:
- See `docs/MCP_SETUP.md` for MCP setup steps.

## Configuration

Environment variables (`.env` file):

```bash
PORT=3000
LLM_COUNCIL_DEBUG=false
LLM_COUNCIL_REDACT_EMAILS=true
LLM_COUNCIL_ATTACHMENT_MAX_BYTES=5000000
LLM_COUNCIL_ATTACHMENT_MAX_TOTAL_BYTES=20000000
LLM_COUNCIL_ATTACHMENT_MAX_COUNT=5
LLM_COUNCIL_ATTACHMENT_ALLOWED_MEDIA_TYPES=text/*,application/json,application/pdf,application/zip,image/*
LLM_COUNCIL_ATTACHMENT_ALLOW_URLS=false
LLM_COUNCIL_FALLBACK_COOLDOWN_MS=120000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```
