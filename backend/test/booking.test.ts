import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creditsOf, getApp, makeClientWithCredits, makeSession, makeUser, prisma, resetDb } from './helpers.js';
import { expireWaitlistOffers } from '../src/services/booking.js';

describe('class booking', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('eight people at once for five places: five get in, nobody is charged twice', async () => {
    const app = await getApp();
    const session = await makeSession({ inHours: 48, capacity: 5 });
    const clients = await Promise.all(Array.from({ length: 8 }, () => makeClientWithCredits(3)));
    const results = await Promise.all(clients.map((c) => app.inject({ method: 'POST', url: `/sessions/${session.id}/book`, headers: c.auth })));
    const ok = results.filter((r) => r.statusCode === 200);
    const full = results.filter((r) => r.statusCode === 409 && r.json().error.code === 'CLASS_FULL');
    expect(ok).toHaveLength(5);
    expect(full).toHaveLength(3);
    expect(await prisma.classBooking.count({ where: { sessionId: session.id, status: 'BOOKED' } })).toBe(5);
    const balances = await Promise.all(clients.map((c) => creditsOf(c.id)));
    expect(balances.filter((b) => b === 2)).toHaveLength(5);
    expect(balances.filter((b) => b === 3)).toHaveLength(3);
  });

  it('a retried request with the same Idempotency-Key books and charges once', async () => {
    const app = await getApp();
    const session = await makeSession({ inHours: 48 });
    const c = await makeClientWithCredits(3);
    const headers = { ...c.auth, 'idempotency-key': 'abc-123' };
    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: `/sessions/${session.id}/book`, headers }),
      app.inject({ method: 'POST', url: `/sessions/${session.id}/book`, headers }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(a.json().id).toBe(b.json().id);
    expect(await creditsOf(c.id)).toBe(2);
  });

  it('refuses without credits, with expired credits, and never goes negative', async () => {
    const app = await getApp();
    const session = await makeSession({ inHours: 48 });
    const none = await makeUser('CLIENT');
    const r1 = await app.inject({ method: 'POST', url: `/sessions/${session.id}/book`, headers: none.auth });
    expect(r1.json().error.code).toBe('NO_MEMBERSHIP');

    const shortLived = await makeClientWithCredits(3, 1); // expires before the class
    const r2 = await app.inject({ method: 'POST', url: `/sessions/${session.id}/book`, headers: shortLived.auth });
    expect(r2.json().error.code).toBe('MEMBERSHIP_EXPIRED');

    const expensive = await makeSession({ inHours: 48, credits: 2 });
    const one = await makeClientWithCredits(1);
    const r3 = await app.inject({ method: 'POST', url: `/sessions/${expensive.id}/book`, headers: one.auth });
    expect(r3.json().error.code).toBe('INSUFFICIENT_CREDITS');
    expect(await creditsOf(one.id)).toBe(1);
  });

  it('cancelling in time returns the credit; late keeps it unless the policy says otherwise', async () => {
    const app = await getApp();
    const c = await makeClientWithCredits(5);
    const early = await makeSession({ inHours: 48 });
    const late = await makeSession({ inHours: 3 }); // free cancellation ends 12h before
    const b1 = (await app.inject({ method: 'POST', url: `/sessions/${early.id}/book`, headers: c.auth })).json();
    const b2 = (await app.inject({ method: 'POST', url: `/sessions/${late.id}/book`, headers: c.auth })).json();
    expect(await creditsOf(c.id)).toBe(3);

    const c1 = await app.inject({ method: 'POST', url: `/bookings/${b1.id}/cancel`, headers: c.auth });
    expect(c1.json()).toMatchObject({ status: 'CANCELLED', refunded: true });
    const c2 = await app.inject({ method: 'POST', url: `/bookings/${b2.id}/cancel`, headers: c.auth });
    expect(c2.json()).toMatchObject({ status: 'LATE_CANCELLED', refunded: false });
    expect(await creditsOf(c.id)).toBe(4);

    // An admin can give the late credit back, once.
    const admin = await makeUser('ADMIN');
    const r = await app.inject({ method: 'POST', url: `/admin/bookings/${b2.id}/restore-credit`, headers: admin.auth, payload: { reason: 'Sick note' } });
    expect(r.statusCode).toBe(200);
    const again = await app.inject({ method: 'POST', url: `/admin/bookings/${b2.id}/restore-credit`, headers: admin.auth, payload: { reason: 'Again' } });
    expect(again.statusCode).toBe(409);
    expect(await creditsOf(c.id)).toBe(5);

    // Policy switched: late cancellations refund.
    await prisma.studioSettings.update({ where: { id: 1 }, data: { lateCancelKeepsCredit: false } });
    const late2 = await makeSession({ inHours: 2 });
    const b3 = (await app.inject({ method: 'POST', url: `/sessions/${late2.id}/book`, headers: c.auth })).json();
    const c3 = await app.inject({ method: 'POST', url: `/bookings/${b3.id}/cancel`, headers: c.auth });
    expect(c3.json()).toMatchObject({ status: 'LATE_CANCELLED', refunded: true });

    // The ledger explains the balance.
    const ledger = await prisma.creditTransaction.findMany({ where: { userId: c.id } });
    expect(ledger.reduce((s, t) => s + t.delta, 0)).toBe(await creditsOf(c.id));
  });

  it('a client cannot cancel someone else’s booking', async () => {
    const app = await getApp();
    const s = await makeSession({ inHours: 48 });
    const a = await makeClientWithCredits(2);
    const b = await makeClientWithCredits(2);
    const booking = (await app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: a.auth })).json();
    const r = await app.inject({ method: 'POST', url: `/bookings/${booking.id}/cancel`, headers: b.auth });
    expect(r.statusCode).toBe(404);
  });

  it('the studio cancelling a class refunds everyone', async () => {
    const app = await getApp();
    const s = await makeSession({ inHours: 5 });
    const clients = await Promise.all([makeClientWithCredits(1), makeClientWithCredits(1)]);
    for (const c of clients) await app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: c.auth });
    const admin = await makeUser('ADMIN');
    const r = await app.inject({ method: 'POST', url: `/admin/sessions/${s.id}/cancel`, headers: admin.auth, payload: { reason: 'Instructor ill' } });
    expect(r.json()).toMatchObject({ ok: true, affected: 2 });
    for (const c of clients) expect(await creditsOf(c.id)).toBe(1);
    expect(await prisma.notification.count({ where: { type: 'SESSION_CANCELLED', channel: 'IN_APP' } })).toBe(2);
  });
});

describe('waiting list', () => {
  beforeEach(resetDb);

  it('offers a freed place to the first in line, holds it, then passes it on when it expires', async () => {
    const app = await getApp();
    const s = await makeSession({ inHours: 48, capacity: 1 });
    const booked = await makeClientWithCredits(2);
    const first = await makeClientWithCredits(2);
    const second = await makeClientWithCredits(2);
    const b = (await app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: booked.auth })).json();

    const w1 = (await app.inject({ method: 'POST', url: `/sessions/${s.id}/waitlist`, headers: first.auth })).json();
    const w2 = (await app.inject({ method: 'POST', url: `/sessions/${s.id}/waitlist`, headers: second.auth })).json();
    expect([w1.position, w2.position]).toEqual([1, 2]);
    const dup = await app.inject({ method: 'POST', url: `/sessions/${s.id}/waitlist`, headers: first.auth });
    expect(dup.json().error.code).toBe('ALREADY_WAITLISTED');

    await app.inject({ method: 'POST', url: `/bookings/${b.id}/cancel`, headers: booked.auth });
    expect((await prisma.classWaitlist.findUniqueOrThrow({ where: { id: w1.id } })).status).toBe('OFFERED');

    // The held place is not available to anyone else.
    const outsider = await makeClientWithCredits(2);
    const steal = await app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: outsider.auth });
    expect(steal.json().error.code).toBe('CLASS_FULL');

    // The offer expires; the second in line gets it, and can accept it.
    await prisma.classWaitlist.update({ where: { id: w1.id }, data: { offerExpiresAt: new Date(Date.now() - 1000) } });
    await expireWaitlistOffers();
    expect((await prisma.classWaitlist.findUniqueOrThrow({ where: { id: w1.id } })).status).toBe('EXPIRED');
    expect((await prisma.classWaitlist.findUniqueOrThrow({ where: { id: w2.id } })).status).toBe('OFFERED');
    const accept = await app.inject({ method: 'POST', url: `/waitlist/${w2.id}/accept`, headers: second.auth });
    expect(accept.statusCode).toBe(200);
    expect(accept.json().source).toBe('WAITLIST');
    expect(await creditsOf(second.id)).toBe(1);
    expect(await prisma.classBooking.count({ where: { sessionId: s.id, status: 'BOOKED' } })).toBe(1);
  });

  it('does not let a client join the list of a class with free places', async () => {
    const app = await getApp();
    const s = await makeSession({ inHours: 48, capacity: 3 });
    const c = await makeClientWithCredits(1);
    const r = await app.inject({ method: 'POST', url: `/sessions/${s.id}/waitlist`, headers: c.auth });
    expect(r.json().error.code).toBe('PLACES_AVAILABLE');
  });
});

describe('staff attendance', () => {
  beforeEach(resetDb);

  it('an instructor marks attendance in her own class only', async () => {
    const app = await getApp();
    const ines = await makeUser('STAFF', { instructor: true });
    const other = await makeUser('STAFF', { instructor: true });
    const s = await makeSession({ inHours: 0.2, instructorId: ines.id });
    const c = await makeClientWithCredits(1);
    const b = (await app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: c.auth })).json();
    const list = await app.inject({ method: 'GET', url: `/staff/sessions/${s.id}`, headers: ines.auth });
    expect(list.json().participants).toHaveLength(1);
    expect(JSON.stringify(list.json())).not.toMatch(/price|payment|email/i);
    expect((await app.inject({ method: 'GET', url: `/staff/sessions/${s.id}`, headers: other.auth })).statusCode).toBe(404);
    const mark = await app.inject({ method: 'POST', url: `/staff/bookings/${b.id}/attendance`, headers: ines.auth, payload: { status: 'PRESENT' } });
    expect(mark.statusCode).toBe(200);
    const denied = await app.inject({ method: 'POST', url: `/staff/bookings/${b.id}/attendance`, headers: other.auth, payload: { status: 'ABSENT' } });
    expect(denied.statusCode).toBe(404);
  });
});
