/**
 * Read-only: how an offer stands (claims, places left) and the packages sold
 * at its price since it started, through the offer or not.
 *   TITLE="BLACK FRIDAY" npx tsx scripts/offer-status.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio } from '../src/lib/time.js';

async function main() {
  const o = await prisma.offer.findFirst({ where: { title: process.env.TITLE ?? 'BLACK FRIDAY', archived: false }, include: { product: true } });
  if (!o) throw new Error('No such offer');
  const claims = await prisma.offerClaim.findMany({ where: { offerId: o.id, role: 'BUYER', status: { not: 'VOID' } }, include: { client: { include: { profile: true } } } });
  console.log(`offer ${o.title}: limit ${o.maxRedemptions}, claimed ${claims.length}, active ${o.active}`);
  for (const c of claims) console.log(`  claim: ${c.client.profile?.firstName} ${c.client.profile?.lastName} ${formatStudio(c.createdAt, 'd LLL HH:mm')}`);
  const purchases = await prisma.membershipPurchase.findMany({
    where: { OR: [{ productId: o.productId ?? undefined }, { createdAt: { gte: o.createdAt }, order: { total: o.product?.price } }] },
    include: { user: { include: { profile: true } }, order: true },
  });
  console.log(`packages at ${o.product?.price} L since ${formatStudio(o.createdAt, 'd LLL')}: ${purchases.length}`);
  for (const p of purchases) console.log(`  ${p.user.profile?.firstName} ${p.user.profile?.lastName} · ${p.nameSnapshot} · ${p.status} · order ${p.order?.status ?? '—'} ${p.order?.total ?? ''}`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
