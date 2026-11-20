/**
 * Book a client into one class from the desk, the way the admin's "Add
 * participant" does: a session from her package, she and the instructor are
 * told as usual. Optionally makes sure the class has a given instructor.
 *
 *   CLIENT="Mirela" AT="2026-11-20 19:00" [INSTRUCTOR="Almira"] npx tsx scripts/book-client.ts            preview
 *   … --apply                                                                                                 do it
 *
 * CLIENT matches first name, "first last", username or email (case ignored);
 * CLIENT_ID picks her by id. Stops, changing nothing, unless exactly one
 * active client and exactly one class match.
 */
import { DateTime } from 'luxon';
import { prisma } from '../src/lib/prisma.js';
import { TZ, formatStudio } from '../src/lib/time.js';
import { bookClass } from '../src/services/booking.js';
import { spendCredits, usableCredits } from '../src/services/credits.js';
import { audit } from '../src/lib/settings.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const q = process.env.CLIENT?.trim();
  const clientId = process.env.CLIENT_ID?.trim();
  const at = DateTime.fromFormat(process.env.AT ?? '', 'yyyy-MM-dd HH:mm', { zone: TZ });
  const instr = process.env.INSTRUCTOR?.trim();
  if ((!q && !clientId) || !at.isValid) throw new Error('Set CLIENT (or CLIENT_ID) and AT="yyyy-MM-dd HH:mm".');

  const parts = (q ?? '').split(/\s+/);
  const clients = await prisma.user.findMany({
    where: clientId
      ? { id: clientId }
      : {
          role: 'CLIENT',
          status: 'ACTIVE',
          OR: [
            { email: { equals: q, mode: 'insensitive' } },
            { username: { equals: q, mode: 'insensitive' } },
            parts.length > 1
              ? { profile: { firstName: { equals: parts[0], mode: 'insensitive' }, lastName: { startsWith: parts.slice(1).join(' '), mode: 'insensitive' } } }
              : { profile: { firstName: { equals: q, mode: 'insensitive' } } },
          ],
        },
    include: { profile: true },
  });
  if (clients.length !== 1) {
    throw new Error(`Expected one client "${clientId ?? q}", found ${clients.length}:${clients.map((c) => `\n    ${c.id}  ${c.profile?.firstName} ${c.profile?.lastName} <${c.email ?? c.username ?? '—'}>`).join('') || ' none'}`);
  }
  const c = clients[0];

  const session = await prisma.classSession.findFirst({ where: { startsAt: at.toJSDate(), status: { in: ['SCHEDULED', 'COMPLETED'] } }, include: { classType: true, instructor: { include: { user: { include: { profile: true } } } }, _count: { select: { bookings: { where: { status: 'BOOKED' } } } } } });
  if (!session) throw new Error(`No class on at ${process.env.AT}`);
  const already = await prisma.classBooking.findFirst({ where: { sessionId: session.id, userId: c.id, status: 'BOOKED' } });
  let teacher: { userId: string; name: string } | null = null;
  if (instr) {
    const found = await prisma.staffProfile.findMany({ where: { isInstructor: true, active: true, user: { status: { not: 'DISABLED' }, profile: { firstName: { equals: instr, mode: 'insensitive' } } } }, include: { user: { include: { profile: true } } } });
    if (found.length !== 1) throw new Error(`Expected one active instructor "${instr}", found ${found.length}`);
    teacher = { userId: found[0].userId, name: `${found[0].user.profile?.firstName} ${found[0].user.profile?.lastName}`.trim() };
  }
  const credits = await usableCredits(prisma, c.id, session.startsAt);
  const current = session.instructor?.user.profile ? `${session.instructor.user.profile.firstName} ${session.instructor.user.profile.lastName}`.trim() : '—';

  console.log(APPLY ? 'Applying:' : 'Preview — nothing is changed without --apply:');
  console.log(`  client: ${c.profile?.firstName} ${c.profile?.lastName} <${c.email ?? c.username ?? '—'}> · sessions she can use: ${credits}`);
  console.log(`  class:  ${session.classType.name} ${formatStudio(session.startsAt, 'EEE d LLL HH:mm')}–${formatStudio(session.endsAt, 'HH:mm')} · ${session._count.bookings}/${session.capacity} booked · instructor ${current}`);
  if (teacher && teacher.userId !== session.instructorId) console.log(`  instructor → ${teacher.name}`);
  if (already) console.log('  she is already booked in this class: nothing to do');
  if (!APPLY || already) return;

  if (teacher && teacher.userId !== session.instructorId) {
    await prisma.classSession.update({ where: { id: session.id }, data: { instructorId: teacher.userId, detached: true } });
  }
  const admin = (await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE', isOwner: true } })) ?? (await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } }));
  if (!admin) throw new Error('No active admin to book as.');
  if (session.status === 'SCHEDULED' && session.endsAt > new Date()) {
    const b = await bookClass(c.id, session.id, { actor: { id: admin.id, role: 'ADMIN' }, source: 'ADMIN', idempotencyKey: `desk:${c.id}:${session.id}` });
    console.log(`  booked: ${b.id}`);
    return;
  }
  // The class is over: record that she was there. A session from her package,
  // marked present; nobody is notified about a class that already happened.
  const b = await prisma.$transaction(async (tx) => {
    const taken = await tx.classBooking.count({ where: { sessionId: session.id, status: 'BOOKED' } });
    if (taken >= session.capacity) throw new Error(`The class is full (${taken}/${session.capacity})`);
    const booking = await tx.classBooking.create({
      data: { sessionId: session.id, userId: c.id, status: 'BOOKED', source: 'ADMIN', creditsUsed: session.classType.creditsRequired, idempotencyKey: `desk:${c.id}:${session.id}`, bookedAt: new Date() },
    });
    const { walletId } = await spendCredits(tx, { userId: c.id, credits: session.classType.creditsRequired, at: session.startsAt, bookingId: booking.id, actorId: admin.id });
    await tx.classBooking.update({ where: { id: booking.id }, data: { walletId } });
    await tx.classAttendance.create({ data: { bookingId: booking.id, status: 'PRESENT', markedById: admin.id } });
    await audit(tx, admin.id, 'booking.create_for_client', 'class_booking', booking.id, { userId: c.id, sessionId: session.id, pay: 'credits', after: true });
    return booking;
  });
  console.log(`  recorded (class over): ${b.id} · present · 1 session used`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? `${(e as { code?: string }).code ?? ''} ${e.message}` : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
