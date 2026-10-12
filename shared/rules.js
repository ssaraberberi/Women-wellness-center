/* ============================================================
   DUA — the rules, and the only copy of them
   ------------------------------------------------------------
   Pure functions over a plain object. The browser calls them so
   the interface can answer instantly; the server calls the same
   ones before it writes, so the answer the client saw is never
   the one that decides. Nothing here touches a database or a
   DOM, which is what lets both sides share it.

   A `state` is: { settings, classTypes, plans, instructors,
                   classes, bookings, memberships, creditEvents }
   ============================================================ */
import { DAY_KEYS, minutes, at, todayIn, plusDays } from './domain.js';

/* The defaults, used until the studio's own settings have been read. */
export const DEFAULTS = { openingDate: '2026-11-02', cancelMinutes: 30, horizonDays: 35, defaultCapacity: 5 };
export const settingsOf = state => ({ ...DEFAULTS, ...((state && state.settings) || {}) });

/* Kept for the screens that still name it. */
export const CANCEL_WINDOW_MIN = DEFAULTS.cancelMinutes;
export const BOOKING_HORIZON_DAYS = DEFAULTS.horizonDays;

export const typeOf = (state, id) => (state.classTypes || []).find(t => t.id === id) || { id, name: id, short: id };
export const planOf = (state, id) => (state.plans || []).find(p => p.id === id) || null;

/* ---------- packages and their credits ---------- */

/* A booking spends a credit while it stands, and keeps it spent if it was
   given up too late or she did not come. Cancelled in time, or cancelled by
   the studio, it gives the credit back. */
export const consumes = b => b.status === 'booked' || b.status === 'late';

export const isLive = m => !!m && m.status === 'active';
export const validOn = (m, date) => isLive(m) && date >= m.start && date <= m.end;

/* Every package a client holds that is still running, soonest to end first. */
export function packagesOf(state, clientId, now) {
  const today = todayIn(now);
  return (state.memberships || [])
    .filter(m => m.clientId === clientId && isLive(m) && m.end >= today)
    .sort((a, b) => a.end.localeCompare(b.end));
}

/* The one a screen names: the running package that ends soonest, else the
   most recent one of any kind, so an expired package can still be shown. */
export function membershipOf(state, clientId, now) {
  const running = packagesOf(state, clientId, now || new Date());
  if (running.length) return running[0];
  return (state.memberships || []).find(m => m.clientId === clientId && m.status !== 'requested') || null;
}

export function isExpired(m, now) {
  if (!m || !isLive(m)) return true;
  return todayIn(now) > m.end;
}

/* What each line of a package allows, and how much of it is left.
   total null means unlimited. */
export function creditLines(state, m) {
  const lines = (m && m.lines) || [];
  const events = (state.creditEvents || []).filter(e => e.membershipId === m.id);
  const mine = (state.bookings || []).filter(b => b.membershipId === m.id && consumes(b));
  const classOf = id => (state.classes || []).find(c => c.id === id);
  return lines.map((l, i) => {
    const adjust = events.filter(e => (e.line || 0) === i).reduce((n, e) => n + e.delta, 0);
    const used = mine.filter(b => { const c = classOf(b.classId); return c ? l.types.includes(c.typeId) : i === 0; }).length;
    const unlimited = l.total == null;
    const total = unlimited ? null : l.total + adjust;
    return {
      index: i, types: l.types, total, base: l.total, adjust, used, unlimited,
      left: unlimited ? Infinity : Math.max(0, total - used),
      label: l.types.map(t => typeOf(state, t).short).join(' + ')
    };
  });
}

/* Totals across the lines of one package, for a summary line. */
export function creditSummary(state, m) {
  const lines = creditLines(state, m);
  if (lines.some(l => l.unlimited)) return { unlimited: true, total: null, used: lines.reduce((n, l) => n + l.used, 0), left: Infinity };
  return lines.reduce((s, l) => ({ unlimited: false, total: s.total + l.total, used: s.used + l.used, left: s.left + l.left }),
    { unlimited: false, total: 0, used: 0, left: 0 });
}

/* Which package, and which line of it, would pay for this class: valid on
   the class's date, allowing its type, with a credit left. The one that
   runs out first is used first. */
export function packageFor(state, clientId, klass, now, onlyId) {
  for (const m of packagesOf(state, clientId, now)) {
    if (onlyId && m.id !== onlyId) continue;
    if (!validOn(m, klass.date)) continue;
    const line = creditLines(state, m).find(l => l.types.includes(klass.typeId) && l.left > 0);
    if (line) return { membership: m, line };
  }
  return null;
}

/* The lines of the one a client sees on her dashboard. */
export function balances(state, clientId, now) {
  const m = membershipOf(state, clientId, now);
  if (!m || !isLive(m)) return [];
  return creditLines(state, m).map(l => ({ ...l, allowance: { limit: l.total }, per: 'package' }));
}

/* ---------- capacity ---------- */

export const bookingsFor = (state, classId) =>
  (state.bookings || []).filter(b => b.classId === classId && b.status === 'booked');

/* Places taken by bookings, places the studio has blocked, and what is
   left. A Duo takes two. */
export function spots(state, klass) {
  const taken = bookingsFor(state, klass.id).length;
  const blocked = klass.blocked || 0;
  const left = Math.max(0, klass.capacity - taken - blocked);
  return { taken, blocked, capacity: klass.capacity, left, full: left <= 0 };
}

export const bookingOf = (state, clientId, classId) =>
  (state.bookings || []).find(b => b.clientId === clientId && b.classId === classId &&
                                   (b.status === 'booked' || b.status === 'waitlist'));

/* ---------- may this class be booked at all? ----------
   Open, not before the studio opens, not started, not too far ahead, and
   with room for this many people. */
export function bookable(state, klass, now, seats) {
  const no = (code, message) => ({ ok: false, code, message });
  const s = settingsOf(state);
  if (!klass) return no('missing', 'That class no longer exists');
  if (klass.cancelled) return no('cancelled', 'This class was cancelled');
  if (klass.date < s.openingDate) return no('before-opening', 'Classes start when the studio opens');
  if (at(klass.date, klass.start) <= now) return no('past', 'This class has already started');
  const first = todayIn(now) > s.openingDate ? todayIn(now) : s.openingDate;
  if (klass.date > plusDays(first, s.horizonDays)) return no('horizon', 'Booking opens ' + s.horizonDays + ' days ahead');
  const left = spots(state, klass).left;
  if (left < (seats || 1)) return no('full', seats > 1 && left > 0 ? 'Not enough places for two' : 'Class is full');
  return { ok: true, code: 'ok' };
}

/* ---------- may this client book this class? ---------- */
export function canBook(state, clientId, klass, now) {
  const no = (code, message) => ({ ok: false, code, message });
  if (!clientId) return no('signed-out', 'Sign in to book');
  const open = bookable(state, klass, now, 1);
  if (!open.ok && open.code !== 'full') return open;
  if (bookingOf(state, clientId, klass.id)) return no('already', 'Already booked');

  const running = packagesOf(state, clientId, now);
  if (!running.length) {
    const any = (state.memberships || []).some(m => m.clientId === clientId && isLive(m));
    return any ? no('expired', 'Your membership has expired') : no('no-membership', 'No active membership');
  }
  if (!running.some(m => validOn(m, klass.date)))
    return no('outside', 'Your package does not cover this date');
  if (!running.some(m => validOn(m, klass.date) && creditLines(state, m).some(l => l.types.includes(klass.typeId))))
    return no('not-included', 'Not included in your membership');
  if (!packageFor(state, clientId, klass, now))
    return no('no-sessions', 'No ' + typeOf(state, klass.typeId).short + ' classes left in your package');
  if (!open.ok) return open;
  return { ok: true, code: 'ok', message: 'Book class' };
}

/* ---------- cancellation ----------
   Allowed up to and including the minute the window closes: with a
   30-minute window, a 09:00 class can be cancelled at 08:30, not 08:31. */
export function cancelDeadline(klass, state) {
  return new Date(at(klass.date, klass.start).getTime() - settingsOf(state).cancelMinutes * 60000);
}
export function canCancel(klass, now, state) {
  const deadline = cancelDeadline(klass, state);
  const ok = now.getTime() <= deadline.getTime();
  return { ok, deadline, late: !ok };
}

/* ---------- who leads a class ----------
   Qualified, free, and available for the whole class — not merely
   present at the moment it starts. */
export function availabilityCovers(instructor, klass) {
  const key = DAY_KEYS[new Date(klass.date + 'T00:00:00').getDay()];
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
    return { status: 'unqualified', why: 'Not qualified for ' + typeOf(state, klass.typeId).short };
  if (!availabilityCovers(instructor, klass))
    return { status: 'unavailable', why: 'Outside their availability' };
  const clash = clashFor(state, instructor, klass);
  if (clash) return { status: 'clash', why: 'Already on a class ' + clash.start + '–' + clash.end };
  return { status: 'recommended', why: 'Qualified and free' };
}

export function suggestInstructors(state, klass) {
  const rank = { recommended: 0, clash: 1, unavailable: 2, unqualified: 3, removed: 4 };
  return (state.instructors || [])
    .map(i => ({ instructor: i, ...instructorFit(state, i, klass) }))
    .sort((a, b) => rank[a.status] - rank[b.status] || a.instructor.name.localeCompare(b.instructor.name));
}

/* ---------- drift ----------
   Valid when it was set, not valid now. The parts, not a sentence: this
   file has no language of its own. */
export function issues(state, now) {
  const out = [];
  const today = todayIn(now);
  (state.classes || []).forEach(c => {
    if (c.cancelled || c.date < today) return;
    const booked = bookingsFor(state, c.id).length;
    if (booked + (c.blocked || 0) > c.capacity) out.push({ kind: 'overfull', klass: c, count: booked });
    if (!c.instructorId) { out.push({ kind: 'unassigned', klass: c, why: 'Nobody assigned' }); return; }
    const i = (state.instructors || []).find(x => x.id === c.instructorId);
    if (!i) return;
    const fit = instructorFit(state, i, c);
    if (fit.status !== 'recommended')
      out.push({ kind: fit.status, klass: c, instructor: i, who: i.name, why: fit.why });
  });
  /* A booking for a date its package no longer covers — a package
     shortened or cancelled after the class was reserved. */
  const byId = new Map((state.memberships || []).map(m => [m.id, m]));
  (state.bookings || []).forEach(b => {
    if (b.status !== 'booked' || !b.membershipId) return;
    const c = (state.classes || []).find(k => k.id === b.classId);
    if (!c || c.cancelled || c.date < today) return;
    const m = byId.get(b.membershipId);
    if (m && !validOn(m, c.date)) out.push({ kind: 'outside-package', klass: c, membership: m, booking: b });
  });
  return out;
}
