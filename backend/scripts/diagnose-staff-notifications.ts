/**
 * Read-only: for the last few days' bookings and cancellations, which staff and
 * admin notifications were written, on which channel, and whether they went out.
 *
 *   npx tsx scripts/diagnose-staff-notifications.ts [days=3]
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio } from '../src/lib/time.js';

async function main() {
  const days = Number(process.argv[2] ?? 3);
  const since = new Date(Date.now() - days * 86_400_000);

  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'STAFF'] }, status: { not: 'DELETED' } },
    include: { profile: true, staffProfile: true, notificationPrefs: true, _count: { select: { pushTokens: true } } },
  });
  console.log('Staff and admins:');
  for (const u of staff) {
    console.log(`  ${u.role} ${u.status} ${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''} <${u.email ?? '—'}> instructor=${u.staffProfile?.isInstructor ?? false} pushTokens=${u._count.pushTokens} emailEnabled=${u.notificationPrefs?.emailEnabled ?? 'default'} pushEnabled=${u.notificationPrefs?.pushEnabled ?? 'default'}`);
  }
  const who = new Map(staff.map((u) => [u.id, `${u.role}:${u.profile?.firstName ?? u.email}`]));

  const bookings = await prisma.classBooking.findMany({
    where: { OR: [{ bookedAt: { gte: since } }, { cancelledAt: { gte: since } }] },
    include: { session: { include: { classType: true } }, user: { include: { profile: true } } },
    orderBy: { bookedAt: 'asc' },
  });
  const cancellers = await prisma.user.findMany({ where: { id: { in: bookings.map((b) => b.cancelledById).filter((x): x is string => !!x) } }, select: { id: true, role: true } });
  const roleOf = new Map(cancellers.map((c) => [c.id, c.role]));

  console.log(`\nBookings and cancellations since ${formatStudio(since, 'd LLL HH:mm')}: ${bookings.length}`);
  for (const b of bookings) {
    const keys = [`booked:${b.id}`, `cancel:${b.id}`];
    const notes = await prisma.notification.findMany({
      where: { OR: keys.map((k) => ({ dedupeKey: { startsWith: k } })), type: { in: ['STAFF_NEW_BOOKING', 'STAFF_BOOKING_CANCELLED', 'INSTRUCTOR_NEW_BOOKING'] } },
      orderBy: { createdAt: 'asc' },
    });
    const instr = b.session.instructorId ? who.get(b.session.instructorId) ?? b.session.instructorId : 'none';
    console.log(`\n  ${b.user.profile?.firstName ?? ''} ${b.user.profile?.lastName ?? ''} · ${b.session.classType.name} ${formatStudio(b.session.startsAt, 'EEE d LLL HH:mm')} · instructor=${instr}`);
    console.log(`    booked ${formatStudio(b.bookedAt, 'd LLL HH:mm')} source=${b.source} status=${b.status}${b.cancelledAt ? ` cancelled ${formatStudio(b.cancelledAt, 'd LLL HH:mm')} by ${roleOf.get(b.cancelledById ?? '') ?? '?'}` : ''}`);
    if (!notes.length) console.log('    staff/admin notifications: NONE');
    for (const n of notes) console.log(`    → ${n.type} to ${who.get(n.userId) ?? n.userId} via ${n.channel}: ${n.status}${n.lastError ? ` (${n.lastError.slice(0, 80)})` : ''}`);
  }
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
