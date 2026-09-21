/* ============================================================
   DUA — the rules
   ------------------------------------------------------------
   Every decision the platform makes lives here: who may book
   what, who may teach when, and what a cancellation costs. The
   views ask these questions and render the answer; they never
   work it out themselves.
   ============================================================ */
import { CLASS_TYPES, PLANS, DAYS, iso, addDays, startOfWeek, minutes, at } from './data.js';

export const typeOf = id => CLASS_TYPES.find(t => t.id === id);
export const planOf = id => PLANS.find(p => p.id === id);

export const CANCEL_WINDOW_MIN = 60;      // free cancellation until one hour before
export const BOOKING_HORIZON_DAYS = 7;    // the calendar opens a week ahead

/* ---------- membership ---------- */

export function membershipOf(state, clientId) {
  const mine = state.memberships.filter(m => m.clientId === clientId);
  return mine.find(m => m.status === 'active') || mine[0] || null;
}

export function isExpired(membership, now) {
  if (!membership) return true;
  if (membership.status === 'cancelled') return true;
  return iso(now) > membership.end;
}

export function allowanceFor(planId, typeId) {
  const plan = planOf(planId);
  if (!plan) return null;
  return plan.allowances.find(a => a.types.includes(typeId)) || null;
}

/* The window an allowance is counted over, as [fromISO, toISO]. */
export function periodRange(per, ref) {
  if (per === 'week') {
    const s = startOfWeek(ref);
    return [iso(s), iso(addDays(s, 6))];
  }
  const s = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const e = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return [iso(s), iso(e)];
}

/* A booking consumes a session unless it was cancelled in time. */
const consumes = b => b.status === 'booked' || b.status === 'late';

export function usage(state, clientId, allowance, ref) {
  const [from, to] = periodRange(allowance.per, ref);
  return state.bookings.filter(b => {
    if (b.clientId !== clientId || !consumes(b)) return false;
    const s = state.sessions.find(x => x.id === b.sessionId);
    if (!s || s.cancelled) return false;
    return allowance.types.includes(s.typeId) && s.date >= from && s.date <= to;
  }).length;
}

export function remaining(state, clientId, allowance, ref) {
  if (allowance.limit == null) return Infinity;
  return Math.max(0, allowance.limit - usage(state, clientId, allowance, ref));
}

/* What the client dashboard shows: one line per allowance. */
export function balances(state, clientId, now) {
  const m = membershipOf(state, clientId);
  if (!m) return [];
  const plan = planOf(m.planId);
  if (!plan) return [];
  return plan.allowances.map(a => ({
    allowance: a,
    label: a.types.map(t => typeOf(t).short).join(' + '),
    used: usage(state, clientId, a, now),
    left: remaining(state, clientId, a, now),
    unlimited: a.limit == null,
    per: a.per
  }));
}

/* ---------- capacity ---------- */

export const bookingsFor = (state, sessionId) =>
  state.bookings.filter(b => b.sessionId === sessionId && b.status === 'booked');

export const waitlistFor = (state, sessionId) =>
  state.bookings.filter(b => b.sessionId === sessionId && b.status === 'waitlist');

export function spots(state, session) {
  const taken = bookingsFor(state, session.id).length;
  return { taken, capacity: session.capacity, left: Math.max(0, session.capacity - taken), full: taken >= session.capacity };
}

export const bookingOf = (state, clientId, sessionId) =>
  state.bookings.find(b => b.clientId === clientId && b.sessionId === sessionId &&
                           (b.status === 'booked' || b.status === 'waitlist'));

/* ---------- can this client book this class? ---------- */

export function canBook(state, clientId, session, now) {
  const no = (code, message) => ({ ok: false, code, message });
  if (!clientId) return no('signed-out', 'Sign in to book');

  if (session.cancelled) return no('cancelled', 'This class was cancelled');
  const starts = at(session.date, session.start);
  if (starts <= now) return no('past', 'This class has already started');
  if (starts > addDays(now, BOOKING_HORIZON_DAYS))
    return no('horizon', 'Booking opens ' + BOOKING_HORIZON_DAYS + ' days ahead');

  if (bookingOf(state, clientId, session.id)) return no('already', 'Already booked');

  const m = membershipOf(state, clientId);
  if (!m || m.status === 'cancelled') return no('no-membership', 'No active membership');
  if (isExpired(m, now)) return no('expired', 'Your membership has expired');

  const a = allowanceFor(m.planId, session.typeId);
  if (!a) return no('not-included', 'Not included in your membership');

  if (remaining(state, clientId, a, starts) <= 0) {
    const word = a.per === 'week' ? 'this week' : 'this month';
    return no('no-sessions', 'No ' + typeOf(session.typeId).short + ' classes left ' + word);
  }

  if (spots(state, session).full) return no('full', 'Class is full');
  return { ok: true, code: 'ok', message: 'Book class' };
}

/* ---------- cancellation ---------- */

export function cancelDeadline(session) {
  return new Date(at(session.date, session.start).getTime() - CANCEL_WINDOW_MIN * 60000);
}

export function canCancel(session, now) {
  const deadline = cancelDeadline(session);
  return { ok: now < deadline, deadline, late: now >= deadline };
}

/* ---------- instructor matching ----------
   The heart of the scheduling: qualified, free, and available for
   the whole class — not merely present at the moment it starts. */

export function availabilityCovers(instructor, session) {
  const dayKey = DAYS[at(session.date, session.start).getDay()];
  const bands = (instructor.availability && instructor.availability[dayKey]) || [];
  const s = minutes(session.start), e = minutes(session.end);
  return bands.some(b => minutes(b.from) <= s && minutes(b.to) >= e);
}

export function clashFor(state, instructor, session) {
  const s = minutes(session.start), e = minutes(session.end);
  return state.sessions.find(o =>
    o.id !== session.id && !o.cancelled && o.instructorId === instructor.id &&
    o.date === session.date && minutes(o.start) < e && minutes(o.end) > s) || null;
}

export function instructorFit(state, instructor, session) {
  if (!instructor.active) return { status: 'removed', why: 'No longer at the studio' };
  if (!instructor.qualifications.includes(session.typeId))
    return { status: 'unqualified', why: 'Does not teach ' + typeOf(session.typeId).short };
  if (!availabilityCovers(instructor, session))
    return { status: 'unavailable', why: 'Outside their availability' };
  const clash = clashFor(state, instructor, session);
  if (clash) return { status: 'clash', why: 'Already teaching ' + clash.start + '–' + clash.end };
  return { status: 'recommended', why: 'Qualified and free' };
}

export function suggestInstructors(state, session) {
  const rank = { recommended: 0, clash: 1, unavailable: 2, unqualified: 3, removed: 4 };
  return state.instructors
    .map(i => ({ instructor: i, ...instructorFit(state, i, session) }))
    .sort((a, b) => rank[a.status] - rank[b.status] || a.instructor.name.localeCompare(b.instructor.name));
}

/* ---------- integrity ----------
   Things that were valid when they were set and are not any more.
   The admin sees these rather than discovering them on the day. */

export function issues(state, now) {
  const out = [];
  state.sessions.forEach(s => {
    if (s.cancelled || s.date < iso(now)) return;
    if (!s.instructorId) { out.push({ kind: 'unassigned', session: s, text: 'No instructor assigned' }); return; }
    const i = state.instructors.find(x => x.id === s.instructorId);
    if (!i) return;
    const fit = instructorFit(state, i, s);
    if (fit.status !== 'recommended')
      out.push({ kind: fit.status, session: s, instructor: i, text: i.name + ' — ' + fit.why.toLowerCase() });
  });
  state.memberships.filter(m => m.status === 'active').forEach(m => {
    if (!isExpired(m, now)) return;
    const future = state.bookings.filter(b => b.clientId === m.clientId && b.status === 'booked' &&
      (state.sessions.find(s => s.id === b.sessionId) || {}).date >= iso(now));
    if (future.length) out.push({ kind: 'expired-booked', membership: m,
      text: 'Membership expired with ' + future.length + ' class' + (future.length > 1 ? 'es' : '') + ' still booked' });
  });
  return out;
}
