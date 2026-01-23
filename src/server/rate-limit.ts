/**
 * Rate Limiting Configuration
 *
 * Protects the server from abuse and denial-of-service attacks by limiting
 * the number of requests from a single IP address within a time window.
 */

import rateLimit from 'express-rate-limit';

// Rate limit configuration from environment variables or defaults
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'); // 100 requests per window

/**
 * Rate limiter middleware for MCP endpoints
 *
 * Limits requests to prevent abuse and DoS attacks.
 * Returns 429 (Too Many Requests) when limit is exceeded.
 */
export const mcpRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  message: {
    error: 'Too many requests',
    message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per ${WINDOW_MS / 60000} minutes.`,
    retryAfter: `${WINDOW_MS / 1000} seconds`,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests (only count requests that trigger rate limiting)
  skipSuccessfulRequests: false,
  // Skip failed requests (4xx and 5xx errors)
  skipFailedRequests: false,
  handler: (req, res) => {
    console.error(
      `⚠️ Rate limit exceeded for IP: ${req.ip} (${MAX_REQUESTS} requests per ${WINDOW_MS / 60000} minutes)`
    );
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per ${WINDOW_MS / 60000} minutes.`,
      retryAfter: `${WINDOW_MS / 1000} seconds`,
    });
  },
});

/**
 * More permissive rate limiter for health check endpoint
 */
export const healthCheckRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: 'Too many health check requests',
    message: 'Health check rate limit exceeded. Maximum 30 requests per minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
