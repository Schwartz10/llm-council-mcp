import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

export function toMcpError(error: unknown, debug: boolean): McpError {
  const message = error instanceof Error ? error.message : String(error);
  const data = debug ? { message } : undefined;
  return new McpError(ErrorCode.InternalError, 'Council consultation failed', data);
}
