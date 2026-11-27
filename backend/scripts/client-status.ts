/**
 * Read-only: a client's packages (sessions left), bookings around a date, and open orders.
 *   CLIENT="Aulona Mersini" [AROUND="2026-11-26"] npx tsx scripts/client-status.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio } from '../src/lib/time.js';

async function main() {
  const q = (process.env.CLIENT ?? '').trim(); const parts = q.split(/\s+/);
  const users = await prisma.user.findMany({
    where: { role: 'CLIENT', OR: [
      { profile: { firstName: { equals: parts[0], mode: 'insensitive' }, ...(parts[1] ? { lastName: { startsWith: parts.slice(1).join(' '), mode: 'insensitive' } } : {}) } },
      { email: { equals: q, mode: 'insensitive' } }, { username: { equals: q, mode: 'insensitive' } } ] },
    include: { profile: true },
  });
  console.log(`matches: ${users.length}`);
  for (const u of users) {
    console.log(`\n${u.id}  ${u.profile?.firstName} ${u.profile?.lastName} <${u.email ?? u.username ?? '—'}> ${u.status} phone=${u.profile?.phone ?? '—'}`);
    const purchases = await prisma.membershipPurchase.findMany({ where: { userId: u.id }, include: { wallet: true, order: true }, orderBy: { createdAt: 'desc' } });
    for (const p of purchases) console.log(`  package ${p.id}: ${p.nameSnapshot} · ${p.status} · starts ${p.startsAt ? formatStudio(p.startsAt, 'd LLL HH:mm') : '—'} · expires ${p.wallet?.expiresAt ? formatStudio(p.wallet.expiresAt, 'd LLL HH:mm') : '—'} · created ${formatStudio(p.createdAt, 'd LLL HH:mm')} · left ${p.wallet?.remaining ?? '—'} · order ${p.order?.status ?? '—'}`);
    const bookings = await prisma.classBooking.findMany({ where: { userId: u.id }, include: { session: true, order: { include: { payments: true } }, attendance: true }, orderBy: { session: { startsAt: 'desc' } }, take: 10 });
    for (const b of bookings) console.log(`  booking ${b.id}: ${formatStudio(b.session.startsAt, 'EEE d LLL HH:mm')} · ${b.status} · source ${b.source} · credits ${b.creditsUsed} wallet ${b.walletId ? 'yes' : 'no'} · attendance ${b.attendance?.status ?? '—'} · order ${b.order ? `${b.order.reference} ${b.order.status} ${b.order.total} L, payments ${b.order.payments.map((x) => x.status + ' ' + x.amount).join(',') || 'none'}` : '—'}`);
  }
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
