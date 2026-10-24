import type { PaymentMethod, PromotionCode } from '@prisma/client';
import { prisma, transaction, isUniqueViolation, type Tx } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { getSettings, audit } from '../lib/settings.js';
import { reference } from '../lib/crypto.js';
import { formatStudio } from '../lib/time.js';
import { notify } from './notify.js';
import { env } from '../env.js';

const lek = (n: number) => `${n.toLocaleString('en-US')} L`;

/** The price a promotion leaves, or why it does not apply. */
async function applyPromotion(tx: Tx, code: string, productId: string, userId: string, subtotal: number) {
  const rows = await tx.$queryRaw<{ id: string }[]>`select id from promotion_codes where upper(code) = upper(${code}) for update`;
  if (!rows.length) throw E.badRequest('PROMO_INVALID', 'This code does not exist');
  const promo = (await tx.promotionCode.findUniqueOrThrow({ where: { id: rows[0].id }, include: { products: true } })) as PromotionCode & { products: { productId: string }[] };
  const now = new Date();
  if (!promo.active || (promo.validFrom && promo.validFrom > now) || (promo.validUntil && promo.validUntil < now)) {
    throw E.badRequest('PROMO_EXPIRED', 'This code is not active');
  }
  if (promo.maxRedemptions !== null && promo.redemptionCount >= promo.maxRedemptions) throw E.badRequest('PROMO_EXHAUSTED', 'This code has been used up');
  if (promo.products.length && !promo.products.some((p) => p.productId === productId)) throw E.badRequest('PROMO_NOT_APPLICABLE', 'This code does not apply to this package');
  if (promo.firstTimeOnly) {
    const before = await tx.order.count({ where: { userId, status: { in: ['PAID', 'PENDING'] } } });
    if (before > 0) throw E.badRequest('PROMO_FIRST_TIME', 'This code is for first-time clients');
  }
  const already = await tx.order.count({ where: { userId, promotionId: promo.id, status: { in: ['PAID', 'PENDING'] } } });
  if (already) throw E.badRequest('PROMO_USED', 'You have already used this code');
  const discount = promo.discountType === 'PERCENT' ? Math.round((subtotal * Math.min(promo.discountValue, 100)) / 100) : Math.min(promo.discountValue, subtotal);
  return { promo, discount };
}

/**
 * Ordering a package writes the purchase with the terms of today (price,
 * credits, validity, wording). Changing the product later changes nothing here.
 */
export async function createOrder(opts: {
  userId: string;
  productId: string;
  promoCode?: string;
  actorId: string;
  idempotencyKey?: string | null;
}) {
  if (opts.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId: opts.userId, idempotencyKey: opts.idempotencyKey } },
      include: { purchase: true },
    });
    if (existing) return existing;
  }
  try {
    return await transaction(async (tx) => {
      // Serialises one person's orders, so limits and first-time checks cannot race.
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${'orders:' + opts.userId}))`;
      const product = await tx.membershipProduct.findUnique({ where: { id: opts.productId }, include: { spaItems: true } });
      if (!product || !product.active) throw E.notFound('Package');
      if (product.firstTimeOnly) {
        const prior = await tx.membershipPurchase.count({ where: { userId: opts.userId, status: { in: ['ACTIVE', 'EXPIRED', 'PENDING_PAYMENT'] } } });
        if (prior) throw E.conflict('TRIAL_NOT_ELIGIBLE', 'This package is for first-time clients');
      }
      if (product.maxPerClient) {
        const n = await tx.membershipPurchase.count({ where: { userId: opts.userId, productId: product.id, status: { not: 'CANCELLED' } } });
        if (n >= product.maxPerClient) throw E.conflict('PURCHASE_LIMIT', 'You have reached the limit for this package');
      }
      const pending = await tx.order.count({ where: { userId: opts.userId, status: 'PENDING', purchase: { productId: product.id } } });
      if (pending) throw E.conflict('ORDER_PENDING', 'You already have this package waiting for payment');

      let discount = 0;
      let promotionId: string | undefined;
      if (opts.promoCode) {
        const p = await applyPromotion(tx, opts.promoCode, product.id, opts.userId, product.price);
        discount = p.discount;
        promotionId = p.promo.id;
        await tx.promotionCode.update({ where: { id: p.promo.id }, data: { redemptionCount: { increment: 1 } } });
      }
      const order = await tx.order.create({
        data: {
          reference: reference(),
          userId: opts.userId,
          subtotal: product.price,
          discount,
          total: product.price - discount,
          promotionId,
          createdById: opts.actorId,
          idempotencyKey: opts.idempotencyKey ?? undefined,
        },
      });
      const purchase = await tx.membershipPurchase.create({
        data: {
          userId: opts.userId,
          productId: product.id,
          orderId: order.id,
          nameSnapshot: product.name,
          priceSnapshot: order.total,
          classCredits: product.classCredits,
          validityDays: product.validityDays,
          termsSnapshot: product.terms,
        },
      });
      const settings = await getSettings(tx);
      if (order.total === 0 || settings.activateBeforePayment) await activatePurchase(tx, purchase.id);
      else {
        await notify(tx, {
          userId: opts.userId,
          type: 'ORDER_PENDING',
          dedupeKey: `order:${order.id}`,
          params: { product: product.name, total: lek(order.total), reference: order.reference },
          data: { kind: 'order', orderId: order.id },
        });
      }
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { purchase: true } });
    });
  } catch (e) {
    if (isUniqueViolation(e) && opts.idempotencyKey) {
      const existing = await prisma.order.findUnique({ where: { userId_idempotencyKey: { userId: opts.userId, idempotencyKey: opts.idempotencyKey } }, include: { purchase: true } });
      if (existing) return existing;
    }
    throw e;
  }
}

/** Start the clock: wallet and SPA entitlements are created from the snapshot. */
export async function activatePurchase(tx: Tx, purchaseId: string) {
  const purchase = await tx.membershipPurchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { product: { include: { spaItems: true } } } });
  if (purchase.status === 'ACTIVE') return purchase;
  if (purchase.status !== 'PENDING_PAYMENT') throw E.conflict('NOT_ACTIVATABLE', 'This purchase cannot be activated');
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + purchase.validityDays * 86_400_000);
  await tx.membershipPurchase.update({ where: { id: purchase.id }, data: { status: 'ACTIVE', startsAt, expiresAt, activatedAt: startsAt } });
  if (purchase.classCredits > 0) {
    const wallet = await tx.creditWallet.create({
      data: { userId: purchase.userId, purchaseId: purchase.id, total: purchase.classCredits, remaining: purchase.classCredits, expiresAt },
    });
    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        userId: purchase.userId,
        type: 'GRANT',
        delta: purchase.classCredits,
        balanceAfter: purchase.classCredits,
        reason: purchase.nameSnapshot,
        idempotencyKey: `grant:${purchase.id}`,
      },
    });
  }
  for (const item of purchase.product.spaItems) {
    await tx.spaEntitlement.create({
      data: { userId: purchase.userId, purchaseId: purchase.id, treatmentId: item.treatmentId, category: item.category, total: item.quantity, remaining: item.quantity, expiresAt },
    });
  }
  await notify(tx, {
    userId: purchase.userId,
    type: 'PURCHASE_ACTIVE',
    dedupeKey: `active:${purchase.id}`,
    params: { product: purchase.nameSnapshot, credits: purchase.classCredits, expires: formatStudio(expiresAt, 'd LLL yyyy') },
    data: { kind: 'purchase', purchaseId: purchase.id },
  });
  return purchase;
}

/**
 * The only two ways an order becomes paid: a person at the desk says so
 * (recorded with who), or a verified provider event does.
 */
export async function recordManualPayment(opts: { orderId: string; method: Exclude<PaymentMethod, 'ONLINE'>; amount?: number; note?: string; actorId: string }) {
  return transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string }[]>`select id from orders where id = ${opts.orderId}::uuid for update`;
    if (!row) throw E.notFound('Order');
    const order = await tx.order.findUniqueOrThrow({ where: { id: opts.orderId }, include: { purchase: true } });
    if (order.status !== 'PENDING') throw E.conflict('ORDER_NOT_PENDING', `This order is ${order.status.toLowerCase()}`);
    const amount = opts.amount ?? order.total;
    if (amount !== order.total) throw E.badRequest('AMOUNT_MISMATCH', `The order total is ${order.total} ALL`);
    const payment = await tx.payment.create({
      data: { orderId: order.id, method: opts.method, status: 'COMPLETED', amount, confirmedById: opts.actorId, note: opts.note, completedAt: new Date(), provider: 'manual' },
    });
    await tx.order.update({ where: { id: order.id }, data: { status: 'PAID' } });
    if (order.purchase) await activatePurchase(tx, order.purchase.id);
    await audit(tx, opts.actorId, 'payment.record', 'order', order.id, { method: opts.method, amount });
    return payment;
  });
}

export async function cancelOrder(orderId: string, actor: { id: string; role: string }) {
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { purchase: true } });
    if (!order || (actor.role === 'CLIENT' && order.userId !== actor.id)) throw E.notFound('Order');
    if (order.status !== 'PENDING') throw E.conflict('ORDER_NOT_PENDING', 'Only unpaid orders can be cancelled');
    await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    if (order.purchase) await tx.membershipPurchase.update({ where: { id: order.purchase.id }, data: { status: 'CANCELLED' } });
    if (order.promotionId) await tx.promotionCode.update({ where: { id: order.promotionId }, data: { redemptionCount: { decrement: 1 } } });
    await audit(tx, actor.id, 'order.cancel', 'order', orderId);
    return { ok: true };
  });
}

/** Refund a completed payment. Remaining credits of the purchase are withdrawn. */
export async function refundPayment(opts: { paymentId: string; amount: number; reason?: string; actorId: string; cancelPurchase: boolean }) {
  return transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string }[]>`select id from payments where id = ${opts.paymentId}::uuid for update`;
    if (!row) throw E.notFound('Payment');
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: opts.paymentId }, include: { refunds: true, order: { include: { purchase: { include: { wallet: true } } } } } });
    if (payment.status !== 'COMPLETED') throw E.conflict('NOT_REFUNDABLE', 'Only completed payments can be refunded');
    const refunded = payment.refunds.reduce((s, r) => s + r.amount, 0);
    if (opts.amount <= 0 || opts.amount + refunded > payment.amount) throw E.badRequest('AMOUNT_MISMATCH', 'Refund exceeds the payment');
    const refund = await tx.refund.create({ data: { paymentId: payment.id, amount: opts.amount, reason: opts.reason, actorId: opts.actorId } });
    if (opts.amount + refunded === payment.amount) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
      await tx.order.update({ where: { id: payment.orderId }, data: { status: 'REFUNDED' } });
    }
    const purchase = payment.order.purchase;
    if (opts.cancelPurchase && purchase) {
      await tx.membershipPurchase.update({ where: { id: purchase.id }, data: { status: 'CANCELLED' } });
      if (purchase.wallet && purchase.wallet.remaining > 0) {
        await tx.creditWallet.update({ where: { id: purchase.wallet.id }, data: { remaining: 0 } });
        await tx.creditTransaction.create({
          data: { walletId: purchase.wallet.id, userId: purchase.userId, type: 'ADMIN_DEDUCT', delta: -purchase.wallet.remaining, balanceAfter: 0, reason: 'Refunded', actorId: opts.actorId },
        });
      }
      await tx.spaEntitlement.updateMany({ where: { purchaseId: purchase.id }, data: { remaining: 0 } });
    }
    await audit(tx, opts.actorId, 'payment.refund', 'payment', payment.id, { amount: opts.amount, cancelPurchase: opts.cancelPurchase });
    return refund;
  });
}

/**
 * Online payments are a seam, not a feature: no provider is configured until
 * the studio signs with one. A provider adapter verifies its webhook signature
 * and then calls `completeOnlinePayment`; nothing else can mark it paid.
 */
export interface PaymentProvider {
  id: string;
  createCheckout(order: { id: string; reference: string; total: number }): Promise<{ checkoutUrl: string; providerRef: string }>;
  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<{ providerRef: string; paid: boolean } | null>;
}

export function paymentProvider(): PaymentProvider | null {
  switch (env.PAYMENT_PROVIDER) {
    case 'none':
    default:
      return null;
  }
}

export async function completeOnlinePayment(providerRef: string) {
  return transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { providerRef }, include: { order: { include: { purchase: true } } } });
    if (!payment || payment.status === 'COMPLETED') return payment;
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });
    if (payment.order.purchase) await activatePurchase(tx, payment.order.purchase.id);
    await audit(tx, null, 'payment.online_complete', 'payment', payment.id);
    return payment;
  });
}
