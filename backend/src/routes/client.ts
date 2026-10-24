import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { route, zDate, zIdParams } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { getSettings } from '../lib/settings.js';
import { studioDayRange, addMinutes } from '../lib/time.js';
import { personName, sessionInclude, sessionsForUser } from '../lib/dto.js';
import { acceptWaitlistOffer, bookClass, cancelBooking, freeCancelDeadline, joinWaitlist, leaveWaitlist } from '../services/booking.js';
import { usableCredits } from '../services/credits.js';
import { bookSpa, cancelSpa, spaAvailability } from '../services/spa.js';
import { cancelOrder, createOrder } from '../services/orders.js';

export async function clientRoutes(app: FastifyInstance) {
  // ─────────────── catalogue ───────────────

  route(app, { method: 'GET', url: '/class-types', access: 'user', summary: 'Pilates formats', tags: ['classes'] }, () =>
    prisma.classType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  );

  route(app, { method: 'GET', url: '/instructors', access: 'user', summary: 'Instructors, for filtering', tags: ['classes'] }, async () => {
    const rows = await prisma.staffProfile.findMany({ where: { active: true, isInstructor: true, user: { status: { in: ['ACTIVE', 'INVITED'] } } }, include: { user: { include: { profile: true } } } });
    return rows.map((r) => ({ id: r.userId, name: personName(r.user.profile, ''), bio: r.bio }));
  });

  route(
    app,
    {
      method: 'GET',
      url: '/sessions',
      access: 'user',
      summary: 'Classes between two studio dates, with places left and my booking',
      tags: ['classes'],
      query: z.object({
        from: zDate,
        to: zDate.optional(),
        format: z.string().optional(),
        classTypeId: z.uuid().optional(),
        instructorId: z.uuid().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).optional(),
        onlyAvailable: z.coerce.boolean().optional(),
      }),
    },
    async ({ user, query }) => {
      const from = studioDayRange(query.from).from;
      const to = studioDayRange(query.to ?? query.from).to;
      if (+to - +from > 45 * 86_400_000) throw E.badRequest('VALIDATION', 'At most 45 days at a time');
      const rows = await prisma.classSession.findMany({
        where: {
          startsAt: { gte: from, lt: to },
          status: { not: 'CANCELLED' },
          instructorId: query.instructorId,
          classTypeId: query.classTypeId,
          classType: { format: query.format, difficulty: query.difficulty },
        },
        include: sessionInclude,
        orderBy: { startsAt: 'asc' },
      });
      const list = await sessionsForUser(rows, user.id);
      return query.onlyAvailable ? list.filter((s) => s.available > 0) : list;
    },
  );

  route(app, { method: 'GET', url: '/sessions/:id', access: 'user', summary: 'One class, with what booking it would cost me', tags: ['classes'], params: zIdParams }, async ({ user, params }) => {
    const row = await prisma.classSession.findUnique({ where: { id: params.id }, include: sessionInclude });
    if (!row) throw E.notFound('Class');
    const [s] = await sessionsForUser([row], user.id);
    const settings = await getSettings();
    const credits = await usableCredits(prisma, user.id, row.startsAt);
    return {
      ...s,
      instructorBio: row.instructor?.bio ?? null,
      myCredits: credits,
      eligible: credits >= row.classType.creditsRequired,
      freeCancelUntil: freeCancelDeadline(row.startsAt, settings),
      lateCancelKeepsCredit: settings.lateCancelKeepsCredit,
      waitlistEnabled: settings.waitlistEnabled,
      bookable: row.status === 'SCHEDULED' && row.startsAt > addMinutes(new Date(), settings.bookingCutoffMin) && row.startsAt <= addMinutes(new Date(), settings.bookingWindowDays * 1440),
    };
  });

  // ─────────────── booking ───────────────

  route(
    app,
    { method: 'POST', url: '/sessions/:id/book', access: ['CLIENT'], summary: 'Book a place (send an Idempotency-Key header)', tags: ['classes'], params: zIdParams },
    async ({ user, params, idempotencyKey }) => bookClass(user.id, params.id, { actor: { id: user.id, role: 'CLIENT' }, idempotencyKey }),
  );

  route(app, { method: 'POST', url: '/sessions/:id/waitlist', access: ['CLIENT'], summary: 'Join the waiting list of a full class', tags: ['classes'], params: zIdParams }, ({ user, params }) =>
    joinWaitlist(user.id, params.id),
  );

  route(app, { method: 'DELETE', url: '/waitlist/:id', access: ['CLIENT'], summary: 'Leave the waiting list', tags: ['classes'], params: zIdParams }, ({ user, params }) =>
    leaveWaitlist(user.id, params.id),
  );

  route(app, { method: 'POST', url: '/waitlist/:id/accept', access: ['CLIENT'], summary: 'Take the place offered from the waiting list', tags: ['classes'], params: zIdParams }, ({ user, params, idempotencyKey }) =>
    acceptWaitlistOffer(user.id, params.id, idempotencyKey),
  );

  route(app, { method: 'POST', url: '/bookings/:id/cancel', access: ['CLIENT'], summary: 'Cancel my booking (policy decides the credit)', tags: ['classes'], params: zIdParams }, ({ user, params }) =>
    cancelBooking(params.id, { id: user.id, role: 'CLIENT' }),
  );

  route(
    app,
    {
      method: 'GET',
      url: '/me/bookings',
      access: ['CLIENT'],
      summary: 'My classes: upcoming, past, cancelled or waiting',
      tags: ['classes'],
      query: z.object({ scope: z.enum(['upcoming', 'past', 'cancelled', 'waitlist']).default('upcoming') }),
    },
    async ({ user, query }) => {
      const now = new Date();
      const settings = await getSettings();
      if (query.scope === 'waitlist') {
        const rows = await prisma.classWaitlist.findMany({
          where: { userId: user.id, status: { in: ['WAITING', 'OFFERED'] }, session: { startsAt: { gt: now } } },
          include: { session: { include: sessionInclude } },
          orderBy: { session: { startsAt: 'asc' } },
        });
        const sessions = await sessionsForUser(rows.map((r) => r.session), user.id);
        return rows.map((r, i) => ({ id: r.id, kind: 'waitlist', status: r.status, offerExpiresAt: r.offerExpiresAt, session: sessions[i] }));
      }
      const where: Prisma.ClassBookingWhereInput =
        query.scope === 'upcoming'
          ? { userId: user.id, status: 'BOOKED', session: { endsAt: { gt: now } } }
          : query.scope === 'past'
            ? { userId: user.id, status: 'BOOKED', session: { endsAt: { lte: now } } }
            : { userId: user.id, status: { in: ['CANCELLED', 'LATE_CANCELLED', 'SESSION_CANCELLED'] } };
      const rows = await prisma.classBooking.findMany({
        where,
        include: { session: { include: sessionInclude }, attendance: true },
        orderBy: { session: { startsAt: query.scope === 'upcoming' ? 'asc' : 'desc' } },
        take: 100,
      });
      const sessions = await sessionsForUser(rows.map((r) => r.session), user.id);
      return rows.map((r, i) => ({
        id: r.id,
        kind: 'booking',
        status: r.status,
        creditsUsed: r.creditsUsed,
        creditRefunded: r.creditRefunded,
        bookedAt: r.bookedAt,
        cancelledAt: r.cancelledAt,
        attendance: r.attendance?.status ?? null,
        freeCancelUntil: freeCancelDeadline(r.session.startsAt, settings),
        canCancel: r.status === 'BOOKED' && r.session.startsAt > now,
        session: sessions[i],
      }));
    },
  );

  // ─────────────── home ───────────────

  route(app, { method: 'GET', url: '/me/home', access: ['CLIENT'], summary: 'Everything the home screen shows, in one call', tags: ['me'] }, async ({ user }) => {
    const now = new Date();
    const [profile, nextBooking, nextSpa, purchases, featured, treatments, announcements, offers, pendingOrders] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: user.id } }),
      prisma.classBooking.findFirst({ where: { userId: user.id, status: 'BOOKED', session: { startsAt: { gt: now } } }, include: { session: { include: sessionInclude } }, orderBy: { session: { startsAt: 'asc' } } }),
      prisma.spaAppointment.findFirst({ where: { clientId: user.id, status: 'BOOKED', startsAt: { gt: now } }, include: { treatment: true, room: true, therapist: { include: { user: { include: { profile: true } } } } }, orderBy: { startsAt: 'asc' } }),
      prisma.membershipPurchase.findMany({ where: { userId: user.id, status: 'ACTIVE', expiresAt: { gt: now } }, include: { wallet: true, spaEntitlements: { include: { treatment: true } } }, orderBy: { expiresAt: 'asc' } }),
      prisma.classSession.findMany({ where: { startsAt: { gt: now, lt: addMinutes(now, 3 * 1440) }, status: 'SCHEDULED' }, include: sessionInclude, orderBy: { startsAt: 'asc' }, take: 6 }),
      prisma.spaTreatment.findMany({ where: { active: true }, orderBy: { price: 'asc' }, take: 6 }),
      prisma.announcement.findMany({ where: { active: true, kind: 'NEWS', startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { startsAt: 'desc' }, take: 3 }),
      prisma.announcement.findMany({ where: { active: true, kind: 'OFFER', startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { startsAt: 'desc' }, take: 3 }),
      prisma.order.count({ where: { userId: user.id, status: 'PENDING' } }),
    ]);
    const featuredDto = await sessionsForUser(featured, user.id);
    const nextDto = nextBooking ? (await sessionsForUser([nextBooking.session], user.id))[0] : null;
    const credits = purchases.reduce((s, p) => s + (p.wallet?.remaining ?? 0), 0);
    const active = purchases[0];
    return {
      firstName: profile?.firstName ?? '',
      nextClass: nextBooking ? { bookingId: nextBooking.id, session: nextDto } : null,
      nextSpa: nextSpa
        ? { id: nextSpa.id, startsAt: nextSpa.startsAt, endsAt: nextSpa.endsAt, treatment: { id: nextSpa.treatment.id, name: nextSpa.treatment.name, nameEn: nextSpa.treatment.nameEn, imageKey: nextSpa.treatment.imageKey }, room: nextSpa.room.name, therapist: personName(nextSpa.therapist.user.profile) }
        : null,
      membership: active
        ? {
            purchaseId: active.id,
            name: active.nameSnapshot,
            expiresAt: active.expiresAt,
            remainingCredits: credits,
            totalCredits: purchases.reduce((s, p) => s + (p.wallet?.total ?? 0), 0),
            spa: purchases.flatMap((p) => p.spaEntitlements.filter((e) => e.remaining > 0).map((e) => ({ name: e.treatment?.name ?? e.category ?? 'SPA', remaining: e.remaining }))),
          }
        : null,
      pendingOrders,
      featured: featuredDto.filter((s) => s.available > 0 && !s.myBookingId).slice(0, 4),
      treatments,
      announcements,
      offers,
    };
  });

  // ─────────────── memberships ───────────────

  route(app, { method: 'GET', url: '/products', access: 'user', summary: 'Packages for sale', tags: ['memberships'] }, () =>
    prisma.membershipProduct.findMany({ where: { active: true }, include: { spaItems: { include: { treatment: true } } }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] }),
  );

  route(
    app,
    {
      method: 'POST',
      url: '/promotions/check',
      access: ['CLIENT'],
      summary: 'Preview a promotion code on a package',
      tags: ['memberships'],
      body: z.object({ code: z.string().trim().min(1).max(40), productId: z.uuid() }),
    },
    async ({ body, user }) => {
      const promo = await prisma.promotionCode.findFirst({ where: { code: { equals: body.code, mode: 'insensitive' } }, include: { products: true } });
      const product = await prisma.membershipProduct.findUnique({ where: { id: body.productId } });
      if (!product) throw E.notFound('Package');
      const now = new Date();
      if (!promo || !promo.active || (promo.validFrom && promo.validFrom > now) || (promo.validUntil && promo.validUntil < now)) throw E.badRequest('PROMO_INVALID', 'This code is not valid');
      if (promo.maxRedemptions !== null && promo.redemptionCount >= promo.maxRedemptions) throw E.badRequest('PROMO_EXHAUSTED', 'This code has been used up');
      if (promo.products.length && !promo.products.some((p) => p.productId === product.id)) throw E.badRequest('PROMO_NOT_APPLICABLE', 'This code does not apply to this package');
      if (promo.firstTimeOnly && (await prisma.order.count({ where: { userId: user.id, status: { in: ['PAID', 'PENDING'] } } }))) throw E.badRequest('PROMO_FIRST_TIME', 'This code is for first-time clients');
      const discount = promo.discountType === 'PERCENT' ? Math.round((product.price * Math.min(promo.discountValue, 100)) / 100) : Math.min(promo.discountValue, product.price);
      return { code: promo.code, description: promo.description, subtotal: product.price, discount, total: product.price - discount };
    },
  );

  route(
    app,
    {
      method: 'POST',
      url: '/orders',
      access: ['CLIENT'],
      summary: 'Order a package. Paid at the studio unless an online provider is configured.',
      tags: ['memberships'],
      body: z.object({ productId: z.uuid(), promoCode: z.string().trim().max(40).optional() }),
    },
    ({ user, body, idempotencyKey }) => createOrder({ userId: user.id, productId: body.productId, promoCode: body.promoCode || undefined, actorId: user.id, idempotencyKey }),
  );

  route(app, { method: 'POST', url: '/orders/:id/cancel', access: ['CLIENT'], summary: 'Cancel an unpaid order', tags: ['memberships'], params: zIdParams }, ({ user, params }) =>
    cancelOrder(params.id, { id: user.id, role: 'CLIENT' }),
  );

  route(app, { method: 'GET', url: '/me/memberships', access: ['CLIENT'], summary: 'My packages, credits and orders', tags: ['memberships'] }, async ({ user }) => {
    const now = new Date();
    const purchases = await prisma.membershipPurchase.findMany({
      where: { userId: user.id, status: { not: 'CANCELLED' } },
      include: { wallet: true, spaEntitlements: { include: { treatment: true } }, order: { include: { payments: true } }, product: { select: { kind: true, imageKey: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const active = purchases.filter((p) => p.status === 'ACTIVE' && p.expiresAt && p.expiresAt > now);
    return {
      summary: {
        remainingCredits: active.reduce((s, p) => s + (p.wallet?.remaining ?? 0), 0),
        totalCredits: active.reduce((s, p) => s + (p.wallet?.total ?? 0), 0),
        usedCredits: active.reduce((s, p) => s + ((p.wallet?.total ?? 0) - (p.wallet?.remaining ?? 0)), 0),
        nextExpiry: active[0] ? active.map((p) => p.expiresAt!).sort((a, b) => +a - +b)[0] : null,
      },
      purchases: purchases.map((p) => ({
        id: p.id,
        name: p.nameSnapshot,
        kind: p.product.kind,
        imageKey: p.product.imageKey,
        status: p.status === 'ACTIVE' && p.expiresAt && p.expiresAt <= now ? 'EXPIRED' : p.status,
        price: p.priceSnapshot,
        terms: p.termsSnapshot,
        startsAt: p.startsAt,
        expiresAt: p.expiresAt,
        createdAt: p.createdAt,
        credits: p.wallet ? { total: p.wallet.total, remaining: p.wallet.remaining } : null,
        spa: p.spaEntitlements.map((e) => ({ id: e.id, name: e.treatment?.name ?? e.category ?? 'SPA', total: e.total, remaining: e.remaining })),
        order: p.order ? { id: p.order.id, reference: p.order.reference, status: p.order.status, total: p.order.total, discount: p.order.discount } : null,
      })),
    };
  });

  route(app, { method: 'GET', url: '/me/credit-transactions', access: ['CLIENT'], summary: 'Every credit change on my account', tags: ['memberships'] }, async ({ user }) =>
    prisma.creditTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 200 }),
  );

  route(app, { method: 'GET', url: '/announcements', access: 'user', summary: 'Studio news and offers', tags: ['public'] }, () => {
    const now = new Date();
    return prisma.announcement.findMany({ where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { startsAt: 'desc' } });
  });

  // ─────────────── SPA ───────────────

  route(
    app,
    { method: 'GET', url: '/spa/treatments', access: 'user', summary: 'SPA treatments', tags: ['spa'], query: z.object({ category: z.string().optional() }) },
    ({ query }) => prisma.spaTreatment.findMany({ where: { active: true, category: query.category }, orderBy: [{ category: 'asc' }, { durationMin: 'asc' }] }),
  );

  route(app, { method: 'GET', url: '/spa/treatments/:id', access: 'user', summary: 'One treatment, with who can perform it', tags: ['spa'], params: zIdParams }, async ({ params }) => {
    const t = await prisma.spaTreatment.findUnique({
      where: { id: params.id },
      include: { qualifications: { where: { therapist: { active: true } }, include: { therapist: { include: { user: { include: { profile: true } } } } } } },
    });
    if (!t || !t.active) throw E.notFound('Treatment');
    const { qualifications, ...rest } = t;
    return { ...rest, therapists: t.clientCanChooseTherapist ? qualifications.map((q) => ({ id: q.therapistId, name: personName(q.therapist.user.profile) })) : [] };
  });

  route(
    app,
    {
      method: 'GET',
      url: '/spa/availability',
      access: 'user',
      summary: 'Free start times for a treatment on a day',
      tags: ['spa'],
      query: z.object({ treatmentId: z.uuid(), date: zDate, therapistId: z.uuid().optional() }),
    },
    ({ query }) => spaAvailability(prisma, query),
  );

  route(
    app,
    {
      method: 'POST',
      url: '/spa/appointments',
      access: ['CLIENT'],
      summary: 'Book a SPA appointment (uses an included treatment from a package when there is one)',
      tags: ['spa'],
      body: z.object({ treatmentId: z.uuid(), startsAt: z.iso.datetime(), therapistId: z.uuid().optional() }),
    },
    ({ user, body, idempotencyKey }) =>
      bookSpa({ clientId: user.id, treatmentId: body.treatmentId, startsAt: new Date(body.startsAt), therapistId: body.therapistId, actor: { id: user.id, role: 'CLIENT' }, idempotencyKey }),
  );

  route(app, { method: 'POST', url: '/spa/appointments/:id/cancel', access: ['CLIENT'], summary: 'Cancel my SPA appointment', tags: ['spa'], params: zIdParams }, ({ user, params }) =>
    cancelSpa(params.id, { id: user.id, role: 'CLIENT' }),
  );

  route(
    app,
    { method: 'GET', url: '/me/spa-appointments', access: ['CLIENT'], summary: 'My SPA appointments', tags: ['spa'], query: z.object({ scope: z.enum(['upcoming', 'past']).default('upcoming') }) },
    async ({ user, query }) => {
      const now = new Date();
      const settings = await getSettings();
      const rows = await prisma.spaAppointment.findMany({
        where: query.scope === 'upcoming' ? { clientId: user.id, status: 'BOOKED', startsAt: { gt: now } } : { clientId: user.id, OR: [{ startsAt: { lte: now } }, { status: { not: 'BOOKED' } }] },
        include: { treatment: true, room: true, therapist: { include: { user: { include: { profile: true } } } } },
        orderBy: { startsAt: query.scope === 'upcoming' ? 'asc' : 'desc' },
        take: 100,
      });
      return rows.map((a) => ({
        id: a.id,
        status: a.status,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        price: a.price,
        paidWith: a.paidWith,
        treatment: { id: a.treatment.id, name: a.treatment.name, nameEn: a.treatment.nameEn, durationMin: a.treatment.durationMin, imageKey: a.treatment.imageKey },
        therapist: personName(a.therapist.user.profile),
        room: a.room.name,
        freeCancelUntil: addMinutes(a.startsAt, -settings.spaFreeCancelHours * 60),
        canCancel: a.status === 'BOOKED' && a.startsAt > now,
      }));
    },
  );
}
