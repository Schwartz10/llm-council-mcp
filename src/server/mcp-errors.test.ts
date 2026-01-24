import { describe, expect, test } from 'vitest';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { toMcpError } from './mcp-errors.js';

describe('toMcpError', () => {
  test('wraps errors as MCP InternalError', () => {
    const error = new Error('boom');
    const mcpError = toMcpError(error, false);

    expect(mcpError).toBeInstanceOf(McpError);
    expect(mcpError.code).toBe(ErrorCode.InternalError);
    expect(mcpError.message).toContain('Council consultation failed');
    expect(mcpError.data).toBeUndefined();
  });

  test('includes debug data when enabled', () => {
    const error = new Error('details');
    const mcpError = toMcpError(error, true);

    expect(mcpError.data).toEqual({ message: 'details' });
  });
});
