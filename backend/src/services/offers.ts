import type { Offer, Prisma } from '@prisma/client';
import { prisma, type Tx } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { dbDate, studioDate, fromDbDate } from '../lib/time.js';
import { normalizeEmail } from './auth.js';
import { notify } from './notify.js';

/**
 * Offers, with the rules the website had:
 *   live      switched on, not archived, inside its dates, not used up
 *   once      one claim per person per offer (held by a partial unique index)
 *   new       "new clients only": never held a package that was not cancelled
 *   friend    BRING A BESTIE: the friend must be new too; her bonus waits for its condition
 * The people a buyer names (a DUO partner, a friend) become clients of their
 * own, never merged with anyone — a possible duplicate is noted for the desk.
 */

export type Person = { firstName: string; lastName: string; phone?: string | null; email?: string | null };

const today = () => studioDate(new Date());

/** The offer, locked so the last place under a cap cannot be taken twice; throws unless it is live. */
export async function liveOffer(tx: Tx, offerId: string, opts: { admin?: boolean } = {}) {
  const rows = await tx.$queryRaw<{ id: string }[]>`select id from offers where id = ${offerId}::uuid for update`;
  if (!rows.length) throw E.notFound('Offer');
  const offer = await tx.offer.findUniqueOrThrow({ where: { id: offerId }, include: { product: true, eligibleProducts: true } });
  if (offer.archived) throw E.conflict('OFFER_UNAVAILABLE', 'This offer is no longer available');
  if (!opts.admin) {
    const d = today();
    if (!offer.active || (offer.startsOn && fromDbDate(offer.startsOn) > d) || (offer.endsOn && fromDbDate(offer.endsOn) < d)) {
      throw E.conflict('OFFER_UNAVAILABLE', 'This offer is no longer available');
    }
  }
  if (offer.maxRedemptions !== null && (await claimedCount(tx, offer.id)) >= offer.maxRedemptions) {
    throw E.conflict('OFFER_LIMIT', 'This offer has reached its limit');
  }
  return offer;
}

const claimedCount = (db: Tx | typeof prisma, offerId: string) => db.offerClaim.count({ where: { offerId, role: 'BUYER', status: { not: 'VOID' } } });

/** Never held a package that counted (active or used up). */
export async function hasHistory(db: Tx | typeof prisma, clientId: string) {
  return (await db.membershipPurchase.count({ where: { userId: clientId, status: { in: ['ACTIVE', 'EXPIRED'] } } })) > 0;
}

/** Clients who might be the same person (same phone or email). Only ever noted, never merged. */
export async function lookalikes(db: Tx | typeof prisma, p: Person, exceptId?: string) {
  const or: Prisma.UserWhereInput[] = [];
  if (p.email) or.push({ email: normalizeEmail(p.email) });
  if (p.phone) or.push({ profile: { phone: p.phone } });
  if (!or.length) return [];
  return db.user.findMany({ where: { OR: or, role: 'CLIENT', status: { not: 'DELETED' }, id: exceptId ? { not: exceptId } : undefined }, select: { id: true } });
}

/**
 * A person named by someone else (a DUO partner, a friend): a client of her
 * own, unverified, with no sign-in until she proves her email herself. An
 * email already in use is not taken over: it is left off and noted.
 */
export async function createNamedPerson(tx: Tx, p: Person, opts: { actorId: string; why: string }) {
  const email = p.email ? normalizeEmail(p.email) : null;
  const emailTaken = email ? !!(await tx.user.findUnique({ where: { email }, select: { id: true } })) : false;
  const twins = await lookalikes(tx, p);
  const u = await tx.user.create({
    data: {
      email: emailTaken ? null : email,
      role: 'CLIENT',
      profile: { create: { firstName: p.firstName, lastName: p.lastName, phone: p.phone ?? null } },
      notificationPrefs: { create: {} },
    },
  });
  const lines = [
    `Added by ${opts.why}; identity not verified.`,
    ...(emailTaken ? [`Email ${email} is already used by another account — left off this profile.`] : []),
    ...(twins.length ? [`Possible duplicate of ${twins.map((x) => x.id).join(', ')} (same phone or email) — check before merging.`] : []),
  ];
  await tx.clientNote.create({ data: { clientId: u.id, authorId: opts.actorId, body: lines.join(' '), visibility: 'INTERNAL' } });
  return { id: u.id, twins };
}

/**
 * Bonus classes whose condition is now true. Called after anything that can
 * make one true: an order made or paid, a package activated, a class attended.
 * A bonus only lands in a package already paid for; until then it waits.
 */
export async function grantPendingBonuses(tx: Tx) {
  const pending = await tx.offerClaim.findMany({ where: { status: 'PENDING' }, include: { offer: true, order: true } });
  const byOrder = new Map<string, typeof pending>();
  for (const c of pending) if (c.orderId) byOrder.set(c.orderId, [...(byOrder.get(c.orderId) ?? []), c]);

  for (const [orderId, claims] of byOrder) {
    const offer = claims[0].offer;
    const order = claims[0].order!;
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      await tx.offerClaim.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'VOID' } });
      continue;
    }
    const buyer = claims.find((c) => c.role === 'BUYER');
    const friend = claims.find((c) => c.role === 'FRIEND');
    if (!(await conditionMet(tx, offer, order, friend?.clientId))) continue;

    const to = [
      ...(buyer && offer.bonusTo !== 'FRIEND' ? [buyer] : []),
      ...(friend && offer.bonusTo !== 'REFERRER' ? [friend] : []),
    ];
    let all = true;
    for (const who of to) {
      const walletId = await bonusWallet(tx, who.clientId, orderId);
      if (!walletId) {
        all = false; // her package from this order is not paid yet
        continue;
      }
      await addBonus(tx, walletId, who.clientId, offer, `bonus:${who.id}`);
    }
    if (all) await tx.offerClaim.updateMany({ where: { orderId, offerId: offer.id, status: 'PENDING' }, data: { status: 'GRANTED', grantedAt: new Date() } });
  }
}

async function conditionMet(tx: Tx, offer: Offer, order: { id: string; status: string }, friendId?: string) {
  switch (offer.bonusWhen) {
    case 'BOOKED':
      return true;
    case 'PAID':
      return order.status === 'PAID';
    case 'FRIEND_PAID':
      return !!friendId && (await tx.order.count({ where: { userId: friendId, status: 'PAID' } })) > 0;
    case 'VISIT':
      return !!friendId && (await tx.classAttendance.count({ where: { status: 'PRESENT', booking: { userId: friendId } } })) > 0;
  }
}

/**
 * Where a bonus lands: the package she bought with the offer (once paid), or
 * her newest running package, or — if she has none at all — a package of its own.
 * Null: her package from this order is still waiting for payment.
 */
async function bonusWallet(tx: Tx, clientId: string, orderId: string): Promise<string | null> {
  const fromOrder = await tx.membershipPurchase.findFirst({ where: { userId: clientId, orderId }, include: { wallet: true } });
  if (fromOrder?.status === 'ACTIVE' && fromOrder.wallet) return fromOrder.wallet.id;
  if (fromOrder?.status === 'PENDING_PAYMENT') return null;
  const running = await tx.creditWallet.findFirst({ where: { userId: clientId, expiresAt: { gt: new Date() }, purchase: { status: 'ACTIVE' } }, orderBy: { expiresAt: 'desc' } });
  if (running) return running.id;
  return (await bonusPackage(tx, clientId)).id;
}

/** A package of its own for a bonus to land in: 0 classes, 60 days, nothing to pay. */
async function bonusPackage(tx: Tx, clientId: string) {
  const product =
    (await tx.membershipProduct.findFirst({ where: { kind: 'PROMO', name: 'Klasa bonus', active: false } })) ??
    (await tx.membershipProduct.create({ data: { kind: 'PROMO', name: 'Klasa bonus', nameEn: 'Bonus classes', price: 0, classCredits: 0, validityDays: 60, active: false } }));
  const startsAt = new Date();
  const expiresAt = new Date(+startsAt + 60 * 86_400_000);
  const p = await tx.membershipPurchase.create({
    data: { userId: clientId, productId: product.id, status: 'ACTIVE', nameSnapshot: product.name, priceSnapshot: 0, classCredits: 0, validityDays: 60, startsAt, expiresAt, activatedAt: startsAt },
  });
  return tx.creditWallet.create({ data: { userId: clientId, purchaseId: p.id, total: 0, remaining: 0, expiresAt } });
}

/** Credit a bonus once (the key holds it), in the ledger, and tell her. */
export async function addBonus(tx: Tx, walletId: string, clientId: string, offer: { title: string; bonusClasses: number }, key: string, reason?: string) {
  if (await tx.creditTransaction.findUnique({ where: { idempotencyKey: key } })) return false;
  const [w] = await tx.$queryRaw<{ remaining: number; total: number }[]>`select remaining, total from credit_wallets where id = ${walletId}::uuid for update`;
  const balanceAfter = w.remaining + offer.bonusClasses;
  await tx.creditWallet.update({ where: { id: walletId }, data: { remaining: balanceAfter, total: w.total + offer.bonusClasses } });
  await tx.creditTransaction.create({
    data: { walletId, userId: clientId, type: 'BONUS', delta: offer.bonusClasses, balanceAfter, reason: reason ?? `Bonus: ${offer.title}`, idempotencyKey: key },
  });
  await notify(tx, { userId: clientId, type: 'BONUS_GRANTED', dedupeKey: key, params: { offer: offer.title, n: offer.bonusClasses } });
  return true;
}

/** What the booking page shows: packages for sale, and the offers live today. */
export async function publicCatalogue() {
  const d = today();
  const [products, offers] = await Promise.all([
    prisma.membershipProduct.findMany({ where: { active: true, kind: { in: ['SINGLE', 'PACKAGE', 'TRIAL', 'PROMO', 'DUO'] } }, orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] }),
    prisma.offer.findMany({ where: { active: true, archived: false }, include: { product: true, eligibleProducts: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  const live = [];
  for (const o of offers) {
    if ((o.startsOn && fromDbDate(o.startsOn) > d) || (o.endsOn && fromDbDate(o.endsOn) < d)) continue;
    const claimed = await claimedCount(prisma, o.id);
    if (o.maxRedemptions !== null && claimed >= o.maxRedemptions) continue;
    live.push({
      id: o.id,
      kind: o.kind,
      title: o.title,
      titleEn: o.titleEn,
      description: o.description,
      descriptionEn: o.descriptionEn,
      eligibility: o.eligibility,
      eligibilityEn: o.eligibilityEn,
      discountPct: o.discountPct,
      endsOn: o.endsOn ? fromDbDate(o.endsOn) : null,
      left: o.maxRedemptions === null ? null : o.maxRedemptions - claimed,
      newClientsOnly: o.newClientsOnly,
      friendRequired: o.friendRequired,
      bonusClasses: o.bonusClasses,
      bonusTo: o.bonusTo,
      bonusWhen: o.bonusWhen,
      together: o.together,
      product: o.product ? productDto(o.product) : null,
      eligibleProductIds: o.eligibleProducts.map((e) => e.productId),
    });
  }
  return { products: products.map(productDto), offers: live };
}

const productDto = (p: { id: string; kind: string; name: string; nameEn: string | null; description: string; descriptionEn: string | null; price: number; originalPrice: number | null; classCredits: number; validityDays: number; persons: number; firstTimeOnly: boolean; terms: string; termsEn: string | null }) => ({
  id: p.id,
  kind: p.kind,
  name: p.name,
  nameEn: p.nameEn,
  description: p.description,
  descriptionEn: p.descriptionEn,
  price: p.price,
  originalPrice: p.originalPrice,
  classCredits: p.classCredits,
  validityDays: p.validityDays,
  persons: p.persons,
  firstTimeOnly: p.firstTimeOnly,
  terms: p.terms,
  termsEn: p.termsEn,
});

export const dbToday = () => dbDate(today());
