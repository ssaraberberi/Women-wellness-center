import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creditsOf, getApp, makeClientWithCredits, makeSession, makeUser, prisma, resetDb } from './helpers.js';

describe('the desk writes in the days she came, and the day her package ends', () => {
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it('a past class: she is in it as present and a session is used', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const client = await makeClientWithCredits(8);
    const past = await makeSession({ inHours: -48 });
    const r = await app.inject({ method: 'POST', url: `/admin/clients/${client.id}/visits`, headers: admin.auth, payload: { sessionId: past.id } });
    expect(r.statusCode).toBe(200);
    expect(await creditsOf(client.id)).toBe(7);
    const b = await prisma.classBooking.findFirstOrThrow({ where: { userId: client.id, sessionId: past.id }, include: { attendance: true } });
    expect(b).toMatchObject({ status: 'BOOKED', creditsUsed: 1, source: 'ADMIN', attendance: { status: 'PRESENT' } });
    // The same class twice is refused.
    expect((await app.inject({ method: 'POST', url: `/admin/clients/${client.id}/visits`, headers: admin.auth, payload: { sessionId: past.id } })).statusCode).toBe(409);
  });

  it('a day with no class in the system: a session is used and the day is listed', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const client = await makeClientWithCredits(2);
    const day = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
    expect((await app.inject({ method: 'POST', url: `/admin/clients/${client.id}/visits`, headers: admin.auth, payload: { date: day } })).statusCode).toBe(200);
    expect(await creditsOf(client.id)).toBe(1);
    const detail = (await app.inject({ method: 'GET', url: `/admin/clients/${client.id}`, headers: admin.auth })).json();
    expect(detail.visits).toEqual([{ date: day, title: null, sessionId: null }]);
    // Not a day still to come, and not with nothing left.
    const future = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    expect((await app.inject({ method: 'POST', url: `/admin/clients/${client.id}/visits`, headers: admin.auth, payload: { date: future } })).statusCode).toBe(400);
    await app.inject({ method: 'POST', url: `/admin/clients/${client.id}/visits`, headers: admin.auth, payload: { date: day } });
    expect((await app.inject({ method: 'POST', url: `/admin/clients/${client.id}/visits`, headers: admin.auth, payload: { date: day } })).statusCode).toBe(409);
  });

  it('the end date of a package can be changed, its sessions with it', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const client = await makeClientWithCredits(4);
    const p = await prisma.membershipPurchase.findFirstOrThrow({ where: { userId: client.id } });
    const end = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
    const r = await app.inject({ method: 'PATCH', url: `/admin/purchases/${p.id}`, headers: admin.auth, payload: { expiresOn: end } });
    expect(r.statusCode).toBe(200);
    const w = await prisma.creditWallet.findFirstOrThrow({ where: { purchaseId: p.id } });
    const after = await prisma.membershipPurchase.findUniqueOrThrow({ where: { id: p.id } });
    expect(+w.expiresAt).toBe(+after.expiresAt!);
    expect(after.expiresAt!.toISOString() > `${end}T00:00`).toBe(true);
  });
});
