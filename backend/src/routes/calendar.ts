import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { route, zDate } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { formatStudio, studioDate, studioDayRange } from '../lib/time.js';
import { personName } from '../lib/dto.js';

const range = z.object({ from: zDate, to: zDate });
const MAX_DAYS = 62;

function bounds(from: string, to: string) {
  if (to < from) throw E.badRequest('BAD_RANGE', '"to" is before "from"');
  const start = studioDayRange(from).from;
  const end = studioDayRange(to).to;
  if (+end - +start > MAX_DAYS * 86_400_000) throw E.badRequest('BAD_RANGE', `At most ${MAX_DAYS} days at a time`);
  return { start, end };
}

/** The month calendar's marks, and the record of classes that took place. */
export async function calendarRoutes(app: FastifyInstance) {
  route(
    app,
    {
      method: 'GET',
      url: '/calendar/days',
      access: 'user',
      summary: 'Per day in a range: classes, places booked, and (client) her own bookings — for marking the month calendar',
      tags: ['classes'],
      query: range,
    },
    async ({ user, query }) => {
      const { start, end } = bounds(query.from, query.to);
      // A client sees the classes she can book and her own; staff the classes they teach; admins everything.
      const where: Prisma.ClassSessionWhereInput = {
        startsAt: { gte: start, lt: end },
        status: { not: 'CANCELLED' },
        ...(user.role === 'STAFF' ? { instructorId: user.id } : {}),
      };
      const sessions = await prisma.classSession.findMany({
        where,
        select: {
          startsAt: true,
          _count: { select: { bookings: { where: { status: 'BOOKED' } } } },
          ...(user.role === 'CLIENT' ? { bookings: { where: { userId: user.id, status: 'BOOKED' }, select: { id: true } } } : {}),
        },
      });
      const days = new Map<string, { date: string; classes: number; booked: number; mine: number }>();
      for (const s of sessions) {
        const date = studioDate(s.startsAt);
        const d = days.get(date) ?? { date, classes: 0, booked: 0, mine: 0 };
        d.classes++;
        d.booked += s._count.bookings;
        d.mine += (s as { bookings?: unknown[] }).bookings?.length ?? 0;
        days.set(date, d);
      }
      return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
    },
  );

  route(
    app,
    {
      method: 'GET',
      url: '/classes/history',
      access: ['STAFF', 'ADMIN'],
      summary: 'Classes that took place with at least one participant — an instructor her own, an admin everyone’s',
      tags: ['staff'],
      query: range.extend({ instructorId: z.uuid().optional() }),
    },
    async ({ user, query }) => {
      const { start, end } = bounds(query.from, query.to);
      const now = new Date();
      const instructorId = user.role === 'STAFF' ? user.id : query.instructorId;
      const rows = await prisma.classSession.findMany({
        where: {
          startsAt: { gte: start, lt: end < now ? end : now },
          status: { not: 'CANCELLED' },
          bookings: { some: { status: 'BOOKED' } },
          ...(instructorId ? { instructorId } : {}),
        },
        include: {
          classType: { select: { name: true } },
          instructor: { include: { user: { include: { profile: true } } } },
          bookings: { where: { status: 'BOOKED' }, select: { attendance: { select: { status: true } } } },
        },
        orderBy: { startsAt: 'desc' },
        take: 1000,
      });
      const classes = rows.map((s) => ({
        id: s.id,
        date: studioDate(s.startsAt),
        start: formatStudio(s.startsAt, 'HH:mm'),
        end: formatStudio(s.endsAt, 'HH:mm'),
        className: s.classType.name,
        instructor: s.instructor ? personName(s.instructor.user.profile) : null,
        participants: s.bookings.length,
        present: s.bookings.filter((b) => b.attendance?.status === 'PRESENT').length,
        absent: s.bookings.filter((b) => b.attendance?.status === 'ABSENT').length,
      }));
      return {
        classes,
        totals: { classes: classes.length, participants: classes.reduce((n, c) => n + c.participants, 0), hours: Math.round(rows.reduce((n, s) => n + (+s.endsAt - +s.startsAt), 0) / 360_000) / 10 },
      };
    },
  );
}
