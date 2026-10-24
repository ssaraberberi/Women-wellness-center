import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { route, zDate, zIdParams, zTime } from '../lib/http.js';
import { prisma, transaction } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { audit, getSettings } from '../lib/settings.js';
import { TZ, addMinutes, dbDate, fromDbDate, studioDateTime, studioDayRange, studioNow } from '../lib/time.js';
import { personName, sessionInclude, sessionsForUser } from '../lib/dto.js';
import { bookClass, cancelBooking, cancelSession, lockSession, offerFreedPlaces, restoreBookingCredit, whenText } from '../services/booking.js';
import { addClosure, generateSessions, regenerateTemplate } from '../services/schedule.js';
import { analytics } from '../services/analytics.js';
import { notify } from '../services/notify.js';

const ADMIN = ['ADMIN'] as const;
const zDifficulty = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']);

export function periodRange(period: 'day' | 'week' | 'month', date?: string) {
  const base = date ? DateTime.fromISO(date, { zone: TZ }) : studioNow();
  const unit = period === 'day' ? 'day' : period === 'week' ? 'week' : 'month';
  const start = base.startOf(unit);
  return { from: start.toUTC().toJSDate(), to: start.plus({ [unit + 's']: 1 }).toUTC().toJSDate() };
}

export async function adminOpsRoutes(app: FastifyInstance) {
  // ─────────────── dashboard ───────────────
  route(
    app,
    {
      method: 'GET',
      url: '/admin/dashboard',
      access: [...ADMIN],
      summary: 'Live business numbers for a day, week or month',
      tags: ['admin'],
      query: z.object({ period: z.enum(['day', 'week', 'month']).default('day'), date: zDate.optional() }),
    },
    async ({ query }) => {
      const { from, to } = periodRange(query.period, query.date);
      const today = studioDayRange(studioNow().toISODate()!);
      const [sessionsToday, spaToday, bookings, activeMembers, newClients, paidOrders, payments, cancellations, waitlists, pendingOrders, pendingRequests, staffToday] = await Promise.all([
        prisma.classSession.findMany({ where: { startsAt: { gte: today.from, lt: today.to } }, include: sessionInclude, orderBy: { startsAt: 'asc' } }),
        prisma.spaAppointment.findMany({
          where: { startsAt: { gte: today.from, lt: today.to }, status: { not: 'CANCELLED' } },
          include: { treatment: true, client: { include: { profile: true } }, therapist: { include: { user: { include: { profile: true } } } }, room: true },
          orderBy: { startsAt: 'asc' },
        }),
        prisma.classBooking.count({ where: { status: 'BOOKED', session: { startsAt: { gte: from, lt: to } } } }),
        prisma.creditWallet.groupBy({ by: ['userId'], where: { expiresAt: { gt: new Date() }, purchase: { status: 'ACTIVE' } } }).then((r) => r.length),
        prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: from, lt: to } } }),
        prisma.order.count({ where: { status: 'PAID', updatedAt: { gte: from, lt: to } } }),
        prisma.payment.aggregate({ where: { status: { in: ['COMPLETED', 'REFUNDED'] }, completedAt: { gte: from, lt: to } }, _sum: { amount: true } }),
        prisma.classBooking.count({ where: { status: { in: ['CANCELLED', 'LATE_CANCELLED'] }, cancelledAt: { gte: from, lt: to } } }),
        prisma.classWaitlist.count({ where: { status: { in: ['WAITING', 'OFFERED'] }, session: { startsAt: { gt: new Date() } } } }),
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.timeOffRequest.count({ where: { status: 'PENDING' } }),
        prisma.staffProfile.findMany({
          where: { active: true, OR: [{ sessions: { some: { startsAt: { gte: today.from, lt: today.to }, status: 'SCHEDULED' } } }, { appointments: { some: { startsAt: { gte: today.from, lt: today.to }, status: 'BOOKED' } } }] },
          include: {
            user: { include: { profile: true } },
            sessions: { where: { startsAt: { gte: today.from, lt: today.to }, status: 'SCHEDULED' }, select: { startsAt: true } },
            appointments: { where: { startsAt: { gte: today.from, lt: today.to }, status: 'BOOKED' }, select: { startsAt: true } },
          },
        }),
      ]);
      const sessions = await sessionsForUser(sessionsToday);
      const refunds = await prisma.refund.aggregate({ where: { createdAt: { gte: from, lt: to } }, _sum: { amount: true } });
      return {
        period: { from, to, kind: query.period },
        today: {
          sessions: sessions.map((s) => ({ id: s.id, startsAt: s.startsAt, title: s.classType.name, instructor: s.instructor?.name ?? null, booked: s.booked, capacity: s.capacity, waitlist: s.waitlistCount, status: s.status })),
          spa: spaToday.map((a) => ({ id: a.id, startsAt: a.startsAt, title: a.treatment.name, client: personName(a.client.profile, a.client.email), therapist: personName(a.therapist.user.profile), room: a.room.name, status: a.status })),
          availablePlaces: sessions.filter((s) => s.status === 'SCHEDULED').reduce((n, s) => n + s.available, 0),
          staff: staffToday.map((s) => ({
            id: s.userId,
            name: personName(s.user.profile),
            classes: s.sessions.length,
            appointments: s.appointments.length,
            firstAt: [...s.sessions, ...s.appointments].map((x) => x.startsAt).sort((a, b) => +a - +b)[0] ?? null,
          })),
        },
        metrics: {
          bookings,
          activeMembers,
          newClients,
          membershipSales: paidOrders,
          revenue: (payments._sum.amount ?? 0) - (refunds._sum.amount ?? 0),
          cancellations,
          waitlists,
        },
        attention: { pendingOrders, pendingRequests },
      };
    },
  );

  route(
    app,
    { method: 'GET', url: '/admin/analytics', access: [...ADMIN], summary: 'Trends from the database', tags: ['admin'], query: z.object({ from: zDate, to: zDate }) },
    ({ query }) => analytics(studioDayRange(query.from).from, studioDayRange(query.to).to),
  );

  // ─────────────── class types ───────────────
  const classTypeBody = z.object({
    name: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().max(80).nullish(),
    description: z.string().max(2000).default(''),
    descriptionEn: z.string().max(2000).nullish(),
    format: z.string().trim().min(1).max(30).default('REFORMER'),
    difficulty: zDifficulty.default('ALL_LEVELS'),
    durationMin: z.number().int().min(10).max(240).default(50),
    defaultCapacity: z.number().int().min(1).max(100).default(8),
    creditsRequired: z.number().int().min(0).max(10).default(1),
    imageKey: z.string().max(60).nullish(),
    active: z.boolean().default(true),
  });
  route(app, { method: 'GET', url: '/admin/class-types', access: [...ADMIN], summary: 'All class types', tags: ['admin'] }, () => prisma.classType.findMany({ orderBy: { name: 'asc' } }));
  route(app, { method: 'POST', url: '/admin/class-types', access: [...ADMIN], summary: 'Create a class type', tags: ['admin'], body: classTypeBody }, async ({ body, user }) => {
    const row = await prisma.classType.create({ data: body });
    await audit(prisma, user.id, 'class_type.create', 'class_type', row.id, body);
    return row;
  });
  route(app, { method: 'PATCH', url: '/admin/class-types/:id', access: [...ADMIN], summary: 'Edit a class type', tags: ['admin'], params: zIdParams, body: classTypeBody.partial() }, async ({ params, body, user }) => {
    const row = await prisma.classType.update({ where: { id: params.id }, data: body });
    await audit(prisma, user.id, 'class_type.update', 'class_type', row.id, body);
    return row;
  });

  // ─────────────── recurring templates ───────────────
  const templateBody = z.object({
    classTypeId: z.uuid(),
    instructorId: z.uuid().nullish(),
    weekday: z.number().int().min(1).max(7),
    startTime: zTime,
    durationMin: z.number().int().min(10).max(240),
    capacity: z.number().int().min(1).max(100),
    validFrom: zDate,
    validUntil: zDate.nullish(),
    active: z.boolean().default(true),
  });
  route(app, { method: 'GET', url: '/admin/templates', access: [...ADMIN], summary: 'The weekly timetable', tags: ['admin'] }, async () => {
    const rows = await prisma.classScheduleTemplate.findMany({ include: { classType: true, instructor: { include: { user: { include: { profile: true } } } } }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] });
    return rows.map((t) => ({ ...t, validFrom: fromDbDate(t.validFrom), validUntil: t.validUntil ? fromDbDate(t.validUntil) : null, instructorName: t.instructor ? personName(t.instructor.user.profile) : null }));
  });
  route(app, { method: 'POST', url: '/admin/templates', access: [...ADMIN], summary: 'Add a weekly slot and generate its classes', tags: ['admin'], body: templateBody }, async ({ body, user }) => {
    await assertInstructor(body.instructorId);
    const row = await prisma.classScheduleTemplate.create({ data: { ...body, validFrom: dbDate(body.validFrom), validUntil: body.validUntil ? dbDate(body.validUntil) : null } });
    const created = await generateSessions();
    await audit(prisma, user.id, 'template.create', 'class_schedule_template', row.id, body);
    return { ...row, generated: created };
  });
  route(app, { method: 'PATCH', url: '/admin/templates/:id', access: [...ADMIN], summary: 'Change a weekly slot. Booked classes keep their shape.', tags: ['admin'], params: zIdParams, body: templateBody.partial() }, async ({ params, body, user }) => {
    await assertInstructor(body.instructorId);
    const row = await prisma.classScheduleTemplate.update({
      where: { id: params.id },
      data: { ...body, validFrom: body.validFrom ? dbDate(body.validFrom) : undefined, validUntil: body.validUntil === undefined ? undefined : body.validUntil ? dbDate(body.validUntil) : null },
    });
    const generated = await regenerateTemplate(row.id);
    await audit(prisma, user.id, 'template.update', 'class_schedule_template', row.id, body);
    return { ...row, generated };
  });
  route(app, { method: 'DELETE', url: '/admin/templates/:id', access: [...ADMIN], summary: 'Stop a weekly slot (booked classes stay)', tags: ['admin'], params: zIdParams }, async ({ params, user }) => {
    await prisma.classScheduleTemplate.update({ where: { id: params.id }, data: { active: false } });
    const { count } = await prisma.classSession.deleteMany({ where: { templateId: params.id, startsAt: { gt: new Date() }, detached: false, bookings: { none: {} }, waitlist: { none: {} } } });
    await audit(prisma, user.id, 'template.deactivate', 'class_schedule_template', params.id, { removedSessions: count });
    return { ok: true, removedSessions: count };
  });
  route(app, { method: 'POST', url: '/admin/templates/generate', access: [...ADMIN], summary: 'Generate classes up to the horizon now', tags: ['admin'] }, async () => ({ created: await generateSessions() }));

  // ─────────────── sessions ───────────────
  route(
    app,
    { method: 'GET', url: '/admin/sessions', access: [...ADMIN], summary: 'Classes in a range, cancelled included', tags: ['admin'], query: z.object({ from: zDate, to: zDate, instructorId: z.uuid().optional() }) },
    async ({ query }) => {
      const rows = await prisma.classSession.findMany({
        where: { startsAt: { gte: studioDayRange(query.from).from, lt: studioDayRange(query.to).to }, instructorId: query.instructorId },
        include: sessionInclude,
        orderBy: { startsAt: 'asc' },
      });
      return sessionsForUser(rows);
    },
  );

  route(app, { method: 'GET', url: '/admin/sessions/:id', access: [...ADMIN], summary: 'A class with its participants and waiting list', tags: ['admin'], params: zIdParams }, async ({ params }) => {
    const row = await prisma.classSession.findUnique({ where: { id: params.id }, include: sessionInclude });
    if (!row) throw E.notFound('Class');
    const [dto] = await sessionsForUser([row]);
    const [bookings, waitlist] = await Promise.all([
      prisma.classBooking.findMany({ where: { sessionId: row.id }, include: { user: { include: { profile: true } }, attendance: true }, orderBy: { bookedAt: 'asc' } }),
      prisma.classWaitlist.findMany({ where: { sessionId: row.id, status: { in: ['WAITING', 'OFFERED'] } }, include: { user: { include: { profile: true } } }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      ...dto,
      detached: row.detached,
      templateId: row.templateId,
      cancelReason: row.cancelReason,
      bookings: bookings.map((b) => ({
        id: b.id,
        userId: b.userId,
        name: personName(b.user.profile, b.user.email),
        phone: b.user.profile?.phone ?? null,
        status: b.status,
        source: b.source,
        creditsUsed: b.creditsUsed,
        creditRefunded: b.creditRefunded,
        attendance: b.attendance?.status ?? null,
        bookedAt: b.bookedAt,
      })),
      waitlist: waitlist.map((w, i) => ({ id: w.id, position: i + 1, userId: w.userId, name: personName(w.user.profile, w.user.email), status: w.status, offerExpiresAt: w.offerExpiresAt })),
    };
  });

  route(
    app,
    {
      method: 'POST',
      url: '/admin/sessions',
      access: [...ADMIN],
      summary: 'A one-off class on one date',
      tags: ['admin'],
      body: z.object({ classTypeId: z.uuid(), instructorId: z.uuid().nullish(), date: zDate, startTime: zTime, durationMin: z.number().int().min(10).max(240).optional(), capacity: z.number().int().min(1).max(100).optional(), room: z.string().max(40).nullish() }),
    },
    async ({ body, user }) => {
      await assertInstructor(body.instructorId);
      const ct = await prisma.classType.findUnique({ where: { id: body.classTypeId } });
      if (!ct) throw E.notFound('Class type');
      const startsAt = studioDateTime(body.date, body.startTime);
      const row = await prisma.classSession.create({
        data: { classTypeId: ct.id, instructorId: body.instructorId ?? null, startsAt, endsAt: addMinutes(startsAt, body.durationMin ?? ct.durationMin), capacity: body.capacity ?? ct.defaultCapacity, detached: true, room: body.room ?? null },
      });
      if (row.instructorId) {
        await notify(prisma, { userId: row.instructorId, type: 'STAFF_ASSIGNED', dedupeKey: `assigned:${row.id}:${row.instructorId}`, params: { className: ct.name, when: whenText(startsAt) }, data: { kind: 'session', sessionId: row.id } });
      }
      await audit(prisma, user.id, 'session.create', 'class_session', row.id, body);
      return row;
    },
  );

  route(
    app,
    {
      method: 'PATCH',
      url: '/admin/sessions/:id',
      access: [...ADMIN],
      summary: 'Edit one date of a class: time, capacity, instructor. Participants are told.',
      tags: ['admin'],
      params: zIdParams,
      body: z.object({ date: zDate.optional(), startTime: zTime.optional(), durationMin: z.number().int().min(10).max(240).optional(), capacity: z.number().int().min(0).max(100).optional(), instructorId: z.uuid().nullish(), room: z.string().max(40).nullish() }),
    },
    async ({ params, body, user }) => {
      await assertInstructor(body.instructorId);
      const settings = await getSettings();
      return transaction(async (tx) => {
        const s = await lockSession(tx, params.id);
        if (s.status !== 'SCHEDULED') throw E.conflict('CLASS_CANCELLED', 'This class is cancelled');
        const current = DateTime.fromJSDate(s.startsAt).setZone(TZ);
        const startsAt = body.date || body.startTime ? studioDateTime(body.date ?? current.toISODate()!, body.startTime ?? current.toFormat('HH:mm')) : s.startsAt;
        const duration = body.durationMin ?? Math.round((+s.endsAt - +s.startsAt) / 60_000);
        const booked = await tx.classBooking.count({ where: { sessionId: s.id, status: 'BOOKED' } });
        if (body.capacity !== undefined && body.capacity < booked) throw E.conflict('CAPACITY_BELOW_BOOKED', `${booked} people are booked; cancel bookings first`);
        const updated = await tx.classSession.update({
          where: { id: s.id },
          data: { startsAt, endsAt: addMinutes(startsAt, duration), capacity: body.capacity, instructorId: body.instructorId === undefined ? undefined : body.instructorId, room: body.room === undefined ? undefined : body.room, detached: true },
        });
        const moved = +startsAt !== +s.startsAt;
        if (moved) {
          const bookings = await tx.classBooking.findMany({ where: { sessionId: s.id, status: 'BOOKED' }, select: { userId: true } });
          for (const b of bookings) {
            await notify(tx, { userId: b.userId, type: 'SESSION_CHANGED', dedupeKey: `moved:${s.id}:${+startsAt}:${b.userId}`, params: { className: s.classType.name, when: whenText(startsAt) }, data: { kind: 'class', sessionId: s.id } });
          }
        }
        const newInstructor = body.instructorId && body.instructorId !== s.instructorId ? body.instructorId : null;
        if (newInstructor) {
          await notify(tx, { userId: newInstructor, type: 'STAFF_ASSIGNED', dedupeKey: `assigned:${s.id}:${newInstructor}`, params: { className: s.classType.name, when: whenText(startsAt) }, data: { kind: 'session', sessionId: s.id } });
        }
        if (s.instructorId && (moved || (body.instructorId !== undefined && body.instructorId !== s.instructorId))) {
          await notify(tx, { userId: s.instructorId, type: 'STAFF_SCHEDULE_CHANGED', dedupeKey: `changed:${s.id}:${+startsAt}:${body.instructorId ?? 'same'}`, params: { className: s.classType.name, when: whenText(startsAt) } });
        }
        if (body.capacity !== undefined && body.capacity > s.capacity) await offerFreedPlaces(tx, s.id, settings);
        await audit(tx, user.id, 'session.update', 'class_session', s.id, body);
        return updated;
      });
    },
  );

  route(app, { method: 'POST', url: '/admin/sessions/:id/cancel', access: [...ADMIN], summary: 'Cancel a class: credits back, everyone told', tags: ['admin'], params: zIdParams, body: z.object({ reason: z.string().max(300).optional() }) }, ({ params, body, user }) =>
    cancelSession(params.id, user.id, body.reason),
  );

  route(
    app,
    { method: 'POST', url: '/admin/sessions/:id/bookings', access: [...ADMIN], summary: "Book a client into a class (uses the client's credits)", tags: ['admin'], params: zIdParams, body: z.object({ userId: z.uuid() }) },
    ({ params, body, user, idempotencyKey }) => bookClass(body.userId, params.id, { actor: { id: user.id, role: 'ADMIN' }, source: 'ADMIN', idempotencyKey }),
  );

  route(
    app,
    { method: 'POST', url: '/admin/bookings/:id/cancel', access: [...ADMIN], summary: 'Cancel a booking; choose to return a late credit', tags: ['admin'], params: zIdParams, body: z.object({ restoreCredit: z.boolean().default(false) }) },
    ({ params, body, user }) => cancelBooking(params.id, { id: user.id, role: 'ADMIN' }, body),
  );

  route(
    app,
    { method: 'POST', url: '/admin/bookings/:id/restore-credit', access: [...ADMIN], summary: 'Give back the credit of a late cancellation or no-show', tags: ['admin'], params: zIdParams, body: z.object({ reason: z.string().min(1).max(300) }) },
    ({ params, body, user }) => restoreBookingCredit(params.id, user.id, body.reason),
  );

  route(
    app,
    { method: 'POST', url: '/admin/bookings/:id/attendance', access: [...ADMIN], summary: 'Mark attendance', tags: ['admin'], params: zIdParams, body: z.object({ status: z.enum(['PRESENT', 'ABSENT']) }) },
    async ({ params, body, user }) => {
      const b = await prisma.classBooking.findUnique({ where: { id: params.id } });
      if (!b || b.status !== 'BOOKED') throw E.notFound('Booking');
      return prisma.classAttendance.upsert({ where: { bookingId: b.id }, update: { status: body.status, markedById: user.id, markedAt: new Date() }, create: { bookingId: b.id, status: body.status, markedById: user.id } });
    },
  );

  // ─────────────── closures ───────────────
  route(app, { method: 'GET', url: '/admin/closures', access: [...ADMIN], summary: 'Days the studio is closed', tags: ['admin'] }, async () => {
    const rows = await prisma.studioClosure.findMany({ where: { date: { gte: dbDate(studioNow().minus({ days: 30 }).toISODate()!) } }, orderBy: { date: 'asc' } });
    return rows.map((r) => ({ ...r, date: fromDbDate(r.date) }));
  });
  route(
    app,
    { method: 'POST', url: '/admin/closures', access: [...ADMIN], summary: 'Close a day: its classes and SPA appointments are cancelled with credits returned', tags: ['admin'], body: z.object({ date: zDate, reason: z.string().max(200).optional() }) },
    async ({ body, user }) => {
      const res = await addClosure(body.date, body.reason, user.id);
      return { ...res, closure: { ...res.closure, date: body.date } };
    },
  );
  route(app, { method: 'DELETE', url: '/admin/closures/:id', access: [...ADMIN], summary: 'Reopen a day (cancelled classes stay cancelled; templates fill the day again)', tags: ['admin'], params: zIdParams }, async ({ params, user }) => {
    await prisma.studioClosure.delete({ where: { id: params.id } });
    await audit(prisma, user.id, 'closure.remove', 'studio_closure', params.id);
    return { ok: true, created: await generateSessions() };
  });

  // ─────────────── settings & audit ───────────────
  route(app, { method: 'GET', url: '/admin/settings', access: [...ADMIN], summary: 'Studio settings', tags: ['admin'] }, () => getSettings());
  route(
    app,
    {
      method: 'PATCH',
      url: '/admin/settings',
      access: [...ADMIN],
      summary: 'Change studio settings',
      tags: ['admin'],
      body: z
        .object({
          studioName: z.string().min(1).max(80),
          address: z.string().max(200),
          phone: z.string().max(40),
          instagram: z.string().max(60),
          openingHours: z.record(z.enum(['1', '2', '3', '4', '5', '6', '7']), z.object({ open: zTime, close: zTime }).nullable()),
          freeCancelHours: z.number().int().min(0).max(168),
          lateCancelKeepsCredit: z.boolean(),
          bookingWindowDays: z.number().int().min(1).max(120),
          bookingCutoffMin: z.number().int().min(0).max(1440),
          defaultClassCapacity: z.number().int().min(1).max(100),
          waitlistEnabled: z.boolean(),
          waitlistOfferMinutes: z.number().int().min(5).max(1440),
          spaFreeCancelHours: z.number().int().min(0).max(168),
          spaSlotStepMin: z.number().int().min(5).max(120),
          activateBeforePayment: z.boolean(),
          reminderHoursBefore: z.number().int().min(1).max(72),
          expiryReminderDays: z.number().int().min(1).max(30),
          scheduleHorizonDays: z.number().int().min(7).max(180),
        })
        .partial(),
    },
    async ({ body, user }) => {
      await getSettings();
      const row = await prisma.studioSettings.update({ where: { id: 1 }, data: body });
      await audit(prisma, user.id, 'settings.update', 'studio_settings', '1', body);
      return row;
    },
  );
  route(
    app,
    { method: 'GET', url: '/admin/audit-logs', access: [...ADMIN], summary: 'Sensitive actions, newest first', tags: ['admin'], query: z.object({ entityType: z.string().optional(), entityId: z.string().optional(), limit: z.coerce.number().min(1).max(200).default(100) }) },
    ({ query }) => prisma.auditLog.findMany({ where: { entityType: query.entityType, entityId: query.entityId }, orderBy: { createdAt: 'desc' }, take: query.limit }),
  );
}

async function assertInstructor(id: string | null | undefined) {
  if (!id) return;
  const s = await prisma.staffProfile.findUnique({ where: { userId: id } });
  if (!s || !s.isInstructor || !s.active) throw E.badRequest('NOT_INSTRUCTOR', 'Choose an active instructor');
}
