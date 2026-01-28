# Contributing

Thanks for contributing to LLM Council MCP!

## Quick Start

1. Fork and clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment template:
   ```bash
   cp .env.example .env
   ```
4. Run the server or CLI as needed:
   ```bash
   npm run server
   ```

## Development Standards

- TypeScript only (ES modules)
- Keep changes small and well‑scoped
- Prefer tests for new behavior
- Avoid breaking the MCP tool contracts

## Checks Before You Submit

```bash
npx tsc --noEmit
npm run lint
npm run format:check
npm test
```

## Pull Requests

- Describe the problem and solution
- Link related issues if applicable
- Include test coverage or explain why it isn’t needed

## Reporting Security Issues

Please see `docs/SECURITY.md` for vulnerability reporting guidance.
