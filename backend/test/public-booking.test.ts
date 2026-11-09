import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creditsOf, getApp, makeClientWithCredits, makeSession, makeUser, prisma, resetDb } from './helpers.js';
import { testOutbox } from '../src/services/mail.js';
import { analytics } from '../src/services/analytics.js';
import { createOrder } from '../src/services/orders.js';

const PRICE = 1800;
const single = () => prisma.membershipProduct.create({ data: { kind: 'SINGLE', name: 'Klasë e vetme', price: PRICE, classCredits: 1, validityDays: 30 } });

const codeFor = (email: string) => {
  const mail = [...testOutbox].reverse().find((m) => m.to === email && /\b\d{6}\b/.test(m.text));
  return mail!.text.match(/\b(\d{6})\b/)![1];
};

let n = 0;
const guest = (over: Partial<{ firstName: string; lastName: string; phone: string; email: string }> = {}) => {
  n++;
  return { firstName: 'Ana', lastName: `Guest${n}`, phone: `+3556910000${String(n).padStart(2, '0')}`, email: `guest${n}-${Date.now()}@mail.test`, ...over };
};

/** The whole public flow: ask for a code, read it from the outbox, confirm. */
async function bookAsGuest(sessionId: string, who = guest(), opts: { key?: string; platform?: 'WEB' | 'APP'; code?: string } = {}) {
  const app = await getApp();
  const c = await app.inject({ method: 'POST', url: '/public/guest-bookings/code', payload: { sessionId, email: who.email } });
  expect(c.statusCode).toBe(200);
  const r = await app.inject({
    method: 'POST',
    url: '/public/guest-bookings',
    headers: opts.key ? { 'idempotency-key': opts.key } : {},
    payload: { sessionId, ...who, code: opts.code ?? codeFor(who.email), platform: opts.platform ?? 'WEB' },
  });
  return { res: r, body: r.json(), who };
}

describe('public booking without an account', () => {
  beforeEach(async () => {
    await resetDb();
    testOutbox.length = 0;
  });
  afterAll(() => prisma.$disconnect());

  it('shows the timetable and the single price to anyone, with nothing about any person', async () => {
    const app = await getApp();
    await single();
    const s = await makeSession({ inHours: 24 });
    const r = await app.inject({ method: 'GET', url: `/public/sessions?from=${new Date(+s.startsAt).toISOString().slice(0, 10)}&to=${new Date(+s.startsAt + 86_400_000).toISOString().slice(0, 10)}` });
    expect(r.statusCode).toBe(200);
    expect(r.json().singlePrice).toBe(PRICE);
    const row = r.json().sessions.find((x: { id: string }) => x.id === s.id);
    expect(row).toMatchObject({ capacity: 5, available: 5 });
    expect(row).not.toHaveProperty('myBookingId');
    const one = await app.inject({ method: 'GET', url: `/public/sessions/${s.id}` });
    expect(one.json().session.id).toBe(s.id);
  });

  it('1–2. a new visitor books a single class: confirmed at once, owed at the studio, nothing counted as paid', async () => {
    await single();
    const s = await makeSession({ inHours: 24 });
    const { body, who } = await bookAsGuest(s.id);
    expect(body.status).toBe('booked');
    expect(body.created).toBe(true);
    expect(body.session.accessToken).toBeTruthy(); // she stays signed in
    expect(body.manageToken).toHaveLength(43);
    expect(body.booking).toMatchObject({ status: 'BOOKED', payment: { total: PRICE, status: 'PENDING' }, canCancel: true });

    const u = await prisma.user.findUniqueOrThrow({ where: { email: who.email }, include: { profile: true } });
    expect(u.emailVerifiedAt).toBeTruthy();
    expect(u.profile).toMatchObject({ firstName: 'Ana', phone: who.phone });
    const b = await prisma.classBooking.findFirstOrThrow({ where: { sessionId: s.id }, include: { order: true } });
    expect(b).toMatchObject({ status: 'BOOKED', source: 'GUEST_WEB', creditsUsed: 0, walletId: null });
    expect(b.order).toMatchObject({ status: 'PENDING', total: PRICE, subtotal: PRICE });
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.membershipPurchase.count()).toBe(0); // no package, no credits

    // Her letter has the private link; no other email for the same booking.
    expect(testOutbox.filter((m) => m.to === who.email && m.text.includes('#manage='))).toHaveLength(1);
    const notes = await prisma.notification.findMany({ where: { userId: u.id, type: 'CLASS_BOOKED' } });
    expect(notes.map((x) => x.channel)).toEqual(['IN_APP']);

    const a = await analytics(new Date(Date.now() - 86_400_000), new Date(Date.now() + 3 * 86_400_000));
    expect(a.revenue.gross).toBe(0);
    expect(a.money.outstanding.single).toEqual({ amount: PRICE, count: 1 });
    expect(a.money.singleClassBookedValue).toBe(PRICE);
  });

  it('3. the unpaid booking shows in the class, in the orders list and on the client, with its source', async () => {
    const app = await getApp();
    await single();
    const admin = await makeUser('ADMIN');
    const s = await makeSession({ inHours: 24 });
    const { who } = await bookAsGuest(s.id, guest(), { platform: 'APP' });

    const cls = (await app.inject({ method: 'GET', url: `/admin/sessions/${s.id}`, headers: admin.auth })).json();
    expect(cls.bookings[0]).toMatchObject({ source: 'GUEST_APP', email: who.email, payment: { status: 'PENDING', total: PRICE, outstanding: PRICE, method: null } });
    const orders = (await app.inject({ method: 'GET', url: '/admin/orders?status=PENDING', headers: admin.auth })).json();
    expect(orders[0]).toMatchObject({ total: PRICE, booking: { status: 'BOOKED', source: 'GUEST_APP' } });
    expect(orders[0].product).toContain('Reformer');
    const client = (await app.inject({ method: 'GET', url: `/admin/clients/${cls.bookings[0].userId}`, headers: admin.auth })).json();
    expect(client.outstanding).toBe(PRICE);
    // Admins hear about the new client and the booking.
    expect(await prisma.notification.count({ where: { userId: admin.id, type: { in: ['ADMIN_NEW_CLIENT', 'STAFF_NEW_BOOKING'] }, channel: 'IN_APP' } })).toBe(2);
  });

  it('4. a member who verifies her email is asked first; her package is used only through her own booking', async () => {
    const app = await getApp();
    await single();
    const member = await makeClientWithCredits(3);
    const s = await makeSession({ inHours: 24 });
    const { body } = await bookAsGuest(s.id, guest({ email: member.email! }));
    expect(body).toMatchObject({ status: 'has_package', credits: 3, created: false });
    expect(await prisma.classBooking.count()).toBe(0);
    expect(await creditsOf(member.id)).toBe(3);

    // She chooses the package, signed in with the session she was given.
    const auth = { authorization: `Bearer ${body.session.accessToken}` };
    const r = await app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: { ...auth, 'idempotency-key': 'k-member' } });
    expect(r.statusCode).toBe(200);
    expect(await creditsOf(member.id)).toBe(2);
    expect(await prisma.order.count({ where: { bookingId: { not: null } } })).toBe(0);
    // Her profile was not overwritten by what was typed.
    expect((await prisma.userProfile.findUniqueOrThrow({ where: { userId: member.id } })).lastName).toBe('Test');
  });

  it('5. a package waiting for payment does not stop her booking one class', async () => {
    const pkg = await prisma.membershipProduct.create({ data: { kind: 'PACKAGE', name: '8 klasa', price: 12000, classCredits: 8, validityDays: 30 } });
    await single();
    const c = await makeUser('CLIENT');
    await createOrder({ userId: c.id, productId: pkg.id, actorId: c.id });
    const s = await makeSession({ inHours: 24 });
    const { body } = await bookAsGuest(s.id, guest({ email: c.email! }));
    expect(body.status).toBe('booked');
    expect(await prisma.order.count({ where: { userId: c.id, status: 'PENDING' } })).toBe(2);
    expect(await creditsOf(c.id)).toBe(0);
  });

  it('6. a repeated submission books once; a second booking of the same class is refused', async () => {
    const app = await getApp();
    await single();
    const s = await makeSession({ inHours: 24 });
    const who = guest();
    const first = await bookAsGuest(s.id, who, { key: 'same-key-123' });
    expect(first.body.status).toBe('booked');
    // The answer was lost and the page sends it again, same key: the same booking, no new session.
    const again = await app.inject({ method: 'POST', url: '/public/guest-bookings', headers: { 'idempotency-key': 'same-key-123' }, payload: { sessionId: s.id, ...who, code: '000000', platform: 'WEB' } });
    expect(again.json()).toMatchObject({ status: 'already_booked', booking: { id: first.body.booking.id } });
    expect(again.json().session).toBeUndefined();
    // A new attempt with a new code: verified, but already in that class.
    const second = await bookAsGuest(s.id, who, { key: 'other-key-456' });
    expect(second.body).toMatchObject({ status: 'not_booked', error: { code: 'ALREADY_BOOKED' } });
    expect(await prisma.classBooking.count()).toBe(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it('7. guests on the web and in the app pressing at once never get more places than the class has', async () => {
    const app = await getApp();
    await single();
    const s = await makeSession({ inHours: 24, capacity: 2 });
    const people = Array.from({ length: 5 }, () => guest());
    for (const p of people) await app.inject({ method: 'POST', url: '/public/guest-bookings/code', payload: { sessionId: s.id, email: p.email } });
    const member = await makeClientWithCredits(2);
    const results = await Promise.all([
      ...people.map((p, i) =>
        app.inject({ method: 'POST', url: '/public/guest-bookings', payload: { sessionId: s.id, ...p, code: codeFor(p.email), platform: i % 2 ? 'APP' : 'WEB' } }).then((r) => r.json().status),
      ),
      app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: { ...member.auth, 'idempotency-key': 'm1' } }).then((r) => (r.statusCode === 200 ? 'booked' : 'full')),
    ]);
    expect(results.filter((x) => x === 'booked')).toHaveLength(2);
    expect(await prisma.classBooking.count({ where: { sessionId: s.id, status: 'BOOKED' } })).toBe(2);
    // Every guest who did not get in owes nothing.
    const guestsIn = await prisma.classBooking.count({ where: { sessionId: s.id, status: 'BOOKED', source: { in: ['GUEST_WEB', 'GUEST_APP'] } } });
    expect(await prisma.order.count()).toBe(guestsIn);
  });

  it('8. no booking without the code, a code is for its own inbox, and a typed phone matches nobody', async () => {
    const app = await getApp();
    await single();
    const s = await makeSession({ inHours: 24 });
    const existing = await makeUser('CLIENT'); // phone +355690000000
    const who = guest({ phone: '+355690000000' });
    await app.inject({ method: 'POST', url: '/public/guest-bookings/code', payload: { sessionId: s.id, email: who.email } });

    const wrong = await app.inject({ method: 'POST', url: '/public/guest-bookings', payload: { sessionId: s.id, ...who, code: '000000' } });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error.code).toBe('OTP_INVALID');
    const otherInbox = await app.inject({ method: 'POST', url: '/public/guest-bookings', payload: { sessionId: s.id, ...who, email: existing.email, code: codeFor(who.email) } });
    expect(otherInbox.statusCode).toBe(400);
    expect(await prisma.classBooking.count()).toBe(0);

    const ok = await app.inject({ method: 'POST', url: '/public/guest-bookings', payload: { sessionId: s.id, ...who, code: codeFor(who.email) } });
    expect(ok.json().status).toBe('booked');
    const b = await prisma.classBooking.findFirstOrThrow();
    expect(b.userId).not.toBe(existing.id); // same phone, different person until proven otherwise

    // The private link shows the booking and nothing else about her.
    const view = (await app.inject({ method: 'POST', url: '/public/bookings/manage', payload: { token: ok.json().manageToken } })).json();
    expect(view).toMatchObject({ id: b.id, firstName: 'Ana' });
    expect(JSON.stringify(view)).not.toContain(who.email);
    expect(JSON.stringify(view)).not.toContain(who.phone);
    expect((await app.inject({ method: 'POST', url: '/public/bookings/manage', payload: { token: 'x'.repeat(43) } })).statusCode).toBe(404);
  });

  it('refuses a code for a full or started class, and anything when no single price is set up', async () => {
    const app = await getApp();
    const s = await makeSession({ inHours: 24 });
    const noPrice = await app.inject({ method: 'POST', url: '/public/guest-bookings/code', payload: { sessionId: s.id, email: 'a@mail.test' } });
    expect(noPrice.json().error.code).toBe('SINGLE_PRICE_MISSING');
    expect((await app.inject({ method: 'GET', url: `/public/sessions/${s.id}` })).json().singlePrice).toBeNull();
    // Two active single prices is also a setup problem, not a choice.
    await single();
    await single();
    expect((await app.inject({ method: 'POST', url: '/public/guest-bookings/code', payload: { sessionId: s.id, email: 'a@mail.test' } })).json().error.code).toBe('SINGLE_PRICE_MISSING');
    await prisma.membershipProduct.deleteMany({ where: { kind: 'SINGLE' } });
    await single();
    const full = await makeSession({ inHours: 24, capacity: 0 });
    expect((await app.inject({ method: 'POST', url: '/public/guest-bookings/code', payload: { sessionId: full.id, email: 'a@mail.test' } })).json().error.code).toBe('CLASS_FULL');
    const started = await makeSession({ inHours: -0.2 });
    expect((await app.inject({ method: 'POST', url: '/public/guest-bookings/code', payload: { sessionId: started.id, email: 'a@mail.test' } })).json().error.code).toBe('CLASS_STARTED');
    expect(testOutbox).toHaveLength(0);
  });

  it('9. cancelled in time: the place opens and she owes nothing; the link stops working', async () => {
    const app = await getApp();
    await single();
    const s = await makeSession({ inHours: 24, capacity: 1 });
    const { body } = await bookAsGuest(s.id);
    const c = await app.inject({ method: 'POST', url: '/public/bookings/manage/cancel', payload: { token: body.manageToken } });
    expect(c.json()).toMatchObject({ status: 'CANCELLED', orderVoided: true, booking: { status: 'CANCELLED', payment: { status: 'CANCELLED' } } });
    expect((await app.inject({ method: 'GET', url: `/public/sessions/${s.id}` })).json().session.available).toBe(1);
    expect((await app.inject({ method: 'POST', url: '/public/bookings/manage', payload: { token: body.manageToken } })).statusCode).toBe(404);
    const a = await analytics(new Date(Date.now() - 86_400_000), new Date(Date.now() + 3 * 86_400_000));
    expect(a.money.outstanding.single.amount).toBe(0);
  });

  it('9. cancelled late, or not coming: the place may open but the class is still owed; the desk can forgive it', async () => {
    const app = await getApp();
    await single();
    const admin = await makeUser('ADMIN');
    const soon = await makeSession({ inHours: 0.5 }); // free cancellation ended 30 minutes ago
    const late = await bookAsGuest(soon.id);
    const c = await app.inject({ method: 'POST', url: '/public/bookings/manage/cancel', payload: { token: late.body.manageToken } });
    expect(c.json()).toMatchObject({ status: 'LATE_CANCELLED', orderVoided: false });
    expect(await prisma.order.findFirstOrThrow({ where: { bookingId: late.body.booking.id } })).toMatchObject({ status: 'PENDING', total: PRICE });

    const later = await makeSession({ inHours: 30 });
    const absent = await bookAsGuest(later.id);
    await app.inject({ method: 'POST', url: `/admin/bookings/${absent.body.booking.id}/attendance`, headers: admin.auth, payload: { status: 'ABSENT' } });
    expect((await prisma.order.findFirstOrThrow({ where: { bookingId: absent.body.booking.id } })).status).toBe('PENDING');
    const a = await analytics(new Date(Date.now() - 86_400_000), new Date(Date.now() + 3 * 86_400_000));
    expect(a.money.outstanding.single).toEqual({ amount: 2 * PRICE, count: 2 });
    expect(a.revenue.gross).toBe(0);

    // The desk forgives the no-show.
    const f = await app.inject({ method: 'POST', url: `/admin/bookings/${absent.body.booking.id}/restore-credit`, headers: admin.auth, payload: { reason: 'Sick' } });
    expect(f.statusCode).toBe(200);
    expect((await prisma.order.findFirstOrThrow({ where: { bookingId: absent.body.booking.id } })).status).toBe('CANCELLED');
  });

  it('a class the studio cancels owes nothing', async () => {
    const app = await getApp();
    await single();
    const admin = await makeUser('ADMIN');
    const s = await makeSession({ inHours: 24 });
    const { body } = await bookAsGuest(s.id);
    await app.inject({ method: 'POST', url: `/admin/sessions/${s.id}/cancel`, headers: admin.auth, payload: {} });
    expect((await prisma.order.findFirstOrThrow({ where: { bookingId: body.booking.id } })).status).toBe('CANCELLED');
  });

  it('10–11. paying at the desk moves the debt to money collected, once; a package class adds no revenue', async () => {
    const app = await getApp();
    await single();
    const admin = await makeUser('ADMIN');
    const s = await makeSession({ inHours: 24 });
    const { body } = await bookAsGuest(s.id);
    const orderId = (await prisma.order.findFirstOrThrow({ where: { bookingId: body.booking.id } })).id;

    const pay = () => app.inject({ method: 'POST', url: `/admin/orders/${orderId}/payments`, headers: admin.auth, payload: { method: 'CASH' } });
    const [p1, p2] = await Promise.all([pay(), pay()]);
    expect([p1.statusCode, p2.statusCode].sort()).toEqual([200, 409]);
    expect(await prisma.payment.count()).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAID');
    expect(await prisma.auditLog.count({ where: { action: 'payment.record' } })).toBe(1);

    // A member's class from a paid package: the package is the revenue, the class is not counted again.
    const member = await makeClientWithCredits(3);
    await prisma.payment.create({ data: { order: { create: { reference: 'DUA-PKG01', userId: member.id, subtotal: 8000, total: 8000, status: 'PAID' } }, method: 'CASH', status: 'COMPLETED', amount: 8000, completedAt: new Date() } });
    await app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: { ...member.auth, 'idempotency-key': 'm' } });

    const a = await analytics(new Date(Date.now() - 86_400_000), new Date(Date.now() + 3 * 86_400_000));
    expect(a.revenue.gross).toBe(PRICE + 8000);
    expect(a.money.collected.single).toBe(PRICE);
    expect(a.money.outstanding.single.amount).toBe(0);
    const cls = (await app.inject({ method: 'GET', url: `/admin/sessions/${s.id}`, headers: admin.auth })).json();
    expect(cls.bookings.find((b: { id: string }) => b.id === body.booking.id).payment).toMatchObject({ status: 'PAID', outstanding: 0, method: 'CASH' });
  });

  it('a signed-in client without a package books one class from the app or the web, labelled by platform', async () => {
    const app = await getApp();
    await single();
    const c = await makeUser('CLIENT');
    const s = await makeSession({ inHours: 24 });
    const detail = (await app.inject({ method: 'GET', url: `/sessions/${s.id}`, headers: c.auth })).json();
    expect(detail).toMatchObject({ eligible: false, singlePrice: PRICE });
    const r = await app.inject({ method: 'POST', url: `/sessions/${s.id}/book-single`, headers: { ...c.auth, 'idempotency-key': 's1', 'x-dua-platform': 'web' } });
    expect(r.statusCode).toBe(200);
    expect(await prisma.classBooking.findFirstOrThrow({ include: { order: true } })).toMatchObject({ source: 'MEMBER_WEB', creditsUsed: 0, order: { status: 'PENDING', total: PRICE } });
    // Booking it twice is refused, and nothing more is owed.
    const twice = await app.inject({ method: 'POST', url: `/sessions/${s.id}/book-single`, headers: { ...c.auth, 'idempotency-key': 's2' } });
    expect(twice.statusCode).toBe(409);
    expect(await prisma.order.count()).toBe(1);
  });

  it('a staff email cannot be used to book as a guest', async () => {
    await single();
    const staff = await makeUser('STAFF', { instructor: true });
    const s = await makeSession({ inHours: 24 });
    const { res } = await bookAsGuest(s.id, guest({ email: staff.email! }));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('STAFF_ACCOUNT');
  });
});
