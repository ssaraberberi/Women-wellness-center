/**
 * Delete every client whose name, username or email contains "test": the
 * accounts the studio made to try things out.
 *
 *   npx tsx scripts/delete-test-clients.ts            preview (lists them)
 *   npx tsx scripts/delete-test-clients.ts --apply    delete
 *
 * Deleted the way the admin deletes a client (anonymised "Deleted client",
 * status DELETED, no email, phone or notes, signed out), and like
 * retire-test-clients.ts their money and classes go too: payments deleted,
 * orders and packages cancelled, offer claims void, bookings and waiting-list
 * entries deleted.
 */
import { prisma } from '../src/lib/prisma.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const has = { contains: 'test', mode: 'insensitive' as const };
  const users = await prisma.user.findMany({
    where: { role: 'CLIENT', status: { not: 'DELETED' }, OR: [{ profile: { firstName: has } }, { profile: { lastName: has } }, { username: has }, { email: has }] },
    include: { profile: true, _count: { select: { bookings: true, orders: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const ids = users.map((u) => u.id);
  console.log(APPLY ? 'Deleting:' : 'Preview — nothing is changed without --apply:');
  for (const u of users) console.log(`  ${u.id}  ${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''} <${u.email ?? u.username ?? '—'}> ${u.status} · orders ${u._count.orders} · bookings ${u._count.bookings}`);
  console.log(`  ${users.length} client(s)`);
  if (!APPLY || !ids.length) return;

  const payments = await prisma.payment.findMany({ where: { order: { userId: { in: ids } } }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    const payIds = payments.map((p) => p.id);
    await tx.refund.deleteMany({ where: { paymentId: { in: payIds } } });
    await tx.payment.deleteMany({ where: { id: { in: payIds } } });
    await tx.offerClaim.updateMany({ where: { clientId: { in: ids } }, data: { status: 'VOID' } });
    await tx.order.updateMany({ where: { userId: { in: ids } }, data: { status: 'CANCELLED', bookingId: null } });
    await tx.membershipPurchase.updateMany({ where: { userId: { in: ids } }, data: { status: 'CANCELLED' } });
    await tx.classWaitlist.deleteMany({ where: { userId: { in: ids } } });
    await tx.classBooking.deleteMany({ where: { userId: { in: ids } } });
    await tx.clientNote.deleteMany({ where: { clientId: { in: ids } } });
    await tx.pushToken.deleteMany({ where: { userId: { in: ids } } });
    await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
    for (const id of ids) {
      await tx.user.update({ where: { id }, data: { status: 'DELETED', email: `deleted-${id}@deleted.invalid`, username: null } });
      await tx.userProfile.update({ where: { userId: id }, data: { firstName: 'Deleted', lastName: 'client', phone: null, avatarUrl: null } });
    }
  }, { timeout: 120_000 });
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
