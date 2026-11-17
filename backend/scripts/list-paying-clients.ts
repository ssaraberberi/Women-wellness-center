/**
 * Read-only: every client with an order, with what she paid and owes, newest
 * first. Names or emails that look like tests are marked. Used to find the
 * accounts the studio made to try things out.
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio } from '../src/lib/time.js';

async function main() {
  const users = await prisma.user.findMany({
    where: { orders: { some: {} } },
    include: { profile: true, orders: { include: { payments: true, purchase: true } }, _count: { select: { bookings: true } } },
  });
  const looksTest = (u: (typeof users)[number]) => /test|prov|demo|dummy|asd|qwe/i.test(`${u.profile?.firstName} ${u.profile?.lastName} ${u.email ?? ''} ${u.username ?? ''}`);
  const rows = users.map((u) => {
    const paid = u.orders.flatMap((o) => o.payments).filter((p) => p.status === 'COMPLETED' || p.status === 'REFUNDED').reduce((n, p) => n + p.amount, 0);
    const owed = u.orders.filter((o) => o.status === 'PENDING').reduce((n, o) => n + o.total, 0);
    return { u, paid, owed, orders: u.orders.length, first: u.createdAt };
  }).sort((a, b) => +b.first - +a.first);
  let tp = 0, to = 0;
  for (const r of rows) {
    const t = looksTest(r.u);
    if (t) { tp += r.paid; to += r.owed; }
    console.log(`${t ? 'TEST? ' : '      '}${r.u.id}  ${r.u.profile?.firstName ?? ''} ${r.u.profile?.lastName ?? ''} <${r.u.email ?? r.u.username ?? '—'}> ${r.u.role}/${r.u.status} since ${formatStudio(r.first, 'd LLL')} · orders ${r.orders} · paid ${r.paid} L · owes ${r.owed} L · bookings ${r.u._count.bookings}`);
  }
  console.log(`\n${rows.length} clients with orders. Marked TEST?: paid ${tp} L, owed ${to} L.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
