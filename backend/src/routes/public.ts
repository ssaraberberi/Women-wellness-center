import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { route, zDate, zIdParams } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { studioDayRange } from '../lib/time.js';
import { sessionInclude, sessionsForUser } from '../lib/dto.js';
import { zPhone } from '../lib/phone.js';
import { singleClassProduct } from '../services/booking.js';
import { cancelByToken, confirmGuestBooking, requestGuestCode, viewByToken } from '../services/guest.js';
import { publicCatalogue } from '../services/offers.js';

/**
 * What anyone may see and do without signing in: the timetable with places
 * left and the single-class price, and booking a class with a verified email.
 * The website's /book and the app share these, so both follow the same rules.
 */
export async function publicRoutes(app: FastifyInstance) {
  const meta = (req: { ip: string; headers: Record<string, unknown> }) => ({ ip: req.ip, userAgent: String(req.headers['user-agent'] ?? '') });
  const tight = { max: 10, timeWindow: '1 minute' };
  const singlePrice = () => singleClassProduct(prisma).then((p) => p.price, () => null);
  // The same shape the app's timetable already reads, minus anything about a person.
  const strip = <T extends { myBookingId: unknown; myWaitlist: unknown }>({ myBookingId: _b, myWaitlist: _w, ...s }: T) => s;

  route(
    app,
    {
      method: 'GET',
      url: '/public/sessions',
      access: 'public',
      summary: 'Classes between two studio dates, with places left and the single-class price (null: online booking is off)',
      tags: ['public'],
      query: z.object({ from: zDate, to: zDate.optional() }),
    },
    async ({ query }) => {
      const from = studioDayRange(query.from).from;
      const to = studioDayRange(query.to ?? query.from).to;
      if (+to - +from > 45 * 86_400_000) throw E.badRequest('VALIDATION', 'At most 45 days at a time');
      const rows = await prisma.classSession.findMany({ where: { startsAt: { gte: from, lt: to }, status: { not: 'CANCELLED' } }, include: sessionInclude, orderBy: { startsAt: 'asc' } });
      return { singlePrice: await singlePrice(), sessions: (await sessionsForUser(rows)).map(strip) };
    },
  );

  route(app, { method: 'GET', url: '/public/catalogue', access: 'public', summary: 'Packages for sale and the offers live today (DUO, discounts, bonuses)', tags: ['public'] }, () =>
    publicCatalogue(),
  );

  route(app, { method: 'GET', url: '/public/sessions/:id', access: 'public', summary: 'One class, for the booking page', tags: ['public'], params: zIdParams }, async ({ params }) => {
    const row = await prisma.classSession.findUnique({ where: { id: params.id }, include: sessionInclude });
    if (!row) throw E.notFound('Class');
    const [s] = await sessionsForUser([row]);
    return { singlePrice: await singlePrice(), session: strip(s) };
  });

  route(
    app,
    {
      method: 'POST',
      url: '/public/guest-bookings/code',
      access: 'public',
      summary: 'Email a code to confirm a booking without an account (checks the class is open first)',
      tags: ['public'],
      rateLimit: tight,
      body: z.object({ sessionId: z.uuid(), email: z.email().max(200), lang: z.enum(['sq', 'en']).default('sq') }),
    },
    ({ body, req }) => requestGuestCode(body, req.ip),
  );

  route(
    app,
    {
      method: 'POST',
      url: '/public/guest-bookings',
      access: 'public',
      summary: 'Confirm a booking with the emailed code. Signs her in; books a single class (paid at the studio) unless she has a package. Send an Idempotency-Key.',
      tags: ['public'],
      rateLimit: tight,
      body: z.object({
        sessionId: z.uuid(),
        email: z.email().max(200),
        code: z.string().regex(/^\d{6}$/),
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().min(1).max(60),
        phone: zPhone,
        lang: z.enum(['sq', 'en']).default('sq'),
        platform: z.enum(['WEB', 'APP']).default('WEB'),
      }),
    },
    ({ body, req, idempotencyKey }) => confirmGuestBooking(body, { idempotencyKey, meta: meta(req) }),
  );

  // The private link travels in the body, never in a URL the server would log.
  const zToken = z.object({ token: z.string().min(20).max(100) });
  route(app, { method: 'POST', url: '/public/bookings/manage', access: 'public', summary: 'One booking, read with its private link', tags: ['public'], rateLimit: tight, body: zToken }, ({ body }) =>
    viewByToken(body.token),
  );
  route(app, { method: 'POST', url: '/public/bookings/manage/cancel', access: 'public', summary: 'Cancel with the private link (free until the deadline, then the class is due)', tags: ['public'], rateLimit: tight, body: zToken }, ({ body }) =>
    cancelByToken(body.token),
  );
}
