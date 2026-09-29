/* ============================================================
   DUA — client-side state
   The server owns the truth; this holds the last copy of it and
   re-reads after every write, so what is on screen is what was
   actually recorded rather than what we hoped would be.
   ============================================================ */
import * as api from './api.js';
import { setCatalogue } from './ui.js';

let state = {
  user: null, ready: false,
  classTypes: [], plans: [], instructors: [], classes: [], bookings: [],
  memberships: [], clients: [], balances: [], membership: null, issues: [], notices: [], me: null
};
const subs = new Set();

export const get = () => state;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
const emit = () => subs.forEach(fn => fn(state));

function merge(patch) { state = { ...state, ...patch }; emit(); }

/* ---------- session ---------- */

export async function boot() {
  try {
    const [me, cat] = await Promise.all([api.get('/me').catch(() => ({ user: null })), api.get('/bootstrap')]);
    setCatalogue(cat.classTypes);
    merge({ user: me.user || null, classTypes: cat.classTypes, plans: cat.plans, ready: true });
    if (state.user) await refresh();
  } catch (e) {
    merge({ ready: true, error: e.message });
  }
}

export async function refresh() {
  const u = state.user;
  if (!u) return;
  const notices = await api.get('/notices').catch(() => []);
  if (u.role === 'client') {
    const s = await api.get('/client/state');
    merge({ ...s, notices });
  } else if (u.role === 'instructor') {
    const s = await api.get('/instructor/state');
    merge({ classes: s.classes, bookings: s.bookings, me: s.me, classTypes: s.classTypes, notices });
  } else {
    const s = await api.get('/admin/state');
    merge({ ...s, notices });
  }
}

export async function signIn(email, password) {
  const r = await api.post('/auth/login', { email, password });
  merge({ user: r.user });
  await refresh();
  return r.user;
}

export async function register(data) {
  const r = await api.post('/auth/register', data);
  merge({ user: r.user });
  await refresh();
  return r.user;
}

export async function signOut() {
  await api.post('/auth/logout');
  state = { ...state, user: null, classes: [], bookings: [], memberships: [], balances: [], membership: null, notices: [] };
  location.hash = '';
  emit();
}

/* ---------- writes ----------
   Each one goes to the server, which reaches the verdict again, and
   then we re-read. No optimistic updates: a booking that the server
   refuses must never look taken. */
const act = fn => async (...args) => { const out = await fn(...args); await refresh(); return out; };

export const book         = act(classId  => api.post('/client/book', { classId }));
export const joinWaitlist = act(classId  => api.post('/client/waitlist', { classId }));
export const cancelBooking= act(bookingId=> api.post('/client/cancel', { bookingId }));
export const purchase     = act(planId   => api.post('/client/membership', { planId }));

export const setQualifications = act(types => api.put('/instructor/qualifications', { types }));
export const setAvailability   = act(availability => api.put('/instructor/availability', { availability }));

export const saveClass        = act(data => api.post('/admin/classes', data));
export const assignInstructor = act((classId, instructorId) => api.post('/admin/classes/' + classId + '/assign', { instructorId }));
export const cancelClass      = act(classId => api.post('/admin/classes/' + classId + '/cancel'));
export const addInstructor    = act(data => api.post('/admin/instructors', data));
export const removeInstructor = act(id => api.del('/admin/instructors/' + id));
export const updateMembership = act((id, patch) => api.put('/admin/memberships/' + id, patch));
export const markNoticesRead  = act(() => api.post('/notices/read'));

export const roster = classId => api.get('/admin/classes/' + classId + '/roster');
