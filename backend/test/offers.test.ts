import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { scryptSync } from 'node:crypto';
import { creditsOf, getApp, makeSession, makeUser, prisma, resetDb } from './helpers.js';
import { cancelOrder, createOrder, recordManualPayment } from '../src/services/orders.js';
import { dbDate, studioDate } from '../src/lib/time.js';

const pkg = (over: Partial<{ name: string; price: number; classCredits: number; persons: number; kind: 'PACKAGE' | 'DUO'; active: boolean }> = {}) =>
  prisma.membershipProduct.create({ data: { kind: 'PACKAGE', name: '8 klasa', price: 12345, classCredits: 8, validityDays: 30, ...over } });
const offer = (data: Parameters<typeof prisma.offer.create>[0]['data']) => prisma.offer.create({ data: { active: true, ...data } });
const err = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);
const walletOf = (userId: string) => prisma.creditWallet.findFirst({ where: { userId } });

describe('offers, as the website had them', () => {
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it('FOUNDING GIRLS: a percentage off chosen packages, once per person, under its cap, for new clients only', async () => {
    const a = await pkg();
    const b = await pkg({ name: 'Mujore', price: 20000 });
    const o = await offer({ kind: 'DISCOUNT', title: 'FOUNDING GIRLS', discountPct: 15, maxRedemptions: 2, newClientsOnly: true, eligibleProducts: { create: [{ productId: a.id }] } });
    const [x, y, z] = [await makeUser(), await makeUser(), await makeUser()];

    const order = await createOrder({ userId: x.id, productId: a.id, offerId: o.id, actorId: x.id });
    expect(order).toMatchObject({ subtotal: 12345, discount: 1852, total: 10493, offerId: o.id }); // rounded to the lek, as on the website
    expect(await err(createOrder({ userId: x.id, productId: a.id, offerId: o.id, actorId: x.id }))).toBe('OFFER_USED');
    expect(await err(createOrder({ userId: y.id, productId: b.id, offerId: o.id, actorId: y.id }))).toBe('OFFER_NOT_APPLICABLE');
    await createOrder({ userId: y.id, productId: a.id, offerId: o.id, actorId: y.id });
    expect(await err(createOrder({ userId: z.id, productId: a.id, offerId: o.id, actorId: z.id }))).toBe('OFFER_LIMIT');

    // Cancelling an unpaid order gives the place under the cap back.
    await cancelOrder(order.id, { id: x.id, role: 'CLIENT' });
    await createOrder({ userId: z.id, productId: a.id, offerId: o.id, actorId: z.id });

    // New clients only: someone who already had a package cannot.
    const old = await makeUser();
    const first = await createOrder({ userId: old.id, productId: b.id, actorId: old.id });
    await recordManualPayment({ orderId: first.id, method: 'CASH', actorId: old.id });
    const o2 = await offer({ kind: 'DISCOUNT', title: 'NEW ONLY', discountPct: 10, newClientsOnly: true });
    expect(await err(createOrder({ userId: old.id, productId: a.id, offerId: o2.id, actorId: old.id }))).toBe('OFFER_NEW_ONLY');
    // Outside its dates it is not live.
    const o3 = await offer({ kind: 'DISCOUNT', title: 'OVER', discountPct: 10, endsOn: dbDate('2020-01-01') });
    expect(await err(createOrder({ userId: z.id, productId: b.id, offerId: o3.id, actorId: z.id }))).toBe('OFFER_UNAVAILABLE');
    expect(studioDate(new Date())).toBeTruthy();
  });

  it('DUA DUO: one order, two people, credits only after payment; booked together, cancelled together', async () => {
    const app = await getApp();
    const duo = await pkg({ kind: 'DUO', name: 'DUA DUO', price: 20000, persons: 2, active: false });
    const o = await offer({ kind: 'BUNDLE', title: 'DUA DUO', productId: duo.id, together: true });
    const ana = await makeUser();
    const existing = await makeUser(); // phone +355690000000
    const admin = await makeUser('ADMIN');

    const order = await createOrder({ userId: ana.id, offerId: o.id, productId: '', partner: { firstName: 'Bea', lastName: 'Duo', phone: '+355690000000' }, actorId: ana.id });
    const pair = await prisma.membershipPurchase.findMany({ where: { pairId: { not: null } }, include: { wallet: true } });
    expect(pair).toHaveLength(2);
    expect(pair.every((p) => p.status === 'PENDING_PAYMENT' && !p.wallet)).toBe(true); // nothing before payment
    const bea = pair.find((p) => p.userId !== ana.id)!.userId;
    expect(bea).not.toBe(existing.id); // same phone, still her own profile
    const note = await prisma.clientNote.findFirstOrThrow({ where: { clientId: bea } });
    expect(note.body).toContain(existing.id); // flagged for the desk

    await recordManualPayment({ orderId: order.id, method: 'CASH', actorId: admin.id });
    expect(await creditsOf(ana.id)).toBe(8);
    expect(await creditsOf(bea)).toBe(8);

    // Bea cannot spend the DUO alone.
    const s = await makeSession({ inHours: 24, capacity: 3 });
    const beaToken = (await makeUserToken(bea));
    expect((await app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: { authorization: beaToken, 'idempotency-key': 'b1' } })).json().error.code).toBe('DUO_TOGETHER');

    // One booking places both: two places gone, one session from each.
    const r = await app.inject({ method: 'POST', url: `/sessions/${s.id}/book-duo`, headers: { ...ana.auth, 'idempotency-key': 'd1' } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toHaveLength(2);
    expect((await walletOf(ana.id))!.remaining).toBe(7);
    expect((await walletOf(bea))!.remaining).toBe(7);
    expect(await prisma.classBooking.count({ where: { sessionId: s.id, status: 'BOOKED' } })).toBe(2);
    const detail = (await app.inject({ method: 'GET', url: `/admin/sessions/${s.id}`, headers: admin.auth })).json();
    expect(detail.bookings.map((b: { userId: string }) => b.userId).sort()).toEqual([ana.id, bea].sort()); // both in attendance and CRM

    // A repeated tap books once.
    await app.inject({ method: 'POST', url: `/sessions/${s.id}/book-duo`, headers: { ...ana.auth, 'idempotency-key': 'd1' } });
    expect(await prisma.classBooking.count({ where: { sessionId: s.id } })).toBe(2);

    // Only one place left in another class: the DUO is refused, nothing is spent.
    const tight = await makeSession({ inHours: 30, capacity: 1 });
    expect((await app.inject({ method: 'POST', url: `/sessions/${tight.id}/book-duo`, headers: { ...ana.auth, 'idempotency-key': 'd2' } })).json().error.code).toBe('CLASS_FULL');
    expect((await walletOf(ana.id))!.remaining).toBe(7);

    // Bea cancels in time: both go, both get the session back.
    const beaBooking = await prisma.classBooking.findFirstOrThrow({ where: { userId: bea, sessionId: s.id } });
    const c = await app.inject({ method: 'POST', url: `/bookings/${beaBooking.id}/cancel`, headers: { authorization: beaToken } });
    expect(c.json()).toMatchObject({ status: 'CANCELLED', cancelled: 2 });
    expect((await walletOf(ana.id))!.remaining).toBe(8);
    expect((await walletOf(bea))!.remaining).toBe(8);
  });

  it('BRING A BESTIE: the bonus waits for its condition and is given once, to both', async () => {
    const a = await pkg();
    const o = await offer({ kind: 'BONUS', title: 'BRING A BESTIE', bonusClasses: 1, bonusTo: 'BOTH', bonusWhen: 'FRIEND_PAID', friendRequired: true, eligibleProducts: { create: [{ productId: a.id }] } });
    const ana = await makeUser();
    const admin = await makeUser('ADMIN');
    expect(await err(createOrder({ userId: ana.id, productId: a.id, offerId: o.id, actorId: ana.id }))).toBe('FRIEND_REQUIRED');

    const order = await createOrder({ userId: ana.id, productId: a.id, offerId: o.id, friend: { firstName: 'Klea', lastName: 'Friend', phone: '+355691234567' }, actorId: ana.id });
    const friendId = (await prisma.offerClaim.findFirstOrThrow({ where: { role: 'FRIEND' } })).clientId;
    await recordManualPayment({ orderId: order.id, method: 'CASH', actorId: admin.id });
    expect(await creditsOf(ana.id)).toBe(8); // paid, but the friend has not: no bonus yet

    // The friend buys her own package at the desk and pays: both get their class, once.
    const hers = await createOrder({ userId: friendId, productId: a.id, actorId: admin.id });
    await recordManualPayment({ orderId: hers.id, method: 'CASH', actorId: admin.id });
    expect(await creditsOf(ana.id)).toBe(9);
    expect(await creditsOf(friendId)).toBe(9);
    expect(await prisma.offerClaim.count({ where: { status: 'GRANTED' } })).toBe(2);
    const again = await createOrder({ userId: friendId, productId: (await pkg({ name: 'Tjetër' })).id, actorId: admin.id });
    await recordManualPayment({ orderId: again.id, method: 'CASH', actorId: admin.id });
    expect(await prisma.creditTransaction.count({ where: { type: 'BONUS' } })).toBe(2);

    // A friend who already came to DUA (same phone, with a package) does not qualify — and is not merged.
    const regular = await makeUser();
    const paid = await createOrder({ userId: regular.id, productId: a.id, actorId: regular.id });
    await recordManualPayment({ orderId: paid.id, method: 'CASH', actorId: admin.id });
    const sara = await makeUser();
    expect(await err(createOrder({ userId: sara.id, productId: a.id, offerId: o.id, friend: { firstName: 'X', lastName: 'Y', phone: '+355690000000' }, actorId: sara.id }))).toBe('FRIEND_NOT_NEW');
  });

  it('a password from the old website still signs in, and is re-hashed', async () => {
    const app = await getApp();
    const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const legacy = `scrypt$16384$${salt}$${scryptSync('Pilates2026', salt, 64, { N: 16384 }).toString('hex')}`;
    const u = await prisma.user.create({ data: { email: 'old@mail.test', role: 'CLIENT', passwordHash: legacy, profile: { create: { firstName: 'Old', lastName: 'Site' } } } });
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'old@mail.test', password: 'wrong123' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'old@mail.test', password: 'Pilates2026' } })).statusCode).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash!.split('$')).toHaveLength(6);
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'old@mail.test', password: 'Pilates2026' } })).statusCode).toBe(200);
  });
});

async function makeUserToken(userId: string) {
  const { signAccessToken } = await import('../src/services/tokens.js');
  return `Bearer ${await signAccessToken(userId, 'CLIENT')}`;
}
