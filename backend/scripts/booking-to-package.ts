/**
 * A class booked as a single class (paid at the studio) that should come out
 * of the client's package instead: the unpaid order is cancelled, one session
 * is taken from her package, and (for a class that is over) she is marked present.
 *
 *   BOOKING_ID=… npx tsx scripts/booking-to-package.ts            preview
 *   BOOKING_ID=… npx tsx scripts/booking-to-package.ts --apply    do it
 *
 * If the package was bought later the same day as the class (sold at the desk
 * after it), its start moves back to the start of that day so it covers it;
 * its end stays. Stops, changing nothing, if the order has a payment, the
 * booking already uses a package, or no package of hers can cover the class.
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio, studioDate, studioDayRange } from '../src/lib/time.js';
import { spendCredits, usableCredits } from '../src/services/credits.js';
import { audit } from '../src/lib/settings.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const id = process.env.BOOKING_ID?.trim();
  if (!id) throw new Error('Set BOOKING_ID.');
  const b = await prisma.classBooking.findUnique({ where: { id }, include: { session: { include: { classType: true } }, user: { include: { profile: true } }, order: { include: { payments: true } }, attendance: true } });
  if (!b) throw new Error('No such booking');
  if (b.status !== 'BOOKED') throw new Error(`Booking is ${b.status}`);
  if (b.walletId || b.creditsUsed > 0) throw new Error('This booking already uses a package');
  if (b.order?.payments.some((p) => p.status === 'COMPLETED')) throw new Error('Its order has a payment: refund it at the desk first');
  const credits = b.session.classType.creditsRequired;
  let left = await usableCredits(prisma, b.userId, b.session.startsAt);
  const over = b.session.endsAt <= new Date();
  // Bought the same day, after the class: her package can start that morning.
  const day = studioDate(b.session.startsAt);
  const dayStart = studioDayRange(day).from;
  const sameDay = left < credits
    ? await prisma.membershipPurchase.findFirst({
        where: { userId: b.userId, status: 'ACTIVE', startsAt: { gt: b.session.startsAt, lt: studioDayRange(day).to }, wallet: { remaining: { gte: credits }, expiresAt: { gt: new Date() } } },
        include: { wallet: true },
      })
    : null;
  if (sameDay) left = sameDay.wallet!.remaining;

  console.log(APPLY ? 'Applying:' : 'Preview — nothing is changed without --apply:');
  console.log(`  ${b.user.profile?.firstName} ${b.user.profile?.lastName} · ${b.session.classType.name} ${formatStudio(b.session.startsAt, 'EEE d LLL HH:mm')}`);
  console.log(`  order ${b.order ? `${b.order.reference} ${b.order.status} ${b.order.total} L → CANCELLED` : '—'}`);
  if (sameDay) console.log(`  package "${sameDay.nameSnapshot}" bought ${formatStudio(sameDay.startsAt!, 'd LLL HH:mm')} → starts ${formatStudio(dayStart, 'd LLL HH:mm')} (end unchanged)`);
  console.log(`  package sessions usable on that date: ${left} → ${left - credits}${over ? '; marked present' : ''}`);
  if (left < credits) throw new Error('She has no usable session in a package for that date. Nothing changed.');
  if (!APPLY) return;

  const admin = (await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE', isOwner: true } })) ?? (await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } }));
  if (!admin) throw new Error('No active admin');
  await prisma.$transaction(async (tx) => {
    if (sameDay) await tx.membershipPurchase.update({ where: { id: sameDay.id }, data: { startsAt: dayStart } });
    if (b.order && b.order.status === 'PENDING') await tx.order.update({ where: { id: b.order.id }, data: { status: 'CANCELLED' } });
    const { walletId } = await spendCredits(tx, { userId: b.userId, credits, at: b.session.startsAt, bookingId: b.id, actorId: admin.id });
    await tx.classBooking.update({ where: { id: b.id }, data: { walletId, creditsUsed: credits } });
    if (over && !b.attendance) await tx.classAttendance.create({ data: { bookingId: b.id, status: 'PRESENT', markedById: admin.id } });
    await audit(tx, admin.id, 'booking.to_package', 'class_booking', b.id, { orderCancelled: b.order?.reference ?? null, credits });
  });
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
