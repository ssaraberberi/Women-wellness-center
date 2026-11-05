import { prisma } from './lib/prisma.js';
import { getSettings } from './lib/settings.js';
import { addMinutes, formatStudio } from './lib/time.js';
import { deliverPending } from './services/notify.js';
import { expireWaitlistOffers, whenText } from './services/booking.js';
import { generateSessions } from './services/schedule.js';
import { notify } from './services/notify.js';

/**
 * Every job is safe to run twice or from two processes at once: deliveries are
 * claimed with skip-locked, reminders are deduplicated by key, generation is
 * insert-if-missing.
 */
/** Minutes before class, largest first. */
const CLIENT_STEPS = [
  { min: 60, type: 'CLASS_REMINDER_60' },
  { min: 30, type: 'CLASS_REMINDER_30' },
  { min: 15, type: 'CLASS_REMINDER_15' },
] as const;
const INSTRUCTOR_STEPS = [
  { min: 120, type: 'INSTRUCTOR_REMINDER_120' },
  { min: 60, type: 'INSTRUCTOR_REMINDER_60' },
  { min: 15, type: 'INSTRUCTOR_REMINDER_15' },
] as const;

/**
 * The reminder due now: the step whose window holds the time left (60 → from
 * 60 down to 30 minutes, 30 → down to 15, 15 → until the start). Only one
 * fires per run, so a late worker never sends three at once. A step whose
 * moment came before the booking was made is skipped: booking 20 minutes
 * before gets only the 15-minute one.
 */
export function dueStep<S extends { min: number }>(steps: readonly S[], startsAt: Date, now: Date, bookedAt?: Date) {
  const left = (+startsAt - +now) / 60_000;
  const i = steps.findIndex((s, k) => left <= s.min && left > (steps[k + 1]?.min ?? 0));
  if (i < 0) return null;
  const step = steps[i];
  if (bookedAt && +bookedAt > +startsAt - step.min * 60_000) return null;
  return step;
}

export async function sendReminders() {
  const s = await getSettings();
  const now = new Date();

  // Clients: 1 hour, 30 minutes and 15 minutes before.
  const bookings = await prisma.classBooking.findMany({
    where: { status: 'BOOKED', session: { status: 'SCHEDULED', startsAt: { gt: now, lte: addMinutes(now, CLIENT_STEPS[0].min) } } },
    include: { session: { include: { classType: true } } },
    take: 1000,
  });
  for (const b of bookings) {
    const step = dueStep(CLIENT_STEPS, b.session.startsAt, now, b.bookedAt);
    if (!step) continue;
    await notify(prisma, {
      userId: b.userId,
      type: step.type,
      dedupeKey: `reminder:${step.min}:${b.id}`,
      params: { className: b.session.classType.name, time: formatStudio(b.session.startsAt, 'HH:mm') },
      data: { kind: 'class', bookingId: b.id, sessionId: b.sessionId },
    });
  }

  // Instructors: 2 hours, 1 hour and 15 minutes before each class they teach.
  const sessions = await prisma.classSession.findMany({
    where: { status: 'SCHEDULED', instructorId: { not: null }, startsAt: { gt: now, lte: addMinutes(now, INSTRUCTOR_STEPS[0].min) } },
    include: { classType: true, _count: { select: { bookings: { where: { status: 'BOOKED' } } } } },
    take: 500,
  });
  for (const c of sessions) {
    const step = dueStep(INSTRUCTOR_STEPS, c.startsAt, now);
    if (!step) continue;
    await notify(prisma, {
      userId: c.instructorId!,
      type: step.type,
      dedupeKey: `instructor-reminder:${step.min}:${c.id}`,
      params: { className: c.classType.name, time: formatStudio(c.startsAt, 'HH:mm'), booked: c._count.bookings, capacity: c.capacity },
      data: { kind: 'class', sessionId: c.id },
    });
  }

  const until = addMinutes(now, s.reminderHoursBefore * 60);
  const appts = await prisma.spaAppointment.findMany({ where: { status: 'BOOKED', startsAt: { gt: now, lte: until } }, include: { treatment: true }, take: 500 });
  for (const a of appts) {
    await notify(prisma, {
      userId: a.clientId,
      type: 'SPA_REMINDER',
      dedupeKey: `spa-reminder:${a.id}`,
      params: { treatment: a.treatment.name, when: whenText(a.startsAt) },
      data: { kind: 'spa', appointmentId: a.id },
    });
  }
  const expiring = await prisma.membershipPurchase.findMany({
    where: { status: 'ACTIVE', expiresAt: { gt: now, lte: addMinutes(now, s.expiryReminderDays * 1440) } },
    include: { wallet: true },
    take: 500,
  });
  for (const p of expiring) {
    await notify(prisma, {
      userId: p.userId,
      type: 'MEMBERSHIP_EXPIRING',
      dedupeKey: `expiring:${p.id}`,
      params: { product: p.nameSnapshot, expires: formatStudio(p.expiresAt!, 'd LLL'), remaining: p.wallet?.remaining ?? 0 },
      data: { kind: 'purchase', purchaseId: p.id },
    });
  }
}

export async function housekeeping() {
  const now = new Date();
  await prisma.membershipPurchase.updateMany({ where: { status: 'ACTIVE', expiresAt: { lte: now } }, data: { status: 'EXPIRED' } });
  await prisma.classSession.updateMany({ where: { status: 'SCHEDULED', endsAt: { lte: now } }, data: { status: 'COMPLETED' } });
  await prisma.authOtpChallenge.deleteMany({ where: { createdAt: { lt: addMinutes(now, -2 * 1440) } } });
  await prisma.authSession.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: addMinutes(now, -30 * 1440) } }] } });
}

type Job = { name: string; everyMs: number; run: () => Promise<unknown>; last?: number; running?: boolean };

export function startWorker(log: { info: (o: object, m?: string) => void; error: (o: object, m?: string) => void }) {
  const jobs: Job[] = [
    { name: 'deliver-notifications', everyMs: 10_000, run: () => deliverPending() },
    { name: 'waitlist-offers', everyMs: 30_000, run: () => expireWaitlistOffers() },
    // Every minute, so "15 minutes before" arrives at 15, not at 11.
    { name: 'reminders', everyMs: 60_000, run: sendReminders },
    { name: 'generate-sessions', everyMs: 60 * 60_000, run: () => generateSessions() },
    { name: 'housekeeping', everyMs: 15 * 60_000, run: housekeeping },
  ];
  const tick = async () => {
    const now = Date.now();
    for (const job of jobs) {
      if (job.running || (job.last && now - job.last < job.everyMs)) continue;
      job.running = true;
      job.last = now;
      job
        .run()
        .catch((e) => log.error({ err: e, job: job.name }, 'job failed'))
        .finally(() => (job.running = false));
    }
  };
  const timer = setInterval(tick, 5_000);
  void tick();
  log.info({ jobs: jobs.map((j) => j.name) }, 'worker started');
  return () => clearInterval(timer);
}
