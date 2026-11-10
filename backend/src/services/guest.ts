import { createHash, randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { prisma, isUniqueViolation } from '../lib/prisma.js';
import { AppError, E } from '../lib/errors.js';
import { getSettings } from '../lib/settings.js';
import { addMinutes } from '../lib/time.js';
import { normalizeEmail, requestOtp, verifyEmailCode } from './auth.js';
import { issueSession } from './tokens.js';
import { usableCredits } from './credits.js';
import { bookClass, cancelBooking, instructorName, lastFreeCancel, lek, singleClassProduct, takenPlaces, whenText } from './booking.js';
import { notifyAdmins } from './notify.js';
import { lookalikes } from './offers.js';
import { brandedEmail, sendEmail } from './mail.js';

/**
 * Booking without an account. The only proof of who she is: the code sent to
 * her email. A name or a phone number typed into a form identifies nobody, so
 * nothing is matched on them — an existing client is found only by the email
 * she has just proven. Proving it is the same as signing in with a code, so
 * she leaves signed in (a session, like any login); she never needs a password.
 *
 * Without sessions in a package she books a single class: confirmed at once,
 * owed at the studio (a PENDING order at the SINGLE price). With sessions left
 * she is asked which to use — credits are never spent because a form said so.
 */

type Platform = 'WEB' | 'APP';
type Meta = { ip?: string; userAgent?: string };

/** Step 1: is the class bookable, and is there a price? Then the code goes out. */
export async function requestGuestCode(input: { sessionId: string; email: string; lang: 'sq' | 'en' }, ip?: string) {
  await assertOpenForGuests(input.sessionId);
  return requestOtp(input.email, input.lang, ip, 'booking');
}

async function assertOpenForGuests(sessionId: string) {
  const s = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!s) throw E.notFound('Class');
  const settings = await getSettings();
  if (s.status !== 'SCHEDULED') throw E.conflict('CLASS_CANCELLED', 'This class is not taking bookings');
  if (s.startsAt <= addMinutes(new Date(), settings.bookingCutoffMin)) throw E.conflict('CLASS_STARTED', 'This class has already started');
  // A hint only: the booking transaction counts again under the lock.
  const { taken } = await takenPlaces(prisma, sessionId);
  if (taken >= s.capacity) throw E.conflict('CLASS_FULL', 'This class is full');
  await singleClassProduct(prisma);
  return s;
}

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export type GuestResult =
  | { status: 'booked'; booking: BookingView; manageToken: string; session: Awaited<ReturnType<typeof issueSession>>; created: boolean }
  | { status: 'has_package'; credits: number; session: Awaited<ReturnType<typeof issueSession>>; created: boolean }
  | { status: 'not_booked'; error: { code: string; message: string }; session: Awaited<ReturnType<typeof issueSession>>; created: boolean }
  | { status: 'already_booked'; booking: BookingView };

/** Step 2: the code, the class, who she is. */
export async function confirmGuestBooking(
  input: { sessionId: string; email: string; code: string; firstName: string; lastName: string; phone: string; lang: 'sq' | 'en'; platform: Platform },
  opts: { idempotencyKey?: string | null; meta: Meta },
): Promise<GuestResult> {
  const email = normalizeEmail(input.email);

  // A retry of a request that already went through (lost answer): show the same booking.
  // No new session or link — those need the code again.
  if (opts.idempotencyKey) {
    const prior = await prisma.classBooking.findFirst({ where: { idempotencyKey: opts.idempotencyKey, sessionId: input.sessionId, user: { email } } });
    if (prior) return { status: 'already_booked', booking: await bookingView(prior.id) };
  }

  await verifyEmailCode(email, input.code);

  const { user, created } = await clientForVerifiedEmail(email, input);
  const session = await issueSession(user.id, 'CLIENT', opts.meta);

  const s = await prisma.classSession.findUniqueOrThrow({ where: { id: input.sessionId }, include: { classType: true } });
  const credits = await usableCredits(prisma, user.id, s.startsAt);
  if (credits >= s.classType.creditsRequired) return { status: 'has_package', credits, session, created };

  try {
    const booking = await bookClass(user.id, s.id, {
      actor: { id: user.id, role: 'CLIENT' },
      source: input.platform === 'WEB' ? 'GUEST_WEB' : 'GUEST_APP',
      idempotencyKey: opts.idempotencyKey,
      pay: 'single',
      skipEmail: true, // her letter below carries the private link
    });
    const manageToken = await createManageToken(booking.id, s.endsAt);
    const view = await bookingView(booking.id);
    void sendConfirmation(email, user.language, view, manageToken).catch((e) => console.error('[guest] confirmation email failed', e));
    return { status: 'booked', booking: view, manageToken, session, created };
  } catch (e) {
    // She is verified and signed in; only the booking failed (full, closed…). The app can try again.
    if (e instanceof AppError) return { status: 'not_booked', error: { code: e.code, message: e.message }, session, created };
    throw e;
  }
}

/**
 * The client this verified email belongs to, or a new one. An existing
 * profile is never overwritten by what was typed; only an empty phone is filled.
 */
async function clientForVerifiedEmail(email: string, input: { firstName: string; lastName: string; phone: string; lang: 'sq' | 'en'; platform: Platform }) {
  const existing = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
  if (existing) {
    if (existing.status === 'DISABLED' || existing.status === 'DELETED') throw E.unauthorized();
    if (existing.role !== 'CLIENT') throw E.conflict('STAFF_ACCOUNT', 'This email belongs to a staff account: sign in in the app');
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
        status: existing.status === 'INVITED' ? 'ACTIVE' : existing.status,
        profile: existing.profile
          ? existing.profile.phone ? undefined : { update: { phone: input.phone } }
          : { create: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, language: input.lang } },
      },
    });
    return { user: { id: existing.id, language: existing.profile?.language ?? input.lang }, created: false };
  }
  try {
    const u = await prisma.user.create({
      data: {
        email,
        role: 'CLIENT',
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
        profile: { create: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, language: input.lang } },
        notificationPrefs: { create: {} },
      },
    });
    await notifyAdmins(prisma, {
      type: 'ADMIN_NEW_CLIENT',
      dedupeKey: `signup:${u.id}`,
      params: { client: `${input.firstName} ${input.lastName}`.trim(), via: input.platform === 'WEB' ? 'web' : 'app' },
      data: { kind: 'client', clientId: u.id },
    });
    return { user: { id: u.id, language: input.lang }, created: true };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Two confirmations at once from the same inbox: the other one made her.
    const u = await prisma.user.findUniqueOrThrow({ where: { email }, include: { profile: true } });
    return { user: { id: u.id, language: u.profile?.language ?? input.lang }, created: false };
  }
}

/**
 * A visitor: a name and a phone, no account and no code. One class, paid at
 * the studio. Nothing proves who she is, so she is not signed in, no package
 * is touched, and an account someone signs in to is never matched — only a
 * client who has never signed in (an earlier visitor, or one the desk added)
 * with the same phone or email is reused. Anyone else is a new client,
 * flagged for the desk when she looks like someone already known.
 */
export async function visitorBooking(
  input: { sessionId: string; email?: string | null; firstName: string; lastName: string; phone: string; lang: 'sq' | 'en'; platform: Platform },
  opts: { idempotencyKey?: string | null },
) {
  const email = input.email ? normalizeEmail(input.email) : null;
  if (opts.idempotencyKey) {
    const prior = await prisma.classBooking.findFirst({ where: { idempotencyKey: opts.idempotencyKey, sessionId: input.sessionId, user: { profile: { phone: input.phone } } } });
    if (prior) return { status: 'already_booked' as const, booking: await bookingView(prior.id) };
  }
  await assertOpenForGuests(input.sessionId);

  const unclaimed = { role: 'CLIENT' as const, passwordHash: null, emailVerifiedAt: null, status: { in: ['ACTIVE' as const, 'INVITED' as const] } };
  const reuse =
    (await prisma.user.findFirst({ where: { ...unclaimed, profile: { phone: input.phone } }, orderBy: { createdAt: 'asc' } })) ??
    (email ? await prisma.user.findFirst({ where: { ...unclaimed, email } }) : null);
  let userId = reuse?.id;
  if (!userId) {
    const twins = await lookalikes(prisma, { email, phone: input.phone, firstName: input.firstName, lastName: input.lastName });
    const emailTaken = email ? !!(await prisma.user.findUnique({ where: { email }, select: { id: true } })) : false;
    const u = await prisma.user.create({
      data: {
        email: emailTaken ? null : email,
        role: 'CLIENT',
        profile: { create: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, language: input.lang } },
        notificationPrefs: { create: {} },
      },
    });
    userId = u.id;
    const lines = [
      'Booked online as a visitor; identity not verified.',
      ...(emailTaken ? [`Email ${email} is already used by another account — left off this profile.`] : []),
      ...(twins.length ? [`Possible duplicate of ${twins.map((x) => x.id).join(', ')} (same phone or email) — check before merging.`] : []),
    ];
    await prisma.clientNote.create({ data: { clientId: u.id, authorId: u.id, body: lines.join(' '), visibility: 'INTERNAL' } });
    await notifyAdmins(prisma, {
      type: 'ADMIN_NEW_CLIENT',
      dedupeKey: `signup:${u.id}`,
      params: { client: `${input.firstName} ${input.lastName}`.trim(), via: input.platform === 'WEB' ? 'web' : 'app' },
      data: { kind: 'client', clientId: u.id },
    });
  }

  const booking = await bookClass(userId, input.sessionId, {
    actor: { id: userId, role: 'CLIENT' },
    source: input.platform === 'WEB' ? 'GUEST_WEB' : 'GUEST_APP',
    idempotencyKey: opts.idempotencyKey,
    pay: 'single',
    // A visitor changes or cancels a booking by calling the studio: nothing to email.
    skipEmail: true,
  });
  return { status: 'booked' as const, booking: await bookingView(booking.id), created: !reuse };
}

// ───────────────────────────── private links ─────────────────────────────

async function createManageToken(bookingId: string, until: Date) {
  const token = randomBytes(32).toString('base64url');
  await prisma.bookingManageToken.create({ data: { bookingId, tokenHash: digest(token), expiresAt: until } });
  return token;
}

async function bookingForToken(token: string) {
  const row = await prisma.bookingManageToken.findUnique({ where: { tokenHash: digest(token) } });
  if (!row || row.revokedAt || row.expiresAt <= new Date()) throw E.notFound('Booking');
  return row.bookingId;
}

export type BookingView = Awaited<ReturnType<typeof bookingView>>;

/** What a link may show: her class and what she owes. No email, no phone, no balances. */
export async function bookingView(bookingId: string) {
  const b = await prisma.classBooking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { session: { include: { classType: true, instructor: { include: { user: { include: { profile: true } } } } } }, order: true, user: { include: { profile: true } }, attendance: true },
  });
  const settings = await getSettings();
  const s = b.session;
  const freeCancelUntil = lastFreeCancel(s.startsAt, settings);
  return {
    id: b.id,
    status: b.status,
    attendance: b.attendance?.status ?? null,
    firstName: b.user.profile?.firstName ?? '',
    class: { id: s.id, name: s.classType.name, nameEn: s.classType.nameEn, startsAt: s.startsAt, endsAt: s.endsAt, instructor: instructorName(s) ?? null, status: s.status },
    payment: b.order ? { reference: b.order.reference, total: b.order.total, status: b.order.status } : null,
    freeCancelUntil,
    canCancel: b.status === 'BOOKED' && s.startsAt > new Date(),
  };
}

export async function viewByToken(token: string) {
  return bookingView(await bookingForToken(token));
}

/** Cancelling from the link, under the same rules as in the app (free until 1 hour before). */
export async function cancelByToken(token: string) {
  const bookingId = await bookingForToken(token);
  const b = await prisma.classBooking.findUniqueOrThrow({ where: { id: bookingId } });
  const result = await cancelBooking(bookingId, { id: b.userId, role: 'CLIENT' });
  return { ...result, booking: await bookingView(bookingId) };
}

async function sendConfirmation(to: string, lang: 'sq' | 'en', v: BookingView, token: string) {
  const sq = lang === 'sq';
  const when = whenText(v.class.startsAt, lang);
  // After '#': browsers never send the fragment to a server, so the link stays out of every access log.
  const link = `${env.PUBLIC_BOOK_URL}#manage=${token}`;
  const { html, text } = brandedEmail({
    heading: sq ? 'Rezervimi u konfirmua' : 'Your booking is confirmed',
    lines: [
      sq ? `Të presim, ${v.firstName}!` : `See you soon, ${v.firstName}!`,
      v.payment ? (sq ? `Paguan në studio, me cash: ${lek(v.payment.total)}.` : `You pay at the studio, in cash: ${lek(v.payment.total)}.`) : '',
      sq ? `Anulim falas deri: ${whenText(v.freeCancelUntil, lang)}. Më vonë, klasa paguhet.` : `Free cancellation until ${whenText(v.freeCancelUntil, lang)}. After that the class is due.`,
      sq ? `Shiko ose anulo rezervimin: ${link}` : `View or cancel your booking: ${link}`,
    ].filter(Boolean),
    details: [
      [sq ? 'Klasa' : 'Class', v.class.name],
      [sq ? 'Data' : 'Date', when],
      ...(v.class.instructor ? ([[sq ? 'Instruktorja' : 'Instructor', v.class.instructor]] as [string, string][]) : []),
      ...(v.payment ? ([[sq ? 'Referenca' : 'Reference', v.payment.reference]] as [string, string][]) : []),
    ],
    footer: sq ? 'Ky link është vetëm për ty — mos e ndaj me të tjerë.' : 'This link is only for you — do not share it.',
  });
  await sendEmail(to, sq ? `Rezervimi: ${v.class.name} · ${when}` : `Booked: ${v.class.name} · ${when}`, html, text);
}
