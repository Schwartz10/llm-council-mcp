# Security

This server is intended for local development. It does not include authentication and should not be exposed to the public internet.

## Summary of Protections

- **Localhost binding**: Server binds to `127.0.0.1` by default.
- **Origin/Host validation**: Blocks non-localhost origins (DNS rebinding protection).
- **Rate limiting**: MCP and health endpoints are rate limited.
- **Input sanitization**: Strips control characters and detects common prompt-injection patterns.
- **Output redaction**: Redacts common secrets (API keys, credentials) from responses.
- **Security headers**: Helmet defaults for common browser protections.

## Best Practices

- Keep the server local; add auth if you must expose it.
- Store API keys in `.env`, never in source control.
- Rotate keys periodically and monitor provider dashboards.
- Prefer stdio transport for local use (lower attack surface).

Configuration details live in `docs/CONFIGURATION.md`.
