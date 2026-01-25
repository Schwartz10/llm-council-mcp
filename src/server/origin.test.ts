import { describe, expect, test, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateOrigin } from './origin.js';

function createReq(
  headers: Record<string, string | undefined>,
  path = '/'
): Request {
  return {
    get: (name: string) => headers[name.toLowerCase()],
    path,
  } as unknown as Request;
}

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('validateOrigin', () => {
  test('rejects missing host header', () => {
    const req = createReq({ origin: 'http://localhost:3000' });
    const res = createRes();
    const next = vi.fn();

    validateOrigin(req, res, next as NextFunction);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'Bad Request',
      message: 'Host header is required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects missing origin header', () => {
    const req = createReq({ host: 'localhost:3000' }, '/health');
    const res = createRes();
    const next = vi.fn();

    validateOrigin(req, res, next as NextFunction);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'Bad Request',
      message: 'Origin header is required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('allows missing origin header on /mcp', () => {
    const req = createReq({ host: 'localhost:3000' }, '/mcp');
    const res = createRes();
    const next = vi.fn();

    validateOrigin(req, res, next as NextFunction);

    expect(res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid host', () => {
    const req = createReq({
      host: 'example.com',
      origin: 'http://localhost:3000',
    });
    const res = createRes();
    const next = vi.fn();

    validateOrigin(req, res, next as NextFunction);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'Forbidden',
      message: 'Requests must target localhost',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid origin', () => {
    const req = createReq({
      host: 'localhost:3000',
      origin: 'http://evil.com',
    });
    const res = createRes();
    const next = vi.fn();

    validateOrigin(req, res, next as NextFunction);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: 'Forbidden',
      message: 'Requests must originate from localhost',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('allows valid host and origin', () => {
    const req = createReq({
      host: '127.0.0.1:3000',
      origin: 'http://127.0.0.1:3000',
    });
    const res = createRes();
    const next = vi.fn();

    validateOrigin(req, res, next as NextFunction);

    expect(res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
