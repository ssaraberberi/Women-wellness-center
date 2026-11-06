import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getApp, makeClientWithCredits, makeSession, makeUser, prisma, resetDb } from './helpers.js';
import { studioDate } from '../src/lib/time.js';

describe('calendar marks and class history', () => {
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it('marks days: classes for everyone, her own bookings for the client, only her classes for the instructor', async () => {
    const app = await getApp();
    const almira = await makeUser('STAFF', { instructor: true });
    const other = await makeUser('STAFF', { instructor: true });
    const client = await makeClientWithCredits(3);
    const admin = await makeUser('ADMIN');
    const mine = await makeSession({ inHours: 48, instructorId: almira.id });
    await makeSession({ inHours: 49, instructorId: other.id });
    await app.inject({ method: 'POST', url: `/sessions/${mine.id}/book`, headers: client.auth });

    const day = studioDate(mine.startsAt);
    const q = `/calendar/days?from=${day}&to=${day}`;
    const c = (await app.inject({ method: 'GET', url: q, headers: client.auth })).json();
    expect(c[0]).toMatchObject({ date: day, mine: 1 });
    const i = (await app.inject({ method: 'GET', url: q, headers: almira.auth })).json();
    expect(i[0]).toMatchObject({ classes: 1, booked: 1 });
    const a = (await app.inject({ method: 'GET', url: q, headers: admin.auth })).json();
    expect(a.reduce((n: number, d: { classes: number }) => n + d.classes, 0)).toBe(2);

    const tooLong = await app.inject({ method: 'GET', url: '/calendar/days?from=2026-01-01&to=2026-06-01', headers: admin.auth });
    expect(tooLong.statusCode).toBe(400);
  });

  it('history lists only classes that took place with at least one participant', async () => {
    const app = await getApp();
    const almira = await makeUser('STAFF', { instructor: true });
    const admin = await makeUser('ADMIN');
    const client = await makeUser('CLIENT');
    const withGirl = await makeSession({ inHours: -3, instructorId: almira.id });
    await makeSession({ inHours: -5, instructorId: almira.id }); // nobody came
    await prisma.classBooking.create({ data: { sessionId: withGirl.id, userId: client.id, status: 'BOOKED' } });

    const day = studioDate(withGirl.startsAt);
    const from = studioDate(new Date(Date.now() - 2 * 86_400_000));
    const r = (await app.inject({ method: 'GET', url: `/classes/history?from=${from}&to=${day}`, headers: almira.auth })).json();
    expect(r.classes).toHaveLength(1);
    expect(r.classes[0]).toMatchObject({ id: withGirl.id, participants: 1 });
    expect(r.totals.classes).toBe(1);

    const forClient = await app.inject({ method: 'GET', url: `/classes/history?from=${from}&to=${day}`, headers: client.auth });
    expect(forClient.statusCode).toBe(403);
    const all = (await app.inject({ method: 'GET', url: `/classes/history?from=${from}&to=${day}`, headers: admin.auth })).json();
    expect(all.classes[0].instructor).toBeTruthy();
  });
});
