/**
 * Change how many clients an offer is for (its places).
 *   TITLE="BLACK FRIDAY" LIMIT=3 npx tsx scripts/set-offer-limit.ts
 * Places left = LIMIT minus the sales recorded through the offer.
 */
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const limit = Number(process.env.LIMIT);
  if (!Number.isInteger(limit) || limit < 0) throw new Error('Set LIMIT to a whole number.');
  const o = await prisma.offer.findFirst({ where: { title: process.env.TITLE ?? 'BLACK FRIDAY', archived: false } });
  if (!o) throw new Error('No such offer');
  await prisma.offer.update({ where: { id: o.id }, data: { maxRedemptions: limit } });
  const claimed = await prisma.offerClaim.count({ where: { offerId: o.id, role: 'BUYER', status: { not: 'VOID' } } });
  console.log(`${o.title}: limit ${o.maxRedemptions} → ${limit}; recorded sales ${claimed}; places left ${Math.max(0, limit - claimed)}`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
