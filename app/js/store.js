/* ============================================================
   DUA — state and the actions that change it
   ------------------------------------------------------------
   One store, one subscribe, and every write goes through an
   action so the consequences the brief asks for — a released
   seat going to the waitlist, a removed instructor leaving her
   classes unassigned — happen in one place rather than in
   whichever screen happened to trigger them.
   ============================================================ */
import { seed, iso, addDays, PLANS } from './data.js';
import { bookingsFor, waitlistFor, spots, canBook, canCancel, membershipOf, instructorFit } from './rules.js';

const KEY = 'dua-platform-v1';
let state = load();
const subs = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.sessions) return s; }
  } catch (e) {}
  return seed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

export const get = () => state;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function commit(note) { save(); subs.forEach(fn => fn(state, note)); }

export function reset() { state = seed(); commit('reset'); }

/* ---------- notices ----------
   What the brief calls "clearly notify affected users": a note
   addressed to a person, raised whenever a change reaches past
   something they had already booked. */
function notify(userId, text, tone) {
  (state.notices = state.notices || []).unshift({
    id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
    userId, text, tone: tone || 'info', at: new Date().toISOString(), read: false
  });
}
export const noticesFor = id => (state.notices || []).filter(n => n.userId === id);
export function markNoticesRead(id) {
  (state.notices || []).forEach(n => { if (n.userId === id) n.read = true; });
  commit('notices');
}

const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const sessionById = id => state.sessions.find(s => s.id === id);

/* ---------- accounts ---------- */

export function findAccount(email) {
  const e = (email || '').trim().toLowerCase();
  const inList = (list, role) => { const u = list.find(x => x.email.toLowerCase() === e); return u ? { user: u, role } : null; };
  return inList(state.admins, 'admin') || inList(state.instructors, 'instructor') || inList(state.clients, 'client');
}

export function signIn(email, password) {
  const hit = findAccount(email);
  if (!hit) return { ok: false, message: 'No account with that email' };
  if (hit.role === 'instructor' && !hit.user.active) return { ok: false, message: 'This instructor account has been removed' };
  if (hit.user.password !== password) return { ok: false, message: 'Wrong password' };
  state.session = { userId: hit.user.id, role: hit.role };
  commit('signin');
  return { ok: true, role: hit.role };
}

export function signOut() { state.session = null; commit('signout'); }

export function currentUser() {
  const s = state.session;
  if (!s) return null;
  const pool = s.role === 'admin' ? state.admins : s.role === 'instructor' ? state.instructors : state.clients;
  const user = pool.find(u => u.id === s.userId);
  if (!user) return null;
  if (s.role === 'instructor' && !user.active) return null;   // access ends the moment they are removed
  return { ...user, role: s.role };
}

export function registerClient({ name, email, phone, password }) {
  if (findAccount(email)) return { ok: false, message: 'That email already has an account' };
  const c = { id: uid('c-'), name, email, phone, password };
  state.clients.push(c);
  state.session = { userId: c.id, role: 'client' };
  commit('register');
  return { ok: true };
}

export function registerAdmin({ name, email, phone, password, code }, adminCode) {
  if (code !== adminCode) return { ok: false, field: 'code', message: 'That admin code is not valid' };
  if (findAccount(email)) return { ok: false, field: 'email', message: 'That email already has an account' };
  const a = { id: uid('a-'), name, email, phone, password };
  state.admins.push(a);
  state.session = { userId: a.id, role: 'admin' };
  commit('register-admin');
  return { ok: true };
}

/* ---------- instructors (admin only) ---------- */

export function addInstructor({ name, email, phone, password, qualifications, availability }) {
  if (findAccount(email)) return { ok: false, message: 'That email already has an account' };
  state.instructors.push({
    id: uid('i-'), name, email, phone, password: password || 'dua1234',
    qualifications: qualifications || [], availability: availability || {}, active: true
  });
  commit('instructor-add');
  return { ok: true };
}

/* Removing an instructor ends their access and leaves every future
   class of theirs visibly unassigned rather than quietly wrong. */
export function removeInstructor(id) {
  const i = state.instructors.find(x => x.id === id);
  if (!i) return { ok: false };
  i.active = false;
  const today = iso(new Date());
  const orphaned = state.sessions.filter(s => s.instructorId === id && s.date >= today && !s.cancelled);
  orphaned.forEach(s => {
    s.instructorId = null;
    bookingsFor(state, s.id).forEach(b => notify(b.clientId,
      'Your ' + s.date + ' ' + s.start + ' class needs a new instructor. Your place is safe.', 'warn'));
  });
  if (state.session && state.session.userId === id) state.session = null;
  commit('instructor-remove');
  return { ok: true, orphaned: orphaned.length };
}

export function updateInstructor(id, patch) {
  const i = state.instructors.find(x => x.id === id);
  if (!i) return { ok: false };
  Object.assign(i, patch);
  commit('instructor-update');
  return { ok: true };
}

/* ---------- classes (admin only) ---------- */

export function saveSession(data) {
  const existing = data.id ? sessionById(data.id) : null;
  if (existing) {
    const moved = existing.date !== data.date || existing.start !== data.start || existing.end !== data.end;
    const swapped = existing.instructorId !== data.instructorId;
    Object.assign(existing, data);
    if (moved) bookingsFor(state, existing.id).forEach(b =>
      notify(b.clientId, 'Your class moved to ' + existing.date + ', ' + existing.start + '–' + existing.end + '.', 'warn'));
    if (swapped) {
      const who = state.instructors.find(x => x.id === existing.instructorId);
      bookingsFor(state, existing.id).forEach(b =>
        notify(b.clientId, 'Your ' + existing.start + ' class will now be taught by ' + (who ? who.name : 'another instructor') + '.', 'info'));
    }
    commit('session-update');
    return { ok: true, id: existing.id };
  }
  const s = { ...data, id: uid('s-'), cancelled: false };
  state.sessions.push(s);
  commit('session-create');
  return { ok: true, id: s.id };
}

export function cancelSession(id) {
  const s = sessionById(id);
  if (!s) return { ok: false };
  s.cancelled = true;
  bookingsFor(state, id).concat(waitlistFor(state, id)).forEach(b => {
    b.status = 'released';          // released, not spent: the class is the studio's doing
    notify(b.clientId, 'The ' + s.start + ' class on ' + s.date + ' was cancelled. Your session has been returned.', 'warn');
  });
  commit('session-cancel');
  return { ok: true };
}

export function deleteSession(id) {
  const s = sessionById(id);
  if (!s) return { ok: false };
  cancelSession(id);
  state.sessions = state.sessions.filter(x => x.id !== id);
  commit('session-delete');
  return { ok: true };
}

export function assignInstructor(sessionId, instructorId) {
  const s = sessionById(sessionId);
  if (!s) return { ok: false };
  if (instructorId) {
    const i = state.instructors.find(x => x.id === instructorId);
    const fit = instructorFit(state, i, s);
    if (fit.status !== 'recommended') return { ok: false, message: i.name + ' — ' + fit.why.toLowerCase() };
  }
  return saveSession({ ...s, instructorId: instructorId || null });
}

/* ---------- booking (client) ---------- */

export function book(clientId, sessionId, now) {
  const s = sessionById(sessionId);
  const verdict = canBook(state, clientId, s, now || new Date());
  if (!verdict.ok) return verdict;
  state.bookings.push({ id: uid('b-'), clientId, sessionId, status: 'booked', at: new Date().toISOString() });
  commit('book');
  return { ok: true };
}

export function joinWaitlist(clientId, sessionId) {
  if (state.bookings.some(b => b.clientId === clientId && b.sessionId === sessionId &&
      (b.status === 'booked' || b.status === 'waitlist'))) return { ok: false, message: 'Already on this class' };
  state.bookings.push({ id: uid('b-'), clientId, sessionId, status: 'waitlist', at: new Date().toISOString() });
  commit('waitlist');
  return { ok: true };
}

/* A seat given up inside the window is returned to the client and
   offered to whoever is first in line. */
export function cancelBooking(bookingId, now) {
  const b = state.bookings.find(x => x.id === bookingId);
  if (!b) return { ok: false };
  const s = sessionById(b.sessionId);
  const verdict = canCancel(s, now || new Date());
  b.status = verdict.late ? 'late' : 'cancelled';

  if (!verdict.late) {
    const next = waitlistFor(state, s.id)[0];
    if (next) {
      next.status = 'booked';
      notify(next.clientId, 'A place opened in the ' + s.start + ' class on ' + s.date + ' — you are in.', 'good');
    }
  }
  commit('cancel');
  return { ok: true, late: verdict.late };
}

/* ---------- memberships ---------- */

export function purchaseMembership(clientId, planId, now) {
  const d = now || new Date();
  state.memberships.filter(m => m.clientId === clientId && m.status === 'active')
    .forEach(m => { m.status = 'replaced'; });
  state.memberships.push({
    id: uid('mem-'), clientId, planId,
    start: iso(d), end: iso(addDays(d, 30)), status: 'active'
  });
  commit('purchase');
  return { ok: true };
}

export function updateMembership(id, patch) {
  const m = state.memberships.find(x => x.id === id);
  if (!m) return { ok: false };
  Object.assign(m, patch);
  const client = state.clients.find(c => c.id === m.clientId);
  if (client) notify(client.id, 'Your membership was updated by the studio.', 'info');
  commit('membership-update');
  return { ok: true };
}

export function grantSessions(id, n) {
  const m = state.memberships.find(x => x.id === id);
  if (!m) return { ok: false };
  m.bonus = (m.bonus || 0) + n;
  commit('membership-bonus');
  return { ok: true };
}

export { PLANS, membershipOf, spots };
