import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { route } from '../lib/http.js';
import { completeRegistration, requestOtp, verifyOtp } from '../services/auth.js';
import { revokeRefreshToken, rotateRefreshToken } from '../services/tokens.js';
import { getSettings } from '../lib/settings.js';
import { prisma } from '../lib/prisma.js';

export async function authRoutes(app: FastifyInstance) {
  const meta = (req: { ip: string; headers: Record<string, unknown> }) => ({ ip: req.ip, userAgent: String(req.headers['user-agent'] ?? '') });
  const tight = { max: 10, timeWindow: '1 minute' };

  route(
    app,
    {
      method: 'POST',
      url: '/auth/otp/request',
      access: 'public',
      summary: 'Email a 6-digit sign-in code (same answer for new and existing addresses)',
      tags: ['auth'],
      rateLimit: tight,
      body: z.object({ email: z.email().max(200), lang: z.enum(['sq', 'en']).default('sq') }),
    },
    ({ body, req }) => requestOtp(body.email, body.lang, req.ip),
  );

  route(
    app,
    {
      method: 'POST',
      url: '/auth/otp/verify',
      access: 'public',
      summary: 'Exchange the code for a session, or for a registration token if the address is new',
      tags: ['auth'],
      rateLimit: tight,
      body: z.object({ email: z.email().max(200), code: z.string().regex(/^\d{6}$/) }),
    },
    ({ body, req }) => verifyOtp(body.email, body.code, meta(req)),
  );

  route(
    app,
    {
      method: 'POST',
      url: '/auth/register',
      access: 'public',
      summary: 'Finish registration after the email is verified. Always creates a client.',
      tags: ['auth'],
      rateLimit: tight,
      body: z.object({
        registrationToken: z.string().min(10),
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().max(60).default(''),
        phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
        language: z.enum(['sq', 'en']).default('sq'),
        marketingConsent: z.boolean().default(false),
      }),
    },
    async ({ body, req }) => {
      const { registrationToken, ...profile } = body;
      return { status: 'signed_in', ...(await completeRegistration(registrationToken, profile, meta(req))) };
    },
  );

  route(
    app,
    {
      method: 'POST',
      url: '/auth/refresh',
      access: 'public',
      summary: 'Rotate the refresh token (each works once)',
      tags: ['auth'],
      rateLimit: { max: 30, timeWindow: '1 minute' },
      body: z.object({ refreshToken: z.string().min(20) }),
    },
    ({ body, req }) => rotateRefreshToken(body.refreshToken, meta(req)),
  );

  route(
    app,
    {
      method: 'POST',
      url: '/auth/logout',
      access: 'public',
      summary: 'End this sign-in',
      tags: ['auth'],
      body: z.object({ refreshToken: z.string().min(20) }),
    },
    async ({ body }) => {
      await revokeRefreshToken(body.refreshToken);
      return { ok: true };
    },
  );

  route(app, { method: 'GET', url: '/public/studio', access: 'public', summary: 'Studio details, hours and policies', tags: ['public'] }, async () => {
    const s = await getSettings();
    return {
      name: s.studioName,
      address: s.address,
      phone: s.phone,
      instagram: s.instagram,
      timezone: s.timezone,
      currency: s.currency,
      openingHours: s.openingHours,
      policies: {
        freeCancelHours: s.freeCancelHours,
        lateCancelKeepsCredit: s.lateCancelKeepsCredit,
        bookingWindowDays: s.bookingWindowDays,
        spaFreeCancelHours: s.spaFreeCancelHours,
        waitlistEnabled: s.waitlistEnabled,
        waitlistOfferMinutes: s.waitlistOfferMinutes,
      },
    };
  });

  route(app, { method: 'GET', url: '/health', access: 'public', summary: 'Liveness and database reachability', tags: ['public'] }, async ({ reply }) => {
    try {
      await prisma.$queryRaw`select 1`;
      return { ok: true, db: true, time: new Date().toISOString() };
    } catch {
      reply.code(503);
      return { ok: false, db: false };
    }
  });
}
