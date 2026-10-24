/**
 * Every refusal the API can give has a stable code. The app translates the
 * code; the message is English for logs and API consumers.
 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const E = {
  badRequest: (code: string, msg: string, details?: unknown) => new AppError(400, code, msg, details),
  unauthorized: (msg = 'Sign in again') => new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'Not allowed') => new AppError(403, 'FORBIDDEN', msg),
  notFound: (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`),
  conflict: (code: string, msg: string, details?: unknown) => new AppError(409, code, msg, details),
  tooMany: (msg = 'Too many attempts, try again later') => new AppError(429, 'RATE_LIMITED', msg),
};
