/* ============================================================
   DUA — the rules, and the only copy of them
   ------------------------------------------------------------
   Pure functions over a plain object. The browser calls them so
   the interface can answer instantly; the server calls the same
   ones before it writes, so the answer the client saw is never
   the one that decides. Nothing here touches a database or a
   DOM, which is what lets both sides share it.

   A `state` is: { classTypes, plans, instructors, classes,
                   bookings, memberships }
   ============================================================ */
import { DAY_KEYS, iso, addDays, minutes, at, periodRange } from './domain.js';

export const CANCEL_WINDOW_MIN = 60;      // free cancellation until one hour before
export const BOOKING_HORIZON_DAYS = 7;    // the calendar opens a week ahead

export const typeOf = (state, id) => (state.classTypes || []).find(t => t.id === id) || { id, name: id, short: id };
export const planOf = (state, id) => (state.plans || []).find(p => p.id === id) || null;

/* ---------- membership ---------- */

/* The membership someone actually holds. A 'requested' row is a client
   asking for a package she has not paid for yet, so it is not one of these:
   it grants nothing until the studio confirms it, and leaving it out here is
   what makes every rule below agree about that. pendingOf is how a screen
   asks about it on purpose. */
export function membershipOf(state, clientId) {
  const mine = (state.memberships || [])
    .filter(m => m.clientId === clientId && m.status !== 'requested');
  return mine.find(m => m.status === 'active') || mine[0] || null;
}

export function pendingOf(state, clientId) {
  return (state.memberships || [])
    .find(m => m.clientId === clientId && m.status === 'requested') || null;
}

export function isExpired(membership, now) {
  if (!membership) return true;
  if (membership.status !== 'active') return true;
  return iso(now) > membership.end;
}

export function allowanceFor(state, planId, typeId) {
  const plan = planOf(state, planId);
  if (!plan) return null;
  return plan.allowances.find(a => a.types.includes(typeId)) || null;
}

/* A booking consumes a session unless it was given up in time, or
   the studio itself cancelled the class. */
const consumes = b => b.status === 'booked' || b.status === 'late';

export function usage(state, clientId, allowance, ref) {
  const [from, to] = periodRange(allowance.per, ref);
  return (state.bookings || []).filter(b => {
    if (b.clientId !== clientId || !consumes(b)) return false;
    const c = (state.classes || []).find(x => x.id === b.classId);
    if (!c || c.cancelled) return false;
    return allowance.types.includes(c.typeId) && c.date >= from && c.date <= to;
  }).length;
}

export function remaining(state, clientId, allowance, ref) {
  if (allowance.limit == null) return Infinity;
  return Math.max(0, allowance.limit - usage(state, clientId, allowance, ref));
}

/* One line per allowance — what the client dashboard renders. */
export function balances(state, clientId, now) {
  const m = membershipOf(state, clientId);
  const plan = m && planOf(state, m.planId);
  if (!plan) return [];
  return plan.allowances.map(a => ({
    allowance: a,
    label: a.types.map(t => typeOf(state, t).short).join(' + '),
    used: usage(state, clientId, a, now),
    left: remaining(state, clientId, a, now),
    unlimited: a.limit == null,
    per: a.per
  }));
}

/* ---------- capacity ---------- */

export const bookingsFor = (state, classId) =>
  (state.bookings || []).filter(b => b.classId === classId && b.status === 'booked');

export const waitlistFor = (state, classId) =>
  (state.bookings || []).filter(b => b.classId === classId && b.status === 'waitlist')
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));

export function spots(state, klass) {
  const taken = bookingsFor(state, klass.id).length;
  return { taken, capacity: klass.capacity, left: Math.max(0, klass.capacity - taken), full: taken >= klass.capacity };
}

export const bookingOf = (state, clientId, classId) =>
  (state.bookings || []).find(b => b.clientId === clientId && b.classId === classId &&
                                   (b.status === 'booked' || b.status === 'waitlist'));

/* ---------- may this client book this class? ---------- */

export function canBook(state, clientId, klass, now) {
  const no = (code, message) => ({ ok: false, code, message });
  if (!clientId) return no('signed-out', 'Sign in to book');
  if (!klass) return no('missing', 'That class no longer exists');
  if (klass.cancelled) return no('cancelled', 'This class was cancelled');

  const starts = at(klass.date, klass.start);
  if (starts <= now) return no('past', 'This class has already started');
  if (starts > addDays(now, BOOKING_HORIZON_DAYS))
    return no('horizon', 'Booking opens ' + BOOKING_HORIZON_DAYS + ' days ahead');

  if (bookingOf(state, clientId, klass.id)) return no('already', 'Already booked');

  const m = membershipOf(state, clientId);
  if (!m) return pendingOf(state, clientId)
    ? no('pending', 'Waiting for the studio to confirm your package')
    : no('no-membership', 'No active membership');
  if (isExpired(m, now)) return no('expired', 'Your membership has expired');

  const a = allowanceFor(state, m.planId, klass.typeId);
  if (!a) return no('not-included', 'Not included in your membership');

  if (remaining(state, clientId, a, starts) <= 0)
    return no('no-sessions', 'No ' + typeOf(state, klass.typeId).short + ' classes left this ' + a.per);

  if (spots(state, klass).full) return no('full', 'Class is full');
  return { ok: true, code: 'ok', message: 'Book class' };
}

/* ---------- cancellation ---------- */

export function cancelDeadline(klass) {
  return new Date(at(klass.date, klass.start).getTime() - CANCEL_WINDOW_MIN * 60000);
}
export function canCancel(klass, now) {
  const deadline = cancelDeadline(klass);
  return { ok: now < deadline, deadline, late: now >= deadline };
}

/* ---------- instructor matching ----------
   Qualified, free, and available for the whole class — not merely
   present at the moment it starts. */

export function availabilityCovers(instructor, klass) {
  const key = DAY_KEYS[at(klass.date, klass.start).getDay()];
  const bands = (instructor.availability && instructor.availability[key]) || [];
  const s = minutes(klass.start), e = minutes(klass.end);
  return bands.some(b => minutes(b.from) <= s && minutes(b.to) >= e);
}

export function clashFor(state, instructor, klass) {
  const s = minutes(klass.start), e = minutes(klass.end);
  return (state.classes || []).find(o =>
    o.id !== klass.id && !o.cancelled && o.instructorId === instructor.id &&
    o.date === klass.date && minutes(o.start) < e && minutes(o.end) > s) || null;
}

export function instructorFit(state, instructor, klass) {
  if (!instructor) return { status: 'removed', why: 'Not at the studio' };
  if (!instructor.active) return { status: 'removed', why: 'No longer at the studio' };
  if (!instructor.qualifications.includes(klass.typeId))
    return { status: 'unqualified', why: 'Does not teach ' + typeOf(state, klass.typeId).short };
  if (!availabilityCovers(instructor, klass))
    return { status: 'unavailable', why: 'Outside their availability' };
  const clash = clashFor(state, instructor, klass);
  if (clash) return { status: 'clash', why: 'Already teaching ' + clash.start + '–' + clash.end };
  return { status: 'recommended', why: 'Qualified and free' };
}

export function suggestInstructors(state, klass) {
  const rank = { recommended: 0, clash: 1, unavailable: 2, unqualified: 3, removed: 4 };
  return (state.instructors || [])
    .map(i => ({ instructor: i, ...instructorFit(state, i, klass) }))
    .sort((a, b) => rank[a.status] - rank[b.status] || a.instructor.name.localeCompare(b.instructor.name));
}

/* ---------- drift ----------
   Valid when it was set, not valid now. */

/* The parts, not a sentence: this file is shared with the server and has
   no language of its own, so the screen that shows a problem is the one
   that puts it into words. */
export function issues(state, now) {
  const out = [];
  (state.classes || []).forEach(c => {
    if (c.cancelled || c.date < iso(now)) return;
    if (!c.instructorId) { out.push({ kind: 'unassigned', klass: c, why: 'No instructor assigned' }); return; }
    const i = (state.instructors || []).find(x => x.id === c.instructorId);
    if (!i) return;
    const fit = instructorFit(state, i, c);
    if (fit.status !== 'recommended')
      out.push({ kind: fit.status, klass: c, instructor: i, who: i.name, why: fit.why });
  });
  (state.memberships || []).filter(m => m.status === 'active').forEach(m => {
    if (!isExpired(m, now)) return;
    const future = (state.bookings || []).filter(b => b.clientId === m.clientId && b.status === 'booked' &&
      ((state.classes || []).find(c => c.id === b.classId) || {}).date >= iso(now));
    if (future.length) out.push({ kind: 'expired-booked', membership: m, count: future.length });
  });
  return out;
}
