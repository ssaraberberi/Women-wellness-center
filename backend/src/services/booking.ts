import type { BookingSource, ClassSession, StudioSettings } from '@prisma/client';
import { reference } from '../lib/crypto.js';
import { randomUUID } from 'node:crypto';
import { prisma, transaction, isUniqueViolation, type Tx } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { getSettings, audit } from '../lib/settings.js';
import { addMinutes, formatStudio, studioDate, studioDayRange, dbDate } from '../lib/time.js';
import { refundBookingCredits, spendCredits, usableCredits } from './credits.js';
import { notify, notifyAdmins } from './notify.js';

type Actor = { id: string; role: 'CLIENT' | 'STAFF' | 'ADMIN' };

export const whenText = (d: Date, lang: 'sq' | 'en' = 'sq') => formatStudio(d, lang === 'sq' ? "ccc d LLL, HH:mm" : 'ccc d LLL, HH:mm', lang);

/** Lock the class row: every capacity decision for this class happens one at a time. */
export async function lockSession(tx: Tx, sessionId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`select id from class_sessions where id = ${sessionId}::uuid for update`;
  if (!rows.length) throw E.notFound('Class');
  return tx.classSession.findUniqueOrThrow({ where: { id: sessionId }, include: { classType: true, instructor: { include: { user: { include: { profile: true } } } } } });
}

/** Places taken: live bookings plus places held for a waiting-list offer. */
export async function takenPlaces(tx: Tx, sessionId: string, exceptOfferForUser?: string) {
  const [booked, held] = await Promise.all([
    tx.classBooking.count({ where: { sessionId, status: 'BOOKED' } }),
    tx.classWaitlist.count({
      where: {
        sessionId,
        status: 'OFFERED',
        offerExpiresAt: { gt: new Date() },
        ...(exceptOfferForUser ? { userId: { not: exceptOfferForUser } } : {}),
      },
    }),
  ]);
  return { booked, held, taken: booked + held };
}

async function assertBookable(tx: Tx, session: ClassSession, settings: StudioSettings, actor: Actor) {
  if (session.status !== 'SCHEDULED') throw E.conflict('CLASS_CANCELLED', 'This class is not taking bookings');
  const now = new Date();
  if (session.startsAt <= addMinutes(now, actor.role === 'ADMIN' ? 0 : settings.bookingCutoffMin)) {
    throw E.conflict('CLASS_STARTED', 'This class has already started');
  }
  if (actor.role !== 'ADMIN' && session.startsAt > addMinutes(now, settings.bookingWindowDays * 1440)) {
    throw E.conflict('BOOKING_NOT_OPEN', 'Booking for this date is not open yet');
  }
  const closed = await tx.studioClosure.findUnique({ where: { date: dbDate(studioDate(session.startsAt)) } });
  if (closed) throw E.conflict('STUDIO_CLOSED', 'The studio is closed that day');
}

/**
 * Book one place. Inside one transaction: lock the class, re-count places,
 * spend the credit, write the booking. The app's "3 places left" is a hint;
 * this is the decision.
 */
export async function bookClass(
  userId: string,
  sessionId: string,
  // pay: 'credits' spends sessions from her package (the default); 'single' books
  // one class without a package and writes what she owes as a PENDING order at
  // the price of the active SINGLE product. Chosen by the server, never by the request body.
  opts: { actor: Actor; idempotencyKey?: string | null; source?: BookingSource; pay?: 'credits' | 'single'; skipEmail?: boolean },
) {
  const useCredit = opts.pay !== 'single';
  if (opts.idempotencyKey) {
    const existing = await prisma.classBooking.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: opts.idempotencyKey } } });
    if (existing) return existing;
  }
  const settings = await getSettings();
  try {
    return await transaction(async (tx) => {
      const session = await lockSession(tx, sessionId);
      // A concurrent retry may have committed while we waited for the lock.
      if (opts.idempotencyKey) {
        const existing = await tx.classBooking.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: opts.idempotencyKey } } });
        if (existing) return existing;
      }
      await assertBookable(tx, session, settings, opts.actor);

      const already = await tx.classBooking.findFirst({ where: { sessionId, userId, status: 'BOOKED' } });
      if (already) throw E.conflict('ALREADY_BOOKED', 'You already have a place in this class');

      const offer = await tx.classWaitlist.findFirst({
        where: { sessionId, userId, status: 'OFFERED', offerExpiresAt: { gt: new Date() } },
      });
      const { taken } = await takenPlaces(tx, sessionId, offer ? userId : undefined);
      if (taken >= session.capacity) {
        throw E.conflict('CLASS_FULL', 'This class is full', { waitlist: settings.waitlistEnabled });
      }

      const booking = await tx.classBooking.create({
        data: {
          sessionId,
          userId,
          status: 'BOOKED',
          source: offer ? 'WAITLIST' : (opts.source ?? 'CLIENT'),
          idempotencyKey: opts.idempotencyKey ?? undefined,
          creditsUsed: useCredit ? session.classType.creditsRequired : 0,
        },
      });
      let walletId: string | null = null;
      if (useCredit) {
        ({ walletId } = await spendCredits(tx, {
          userId,
          credits: session.classType.creditsRequired,
          at: session.startsAt,
          bookingId: booking.id,
          actorId: opts.actor.id,
        }));
        await tx.classBooking.update({ where: { id: booking.id }, data: { walletId } });
      }
      // A single class: confirmed now, paid at the studio. The order is the debt, not money received.
      let order: { id: string; reference: string; total: number } | null = null;
      if (!useCredit) {
        const product = await singleClassProduct(tx);
        order = await tx.order.create({
          data: { reference: reference(), userId, subtotal: product.price, total: product.price, createdById: opts.actor.id, bookingId: booking.id },
          select: { id: true, reference: true, total: true },
        });
      }

      // Booking directly while waiting (a place opened for everyone) settles the entry too.
      await tx.classWaitlist.updateMany({
        where: { sessionId, userId, status: { in: ['WAITING', 'OFFERED'] } },
        data: { status: 'ACCEPTED' },
      });

      await notify(tx, {
        userId,
        type: 'CLASS_BOOKED',
        dedupeKey: `booked:${booking.id}`,
        params: { className: session.classType.name, when: whenText(session.startsAt), instructor: instructorName(session), price: order ? lek(order.total) : undefined },
        data: { kind: 'class', bookingId: booking.id, sessionId },
        skipEmail: opts.skipEmail,
      });
      await tellStaff(tx, session, { type: 'STAFF_NEW_BOOKING', dedupeKey: `booked:${booking.id}`, clientId: userId, actorId: opts.actor.id });
      if (opts.actor.role === 'ADMIN') {
        await audit(tx, opts.actor.id, 'booking.create_for_client', 'class_booking', booking.id, { userId, sessionId, pay: opts.pay ?? 'credits' });
      }
      return { ...booking, walletId, order };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      if (opts.idempotencyKey) {
        const existing = await prisma.classBooking.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: opts.idempotencyKey } } });
        if (existing) return existing;
      }
      throw E.conflict('ALREADY_BOOKED', 'You already have a place in this class');
    }
    throw e;
  }
}

/**
 * A DUO's two packages that can pay for a class at `at`: hers and her
 * partner's, both active, both with enough left. Null when there is none.
 */
export async function duoWallets(db: Tx | typeof prisma, userId: string, at: Date, credits = 1) {
  const mine = await db.membershipPurchase.findMany({
    where: { userId, status: 'ACTIVE', together: true, pairId: { not: null }, expiresAt: { gt: at }, wallet: { remaining: { gte: credits } } },
    include: { wallet: true },
    orderBy: { expiresAt: 'asc' },
  });
  for (const p of mine) {
    const other = await db.membershipPurchase.findFirst({
      where: { pairId: p.pairId, userId: { not: userId }, status: 'ACTIVE', expiresAt: { gt: at }, wallet: { remaining: { gte: credits } } },
      include: { wallet: true, user: { include: { profile: true } } },
    });
    if (other?.wallet && p.wallet) return { pairId: p.pairId!, mine: p.wallet, partner: { userId: other.userId, wallet: other.wallet, name: other.user.profile ? `${other.user.profile.firstName} ${other.user.profile.lastName}`.trim() : '' } };
  }
  return null;
}

/**
 * A DUO that comes together: one booking places both, in one transaction —
 * two places or none, a session from each one's own DUO package. Cancelling
 * either cancels both (see cancelBooking).
 */
export async function bookDuo(userId: string, sessionId: string, opts: { actor: Actor; idempotencyKey?: string | null; source?: BookingSource }) {
  if (opts.idempotencyKey) {
    const existing = await prisma.classBooking.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: opts.idempotencyKey } } });
    if (existing) return prisma.classBooking.findMany({ where: { pairId: existing.pairId ?? existing.id } });
  }
  const settings = await getSettings();
  try {
    return await transaction(async (tx) => {
      const session = await lockSession(tx, sessionId);
      await assertBookable(tx, session, settings, opts.actor);
      const duo = await duoWallets(tx, userId, session.startsAt, session.classType.creditsRequired);
      if (!duo) throw E.conflict('NO_DUO', 'There is no DUO package with classes left for both of you');
      const people = [userId, duo.partner.userId];
      if (await tx.classBooking.count({ where: { sessionId, userId: { in: people }, status: 'BOOKED' } })) {
        throw E.conflict('ALREADY_BOOKED', 'One of you already has a place in this class');
      }
      const { taken } = await takenPlaces(tx, sessionId);
      if (taken + 2 > session.capacity) throw E.conflict('CLASS_FULL', 'There are not two places left in this class', { waitlist: false });

      const pairId = randomUUID();
      const made = [];
      for (const [who, wallet] of [[userId, duo.mine], [duo.partner.userId, duo.partner.wallet]] as const) {
        const b = await tx.classBooking.create({
          data: {
            sessionId,
            userId: who,
            status: 'BOOKED',
            source: opts.source ?? 'CLIENT',
            pairId,
            // The key is the booker's; the partner's row carries none (her own key space).
            idempotencyKey: who === userId ? (opts.idempotencyKey ?? undefined) : undefined,
            creditsUsed: session.classType.creditsRequired,
          },
        });
        await spendCredits(tx, { userId: who, credits: session.classType.creditsRequired, at: session.startsAt, bookingId: b.id, actorId: opts.actor.id, walletId: wallet.id });
        await tx.classBooking.update({ where: { id: b.id }, data: { walletId: wallet.id } });
        await notify(tx, {
          userId: who,
          type: 'CLASS_BOOKED',
          dedupeKey: `booked:${b.id}`,
          params: { className: session.classType.name, when: whenText(session.startsAt), instructor: instructorName(session) },
          data: { kind: 'class', bookingId: b.id, sessionId },
        });
        await tellStaff(tx, session, { type: 'STAFF_NEW_BOOKING', dedupeKey: `booked:${b.id}`, clientId: who, actorId: opts.actor.id });
        made.push({ ...b, walletId: wallet.id });
      }
      if (opts.actor.role === 'ADMIN') await audit(tx, opts.actor.id, 'booking.create_duo', 'class_session', sessionId, { pairId, people });
      return made;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw E.conflict('ALREADY_BOOKED', 'One of you already has a place in this class');
    throw e;
  }
}

export const lek = (n: number) => `${n.toLocaleString('en-US')} L`;

/**
 * The price of one class without a package: the one active SINGLE product.
 * None, or more than one, is a setup problem the desk must fix — never a guess.
 */
export async function singleClassProduct(db: Tx | typeof prisma) {
  const rows = await db.membershipProduct.findMany({ where: { kind: 'SINGLE', active: true }, select: { id: true, name: true, nameEn: true, price: true } });
  if (rows.length !== 1 || rows[0].price <= 0) {
    throw E.conflict('SINGLE_PRICE_MISSING', rows.length > 1 ? 'More than one single-class price is active' : 'No single-class price is set up', { active: rows.length });
  }
  return rows[0];
}

export const instructorName = (s: { instructor?: { user: { profile: { firstName: string; lastName: string } | null } } | null }) =>
  s.instructor?.user.profile ? `${s.instructor.user.profile.firstName} ${s.instructor.user.profile.lastName}`.trim() : undefined;

/**
 * Tell the class's instructor and every admin that someone booked or
 * cancelled — with who, and how full the class is now. Whoever did it
 * (an admin booking at the desk) is not told about her own action.
 */
async function tellStaff(
  tx: Tx,
  session: { id: string; startsAt: Date; capacity: number; instructorId: string | null; classType: { name: string } },
  opts: { type: 'STAFF_NEW_BOOKING' | 'STAFF_BOOKING_CANCELLED'; dedupeKey: string; clientId: string; actorId: string; late?: boolean },
) {
  const [profile, booked] = await Promise.all([
    tx.userProfile.findUnique({ where: { userId: opts.clientId }, select: { firstName: true, lastName: true } }),
    tx.classBooking.count({ where: { sessionId: session.id, status: 'BOOKED' } }),
  ]);
  const params = {
    client: profile ? `${profile.firstName} ${profile.lastName}`.trim() : '—',
    className: session.classType.name,
    when: whenText(session.startsAt),
    booked,
    capacity: session.capacity,
    late: opts.late ? 1 : undefined,
  };
  const data = { kind: 'class', sessionId: session.id };
  if (session.instructorId && session.instructorId !== opts.actorId) {
    if (opts.type === 'STAFF_NEW_BOOKING') {
      await notify(tx, { userId: session.instructorId, type: 'INSTRUCTOR_NEW_BOOKING', dedupeKey: `${opts.dedupeKey}:instructor`, params: { client: params.client, ...(await instructorDay(tx, session.instructorId, session)) }, data });
    } else {
      await notify(tx, { userId: session.instructorId, type: opts.type, dedupeKey: `${opts.dedupeKey}:instructor`, params, data });
    }
  }
  await notifyAdmins(tx, { type: opts.type, dedupeKey: opts.dedupeKey, params, data, exceptUserId: opts.actorId });
}

/**
 * The class's hours ("20:00-21:00"), its day, and every class she teaches that
 * day with how full it is: one row per class, time and what, tab-separated.
 */
async function instructorDay(tx: Tx, instructorId: string, session: { startsAt: Date }) {
  const day = studioDate(session.startsAt);
  const { from, to } = studioDayRange(day);
  const classes = await tx.classSession.findMany({
    where: { instructorId, status: 'SCHEDULED', startsAt: { gte: from, lt: to } },
    include: { classType: true, _count: { select: { bookings: { where: { status: 'BOOKED' } } } } },
    orderBy: { startsAt: 'asc' },
  });
  const range = (s: { startsAt: Date; endsAt: Date }) => `${formatStudio(s.startsAt, 'HH:mm')}-${formatStudio(s.endsAt, 'HH:mm')}`;
  const mine = classes.find((c) => +c.startsAt === +session.startsAt);
  return {
    range: mine ? range(mine) : formatStudio(session.startsAt, 'HH:mm'),
    day: formatStudio(session.startsAt, 'cccc, d LLLL'),
    summary: classes.map((c) => `${range(c)}\t${c.classType.name} · ${c._count.bookings}/${c.capacity}`).join('\n'),
  };
}

/** When free cancellation ends for a class. */
export const freeCancelDeadline = (startsAt: Date, settings: StudioSettings) => addMinutes(startsAt, -settings.freeCancelHours * 60);

/**
 * The last moment a cancellation is still free, for showing: one second before
 * the deadline, so a 17:00 class with 1 hour reads "until 15:59" — from 16:00 the
 * session is used up.
 */
export const lastFreeCancel = (startsAt: Date, settings: StudioSettings) => new Date(+freeCancelDeadline(startsAt, settings) - 1000);

/**
 * Cancel a booking. In time (at least `freeCancelHours` before, never less
 * than 1 hour): the session comes back. Late: the session counts as used, just
 * like not turning up. Only an admin can choose to give it back.
 */
export async function cancelBooking(bookingId: string, actor: Actor, opts: { restoreCredit?: boolean } = {}) {
  const settings = await getSettings();
  return transaction(async (tx) => {
    const pre = await tx.classBooking.findUnique({ where: { id: bookingId } });
    if (!pre) throw E.notFound('Booking');
    if (actor.role === 'CLIENT' && pre.userId !== actor.id) throw E.notFound('Booking');
    const session = await lockSession(tx, pre.sessionId);
    const booking = await tx.classBooking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.status !== 'BOOKED') throw E.conflict('NOT_CANCELLABLE', 'This booking is not active');

    const now = new Date();
    if (actor.role === 'CLIENT' && session.startsAt <= now) throw E.conflict('CANCEL_CLOSED', 'The class has already started');

    // Strictly before the deadline: with 1 hour, 15:59 is free and 16:00 is late.
    const inTime = now < freeCancelDeadline(session.startsAt, settings);
    const refund = inTime || (actor.role === 'ADMIN' && opts.restoreCredit === true);
    // A DUO that came together cancels together, under the same rule for both.
    const targets = booking.pairId ? await tx.classBooking.findMany({ where: { pairId: booking.pairId, status: 'BOOKED' } }) : [booking];
    let refunded = false;
    let orderVoided = false;
    for (const b of targets) {
      await tx.classBooking.update({
        where: { id: b.id },
        data: { status: inTime ? 'CANCELLED' : 'LATE_CANCELLED', cancelledAt: now, cancelledById: actor.id },
      });
      let back = false;
      // A single class not yet paid: cancelled in time (or forgiven by the desk) she owes nothing;
      // late, the order stays PENDING — the debt remains, just like a used session.
      const voided = refund ? await voidUnpaidOrder(tx, b.id) : false;
      if (refund) {
        back = await refundBookingCredits(tx, b, actor.role === 'ADMIN' && !inTime ? 'ADMIN_RESTORE' : 'REFUND', inTime ? 'Cancelled in time' : 'Late cancellation, credit returned', actor.id);
      } else if (b.walletId) {
        const w = await tx.creditWallet.findUniqueOrThrow({ where: { id: b.walletId } });
        await tx.creditTransaction.create({
          data: { walletId: b.walletId, userId: b.userId, type: 'LATE_CANCEL_KEPT', delta: 0, balanceAfter: w.remaining, bookingId: b.id, reason: 'Late cancellation', actorId: actor.id, idempotencyKey: `late:${b.id}` },
        });
      }
      if (b.id === booking.id) [refunded, orderVoided] = [back, voided];
      await notify(tx, {
        userId: b.userId,
        type: 'CLASS_CANCELLED',
        dedupeKey: `cancel:${b.id}`,
        params: { className: session.classType.name, when: whenText(session.startsAt), refunded: back ? 1 : undefined },
        data: { kind: 'class', bookingId: b.id, sessionId: session.id },
      });
      await tellStaff(tx, session, { type: 'STAFF_BOOKING_CANCELLED', dedupeKey: `cancel:${b.id}`, clientId: b.userId, actorId: actor.id, late: !inTime });
      if (actor.role === 'ADMIN') await audit(tx, actor.id, 'booking.cancel', 'class_booking', b.id, { refunded: back, orderVoided: voided, pair: !!booking.pairId });
      // Her private links stop working with the booking.
      await tx.bookingManageToken.updateMany({ where: { bookingId: b.id, revokedAt: null }, data: { revokedAt: now } });
    }
    await offerFreedPlaces(tx, session.id, settings);
    return { status: inTime ? 'CANCELLED' : 'LATE_CANCELLED', refunded, orderVoided, cancelled: targets.length };
  });
}

/** Cancel what is still owed for a single class. Paid orders are left alone: money back is a refund, at the desk. */
async function voidUnpaidOrder(tx: Tx, bookingId: string) {
  const r = await tx.order.updateMany({ where: { bookingId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  return r.count > 0;
}

/** Restore the credit of a late cancellation or a no-show, at the desk — or, for a single class not paid, forgive what she owes. */
export async function restoreBookingCredit(bookingId: string, actorId: string, reason: string) {
  return transaction(async (tx) => {
    const booking = await tx.classBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw E.notFound('Booking');
    const credit = await refundBookingCredits(tx, booking, 'ADMIN_RESTORE', reason, actorId);
    const forgiven = booking.status !== 'BOOKED' || (await tx.classAttendance.count({ where: { bookingId, status: 'ABSENT' } })) > 0 ? await voidUnpaidOrder(tx, bookingId) : false;
    if (!credit && !forgiven) throw E.conflict('NOTHING_TO_RESTORE', 'There is no credit to restore on this booking');
    await audit(tx, actorId, 'credit.restore', 'class_booking', bookingId, { reason, credit, forgiven });
    return { ok: true };
  });
}

// ───────────────────────────── waiting list ─────────────────────────────

export async function joinWaitlist(userId: string, sessionId: string) {
  const settings = await getSettings();
  if (!settings.waitlistEnabled) throw E.conflict('WAITLIST_DISABLED', 'The waiting list is not available');
  try {
    return await transaction(async (tx) => {
      const session = await lockSession(tx, sessionId);
      await assertBookable(tx, session, settings, { id: userId, role: 'CLIENT' });
      if (await tx.classBooking.findFirst({ where: { sessionId, userId, status: 'BOOKED' } })) {
        throw E.conflict('ALREADY_BOOKED', 'You already have a place in this class');
      }
      const { taken } = await takenPlaces(tx, sessionId);
      if (taken < session.capacity) throw E.conflict('PLACES_AVAILABLE', 'There are places available — book directly');
      if ((await usableCredits(tx, userId, session.startsAt)) < session.classType.creditsRequired) {
        throw E.conflict('INSUFFICIENT_CREDITS', 'You need credits to join the waiting list');
      }
      const entry = await tx.classWaitlist.create({ data: { sessionId, userId } });
      const position = await tx.classWaitlist.count({ where: { sessionId, status: 'WAITING', createdAt: { lte: entry.createdAt } } });
      return { ...entry, position };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw E.conflict('ALREADY_WAITLISTED', 'You are already on the waiting list');
    throw e;
  }
}

export async function leaveWaitlist(userId: string, waitlistId: string) {
  const settings = await getSettings();
  return transaction(async (tx) => {
    const entry = await tx.classWaitlist.findUnique({ where: { id: waitlistId } });
    if (!entry || entry.userId !== userId) throw E.notFound('Waiting list entry');
    await lockSession(tx, entry.sessionId);
    if (entry.status !== 'WAITING' && entry.status !== 'OFFERED') throw E.conflict('NOT_WAITLISTED', 'Not on the waiting list');
    await tx.classWaitlist.update({ where: { id: entry.id }, data: { status: 'LEFT' } });
    if (entry.status === 'OFFERED') await offerFreedPlaces(tx, entry.sessionId, settings);
    return { ok: true };
  });
}

/** Accepting an offer is booking the held place. */
export async function acceptWaitlistOffer(userId: string, waitlistId: string, idempotencyKey?: string | null) {
  const entry = await prisma.classWaitlist.findUnique({ where: { id: waitlistId } });
  if (!entry || entry.userId !== userId) throw E.notFound('Waiting list entry');
  if (entry.status !== 'OFFERED' || !entry.offerExpiresAt || entry.offerExpiresAt < new Date()) {
    throw E.conflict('OFFER_EXPIRED', 'This offer has expired');
  }
  return bookClass(userId, entry.sessionId, { actor: { id: userId, role: 'CLIENT' }, idempotencyKey, source: 'WAITLIST' });
}

/**
 * Called (under the class lock) whenever a place may have opened: offer each
 * free place to the next eligible person waiting, held for a while.
 */
export async function offerFreedPlaces(tx: Tx, sessionId: string, settings: StudioSettings) {
  if (!settings.waitlistEnabled) return;
  const session = await tx.classSession.findUniqueOrThrow({ where: { id: sessionId }, include: { classType: true } });
  if (session.status !== 'SCHEDULED') return;
  const now = new Date();
  const lastMoment = addMinutes(session.startsAt, -settings.bookingCutoffMin);
  if (lastMoment <= now) return;
  let { taken } = await takenPlaces(tx, sessionId);
  let free = session.capacity - taken;
  if (free <= 0) return;

  const waiting = await tx.classWaitlist.findMany({ where: { sessionId, status: 'WAITING' }, orderBy: { createdAt: 'asc' } });
  for (const w of waiting) {
    if (free <= 0) break;
    if ((await usableCredits(tx, w.userId, session.startsAt)) < session.classType.creditsRequired) continue;
    const until = new Date(Math.min(addMinutes(now, settings.waitlistOfferMinutes).getTime(), lastMoment.getTime()));
    await tx.classWaitlist.update({ where: { id: w.id }, data: { status: 'OFFERED', offeredAt: now, offerExpiresAt: until } });
    await notify(tx, {
      userId: w.userId,
      type: 'WAITLIST_OFFER',
      dedupeKey: `offer:${w.id}`,
      params: { className: session.classType.name, when: whenText(session.startsAt), until: formatStudio(until, 'HH:mm') },
      data: { kind: 'waitlist', waitlistId: w.id, sessionId },
    });
    free--;
    taken++;
  }
}

/** Worker: offers that ran out go back to the list, and the place moves on. */
export async function expireWaitlistOffers() {
  const settings = await getSettings();
  const expired = await prisma.classWaitlist.findMany({
    where: { status: 'OFFERED', offerExpiresAt: { lte: new Date() } },
    select: { id: true, sessionId: true },
    take: 100,
  });
  for (const e of expired) {
    await transaction(async (tx) => {
      const session = await lockSession(tx, e.sessionId);
      const res = await tx.classWaitlist.updateMany({ where: { id: e.id, status: 'OFFERED' }, data: { status: 'EXPIRED' } });
      if (!res.count) return;
      const row = await tx.classWaitlist.findUniqueOrThrow({ where: { id: e.id } });
      await notify(tx, {
        userId: row.userId,
        type: 'WAITLIST_EXPIRED',
        dedupeKey: `offer-expired:${e.id}`,
        params: { className: session.classType.name, when: whenText(session.startsAt) },
      });
      await offerFreedPlaces(tx, e.sessionId, settings);
    });
  }
  // Classes that have started close their lists.
  await prisma.classWaitlist.updateMany({
    where: { status: { in: ['WAITING', 'OFFERED'] }, session: { startsAt: { lte: new Date() } } },
    data: { status: 'CLOSED' },
  });
  return expired.length;
}

// ───────────────────────────── studio-side changes ─────────────────────────────

/** The studio cancels a class: every place is released with its credit, everyone is told. */
export async function cancelSession(sessionId: string, actorId: string, reason?: string) {
  return transaction(async (tx) => {
    const session = await lockSession(tx, sessionId);
    if (session.status === 'CANCELLED') return { ok: true, affected: 0 };
    await tx.classSession.update({ where: { id: sessionId }, data: { status: 'CANCELLED', cancelReason: reason, detached: true } });
    const bookings = await tx.classBooking.findMany({ where: { sessionId, status: 'BOOKED' } });
    for (const b of bookings) {
      await tx.classBooking.update({ where: { id: b.id }, data: { status: 'SESSION_CANCELLED', cancelledAt: new Date(), cancelledById: actorId } });
      await refundBookingCredits(tx, b, 'REFUND', 'Class cancelled by the studio', actorId);
      await voidUnpaidOrder(tx, b.id);
      await tx.bookingManageToken.updateMany({ where: { bookingId: b.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await notify(tx, {
        userId: b.userId,
        type: 'SESSION_CANCELLED',
        dedupeKey: `session-cancel:${sessionId}:${b.id}`,
        params: { className: session.classType.name, when: whenText(session.startsAt) },
        data: { kind: 'class', sessionId },
      });
    }
    await tx.classWaitlist.updateMany({ where: { sessionId, status: { in: ['WAITING', 'OFFERED'] } }, data: { status: 'CLOSED' } });
    if (session.instructorId) {
      await notify(tx, {
        userId: session.instructorId,
        type: 'STAFF_SESSION_CANCELLED',
        dedupeKey: `staff-session-cancel:${sessionId}`,
        params: { className: session.classType.name, when: whenText(session.startsAt) },
        data: { kind: 'session', sessionId },
      });
    }
    await audit(tx, actorId, 'session.cancel', 'class_session', sessionId, { reason, affected: bookings.length });
    return { ok: true, affected: bookings.length };
  });
}
