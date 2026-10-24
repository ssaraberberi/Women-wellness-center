import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { route, zDate, zIdParams, zTime } from '../lib/http.js';
import { prisma, transaction } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { fromDbDate, studioDayRange, studioNow } from '../lib/time.js';
import { personName } from '../lib/dto.js';
import { setSpaOutcome } from '../services/spa.js';
import { notify } from '../services/notify.js';
import type { AuthUser } from '../services/tokens.js';

/**
 * Staff see their own sessions and appointments, the names of the people in
 * them, and attendance. Never payments, never admin-only notes; service notes
 * only with the permission an admin gave them.
 */
export async function staffRoutes(app: FastifyInstance) {
  const STAFF = ['STAFF', 'ADMIN'] as const;

  async function schedule(user: AuthUser, from: Date, to: Date) {
    const [sessions, appointments, closures, timeOff] = await Promise.all([
      prisma.classSession.findMany({
        where: { instructorId: user.id, startsAt: { gte: from, lt: to } },
        include: { classType: true, _count: { select: { bookings: { where: { status: 'BOOKED' } } } } },
        orderBy: { startsAt: 'asc' },
      }),
      prisma.spaAppointment.findMany({
        where: { therapistId: user.id, startsAt: { gte: from, lt: to }, status: { not: 'CANCELLED' } },
        include: { treatment: true, room: true, client: { include: { profile: true } } },
        orderBy: { startsAt: 'asc' },
      }),
      prisma.studioClosure.findMany({ where: { date: { gte: new Date(from.toISOString().slice(0, 10)), lte: to } } }),
      prisma.timeOffRequest.findMany({ where: { staffId: user.id, status: 'APPROVED', startsAt: { lt: to }, endsAt: { gt: from } } }),
    ]);
    return {
      sessions: sessions.map((s) => ({
        kind: 'class' as const,
        id: s.id,
        title: s.classType.name,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
        capacity: s.capacity,
        booked: s._count.bookings,
        room: s.room,
      })),
      appointments: appointments.map((a) => ({
        kind: 'spa' as const,
        id: a.id,
        title: a.treatment.name,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: a.status,
        durationMin: a.treatment.durationMin,
        room: a.room.name,
        client: personName(a.client.profile, 'Client'),
      })),
      closures: closures.map((c) => ({ date: fromDbDate(c.date), reason: c.reason })),
      timeOff: timeOff.map((t) => ({ startsAt: t.startsAt, endsAt: t.endsAt, reason: t.reason })),
    };
  }

  route(app, { method: 'GET', url: '/staff/today', access: [...STAFF], summary: "Today's sessions and appointments, and what changed", tags: ['staff'] }, async ({ user }) => {
    const today = studioNow().toISODate()!;
    const { from } = studioDayRange(today);
    const week = new Date(+from + 7 * 86_400_000);
    const [day, upcoming, recentChanges] = await Promise.all([
      schedule(user, from, studioDayRange(today).to),
      schedule(user, studioDayRange(today).to, week),
      prisma.notification.findMany({
        where: { userId: user.id, channel: 'IN_APP', type: { in: ['STAFF_ASSIGNED', 'STAFF_SESSION_CANCELLED', 'STAFF_SCHEDULE_CHANGED', 'STAFF_REQUEST_REVIEWED'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    return {
      date: today,
      today: day,
      upcomingCount: upcoming.sessions.filter((s) => s.status === 'SCHEDULED').length + upcoming.appointments.filter((a) => a.status === 'BOOKED').length,
      upcoming,
      clientsToday: day.sessions.reduce((s, x) => s + x.booked, 0) + day.appointments.length,
      changes: recentChanges.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt })),
    };
  });

  route(
    app,
    { method: 'GET', url: '/staff/schedule', access: [...STAFF], summary: 'My schedule between two dates', tags: ['staff'], query: z.object({ from: zDate, to: zDate }) },
    async ({ user, query }) => {
      const from = studioDayRange(query.from).from;
      const to = studioDayRange(query.to).to;
      if (+to - +from > 62 * 86_400_000) throw E.badRequest('VALIDATION', 'At most two months at a time');
      return schedule(user, from, to);
    },
  );

  route(app, { method: 'GET', url: '/staff/sessions/:id', access: [...STAFF], summary: 'Participants of one of my classes', tags: ['staff'], params: zIdParams }, async ({ user, params }) => {
    const s = await prisma.classSession.findUnique({
      where: { id: params.id },
      include: {
        classType: true,
        bookings: { where: { status: { in: ['BOOKED', 'LATE_CANCELLED'] } }, include: { attendance: true, user: { include: { profile: true } } }, orderBy: { bookedAt: 'asc' } },
        waitlist: { where: { status: { in: ['WAITING', 'OFFERED'] } } },
      },
    });
    if (!s || (user.role !== 'ADMIN' && s.instructorId !== user.id)) throw E.notFound('Class');
    const clientIds = s.bookings.map((b) => b.userId);
    const notes = user.canViewClientNotes
      ? await prisma.clientNote.findMany({ where: { clientId: { in: clientIds }, visibility: 'SERVICE' }, orderBy: { createdAt: 'desc' } })
      : [];
    const firstTimers = await prisma.classBooking.groupBy({
      by: ['userId'],
      where: { userId: { in: clientIds }, status: 'BOOKED', session: { startsAt: { lt: s.startsAt } } },
      _count: true,
    });
    const prior = new Map(firstTimers.map((f) => [f.userId, f._count]));
    return {
      id: s.id,
      title: s.classType.name,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
      capacity: s.capacity,
      booked: s.bookings.filter((b) => b.status === 'BOOKED').length,
      waitlist: s.waitlist.length,
      canMarkAttendance: s.startsAt.getTime() - Date.now() < 30 * 60_000,
      participants: s.bookings
        .filter((b) => b.status === 'BOOKED')
        .map((b) => ({
          bookingId: b.id,
          name: personName(b.user.profile, 'Client'),
          firstClass: (prior.get(b.userId) ?? 0) === 0,
          attendance: b.attendance?.status ?? null,
          notes: notes.filter((n) => n.clientId === b.userId).map((n) => n.body),
        })),
    };
  });

  route(
    app,
    {
      method: 'POST',
      url: '/staff/bookings/:id/attendance',
      access: [...STAFF],
      summary: 'Mark a participant present or absent',
      tags: ['staff'],
      params: zIdParams,
      body: z.object({ status: z.enum(['PRESENT', 'ABSENT']) }),
    },
    async ({ user, params, body }) => {
      const b = await prisma.classBooking.findUnique({ where: { id: params.id }, include: { session: true } });
      if (!b || (user.role !== 'ADMIN' && b.session.instructorId !== user.id)) throw E.notFound('Booking');
      if (b.status !== 'BOOKED') throw E.conflict('NOT_ACTIVE', 'This booking is not active');
      if (b.session.startsAt.getTime() - Date.now() > 30 * 60_000) throw E.conflict('NOT_STARTED', 'Attendance opens 30 minutes before the class');
      return prisma.classAttendance.upsert({
        where: { bookingId: b.id },
        update: { status: body.status, markedById: user.id, markedAt: new Date() },
        create: { bookingId: b.id, status: body.status, markedById: user.id },
      });
    },
  );

  route(app, { method: 'GET', url: '/staff/appointments/:id', access: [...STAFF], summary: 'One of my SPA appointments', tags: ['staff'], params: zIdParams }, async ({ user, params }) => {
    const a = await prisma.spaAppointment.findUnique({ where: { id: params.id }, include: { treatment: true, room: true, client: { include: { profile: true } } } });
    if (!a || (user.role !== 'ADMIN' && a.therapistId !== user.id)) throw E.notFound('Appointment');
    const notes = user.canViewClientNotes ? await prisma.clientNote.findMany({ where: { clientId: a.clientId, visibility: 'SERVICE' }, orderBy: { createdAt: 'desc' } }) : [];
    return {
      id: a.id,
      status: a.status,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      treatment: { name: a.treatment.name, durationMin: a.treatment.durationMin, category: a.treatment.category },
      room: a.room.name,
      client: personName(a.client.profile, 'Client'),
      serviceNotes: user.canViewClientNotes ? a.serviceNotes : null,
      clientNotes: notes.map((n) => n.body),
      canClose: a.status === 'BOOKED' && a.startsAt <= new Date(),
    };
  });

  route(
    app,
    { method: 'POST', url: '/staff/appointments/:id/outcome', access: [...STAFF], summary: 'Mark an appointment completed or a no-show', tags: ['staff'], params: zIdParams, body: z.object({ status: z.enum(['COMPLETED', 'NO_SHOW']) }) },
    ({ user, params, body }) => setSpaOutcome(params.id, { id: user.id, role: user.role }, body.status),
  );

  route(app, { method: 'GET', url: '/staff/hours', access: [...STAFF], summary: 'My working hours and submitted preferences', tags: ['staff'] }, async ({ user }) => {
    const [hours, prefs, templates] = await Promise.all([
      prisma.therapistAvailability.findMany({ where: { therapistId: user.id }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }),
      prisma.staffAvailability.findMany({ where: { staffId: user.id }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }),
      prisma.classScheduleTemplate.findMany({ where: { instructorId: user.id, active: true }, include: { classType: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }),
    ]);
    return {
      therapistHours: hours,
      preferences: prefs,
      weeklyClasses: templates.map((t) => ({ id: t.id, weekday: t.weekday, startTime: t.startTime, durationMin: t.durationMin, title: t.classType.name })),
    };
  });

  route(
    app,
    {
      method: 'PUT',
      url: '/staff/availability-preferences',
      access: [...STAFF],
      summary: 'Replace my preferred hours (the admin sees them; they do not change bookings by themselves)',
      tags: ['staff'],
      body: z.object({ slots: z.array(z.object({ weekday: z.number().int().min(1).max(7), startTime: zTime, endTime: zTime, note: z.string().max(200).optional() })).max(30) }),
    },
    async ({ user, body }) => {
      await transaction(async (tx) => {
        await tx.staffAvailability.deleteMany({ where: { staffId: user.id } });
        await tx.staffAvailability.createMany({ data: body.slots.map((s) => ({ ...s, staffId: user.id })) });
      });
      return { ok: true };
    },
  );

  route(app, { method: 'GET', url: '/staff/requests', access: [...STAFF], summary: 'My time-off and conflict requests', tags: ['staff'] }, ({ user }) =>
    prisma.timeOffRequest.findMany({ where: { staffId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  );

  route(
    app,
    {
      method: 'POST',
      url: '/staff/requests',
      access: [...STAFF],
      summary: 'Request time off, report a conflict or ask to change hours. An admin decides.',
      tags: ['staff'],
      body: z.object({ kind: z.enum(['TIME_OFF', 'CONFLICT', 'AVAILABILITY_CHANGE']), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), reason: z.string().max(500).optional() }),
    },
    async ({ user, body }) => {
      const startsAt = new Date(body.startsAt);
      const endsAt = new Date(body.endsAt);
      if (endsAt <= startsAt) throw E.badRequest('VALIDATION', 'The end must be after the start');
      const req = await prisma.timeOffRequest.create({ data: { staffId: user.id, kind: body.kind, startsAt, endsAt, reason: body.reason } });
      const me = await prisma.userProfile.findUnique({ where: { userId: user.id } });
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
      for (const a of admins) {
        await notify(prisma, {
          userId: a.id,
          type: 'STAFF_REQUEST_NEW',
          dedupeKey: `staff-request:${req.id}:${a.id}`,
          params: { staff: personName(me, 'Staff'), summary: body.kind.replace('_', ' ').toLowerCase() },
          data: { kind: 'staff-request', requestId: req.id },
        });
      }
      return req;
    },
  );
}
