# Configuration

This project has two configuration surfaces:

1. `.env` — runtime/server settings and API keys
2. `council.config.ts` — which models to use and their fallback order

## council.config.ts (Model Selection)

`council.config.ts` lives at the repo root and defines the Council lineup. Models are tried in order, so the first entry in `models` is primary and the rest are fallbacks.

```ts
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

Fields:
- `name`: Display name shown to clients
- `provider`: One of `anthropic`, `openai`, `gemini`, `xai`, `groq`
- `apiKey`: Typically `process.env.*`
- `models`: Ordered list of model IDs

## .env (Environment Variables)

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required (at least one):
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `XAI_API_KEY`
- `GROQ_API_KEY`

Optional:
- `PORT` (default: `3000`)
- `LLM_COUNCIL_DEBUG` (default: `false`)
- `LLM_COUNCIL_TIMEOUT_MS` (default: `30000`)
- `LLM_COUNCIL_REDACT_EMAILS` (default: `true`)
- `LLM_COUNCIL_ATTACHMENT_MAX_BYTES` (default: `5000000`)
- `LLM_COUNCIL_ATTACHMENT_MAX_TOTAL_BYTES` (default: `20000000`)
- `LLM_COUNCIL_ATTACHMENT_MAX_COUNT` (default: `5`)
- `LLM_COUNCIL_ATTACHMENT_ALLOWED_MEDIA_TYPES`
  - default: `text/*,application/json,application/pdf,application/zip,image/*`
- `LLM_COUNCIL_ATTACHMENT_ALLOW_URLS` (default: `false`)
- `LLM_COUNCIL_FALLBACK_COOLDOWN_MS` (default: `120000`)
- `RATE_LIMIT_WINDOW_MS` (default: `900000`)
- `RATE_LIMIT_MAX_REQUESTS` (default: `100`)
- `LLM_COUNCIL_LIVE_TESTS` (default: `false`)

