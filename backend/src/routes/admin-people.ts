import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { route, zDate, zIdParams, zTime } from '../lib/http.js';
import { prisma, transaction } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { audit } from '../lib/settings.js';
import { studioDayRange } from '../lib/time.js';
import { personName, userSummary } from '../lib/dto.js';
import { notify } from '../services/notify.js';
import { normalizeEmail } from '../services/auth.js';
import { revokeAllSessions } from '../services/tokens.js';
import { adjustWallet } from '../services/credits.js';
import { createOrder, recordManualPayment } from '../services/orders.js';

const ADMIN = ['ADMIN'] as const;
const zPhone = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/);

export async function adminPeopleRoutes(app: FastifyInstance) {
  // ─────────────── staff ───────────────
  route(app, { method: 'GET', url: '/admin/staff', access: [...ADMIN], summary: 'Instructors, therapists and admins', tags: ['admin-staff'] }, async () => {
    const rows = await prisma.user.findMany({
      where: { role: { in: ['STAFF', 'ADMIN'] }, status: { not: 'DELETED' } },
      include: { profile: true, staffProfile: { include: { qualifications: { include: { treatment: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((u) => ({
      ...userSummary(u),
      status: u.status,
      isOwner: u.isOwner,
      staff: u.staffProfile
        ? {
            isInstructor: u.staffProfile.isInstructor,
            isTherapist: u.staffProfile.isTherapist,
            active: u.staffProfile.active,
            bio: u.staffProfile.bio,
            compensationModel: u.staffProfile.compensationModel,
            compensationRate: u.staffProfile.compensationRate,
            canViewClientNotes: u.staffProfile.canViewClientNotes,
            qualifications: u.staffProfile.qualifications.map((q) => ({ id: q.treatmentId, name: q.treatment.name })),
          }
        : null,
    }));
  });

  const staffFields = z.object({
    isInstructor: z.boolean().default(false),
    isTherapist: z.boolean().default(false),
    bio: z.string().max(1000).nullish(),
    compensationModel: z.enum(['FIXED_SALARY', 'HOURLY', 'PER_CLASS']).default('PER_CLASS'),
    compensationRate: z.number().int().min(0).max(10_000_000).default(0),
    canViewClientNotes: z.boolean().default(false),
  });

  route(
    app,
    {
      method: 'POST',
      url: '/admin/staff/invite',
      access: [...ADMIN],
      summary: 'Invite a staff member or another admin by email. Only owners may create admins.',
      tags: ['admin-staff'],
      body: staffFields.extend({
        email: z.email(),
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().max(60).default(''),
        phone: zPhone.optional(),
        role: z.enum(['STAFF', 'ADMIN']),
        isOwner: z.boolean().default(false),
      }),
    },
    async ({ body, user, req }) => {
      if ((body.role === 'ADMIN' || body.isOwner) && !user.isOwner) throw E.forbidden('Only an owner can add administrators');
      const email = normalizeEmail(body.email);
      const staffData = {
        isInstructor: body.isInstructor,
        isTherapist: body.isTherapist,
        bio: body.bio,
        compensationModel: body.compensationModel,
        compensationRate: body.compensationRate,
        canViewClientNotes: body.canViewClientNotes,
      };
      const needsStaffProfile = body.role === 'STAFF' || body.isInstructor || body.isTherapist;
      const result = await transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing && existing.role !== 'CLIENT') throw E.conflict('ALREADY_STAFF', 'This person is already on the team');
        const u = existing
          ? await tx.user.update({ where: { id: existing.id }, data: { role: body.role, isOwner: body.isOwner } })
          : await tx.user.create({
              data: {
                email,
                role: body.role,
                status: 'INVITED',
                isOwner: body.isOwner,
                profile: { create: { firstName: body.firstName, lastName: body.lastName, phone: body.phone } },
                notificationPrefs: { create: {} },
              },
            });
        if (needsStaffProfile) {
          await tx.staffProfile.upsert({ where: { userId: u.id }, update: staffData, create: { userId: u.id, ...staffData } });
        }
        const inviter = await tx.userProfile.findUnique({ where: { userId: user.id } });
        await notify(tx, {
          userId: u.id,
          type: 'STAFF_INVITE',
          dedupeKey: `invite:${u.id}:${body.role}`,
          params: { inviter: personName(inviter, 'DUA'), roleName: body.role === 'ADMIN' ? 'admin' : body.isTherapist ? 'therapist' : 'instructor', email },
        });
        await audit(tx, user.id, 'staff.invite', 'user', u.id, { email, role: body.role, isOwner: body.isOwner }, req.ip);
        return u;
      });
      if (result.role !== 'CLIENT') await revokeAllSessions(result.id); // a promoted client signs in again with the new role
      return { id: result.id };
    },
  );

  route(
    app,
    {
      method: 'PATCH',
      url: '/admin/staff/:id',
      access: [...ADMIN],
      summary: 'Edit a team member, or deactivate them',
      tags: ['admin-staff'],
      params: zIdParams,
      body: staffFields.partial().extend({
        firstName: z.string().trim().min(1).max(60).optional(),
        lastName: z.string().trim().max(60).optional(),
        phone: zPhone.optional(),
        active: z.boolean().optional(),
        isOwner: z.boolean().optional(),
      }),
    },
    async ({ params, body, user, req }) => {
      const target = await prisma.user.findUnique({ where: { id: params.id } });
      if (!target || target.role === 'CLIENT') throw E.notFound('Team member');
      if (body.isOwner !== undefined && !user.isOwner) throw E.forbidden('Only an owner can change ownership');
      if (target.isOwner && !user.isOwner) throw E.forbidden('Only an owner can edit an owner');
      if (body.isOwner === false && target.isOwner) {
        const owners = await prisma.user.count({ where: { isOwner: true, status: { not: 'DELETED' } } });
        if (owners <= 1) throw E.conflict('LAST_OWNER', 'The studio must keep at least one owner');
      }
      const { firstName, lastName, phone, active, isOwner, ...staff } = body;
      await transaction(async (tx) => {
        if (firstName || lastName !== undefined || phone) {
          await tx.userProfile.update({ where: { userId: target.id }, data: { firstName, lastName, phone } });
        }
        if (Object.keys(staff).length || active !== undefined) {
          await tx.staffProfile.upsert({ where: { userId: target.id }, update: { ...staff, active }, create: { userId: target.id, ...staff, active: active ?? true } });
        }
        if (isOwner !== undefined) await tx.user.update({ where: { id: target.id }, data: { isOwner } });
        if (active === false) await tx.user.update({ where: { id: target.id }, data: { status: 'DISABLED' } });
        if (active === true && target.status === 'DISABLED') await tx.user.update({ where: { id: target.id }, data: { status: 'ACTIVE' } });
        await audit(tx, user.id, 'staff.update', 'user', target.id, body as Prisma.InputJsonValue, req.ip);
      });
      if (active === false) await revokeAllSessions(target.id);
      return { ok: true };
    },
  );

  route(
    app,
    { method: 'PUT', url: '/admin/staff/:id/qualifications', access: [...ADMIN], summary: 'Which treatments a therapist may perform', tags: ['admin-staff'], params: zIdParams, body: z.object({ treatmentIds: z.array(z.uuid()) }) },
    async ({ params, body, user }) => {
      await transaction(async (tx) => {
        await tx.therapistQualification.deleteMany({ where: { therapistId: params.id } });
        await tx.therapistQualification.createMany({ data: body.treatmentIds.map((treatmentId) => ({ therapistId: params.id, treatmentId })) });
        await audit(tx, user.id, 'staff.qualifications', 'user', params.id, body);
      });
      return { ok: true };
    },
  );

  route(
    app,
    {
      method: 'PUT',
      url: '/admin/staff/:id/hours',
      access: [...ADMIN],
      summary: "Replace a therapist's weekly working hours (existing appointments are not moved)",
      tags: ['admin-staff'],
      params: zIdParams,
      body: z.object({
        hours: z.array(z.object({ weekday: z.number().int().min(1).max(7), startTime: zTime, endTime: zTime, breakStart: zTime.nullish(), breakEnd: zTime.nullish() })).max(21),
      }),
    },
    async ({ params, body, user }) => {
      for (const h of body.hours) if (h.endTime <= h.startTime) throw E.badRequest('VALIDATION', 'Each end time must be after its start');
      await transaction(async (tx) => {
        await tx.therapistAvailability.deleteMany({ where: { therapistId: params.id } });
        await tx.therapistAvailability.createMany({ data: body.hours.map((h) => ({ ...h, therapistId: params.id })) });
        await audit(tx, user.id, 'staff.hours', 'user', params.id, body);
      });
      return { ok: true };
    },
  );

  route(app, { method: 'GET', url: '/admin/staff/:id', access: [...ADMIN], summary: 'A team member: hours, preferences, upcoming work, attendance', tags: ['admin-staff'], params: zIdParams }, async ({ params }) => {
    const u = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        profile: true,
        staffProfile: {
          include: {
            therapistAvailability: { orderBy: [{ weekday: 'asc' }] },
            staffAvailability: { orderBy: [{ weekday: 'asc' }] },
            qualifications: { include: { treatment: true } },
            timeOff: { orderBy: { createdAt: 'desc' }, take: 20 },
            sessions: { where: { startsAt: { gt: new Date() }, status: 'SCHEDULED' }, include: { classType: true, _count: { select: { bookings: { where: { status: 'BOOKED' } } } } }, orderBy: { startsAt: 'asc' }, take: 30 },
            appointments: { where: { startsAt: { gt: new Date() }, status: 'BOOKED' }, include: { treatment: true }, orderBy: { startsAt: 'asc' }, take: 30 },
          },
        },
      },
    });
    if (!u || u.role === 'CLIENT') throw E.notFound('Team member');
    const attendance = await prisma.classAttendance.groupBy({ by: ['status'], where: { booking: { session: { instructorId: u.id } } }, _count: true });
    return { ...userSummary(u), status: u.status, isOwner: u.isOwner, staff: u.staffProfile, attendance };
  });

  route(
    app,
    { method: 'GET', url: '/admin/payroll', access: [...ADMIN], summary: 'Estimated pay per team member for a period (an estimate — nothing is paid from here)', tags: ['admin-staff'], query: z.object({ from: zDate, to: zDate }) },
    async ({ query }) => {
      const from = studioDayRange(query.from).from;
      const to = studioDayRange(query.to).to;
      const days = (+to - +from) / 86_400_000;
      const staff = await prisma.staffProfile.findMany({
        include: {
          user: { include: { profile: true } },
          sessions: { where: { startsAt: { gte: from, lt: to }, status: { not: 'CANCELLED' }, endsAt: { lte: new Date() } }, select: { startsAt: true, endsAt: true } },
          appointments: { where: { startsAt: { gte: from, lt: to }, status: 'COMPLETED' }, select: { startsAt: true, endsAt: true } },
        },
      });
      return staff.map((s) => {
        const minutes = [...s.sessions, ...s.appointments].reduce((m, x) => m + (+x.endsAt - +x.startsAt) / 60_000, 0);
        const count = s.sessions.length + s.appointments.length;
        const estimate =
          s.compensationModel === 'PER_CLASS'
            ? count * s.compensationRate
            : s.compensationModel === 'HOURLY'
              ? Math.round((minutes / 60) * s.compensationRate)
              : Math.round((s.compensationRate * days) / 30);
        return {
          id: s.userId,
          name: personName(s.user.profile, s.user.email),
          model: s.compensationModel,
          rate: s.compensationRate,
          classes: s.sessions.length,
          appointments: s.appointments.length,
          hours: Math.round((minutes / 60) * 10) / 10,
          estimate,
        };
      });
    },
  );

  route(
    app,
    { method: 'GET', url: '/admin/staff-requests', access: [...ADMIN], summary: 'Time off, conflicts and availability changes', tags: ['admin-staff'], query: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() }) },
    async ({ query }) => {
      const rows = await prisma.timeOffRequest.findMany({ where: { status: query.status }, include: { staff: { include: { user: { include: { profile: true } } } } }, orderBy: { createdAt: 'desc' }, take: 100 });
      return Promise.all(
        rows.map(async (r) => ({
          ...r,
          staffName: personName(r.staff.user.profile),
          // What an approval would collide with.
          affectedSessions: await prisma.classSession.count({ where: { instructorId: r.staffId, status: 'SCHEDULED', startsAt: { lt: r.endsAt }, endsAt: { gt: r.startsAt } } }),
          affectedAppointments: await prisma.spaAppointment.count({ where: { therapistId: r.staffId, status: 'BOOKED', startsAt: { lt: r.endsAt }, endsAt: { gt: r.startsAt } } }),
        })),
      );
    },
  );

  route(
    app,
    { method: 'POST', url: '/admin/staff-requests/:id/review', access: [...ADMIN], summary: 'Approve or reject. Approving does not move bookings — reassign them first.', tags: ['admin-staff'], params: zIdParams, body: z.object({ approve: z.boolean(), note: z.string().max(500).optional() }) },
    async ({ params, body, user }) => {
      const r = await prisma.timeOffRequest.findUnique({ where: { id: params.id } });
      if (!r) throw E.notFound('Request');
      if (r.status !== 'PENDING') throw E.conflict('ALREADY_REVIEWED', 'This request was already reviewed');
      if (body.approve && r.kind === 'TIME_OFF') {
        const clash = await prisma.classSession.count({ where: { instructorId: r.staffId, status: 'SCHEDULED', startsAt: { lt: r.endsAt }, endsAt: { gt: r.startsAt } } });
        const clashSpa = await prisma.spaAppointment.count({ where: { therapistId: r.staffId, status: 'BOOKED', startsAt: { lt: r.endsAt }, endsAt: { gt: r.startsAt } } });
        if (clash || clashSpa) throw E.conflict('HAS_BOOKINGS', `Reassign or cancel ${clash} classes and ${clashSpa} appointments first`, { clash, clashSpa });
      }
      const updated = await prisma.timeOffRequest.update({ where: { id: r.id }, data: { status: body.approve ? 'APPROVED' : 'REJECTED', reviewedById: user.id, reviewedAt: new Date(), reviewNote: body.note } });
      await notify(prisma, {
        userId: r.staffId,
        type: 'STAFF_REQUEST_REVIEWED',
        dedupeKey: `review:${r.id}`,
        params: { approved: body.approve ? 1 : undefined, summary: body.note ?? '' },
        data: { kind: 'staff-request', requestId: r.id },
      });
      await audit(prisma, user.id, 'staff_request.review', 'time_off_request', r.id, body);
      return updated;
    },
  );

  // ─────────────── clients ───────────────
  route(
    app,
    { method: 'GET', url: '/admin/clients', access: [...ADMIN], summary: 'Search clients by name, email or phone', tags: ['admin-clients'], query: z.object({ q: z.string().max(100).optional(), limit: z.coerce.number().min(1).max(200).default(50) }) },
    async ({ query }) => {
      const q = query.q?.trim();
      const rows = await prisma.user.findMany({
        where: {
          role: 'CLIENT',
          status: { not: 'DELETED' },
          ...(q
            ? {
                OR: [
                  { email: { contains: q, mode: 'insensitive' } },
                  { profile: { firstName: { contains: q, mode: 'insensitive' } } },
                  { profile: { lastName: { contains: q, mode: 'insensitive' } } },
                  { profile: { phone: { contains: q.replace(/\s/g, '') } } },
                ],
              }
            : {}),
        },
        include: { profile: true, wallets: { where: { expiresAt: { gt: new Date() }, purchase: { status: 'ACTIVE' } } } },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
      });
      return rows.map((u) => ({ ...userSummary(u), status: u.status, createdAt: u.createdAt, remainingCredits: u.wallets.reduce((s, w) => s + w.remaining, 0), hasActiveMembership: u.wallets.length > 0 }));
    },
  );

  route(
    app,
    {
      method: 'POST',
      url: '/admin/clients',
      access: [...ADMIN],
      summary: 'Add a client at the desk (she signs in later with her email)',
      tags: ['admin-clients'],
      body: z.object({ email: z.email(), firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().max(60).default(''), phone: zPhone, language: z.enum(['sq', 'en']).default('sq') }),
    },
    async ({ body, user }) => {
      const email = normalizeEmail(body.email);
      if (await prisma.user.findUnique({ where: { email } })) throw E.conflict('EMAIL_TAKEN', 'There is already an account with this email');
      const u = await prisma.user.create({
        data: { email, role: 'CLIENT', profile: { create: { firstName: body.firstName, lastName: body.lastName, phone: body.phone, language: body.language } }, notificationPrefs: { create: {} } },
      });
      await audit(prisma, user.id, 'client.create', 'user', u.id, { email });
      return { id: u.id };
    },
  );

  route(app, { method: 'GET', url: '/admin/clients/:id', access: [...ADMIN], summary: 'Everything about one client', tags: ['admin-clients'], params: zIdParams }, async ({ params }) => {
    const u = await prisma.user.findUnique({ where: { id: params.id }, include: { profile: true, notificationPrefs: true } });
    if (!u || u.role !== 'CLIENT') throw E.notFound('Client');
    const now = new Date();
    const [purchases, bookings, spa, orders, notes, transactions] = await Promise.all([
      prisma.membershipPurchase.findMany({ where: { userId: u.id }, include: { wallet: true, spaEntitlements: { include: { treatment: true } }, order: true }, orderBy: { createdAt: 'desc' } }),
      prisma.classBooking.findMany({ where: { userId: u.id }, include: { session: { include: { classType: true } }, attendance: true }, orderBy: { session: { startsAt: 'desc' } }, take: 50 }),
      prisma.spaAppointment.findMany({ where: { clientId: u.id }, include: { treatment: true, therapist: { include: { user: { include: { profile: true } } } } }, orderBy: { startsAt: 'desc' }, take: 50 }),
      prisma.order.findMany({ where: { userId: u.id }, include: { payments: true, purchase: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.clientNote.findMany({ where: { clientId: u.id }, orderBy: { createdAt: 'desc' } }),
      prisma.creditTransaction.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const active = purchases.filter((p) => p.status === 'ACTIVE' && p.expiresAt && p.expiresAt > now);
    return {
      ...userSummary(u),
      status: u.status,
      createdAt: u.createdAt,
      language: u.profile?.language,
      marketingConsent: u.profile?.marketingConsent ?? false,
      remainingCredits: active.reduce((s, p) => s + (p.wallet?.remaining ?? 0), 0),
      purchases: purchases.map((p) => ({
        id: p.id,
        name: p.nameSnapshot,
        status: p.status,
        price: p.priceSnapshot,
        startsAt: p.startsAt,
        expiresAt: p.expiresAt,
        wallet: p.wallet ? { id: p.wallet.id, total: p.wallet.total, remaining: p.wallet.remaining } : null,
        spa: p.spaEntitlements.map((e) => ({ id: e.id, name: e.treatment?.name ?? e.category ?? 'SPA', total: e.total, remaining: e.remaining })),
        orderId: p.orderId,
        orderStatus: p.order?.status ?? null,
      })),
      bookings: bookings.map((b) => ({ id: b.id, sessionId: b.sessionId, title: b.session.classType.name, startsAt: b.session.startsAt, status: b.status, attendance: b.attendance?.status ?? null, creditsUsed: b.creditsUsed, creditRefunded: b.creditRefunded })),
      spa: spa.map((a) => ({ id: a.id, title: a.treatment.name, startsAt: a.startsAt, status: a.status, therapist: personName(a.therapist.user.profile), paidWith: a.paidWith, price: a.price })),
      orders: orders.map((o) => ({ id: o.id, reference: o.reference, status: o.status, total: o.total, discount: o.discount, createdAt: o.createdAt, product: o.purchase?.nameSnapshot ?? null, payments: o.payments.map((p) => ({ id: p.id, method: p.method, status: p.status, amount: p.amount, completedAt: p.completedAt })) })),
      notes,
      transactions,
    };
  });

  route(
    app,
    {
      method: 'PATCH',
      url: '/admin/clients/:id',
      access: [...ADMIN],
      summary: "Edit a client's details, or disable / complete deletion",
      tags: ['admin-clients'],
      params: zIdParams,
      body: z.object({
        firstName: z.string().trim().min(1).max(60).optional(),
        lastName: z.string().trim().max(60).optional(),
        phone: zPhone.optional(),
        status: z.enum(['ACTIVE', 'DISABLED', 'DELETED']).optional(),
      }),
    },
    async ({ params, body, user, req }) => {
      const u = await prisma.user.findUnique({ where: { id: params.id } });
      if (!u || u.role !== 'CLIENT') throw E.notFound('Client');
      const { status, ...profile } = body;
      await transaction(async (tx) => {
        if (Object.keys(profile).length) await tx.userProfile.update({ where: { userId: u.id }, data: profile });
        if (status === 'DELETED') {
          // Anonymise: payments and bookings stay as records, the person does not.
          await tx.user.update({ where: { id: u.id }, data: { status: 'DELETED', email: `deleted-${u.id}@deleted.invalid` } });
          await tx.userProfile.update({ where: { userId: u.id }, data: { firstName: 'Deleted', lastName: 'client', phone: null, avatarUrl: null } });
          await tx.clientNote.deleteMany({ where: { clientId: u.id } });
          await tx.pushToken.deleteMany({ where: { userId: u.id } });
        } else if (status) {
          await tx.user.update({ where: { id: u.id }, data: { status } });
        }
        await audit(tx, user.id, status === 'DELETED' ? 'client.delete' : 'client.update', 'user', u.id, body, req.ip);
      });
      if (status === 'DISABLED' || status === 'DELETED') await revokeAllSessions(u.id);
      return { ok: true };
    },
  );

  route(
    app,
    { method: 'POST', url: '/admin/clients/:id/notes', access: [...ADMIN], summary: 'Add a note. SERVICE notes are visible to permitted staff; INTERNAL only to admins.', tags: ['admin-clients'], params: zIdParams, body: z.object({ body: z.string().min(1).max(2000), visibility: z.enum(['INTERNAL', 'SERVICE']).default('INTERNAL') }) },
    ({ params, body, user }) => prisma.clientNote.create({ data: { clientId: params.id, authorId: user.id, body: body.body, visibility: body.visibility } }),
  );

  route(app, { method: 'DELETE', url: '/admin/notes/:id', access: [...ADMIN], summary: 'Delete a note', tags: ['admin-clients'], params: zIdParams }, async ({ params }) => {
    await prisma.clientNote.delete({ where: { id: params.id } });
    return { ok: true };
  });

  route(
    app,
    {
      method: 'POST',
      url: '/admin/clients/:id/assign-package',
      access: [...ADMIN],
      summary: 'Sell a package at the desk; record the payment in the same step if it was paid',
      tags: ['admin-clients'],
      params: zIdParams,
      body: z.object({ productId: z.uuid(), promoCode: z.string().max(40).optional(), payment: z.object({ method: z.enum(['CASH', 'CARD_AT_STUDIO']), note: z.string().max(300).optional() }).optional() }),
    },
    async ({ params, body, user, idempotencyKey }) => {
      const order = await createOrder({ userId: params.id, productId: body.productId, promoCode: body.promoCode, actorId: user.id, idempotencyKey });
      if (body.payment && order.status === 'PENDING') await recordManualPayment({ orderId: order.id, method: body.payment.method, note: body.payment.note, actorId: user.id });
      await audit(prisma, user.id, 'package.assign', 'order', order.id, { clientId: params.id, productId: body.productId, paid: !!body.payment });
      return prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { purchase: true, payments: true } });
    },
  );

  route(
    app,
    { method: 'POST', url: '/admin/wallets/:id/adjust', access: [...ADMIN], summary: 'Add or deduct credits, with a reason (recorded)', tags: ['admin-clients'], params: zIdParams, body: z.object({ delta: z.number().int().min(-100).max(100), reason: z.string().min(1).max(300) }) },
    async ({ params, body, user, idempotencyKey }) => {
      const tx = await transaction(async (t) => {
        const row = await adjustWallet(t, { walletId: params.id, delta: body.delta, reason: body.reason, actorId: user.id, idempotencyKey: idempotencyKey ? `adjust:${idempotencyKey}` : undefined });
        await audit(t, user.id, 'credit.adjust', 'credit_wallet', params.id, body);
        await notify(t, { userId: row.userId, type: 'CREDITS_ADJUSTED', dedupeKey: `adjust:${row.id}`, params: { delta: body.delta > 0 ? `+${body.delta}` : String(body.delta), reason: body.reason } });
        return row;
      });
      return tx;
    },
  );

  route(
    app,
    { method: 'POST', url: '/admin/purchases/:id/extend', access: [...ADMIN], summary: 'Extend a package (and its credits and SPA entitlements) by some days', tags: ['admin-clients'], params: zIdParams, body: z.object({ days: z.number().int().min(1).max(365), reason: z.string().max(300).optional() }) },
    async ({ params, body, user }) => {
      return transaction(async (tx) => {
        const p = await tx.membershipPurchase.findUnique({ where: { id: params.id } });
        if (!p || !p.expiresAt) throw E.conflict('NOT_ACTIVE', 'Only an activated package can be extended');
        const expiresAt = new Date(+p.expiresAt + body.days * 86_400_000);
        await tx.membershipPurchase.update({ where: { id: p.id }, data: { expiresAt, status: p.status === 'EXPIRED' ? 'ACTIVE' : p.status } });
        await tx.creditWallet.updateMany({ where: { purchaseId: p.id }, data: { expiresAt } });
        await tx.spaEntitlement.updateMany({ where: { purchaseId: p.id }, data: { expiresAt } });
        await audit(tx, user.id, 'purchase.extend', 'membership_purchase', p.id, body);
        return { ok: true, expiresAt };
      });
    },
  );

  route(
    app,
    { method: 'POST', url: '/admin/clients/:id/notify', access: [...ADMIN], summary: 'Send an operational message to one client (in-app and push)', tags: ['admin-clients'], params: zIdParams, body: z.object({ title: z.string().min(1).max(80), body: z.string().min(1).max(500) }) },
    async ({ params, body, user }) => {
      // Operational, not marketing: delivered whatever the marketing switch says.
      await notify(prisma, { userId: params.id, type: 'DIRECT', dedupeKey: `direct:${params.id}:${Date.now()}`, params: body });
      await audit(prisma, user.id, 'client.notify', 'user', params.id, body);
      return { ok: true };
    },
  );
}
