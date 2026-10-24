import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export const personName = (p?: { firstName: string; lastName: string } | null, fallback = '') =>
  p ? `${p.firstName} ${p.lastName}`.trim() : fallback;

export const sessionInclude = {
  classType: true,
  instructor: { include: { user: { select: { id: true, profile: true } } } },
  _count: { select: { bookings: { where: { status: 'BOOKED' } } } },
} satisfies Prisma.ClassSessionInclude;

type SessionRow = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>;

/**
 * Classes as the app shows them, with places left counted the same way the
 * booking transaction counts them (bookings + held waiting-list offers), and
 * this caller's own booking / waiting-list entry.
 */
export async function sessionsForUser(sessions: SessionRow[], userId?: string) {
  const ids = sessions.map((s) => s.id);
  const [held, mine, myWait, waitingCounts] = await Promise.all([
    prisma.classWaitlist.groupBy({ by: ['sessionId'], where: { sessionId: { in: ids }, status: 'OFFERED', offerExpiresAt: { gt: new Date() } }, _count: true }),
    userId ? prisma.classBooking.findMany({ where: { sessionId: { in: ids }, userId, status: 'BOOKED' }, select: { id: true, sessionId: true } }) : [],
    userId ? prisma.classWaitlist.findMany({ where: { sessionId: { in: ids }, userId, status: { in: ['WAITING', 'OFFERED'] } } }) : [],
    prisma.classWaitlist.groupBy({ by: ['sessionId'], where: { sessionId: { in: ids }, status: 'WAITING' }, _count: true }),
  ]);
  const heldBy = new Map(held.map((h) => [h.sessionId, h._count]));
  const waitingBy = new Map(waitingCounts.map((h) => [h.sessionId, h._count]));
  const mineBy = new Map(mine.map((b) => [b.sessionId, b.id]));
  const waitBy = new Map(myWait.map((w) => [w.sessionId, w]));

  return Promise.all(
    sessions.map(async (s) => {
      const taken = s._count.bookings + (heldBy.get(s.id) ?? 0);
      const w = waitBy.get(s.id);
      let position: number | null = null;
      if (w?.status === 'WAITING') {
        position = await prisma.classWaitlist.count({ where: { sessionId: s.id, status: 'WAITING', createdAt: { lte: w.createdAt } } });
      }
      return {
        id: s.id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        durationMin: Math.round((+s.endsAt - +s.startsAt) / 60_000),
        status: s.status,
        capacity: s.capacity,
        booked: s._count.bookings,
        available: Math.max(s.capacity - taken, 0),
        waitlistCount: waitingBy.get(s.id) ?? 0,
        room: s.room,
        classType: {
          id: s.classType.id,
          name: s.classType.name,
          nameEn: s.classType.nameEn,
          description: s.classType.description,
          descriptionEn: s.classType.descriptionEn,
          format: s.classType.format,
          difficulty: s.classType.difficulty,
          creditsRequired: s.classType.creditsRequired,
          imageKey: s.classType.imageKey,
        },
        instructor: s.instructor ? { id: s.instructor.userId, name: personName(s.instructor.user.profile) } : null,
        myBookingId: mineBy.get(s.id) ?? null,
        myWaitlist: w ? { id: w.id, status: w.status, offerExpiresAt: w.offerExpiresAt, position } : null,
      };
    }),
  );
}

export const userSummary = (u: { id: string; email: string; role: string; profile: { firstName: string; lastName: string; phone: string | null } | null }) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  name: personName(u.profile, u.email),
  firstName: u.profile?.firstName ?? '',
  lastName: u.profile?.lastName ?? '',
  phone: u.profile?.phone ?? null,
});
