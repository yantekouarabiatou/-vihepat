import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not catch rejected promises from async route handlers —
 * an unhandled rejection just hangs the request instead of reaching
 * errorHandler. Wrap every async controller with this before registering it.
 */
export function catchAsync(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
