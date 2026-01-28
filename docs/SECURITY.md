# Security Documentation

This document describes the security measures implemented in the Council MCP server and best practices for secure usage.

## Security Overview

The Council server implements defense-in-depth security with multiple layers of protection:

1. **Network Security**: Localhost binding, origin validation
2. **Rate Limiting**: Protection against abuse and DoS attacks
3. **Input Sanitization**: Protection against injection attacks
4. **Output Sanitization**: Prevention of sensitive data leakage
5. **Security Headers**: HTTP security headers via Helmet

## Security Measures

### 1. Network Security

#### Localhost Binding

The server binds exclusively to `127.0.0.1` (localhost) by default:

```typescript
app.listen(port, '127.0.0.1');
```

This prevents external network access and ensures the server is only accessible from the local machine.

**⚠️ WARNING**: Do NOT expose this server to the internet without implementing authentication and HTTPS.

#### Origin Validation

All HTTP requests are validated to ensure they originate from localhost:

- **Valid origins**:
  - `http://localhost`
  - `http://localhost:<port>`
  - `http://127.0.0.1`
  - `http://127.0.0.1:<port>`
  - `https://localhost`
  - `https://127.0.0.1`

- **Blocked origins**: Any non-localhost origin receives a 403 Forbidden response

This protects against DNS rebinding attacks and unauthorized access attempts.

#### DNS Rebinding Protection

The server uses `createMcpExpressApp` from the MCP SDK, which includes built-in DNS rebinding protection via Host header validation.

### 2. Rate Limiting

Rate limiting protects against denial-of-service (DoS) attacks and API abuse.

#### MCP Endpoint Rate Limits

**Default limits:**
- **Window**: 15 minutes (900,000 ms)
- **Max requests**: 100 requests per window
- **Response**: 429 (Too Many Requests) when exceeded

**Configuration:**
```bash
# .env
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100       # Max requests per window
```

#### Health Check Rate Limits

Health checks have more permissive limits:
- **Window**: 1 minute
- **Max requests**: 30 requests per minute

### 3. Input Sanitization

All user inputs are sanitized to prevent injection attacks and malicious payloads.

#### Control Character Removal

Control characters (except newlines and tabs) are stripped from all inputs:

```typescript
text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
```

This prevents null byte injection and other control character exploits.

#### Length Limits

Strict length limits prevent memory exhaustion attacks:
- **Prompt**: Maximum 10,000 characters
- **Context**: Maximum 5,000 characters

Inputs exceeding these limits are truncated.

#### Injection Detection

The server detects common prompt injection patterns:

**Detected patterns:**
- "Ignore all previous instructions"
- "Disregard previous instructions"
- "System:" prompts
- Instruction tokens: `[INST]`, `[SYSTEM]`, `<|system|>`, etc.
- "You are now..." role changes
- "Override instructions"

**Response**: Detection is logged but requests are not blocked (to avoid false positives). Monitoring these logs can help identify attack attempts.

### 4. Output Sanitization

Council responses are scanned for sensitive data leakage.

#### Sensitive Data Detection

The server detects the following patterns in model responses:

**API Keys & Tokens:**
- Anthropic API keys: `sk-ant-...`
- OpenAI API keys: `sk-...`
- Gemini API keys: `AIza...`
- xAI API keys: `xai-...`
- Groq API keys: `gsk_...`
- Bearer tokens

**AWS Credentials:**
- Access key IDs: `AKIA...`
- Secret access keys

**Private Keys:**
- RSA private keys
- OpenSSH private keys

**Email Addresses:**
- Detected but NOT redacted (may be legitimate content)

#### Automatic Redaction

When sensitive data is detected:
1. The data is automatically redacted: `[REDACTED_API_KEY]`
2. A warning is logged to server logs
3. The response includes a `redacted: true` flag
4. The response includes a `warnings` array describing what was redacted

**Example redacted response:**
```json
{
  "model": "Claude Sonnet 4.5",
  "response": "Use this key: [REDACTED_API_KEY]",
  "latency_ms": 1234,
  "redacted": true,
  "warnings": ["API keys detected and redacted"]
}
```

### 5. Security Headers

The server applies comprehensive HTTP security headers via Helmet:

#### Content Security Policy (CSP)

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*"]
  }
}
```

#### Other Security Headers

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Cross-Origin-Resource-Policy: cross-origin` - Allows localhost CORS
- `Cross-Origin-Embedder-Policy: disabled` - Compatibility with MCP clients

## Security Best Practices

### For Server Operators

1. **Never expose to internet**: The server is designed for local development only
2. **Use stdio transport when possible**: Lower attack surface than HTTP
3. **Monitor rate limit violations**: Check logs for suspicious activity
4. **Keep API keys secure**:
   - Store in `.env` file only
   - Never commit `.env` to version control
   - Use restrictive file permissions: `chmod 600 .env`
5. **Review injection detection logs**: Unusual patterns may indicate attacks
6. **Update dependencies regularly**: Run `npm audit` and fix vulnerabilities

### For API Security

1. **Rotate API keys periodically**: Especially if logs show suspicious activity
2. **Use provider-specific rate limits**: Configure provider dashboards to limit costs
3. **Monitor API usage**: Track costs and usage patterns
4. **Use minimal permissions**: If providers support scoped keys, use read-only where possible

### For MCP Clients

1. **Validate responses**: Don't blindly trust redacted content
2. **Add context carefully**: Don't include sensitive data in prompts or context
3. **Review all Council responses**: Multiple models may have different vulnerabilities
4. **Monitor for data leakage**: Check if models are inadvertently revealing sensitive info

## Configuration

### Environment Variables

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes (default)
RATE_LIMIT_MAX_REQUESTS=100          # Max requests per window (default)

# Server Configuration
PORT=3000                             # Server port
LLM_COUNCIL_TIMEOUT_MS=30000        # Query timeout
LLM_COUNCIL_DEBUG=false             # Debug logging
```

### Adjusting Rate Limits

**For higher throughput:**
```bash
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500          # Allow 500 requests per 15 min
```

**For stricter limits:**
```bash
RATE_LIMIT_WINDOW_MS=300000          # 5 minutes
RATE_LIMIT_MAX_REQUESTS=20           # Allow 20 requests per 5 min
```

## Threat Model

### Threats Mitigated

| Threat | Mitigation | Status |
|--------|-----------|--------|
| **Prompt Injection** | Input sanitization, injection detection | ✅ Mitigated |
| **Sensitive Data Disclosure** | Output sanitization, automatic redaction | ✅ Mitigated |
| **Denial of Service** | Rate limiting, timeouts, input length limits | ✅ Mitigated |
| **DNS Rebinding** | Host validation, origin validation | ✅ Mitigated |
| **Code Injection** | No eval/exec, Zod validation, no DB/shell commands | ✅ Mitigated |
| **XSS** | No HTML in responses, safe markdown only | ✅ Mitigated |
| **CSRF** | Stateless mode, no cookies/sessions | ✅ Mitigated |
| **Security Misconfiguration** | Helmet headers, localhost binding | ✅ Mitigated |

### Residual Risks (Accepted)

| Risk | Reason | Recommendation |
|------|--------|----------------|
| **No Authentication** | Designed for local dev simplicity | Add OAuth if exposing externally |
| **No Authorization** | Single tool, read-only operations | Add RBAC for multi-user scenarios |
| **No Audit Logging** | Minimal compliance requirements | Add audit trail for production use |
| **No Cost Tracking** | User manages API usage | Implement usage quotas for production |
| **Model Hallucinations** | Inherent to LLMs | Always validate model outputs |
| **API Key Exposure** | If models leak keys in responses | Monitor redaction logs, rotate keys |

## Security Testing

The server includes comprehensive security tests:

```bash
# Run security tests
npm run test src/server/security.test.ts

# All tests
npm run test
```

**Test coverage includes:**
- Input sanitization (control chars, length limits)
- Injection detection (9+ attack patterns)
- Sensitive data detection (API keys, credentials, private keys)
- Output redaction (automatic removal of secrets)
- Rate limiting configuration
- Origin validation patterns

## Incident Response

### If Suspicious Activity Detected

1. **Review server logs** for injection attempts or rate limit violations
2. **Check API provider dashboards** for unusual usage patterns
3. **Rotate API keys** if compromise suspected
4. **Review `.env` file permissions** (should be 600)
5. **Update dependencies** if vulnerability discovered
6. **Increase logging** temporarily: `LLM_COUNCIL_DEBUG=true`

### If Sensitive Data Leaked

1. **Check server logs** for redaction warnings
2. **Review affected model responses**
3. **Rotate any exposed credentials immediately**
4. **Report to affected parties** if third-party data exposed
5. **Review Council prompts** for inadvertent sensitive data inclusion

## Reporting Security Issues

**Do NOT open public GitHub issues for security vulnerabilities.**

Instead:
1. Email security concerns to the maintainer
2. Include detailed reproduction steps
3. Provide proof-of-concept if available
4. Allow 90 days for fix before public disclosure

## Compliance Considerations

This server is designed for **local development only**. For production or compliance-sensitive environments, additional measures required:

### GDPR / Privacy
- Add audit logging for data access
- Implement data retention policies
- Add user consent mechanisms
- Review model provider data policies

### SOC 2 / Security
- Implement authentication and authorization
- Add comprehensive audit trail
- Enable encrypted communication (HTTPS/TLS)
- Regular security assessments
- Incident response procedures

### Cost Controls
- Implement per-user quotas
- Add cost tracking and alerts
- Rate limiting per API key
- Budget caps with provider APIs

## Additional Resources

- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
