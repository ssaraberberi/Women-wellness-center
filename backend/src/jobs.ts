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
export async function sendReminders() {
  const s = await getSettings();
  const now = new Date();
  const until = addMinutes(now, s.reminderHoursBefore * 60);
  const bookings = await prisma.classBooking.findMany({
    where: { status: 'BOOKED', session: { status: 'SCHEDULED', startsAt: { gt: now, lte: until } } },
    include: { session: { include: { classType: true } } },
    take: 500,
  });
  for (const b of bookings) {
    await notify(prisma, {
      userId: b.userId,
      type: 'CLASS_REMINDER',
      dedupeKey: `reminder:${b.id}`,
      params: { className: b.session.classType.name, when: whenText(b.session.startsAt) },
      data: { kind: 'class', bookingId: b.id, sessionId: b.sessionId },
    });
  }
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
    { name: 'reminders', everyMs: 5 * 60_000, run: sendReminders },
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
