#!/usr/bin/env node
/**
 * Council Daemon Server - HTTP Transport
 *
 * Express server with MCP integration that provides Council consultation
 * as a shared service accessible via both HTTP and MCP protocols.
 *
 * This server uses Streamable HTTP transport for modern MCP clients.
 */

import { Request, Response, NextFunction } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import helmet from 'helmet';
import { mcpServer, initializeCouncil, getCouncilProviders } from './shared.js';
import { getMissingApiKeys, loadConfig } from '../config.js';
import { mcpRateLimiter, healthCheckRateLimiter } from './rate-limit.js';

// Load configuration
const config = loadConfig();

// Create Express app with MCP defaults
const app = createMcpExpressApp({
  host: '127.0.0.1', // Enable DNS rebinding protection
});

// Apply security headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'http://localhost:*', 'http://127.0.0.1:*'],
      },
    },
    // Allow cross-origin for localhost MCP clients
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

/**
 * Origin validation middleware
 * Validates that requests come from localhost origins only
 */
function validateOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('Origin');
  const host = req.get('Host');

  // If no Origin header, check Host header
  if (!origin) {
    // Host header should be localhost or 127.0.0.1
    if (host && (host.startsWith('localhost') || host.startsWith('127.0.0.1'))) {
      return next();
    }
    console.warn(`⚠️ Suspicious request without Origin header from Host: ${host}`);
    return next(); // Allow for now (createMcpExpressApp already validates Host)
  }

  // Validate Origin is localhost
  const localhostPatterns = [
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https:\/\/localhost(:\d+)?$/,
    /^https:\/\/127\.0\.0\.1(:\d+)?$/,
  ];

  const isValidOrigin = localhostPatterns.some((pattern) => pattern.test(origin));

  if (!isValidOrigin) {
    console.error(`⚠️ Blocked request from invalid Origin: ${origin}`);
    res.status(403).json({
      error: 'Forbidden',
      message: 'Requests must originate from localhost',
    });
    return;
  }

  next();
}

// Apply origin validation to all routes
app.use(validateOrigin);

// Health check endpoint (with permissive rate limiting)
app.get('/health', healthCheckRateLimiter, (_req: Request, res: Response) => {
  const missingKeys = getMissingApiKeys();
  const councilProviders = getCouncilProviders();

  const status = {
    status: 'ok',
    council: {
      initialized: councilProviders.length > 0,
      models_available: councilProviders.length,
      model_names: councilProviders.map((p) => p.name),
    },
    config: {
      timeout_ms: config.timeoutMs,
      debug: config.debug,
    },
    ...(missingKeys.length > 0 ? { warnings: { missing_api_keys: missingKeys } } : {}),
  };

  res.json(status);
});

// MCP POST handler - stateless mode with streaming support (modern clients)
app.post('/mcp', mcpRateLimiter, async (req: Request, res: Response) => {
  // Create a new transport for each request (stateless mode)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode - no session IDs
    enableJsonResponse: true,
  });

  // Clean up transport after request completes
  res.on('close', () => {
    void transport.close();
  });

  // Connect the transport to the MCP server before handling the request
  await mcpServer.connect(transport);

  // Handle the request (supports streaming responses)
  await transport.handleRequest(req, res, req.body);
});

// MCP GET handler - SSE transport for backwards compatibility (older clients)
app.get('/mcp', mcpRateLimiter, async (_req: Request, res: Response) => {
  // Log deprecation warning
  console.error('⚠️ SSE transport is deprecated. Please upgrade to Streamable HTTP (POST /mcp).');

  // Create SSE transport
  const transport = new SSEServerTransport('/mcp', res);

  // Clean up transport when client disconnects
  res.on('close', () => {
    void transport.close();
  });

  // Connect the transport to the MCP server
  await mcpServer.connect(transport);

  // Start the SSE stream
  await transport.start();
});

// Start server
async function startServer() {
  // Validate API keys
  const missingKeys = getMissingApiKeys();
  if (missingKeys.length > 0) {
    console.error('⚠ Warning: Missing API keys:', missingKeys.join(', '));
    console.error('Some Council models may not be available.\n');
  }

  // Initialize Council
  await initializeCouncil();

  // Start listening
  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, '127.0.0.1', () => {
    console.error(`\n✓ Council daemon server running on http://127.0.0.1:${port}`);
    console.error(`  - Health check: http://127.0.0.1:${port}/health`);
    console.error(`  - MCP endpoint: http://127.0.0.1:${port}/mcp`);
    console.error('\nReady to receive Council consultation requests.\n');
  });
}

// Handle errors
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
