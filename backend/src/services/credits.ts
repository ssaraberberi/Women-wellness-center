import type { CreditTxType, CreditWallet } from '@prisma/client';
import { type Tx } from '../lib/prisma.js';
import { E } from '../lib/errors.js';

/**
 * Credits live in wallets, one per purchased package, and every change is a
 * row in credit_transactions. `remaining` is only ever changed together with
 * the ledger row that explains it, under a row lock on the wallet.
 */

/** Wallets that can pay for something happening at `at`, soonest-expiring first, locked. */
export async function lockUsableWallets(tx: Tx, userId: string, at: Date): Promise<CreditWallet[]> {
  return tx.$queryRaw<CreditWallet[]>`
    select w.id, w.user_id as "userId", w.purchase_id as "purchaseId", w.total, w.remaining,
           w.expires_at as "expiresAt", w.created_at as "createdAt", w.updated_at as "updatedAt"
    from credit_wallets w
    join membership_purchases p on p.id = w.purchase_id
    where w.user_id = ${userId}::uuid
      and p.status = 'ACTIVE'
      and w.expires_at > ${at}
      and w.expires_at > now()
      and (p.starts_at is null or p.starts_at <= ${at})
    order by w.expires_at asc, w.created_at asc
    for update of w`;
}

/** Read-only version, for showing eligibility before booking. */
export async function usableCredits(tx: Tx, userId: string, at: Date) {
  const rows = await tx.$queryRaw<{ remaining: number }[]>`
    select coalesce(sum(w.remaining), 0)::int as remaining
    from credit_wallets w join membership_purchases p on p.id = w.purchase_id
    where w.user_id = ${userId}::uuid and p.status = 'ACTIVE' and w.expires_at > ${at} and w.expires_at > now()
      and (p.starts_at is null or p.starts_at <= ${at})`;
  return rows[0]?.remaining ?? 0;
}

export async function spendCredits(
  tx: Tx,
  opts: { userId: string; credits: number; at: Date; bookingId: string; actorId?: string },
): Promise<{ walletId: string | null }> {
  if (opts.credits <= 0) return { walletId: null };
  const wallets = await lockUsableWallets(tx, opts.userId, opts.at);
  if (!wallets.length) {
    const any = await tx.creditWallet.count({ where: { userId: opts.userId } });
    throw any
      ? E.conflict('MEMBERSHIP_EXPIRED', 'Your package does not cover this date')
      : E.conflict('NO_MEMBERSHIP', 'You need a package to book');
  }
  const wallet = wallets.find((w) => w.remaining >= opts.credits);
  if (!wallet) throw E.conflict('INSUFFICIENT_CREDITS', 'Not enough credits');
  const balanceAfter = wallet.remaining - opts.credits;
  await tx.creditWallet.update({ where: { id: wallet.id }, data: { remaining: balanceAfter } });
  await tx.creditTransaction.create({
    data: {
      walletId: wallet.id,
      userId: opts.userId,
      type: 'BOOKING',
      delta: -opts.credits,
      balanceAfter,
      bookingId: opts.bookingId,
      actorId: opts.actorId,
      // A booking spends once, however many times the request is retried.
      idempotencyKey: `booking:${opts.bookingId}`,
    },
  });
  return { walletId: wallet.id };
}

/** Give a booking's credits back, once. */
export async function refundBookingCredits(
  tx: Tx,
  booking: { id: string; userId: string; walletId: string | null; creditsUsed: number; creditRefunded: boolean },
  type: Extract<CreditTxType, 'REFUND' | 'ADMIN_RESTORE'>,
  reason: string,
  actorId?: string,
) {
  if (!booking.walletId || booking.creditsUsed <= 0 || booking.creditRefunded) return false;
  const [w] = await tx.$queryRaw<{ remaining: number }[]>`select remaining from credit_wallets where id = ${booking.walletId}::uuid for update`;
  const balanceAfter = w.remaining + booking.creditsUsed;
  await tx.creditWallet.update({ where: { id: booking.walletId }, data: { remaining: balanceAfter } });
  await tx.creditTransaction.create({
    data: {
      walletId: booking.walletId,
      userId: booking.userId,
      type,
      delta: booking.creditsUsed,
      balanceAfter,
      bookingId: booking.id,
      reason,
      actorId,
      idempotencyKey: `refund:${booking.id}`,
    },
  });
  await tx.classBooking.update({ where: { id: booking.id }, data: { creditRefunded: true } });
  return true;
}

/** Desk adjustments. Adding grows the wallet's total; deducting can never go below zero. */
export async function adjustWallet(
  tx: Tx,
  opts: { walletId: string; delta: number; reason: string; actorId: string; idempotencyKey?: string },
) {
  const [w] = await tx.$queryRaw<{ remaining: number; total: number; user_id: string }[]>`
    select remaining, total, user_id from credit_wallets where id = ${opts.walletId}::uuid for update`;
  if (!w) throw E.notFound('Wallet');
  if (opts.delta === 0) throw E.badRequest('VALIDATION', 'Delta must not be zero');
  const balanceAfter = w.remaining + opts.delta;
  if (balanceAfter < 0) throw E.conflict('INSUFFICIENT_CREDITS', 'Credits cannot go below zero');
  await tx.creditWallet.update({
    where: { id: opts.walletId },
    data: { remaining: balanceAfter, total: opts.delta > 0 ? w.total + opts.delta : w.total },
  });
  return tx.creditTransaction.create({
    data: {
      walletId: opts.walletId,
      userId: w.user_id,
      type: opts.delta > 0 ? 'ADMIN_ADD' : 'ADMIN_DEDUCT',
      delta: opts.delta,
      balanceAfter,
      reason: opts.reason,
      actorId: opts.actorId,
      idempotencyKey: opts.idempotencyKey,
    },
  });
}
