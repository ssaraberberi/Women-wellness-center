/**
 * Accounts the studio made to try things out: take them out of the money and
 * out of the classes, so they count for nothing.
 *
 *   IDS=uuid,uuid,… npx tsx scripts/retire-test-clients.ts            preview
 *   IDS=uuid,uuid,… npx tsx scripts/retire-test-clients.ts --apply    do it
 *
 * For each account (CLIENT only):
 *  - payments (and their refunds) are deleted: they were never real money,
 *    and revenue is summed from payments;
 *  - orders become CANCELLED, so nothing shows as owed or sold;
 *  - packages become CANCELLED; offer claims VOID (they free the offer's places);
 *  - class bookings and waiting-list entries are deleted, past and future, so
 *    no class shows them, counts them or suggests itself because of them;
 *  - the account is DISABLED: it can no longer sign in.
 * Nothing else is touched. Stops if an id is not a client.
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio } from '../src/lib/time.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const ids = (process.env.IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) throw new Error('Set IDS.');
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, include: { profile: true } });
  const bad = ids.filter((id) => !users.some((u) => u.id === id && u.role === 'CLIENT'));
  if (bad.length) throw new Error(`Not clients (nothing changed): ${bad.join(', ')}`);

  const now = new Date();
  const [orders, payments, purchases, bookings, waits, claims] = await Promise.all([
    prisma.order.findMany({ where: { userId: { in: ids } } }),
    prisma.payment.findMany({ where: { order: { userId: { in: ids } } }, include: { refunds: true } }),
    prisma.membershipPurchase.findMany({ where: { userId: { in: ids } } }),
    prisma.classBooking.findMany({ where: { userId: { in: ids } }, include: { session: { include: { classType: true } } } }),
    prisma.classWaitlist.findMany({ where: { userId: { in: ids } } }),
    prisma.offerClaim.findMany({ where: { clientId: { in: ids }, status: { not: 'VOID' } } }),
  ]);
  const money = payments.filter((p) => p.status === 'COMPLETED' || p.status === 'REFUNDED').reduce((n, p) => n + p.amount, 0);
  const owed = orders.filter((o) => o.status === 'PENDING').reduce((n, o) => n + o.total, 0);
  const future = bookings.filter((b) => b.status === 'BOOKED' && b.session.startsAt > now);

  console.log(APPLY ? 'Applying:' : 'Preview — nothing is changed without --apply:');
  for (const u of users) console.log(`  ${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''} <${u.email ?? u.username ?? '—'}> ${u.status}`);
  console.log(`  payments: ${payments.length} deleted (${money} L out of revenue)`);
  console.log(`  orders: ${orders.length} → CANCELLED (${owed} L no longer owed)`);
  console.log(`  packages: ${purchases.length} → CANCELLED; offer claims: ${claims.length} → VOID`);
  console.log(`  bookings: ${bookings.length} deleted, of them ${future.length} in upcoming classes${future.length ? ': ' + future.map((b) => `${formatStudio(b.session.startsAt, 'EEE d LLL HH:mm')}`).join(', ') : ''}`);
  console.log(`  waiting list: ${waits.length} deleted; accounts → DISABLED`);
  if (!APPLY) return;

  await prisma.$transaction(async (tx) => {
    const payIds = payments.map((p) => p.id);
    await tx.refund.deleteMany({ where: { paymentId: { in: payIds } } });
    await tx.payment.deleteMany({ where: { id: { in: payIds } } });
    await tx.offerClaim.updateMany({ where: { id: { in: claims.map((c) => c.id) } }, data: { status: 'VOID' } });
    // An order can point at a booking; let go of it before the booking goes.
    await tx.order.updateMany({ where: { userId: { in: ids } }, data: { status: 'CANCELLED', bookingId: null } });
    await tx.membershipPurchase.updateMany({ where: { userId: { in: ids } }, data: { status: 'CANCELLED' } });
    await tx.classWaitlist.deleteMany({ where: { userId: { in: ids } } });
    await tx.classBooking.deleteMany({ where: { userId: { in: ids } } });
    await tx.user.updateMany({ where: { id: { in: ids } }, data: { status: 'DISABLED' } });
    await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
  }, { timeout: 60_000 });
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
