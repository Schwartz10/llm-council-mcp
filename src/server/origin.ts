import { Request, Response, NextFunction } from 'express';

const LOCALHOST_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/localhost(:\d+)?$/,
  /^https:\/\/127\.0\.0\.1(:\d+)?$/,
];

/**
 * Origin validation middleware
 * Validates that requests come from localhost origins only
 */
export function validateOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('Origin');
  const host = req.get('Host');

  if (!host) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Host header is required',
    });
    return;
  }

  const isLocalhostHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

  if (!isLocalhostHost) {
    console.error(`⚠️ Blocked request with invalid Host: ${host}`);
    res.status(403).json({
      error: 'Forbidden',
      message: 'Requests must target localhost',
    });
    return;
  }

  if (!origin) {
    // Non-browser MCP clients typically omit Origin; allow this for MCP routes.
    if (req.path.startsWith('/mcp')) {
      next();
      return;
    }
    res.status(400).json({
      error: 'Bad Request',
      message: 'Origin header is required',
    });
    return;
  }

  const isValidOrigin = LOCALHOST_PATTERNS.some((pattern) => pattern.test(origin));

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
