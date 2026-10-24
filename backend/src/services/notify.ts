import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../lib/prisma.js';
import { MESSAGES } from './messages.js';
import { brandedEmail, sendEmail } from './mail.js';

/**
 * Notifications are rows first and deliveries second. `notify` only writes
 * (inside the caller's transaction, so a rolled-back booking sends nothing);
 * the worker delivers PUSH and EMAIL with retries. `dedupeKey` + channel is
 * unique, so the same event can be raised twice and is delivered once.
 */
export async function notify(
  db: Tx | typeof prisma,
  opts: { userId: string; type: keyof typeof MESSAGES; dedupeKey: string; params: Record<string, string | number | undefined>; data?: Prisma.InputJsonValue },
) {
  const def = MESSAGES[opts.type];
  if (!def) throw new Error(`Unknown notification type ${opts.type}`);
  const user = await db.user.findUnique({
    where: { id: opts.userId },
    select: { status: true, profile: { select: { language: true } }, notificationPrefs: true, pushTokens: { select: { id: true }, take: 1 } },
  });
  if (!user || user.status === 'DELETED' || user.status === 'DISABLED') return;
  const lang = user.profile?.language ?? 'sq';
  const prefs = user.notificationPrefs ?? { pushEnabled: true, emailEnabled: true, reminders: true, waitlist: true, marketing: false };
  const msg = def.render(lang, opts.params);

  const categoryOn =
    def.category === 'essential' ||
    (def.category === 'reminders' && prefs.reminders) ||
    (def.category === 'waitlist' && prefs.waitlist) ||
    (def.category === 'marketing' && prefs.marketing);
  if (!categoryOn) return;

  const rows: Prisma.NotificationCreateManyInput[] = [
    { userId: opts.userId, type: opts.type, channel: 'IN_APP', status: 'SENT', sentAt: new Date(), title: msg.title, body: msg.body, data: opts.data, dedupeKey: opts.dedupeKey },
  ];
  if (prefs.pushEnabled && user.pushTokens.length) {
    rows.push({ userId: opts.userId, type: opts.type, channel: 'PUSH', title: msg.title, body: msg.body, data: opts.data, dedupeKey: opts.dedupeKey });
  }
  if (def.email && (prefs.emailEnabled || def.critical)) {
    rows.push({
      userId: opts.userId,
      type: opts.type,
      channel: 'EMAIL',
      title: msg.title,
      body: msg.body,
      data: { ...((opts.data as object) ?? {}), details: msg.details ?? [], lang } as Prisma.InputJsonValue,
      dedupeKey: opts.dedupeKey,
    });
  }
  await db.notification.createMany({ data: rows, skipDuplicates: true });
}

const BACKOFF_MIN = [1, 5, 15, 60, 240];
const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;

/** Deliver pending PUSH/EMAIL rows. Safe to run from several processes: rows are claimed with skip locked. */
export async function deliverPending(limit = 50) {
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    update notifications set attempts = attempts + 1, next_attempt_at = now() + interval '10 minutes'
    where id in (
      select id from notifications
      where status = 'PENDING' and next_attempt_at <= now() and channel in ('PUSH','EMAIL')
      order by next_attempt_at limit ${limit}
      for update skip locked
    )
    returning id`;
  if (!claimed.length) return 0;
  const rows = await prisma.notification.findMany({
    where: { id: { in: claimed.map((r) => r.id) } },
    include: { user: { select: { email: true, pushTokens: true } } },
  });

  // Expo accepts up to 100 messages a call; one per row keeps errors per row.
  for (const n of rows) {
    try {
      if (n.channel === 'EMAIL') {
        const d = (n.data ?? {}) as { details?: [string, string][]; lang?: 'sq' | 'en' };
        const { html, text } = brandedEmail({
          heading: n.title,
          lines: [n.body],
          details: d.details,
          footer: d.lang === 'en' ? 'You can change which emails you receive in the app, under Profile.' : 'Mund të zgjedhësh cilat email-e merr te Profili në aplikacion.',
        });
        await sendEmail(n.user.email, n.title, html, text);
      } else {
        await sendPush(n.user.pushTokens.map((t) => t.token), n.title, n.body, n.data);
      }
      await prisma.notification.update({ where: { id: n.id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const done = n.attempts >= MAX_ATTEMPTS;
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          status: done ? 'FAILED' : 'PENDING',
          lastError: err.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + (BACKOFF_MIN[n.attempts - 1] ?? 240) * 60_000),
        },
      });
    }
  }
  return rows.length;
}

async function sendPush(tokens: string[], title: string, body: string, data: unknown) {
  if (!tokens.length) throw new Error('No push token');
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, data: data ?? {}, sound: 'default' }))),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { status: string; message?: string; details?: { error?: string } }[] };
  if (!res.ok) throw new Error(`Expo push ${res.status}`);
  const tickets = json.data ?? [];
  // A device that uninstalled the app: forget its token instead of retrying forever.
  await Promise.all(
    tickets.map((t, i) =>
      t.details?.error === 'DeviceNotRegistered' ? prisma.pushToken.deleteMany({ where: { token: tokens[i] } }) : null,
    ),
  );
  if (tickets.length && tickets.every((t) => t.status === 'error')) {
    throw new Error(tickets[0].message ?? 'Push rejected');
  }
}
