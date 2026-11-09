import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creditsOf, getApp, makeClientWithCredits, makeSession, makeUser, prisma, resetDb } from './helpers.js';

describe('desk adds a participant without an account', () => {
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it('a name is enough: a client without email is created and booked without a session, owing a single class', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    await prisma.membershipProduct.create({ data: { kind: 'SINGLE', name: 'Klasë e vetme', price: 1800, classCredits: 1, validityDays: 30 } });
    const s = await makeSession({ inHours: 24 });
    const r = await app.inject({ method: 'POST', url: `/admin/sessions/${s.id}/guest-bookings`, headers: admin.auth, payload: { firstName: 'Ana', lastName: 'Hoxha' } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ created: true, usedSession: false });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: r.json().clientId }, include: { profile: true } });
    expect(u).toMatchObject({ email: null, role: 'CLIENT', profile: { firstName: 'Ana', lastName: 'Hoxha', phone: null } });
    const b = await prisma.classBooking.findFirstOrThrow({ where: { sessionId: s.id } });
    expect(b).toMatchObject({ userId: u.id, status: 'BOOKED', creditsUsed: 0, walletId: null, source: 'ADMIN' });
    expect(await prisma.order.findFirstOrThrow({ where: { bookingId: b.id } })).toMatchObject({ status: 'PENDING', total: 1800 });

    // She shows up in the class like anyone else.
    const detail = (await app.inject({ method: 'GET', url: `/admin/sessions/${s.id}`, headers: admin.auth })).json();
    expect(detail.bookings[0].name).toBe('Ana Hoxha');
  });

  it('the same phone again is the same client, and a client with sessions uses one', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    await prisma.membershipProduct.create({ data: { kind: 'SINGLE', name: 'Klasë e vetme', price: 1800, classCredits: 1, validityDays: 30 } });
    const a = await makeSession({ inHours: 24 });
    const b = await makeSession({ inHours: 48 });
    const first = (await app.inject({ method: 'POST', url: `/admin/sessions/${a.id}/guest-bookings`, headers: admin.auth, payload: { firstName: 'Ana', lastName: 'Hoxha', phone: '069 123 4567' } })).json();
    const again = (await app.inject({ method: 'POST', url: `/admin/sessions/${b.id}/guest-bookings`, headers: admin.auth, payload: { firstName: 'Ana', lastName: 'H', phone: '+355691234567' } })).json();
    expect(again.clientId).toBe(first.clientId);
    expect(again.created).toBe(false);

    const member = await makeClientWithCredits(3);
    const m = (await app.inject({ method: 'POST', url: `/admin/sessions/${a.id}/guest-bookings`, headers: admin.auth, payload: { firstName: 'X', lastName: 'Y', email: member.email!.toUpperCase() } })).json();
    expect(m).toMatchObject({ clientId: member.id, created: false, usedSession: true });
    expect(await creditsOf(member.id)).toBe(2);
  });

  it('rejects a bad phone, a missing last name, and non-admins', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const staff = await makeUser('STAFF', { instructor: true });
    const s = await makeSession({ inHours: 24 });
    const url = `/admin/sessions/${s.id}/guest-bookings`;
    expect((await app.inject({ method: 'POST', url, headers: admin.auth, payload: { firstName: 'Ana', lastName: 'Hoxha', phone: '123' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url, headers: admin.auth, payload: { firstName: 'Ana', lastName: '' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url, headers: staff.auth, payload: { firstName: 'Ana', lastName: 'Hoxha' } })).statusCode).toBe(403);
  });
});
