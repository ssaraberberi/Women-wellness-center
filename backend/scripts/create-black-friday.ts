/**
 * Black Friday 2026: 24 Reformer sessions in 3 months (2× a week) for
 * 36,000 L instead of 43,500 L, for the first 10 clients only.
 *
 *   npx tsx scripts/create-black-friday.ts            preview, changes nothing
 *   npx tsx scripts/create-black-friday.ts --apply    create it
 *
 * The package is created switched off (not listed on its own): it is sold
 * only through the BUNDLE offer, which carries the limit of 10. Each sale
 * from the desk counts against it; at 10 the offer leaves the catalogue
 * (and the website's banner goes with it). Running it twice is harmless.
 */
import { prisma } from '../src/lib/prisma.js';

const APPLY = process.argv.includes('--apply');
const OFFER_TITLE = 'BLACK FRIDAY';

async function main() {
  const existing = await prisma.offer.findFirst({ where: { title: OFFER_TITLE, archived: false }, include: { product: true } });
  if (existing) {
    console.log(`Already there: offer ${existing.id} (${existing.active ? 'on' : 'off'}), package "${existing.product?.name}" ${existing.product?.price} L, limit ${existing.maxRedemptions}.`);
    return;
  }
  const product = {
    kind: 'PACKAGE' as const,
    name: '24 seanca · 3 muaj',
    nameEn: '24 classes · 3 months',
    description: '2 herë në javë, 24 seanca Reformer, të vlefshme 3 muaj.',
    descriptionEn: 'Twice a week: 24 Reformer classes, valid for 3 months.',
    price: 36000,
    originalPrice: 43500,
    classCredits: 24,
    validityDays: 90,
    sessionsPerWeekHint: 2,
    terms: 'Ofertë Black Friday, vetëm për 10 kliente. Paguhet në studio.',
    termsEn: 'Black Friday offer, for 10 clients only. Paid at the studio.',
    active: false,
    sortOrder: -10,
  };
  console.log(APPLY ? 'Creating:' : 'Preview — nothing is changed without --apply:');
  console.log(`  package: ${product.name} · ${product.classCredits} sessions · ${product.validityDays} days · ${product.price} L (was ${product.originalPrice} L) · not listed on its own`);
  console.log(`  offer:   ${OFFER_TITLE} · BUNDLE · first 10 clients · open to everyone · on`);
  if (!APPLY) return;

  const admin = (await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE', isOwner: true } })) ?? (await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } }));
  await prisma.$transaction(async (tx) => {
    const p = await tx.membershipProduct.create({ data: product });
    const o = await tx.offer.create({
      data: {
        kind: 'BUNDLE',
        title: OFFER_TITLE,
        titleEn: OFFER_TITLE,
        description: '2× në javë · 24 seanca · 3 muaj. 36,000 L në vend të 43,500 L. Vetëm për 10 vajza.',
        descriptionEn: '2× a week · 24 classes · 3 months. 36,000 L instead of 43,500 L. For 10 women only.',
        productId: p.id,
        maxRedemptions: 10,
        newClientsOnly: false,
        active: true,
        sortOrder: -10,
      },
    });
    if (admin) {
      await tx.auditLog.create({ data: { actorId: admin.id, action: 'offer.create', entityType: 'offer', entityId: o.id, data: { title: o.title, via: 'script' } } });
    }
    console.log(`  created package ${p.id} and offer ${o.id}`);
  });
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
