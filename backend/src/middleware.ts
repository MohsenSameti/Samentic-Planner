import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Error type for expected API failures (validation, not-found, etc.).
 *
 * Route handlers `throw new ApiError(...)` to surface a specific status
 * code to clients. Anything reaching `errorHandler` that isn't an
 * `ApiError` is treated as an unexpected server error and reported
 * with status 500 (hiding the underlying message in production).
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly details: unknown;

  constructor(message: string, status: number = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Express error-handling middleware. Express invokes this with 4 args,
 * so the `next` parameter is required by the framework even though we
 * never call it from inside this function.
 *
 * Order of checks (most-specific first):
 *   1. `ApiError` — explicit failures thrown by route handlers.
 *   2. `ZodError` — schema validation failures from `parse()`.
 *   3. JWT errors — placeholder for when auth is added later.
 *   4. Anything else — generic 500 with the message kept in development.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Always log the full error server-side for debugging, even when we
  // sanitize the message in the response.
  console.error('[error]', err);

  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues,
    });
    return;
  }

  // JWT errors aren't currently produced by the app (no auth yet), but
  // wiring the case here means adding auth later doesn't require
  // touching the error pipeline.
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  // Malformed JSON in the request body — `express.json()` throws a
  // SyntaxError with `type === 'entity.parse.failed'` before our route
  // handlers ever run. Map it to a clean 400 instead of a generic 500.
  if (
    err instanceof SyntaxError &&
    (err as SyntaxError & { type?: string }).type === 'entity.parse.failed'
  ) {
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }

  // Unknown errors: hide details in production to avoid leaking stack
  // traces / internal paths to clients.
  res.status(500).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message,
  });
}

/**
 * Catch-all 404 for unmatched routes. Registered after the API router
 * so any request that falls through `/api/*` hits this handler.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not Found' });
}
