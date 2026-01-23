#!/usr/bin/env node
/**
 * Council MCP Server - stdio Transport
 *
 * Entry point for stdio transport mode, enabling MCP clients to spawn
 * the server as a subprocess and communicate via stdin/stdout.
 *
 * Usage:
 *   node dist/server/stdio.js
 *
 * The server reads JSON-RPC messages from stdin and writes responses to stdout.
 * All logging is written to stderr to avoid polluting the JSON-RPC stream.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mcpServer, initializeCouncil } from './shared.js';
import { getMissingApiKeys } from '../config.js';

async function startStdioServer() {
  try {
    // Validate API keys (log to stderr)
    const missingKeys = getMissingApiKeys();
    if (missingKeys.length > 0) {
      console.error('⚠ Warning: Missing API keys:', missingKeys.join(', '));
      console.error('Some Council models may not be available.\n');
    }

    // Initialize Council (must happen before transport.start())
    await initializeCouncil();

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect the transport to the MCP server
    await mcpServer.connect(transport);

    // Start the transport (begins reading from stdin)
    console.error('✓ Council MCP server ready on stdio transport\n');
    await transport.start();
  } catch (error) {
    console.error('Failed to start stdio server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\n✓ Shutting down stdio server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n✓ Shutting down stdio server...');
  process.exit(0);
});

// Start the server
void startStdioServer();
