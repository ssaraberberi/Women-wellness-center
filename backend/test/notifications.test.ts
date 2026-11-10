import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getApp, makeClientWithCredits, makeSession, makeUser, prisma, resetDb } from './helpers.js';
import { dueStep, sendReminders } from '../src/jobs.js';

const STEPS = [{ min: 60 }, { min: 30 }, { min: 15 }];
const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000);
const inApp = (userId: string) => prisma.notification.findMany({ where: { userId, channel: 'IN_APP' }, orderBy: { createdAt: 'asc' } });

describe('reminder timing', () => {
  const now = new Date();
  const t = (m: number) => new Date(+now + m * 60_000);

  it('picks the one reminder whose window holds the time left', () => {
    expect(dueStep(STEPS, t(90), now)).toBeNull();
    expect(dueStep(STEPS, t(55), now)?.min).toBe(60);
    expect(dueStep(STEPS, t(30), now)?.min).toBe(30);
    expect(dueStep(STEPS, t(20), now)?.min).toBe(30);
    expect(dueStep(STEPS, t(14), now)?.min).toBe(15);
    expect(dueStep(STEPS, t(-1), now)).toBeNull();
  });

  it('skips a reminder whose moment came before the booking was made', () => {
    // Class at 10:00, booked at 09:40: no "30 minutes" message at 09:40; the 15 one comes at 09:45.
    const start = t(20);
    const bookedAt = now;
    expect(dueStep(STEPS, start, now, bookedAt)).toBeNull();
    expect(dueStep(STEPS, start, t(6), bookedAt)?.min).toBe(15);
  });
});

describe('who hears about what', () => {
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it('a booking and a cancellation reach the instructor and every admin, not the admin who did it', async () => {
    const app = await getApp();
    const instructor = await makeUser('STAFF', { instructor: true });
    const admin1 = await makeUser('ADMIN');
    const admin2 = await makeUser('ADMIN');
    const client = await makeClientWithCredits(3);
    const s = await makeSession({ inHours: 48, instructorId: instructor.id });

    const later = await makeSession({ inHours: 49, instructorId: instructor.id });
    const b = (await app.inject({ method: 'POST', url: `/sessions/${s.id}/book`, headers: client.auth })).json();
    for (const u of [admin1, admin2]) {
      const rows = await inApp(u.id);
      expect(rows.map((r) => r.type)).toEqual(['STAFF_NEW_BOOKING']);
      expect(rows[0].body).toContain('(1/5)');
    }
    // The instructor gets it by email too: who was added, at what hours, and her whole day.
    const mail = await prisma.notification.findFirstOrThrow({ where: { userId: instructor.id, channel: 'EMAIL' } });
    const name = (await prisma.userProfile.findUniqueOrThrow({ where: { userId: client.id } })).firstName;
    expect(mail.type).toBe('INSTRUCTOR_NEW_BOOKING');
    expect(mail.title).toMatch(new RegExp(`^${name}.* u shtua në \\d\\d:\\d\\d-\\d\\d:\\d\\d$`));
    expect(mail.body).toContain('Ja ku është përmbledhja jote e ditës');
    const details = (mail.data as { details: [string, string][] }).details;
    expect(details.map((d) => d[1].split(' · ')[1])).toEqual(
      new Date(s.startsAt).toDateString() === new Date(later.startsAt).toDateString() ? ['1/5', '0/5'] : ['1/5'],
    );

    // Admin 1 cancels at the desk: admin 2 and the instructor hear about it, admin 1 does not.
    await app.inject({ method: 'POST', url: `/admin/bookings/${b.id}/cancel`, headers: admin1.auth, payload: {} });
    expect((await inApp(admin1.id)).map((r) => r.type)).toEqual(['STAFF_NEW_BOOKING']);
    expect((await inApp(admin2.id)).map((r) => r.type)).toEqual(['STAFF_NEW_BOOKING', 'STAFF_BOOKING_CANCELLED']);
    expect((await inApp(instructor.id)).map((r) => r.type)).toEqual(['INSTRUCTOR_NEW_BOOKING', 'STAFF_BOOKING_CANCELLED']);
  });

  it('sends the client and the instructor their reminders once each', async () => {
    const instructor = await makeUser('STAFF', { instructor: true });
    const client = await makeClientWithCredits(3);
    const s = await makeSession({ inHours: 50 / 60, instructorId: instructor.id }); // starts in 50 minutes
    await prisma.classBooking.create({ data: { sessionId: s.id, userId: client.id, status: 'BOOKED', bookedAt: at(-24 * 60) } });

    await sendReminders();
    await sendReminders(); // a second run sends nothing new
    expect((await inApp(client.id)).map((r) => r.type).filter((x) => x.startsWith('CLASS_REMINDER'))).toEqual(['CLASS_REMINDER_60']);
    expect((await inApp(instructor.id)).map((r) => r.type)).toEqual(['INSTRUCTOR_REMINDER_60']);
  });

  it('tells the admins when someone signs up', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const { testOutbox } = await import('../src/services/mail.js');
    const email = 'new.client@test.dev';
    await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email } });
    const code = [...testOutbox].reverse().find((m) => m.to === email)!.text.match(/\b(\d{6})\b/)![1];
    const v = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email, code } });
    await app.inject({ method: 'POST', url: '/auth/register', payload: { registrationToken: v.json().registrationToken, firstName: 'Ana', lastName: 'Kola', phone: '+355691234567' } });
    const rows = await inApp(admin.id);
    expect(rows.map((r) => r.type)).toEqual(['ADMIN_NEW_CLIENT']);
    expect(rows[0].body).toContain('Ana Kola');
  });
});
