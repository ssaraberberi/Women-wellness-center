import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creditsOf, getApp, makeClientWithCredits, makeSession, prisma, resetDb } from './helpers.js';

const single = () => prisma.membershipProduct.create({ data: { kind: 'SINGLE', name: 'Klasë e vetme', price: 2400, classCredits: 1, validityDays: 30 } });

describe('a visitor books with a name and a phone', () => {
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it('one class, paid at the studio, not signed in; the same phone again is the same visitor', async () => {
    const app = await getApp();
    await single();
    const a = await makeSession({ inHours: 24 });
    const b = await makeSession({ inHours: 48 });
    const one = await app.inject({ method: 'POST', url: '/public/visitor-bookings', payload: { sessionId: a.id, firstName: 'Ana', lastName: 'Hoxha', phone: '069 123 4567' } });
    expect(one.statusCode).toBe(200);
    expect(one.json()).toMatchObject({ status: 'booked', created: true, booking: { payment: { total: 2400, status: 'PENDING' } } });
    expect(one.json()).not.toHaveProperty('session');
    const two = (await app.inject({ method: 'POST', url: '/public/visitor-bookings', payload: { sessionId: b.id, firstName: 'Ana', lastName: 'Hoxha', phone: '+355691234567' } })).json();
    expect(two.created).toBe(false);
    const rows = await prisma.classBooking.findMany({ where: { sessionId: { in: [a.id, b.id] } } });
    expect(new Set(rows.map((r) => r.userId)).size).toBe(1);
    expect(rows.every((r) => r.source === 'GUEST_WEB')).toBe(true);
  });

  it('never books into an account someone signs in to, and never touches her package', async () => {
    const app = await getApp();
    await single();
    const s = await makeSession({ inHours: 24 });
    const member = await makeClientWithCredits(3);
    await prisma.user.update({ where: { id: member.id }, data: { emailVerifiedAt: new Date() } });
    await prisma.userProfile.update({ where: { userId: member.id }, data: { phone: '+355691234599' } });
    const r = await app.inject({ method: 'POST', url: '/public/visitor-bookings', payload: { sessionId: s.id, firstName: 'X', lastName: 'Y', phone: '069 123 4599', email: member.email } });
    expect(r.statusCode).toBe(200);
    const b = await prisma.classBooking.findFirstOrThrow({ where: { sessionId: s.id }, include: { user: true } });
    expect(b.userId).not.toBe(member.id);
    expect(b.user.email).toBeNull();
    expect(await creditsOf(member.id)).toBe(3);
    expect((await prisma.clientNote.findFirstOrThrow({ where: { clientId: b.userId } })).body).toContain(member.id);
  });
});
