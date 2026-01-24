#!/usr/bin/env node
/**
 * Council Daemon Server - HTTP Transport
 *
 * Express server with MCP integration that provides Council consultation
 * as a shared service accessible via both HTTP and MCP protocols.
 *
 * This server uses Streamable HTTP transport for modern MCP clients.
 */

import { Request, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import helmet from 'helmet';
import { mcpServer, initializeCouncil, getCouncilProviders } from './shared.js';
import { getMissingApiKeys, loadConfig } from '../config.js';
import { mcpRateLimiter, healthCheckRateLimiter } from './rate-limit.js';
import { validateOrigin } from './origin.js';

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
  try {
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('MCP request failed:', errorMessage);
    if (!res.headersSent) {
      const requestBody: unknown = req.body;
      const requestId =
        requestBody && typeof requestBody === 'object' && 'id' in requestBody
          ? (requestBody as { id?: unknown }).id
          : null;
      const sanitizedRequestId =
        typeof requestId === 'string' || typeof requestId === 'number' ? requestId : null;
      const errorPayload: Record<string, unknown> = {
        jsonrpc: '2.0',
        id: sanitizedRequestId,
        error: {
          code: -32603,
          message: 'Internal error',
          ...(config.debug ? { data: { message: errorMessage } } : {}),
        },
      };
      res.status(200).json(errorPayload);
    }
  }
});

// MCP GET handler - SSE transport for backwards compatibility (older clients)
app.get('/mcp', mcpRateLimiter, async (_req: Request, res: Response) => {
  try {
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('MCP SSE request failed:', errorMessage);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// Start server
function startServer() {
  // Validate API keys
  const missingKeys = getMissingApiKeys();
  if (missingKeys.length > 0) {
    console.error('⚠ Warning: Missing API keys:', missingKeys.join(', '));
    console.error('Some Council models may not be available.\n');
  }

  // Initialize Council
  initializeCouncil();

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
try {
  startServer();
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
