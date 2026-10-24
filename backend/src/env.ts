import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';

// Railway injects variables directly; locally they come from backend/.env.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

const schema = z.object({
  APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  OTP_PEPPER: z.string().min(32, 'OTP_PEPPER must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().default('DUA Pilates & SPA <no-reply@dua-pilates.com>'),
  DEV_LOGIN_CODE: z.string().optional().default(''),
  RUN_WORKER: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  CORS_ORIGINS: z.string().optional().default(''),
  PAYMENT_PROVIDER: z.string().default('none'),
  PAYMENT_WEBHOOK_SECRET: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.APP_ENV === 'production';

if (isProd && !env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY is required in production: nobody could sign in without it.');
  process.exit(1);
}
if (isProd && env.DEV_LOGIN_CODE) {
  console.warn('DEV_LOGIN_CODE is ignored in production.');
}
