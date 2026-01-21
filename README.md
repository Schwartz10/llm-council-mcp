# Second Brain

A CLI tool that demonstrates multi-model AI deliberation produces better answers than any single model. Users ask questions through a "Personal Brain" (Claude Sonnet 4.5), which escalates to 4 frontier models deliberating in parallel, then synthesizes a unified response.

**Hypothesis:** Second Brain answers will be preferred >60% of the time vs the best single model.

## Architecture

```
User → CLI → Personal Brain → Second Brain (4 models in parallel) → Consensus Module → Personal Brain (synthesis) → User
```

### The Four Models

Second Brain consults these frontier models in parallel:

1. **Claude Sonnet 4.5** (Anthropic)
2. **GPT-5.2** (OpenAI)
3. **Grok** (xAI)
4. **Llama 4 Maverick** (via Groq)

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

Required API keys:
- `ANTHROPIC_API_KEY` - Get from [Anthropic Console](https://console.anthropic.com/)
- `OPENAI_API_KEY` - Get from [OpenAI Platform](https://platform.openai.com/)
- `XAI_API_KEY` - Get from [xAI Console](https://console.x.ai/)
- `GROQ_API_KEY` - Get from [Groq Console](https://console.groq.com/)

## Model Configuration

The council models are configured in `src/config.ts` via the `COUNCIL_MODELS` array. This configuration defines:
- Which models to use for each provider
- Primary and fallback models (tried in order)
- API keys from environment variables

You can edit the `COUNCIL_MODELS` array in `src/config.ts` to customize which models the council uses. Models are tried in order - if the primary fails, the system automatically falls back to the next one.

Example:
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

## Usage

### Test All Providers

Verify that all 4 AI providers are configured correctly:

```bash
npm run test:providers
```

This will test connectivity to all providers, automatically trying fallback models if primary ones fail. The output shows which specific model connected (e.g., "GPT: Connected (using gpt-4o)").

### Test Individual Provider

Test a specific provider to verify its configuration:

```bash
npm run test:provider -- <provider-key>
```

Available providers:
- `Claude Sonnet 4.5`
- `GPT`
- `Grok`
- `Llama 4 Maverick`

Example:
```bash
npm run test:provider -- "GPT"
```

**Note:** The `--` is required to pass arguments to the script. Provider names are case-insensitive.

### Ask a Question (Coming Soon)

Once implementation is complete, you'll be able to ask questions:

```bash
npm run ask "What is the best programming language for systems programming?"
```

## Development

### Project Structure

```
second-brain/
├── src/
│   ├── index.ts         # CLI entry point
│   ├── config.ts        # Configuration: env vars + council model configs
│   ├── providers/       # Provider abstraction layer (Phase 2)
│   ├── council/         # Parallel querying module (Phase 3)
│   ├── consensus/       # Synthesis module (Phase 4)
│   ├── brain/           # Personal Brain module (Phase 5)
│   ├── cli/             # CLI interface (Phase 6)
│   └── eval/            # Evaluation harness (Phase 7)
├── package.json
├── tsconfig.json
└── .env
```

### Available Scripts

```bash
npm run dev              # Run CLI in development mode
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

## Configuration

Optional environment variables:

- `SECOND_BRAIN_TIMEOUT_MS` - Timeout for each provider in milliseconds (default: 30000)
- `SECOND_BRAIN_DEBUG` - Enable debug logging (default: false)

## Implementation Status

- [x] Phase 1: Project Setup & Provider Integration
- [ ] Phase 2: Provider Abstraction Layer
- [ ] Phase 3: Council Module (Parallel Querying)
- [ ] Phase 4: Consensus Module
- [ ] Phase 5: Personal Brain Module
- [ ] Phase 6: CLI Interface
- [ ] Phase 7: Evaluation Module

## Tech Stack

- **Language:** TypeScript/Node.js
- **LLM SDKs:** Vercel AI SDK (`@ai-sdk/*`) for unified provider interface
- **CLI Framework:** Commander.js
- **UI:** ora (spinners), chalk (colors)

## License

ISC
