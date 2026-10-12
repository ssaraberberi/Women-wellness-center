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

/* The catalogue is read again after signing in, not only before: whether a
   plan comes back with its price depends on who is asking, and at boot
   nobody is. */
async function catalogue() {
  const cat = await api.get('/bootstrap');
  setCatalogue(cat.classTypes);
  merge({ classTypes: cat.classTypes, plans: cat.plans });
}

/* The session ended under us. Drop everything that belonged to it and
   let the app draw the sign-in screen; nothing is lost that was not
   already gone. */
api.whenSignedOut(() => {
  if (!state.user) return;
  state = { ...state, user: null, classes: [], bookings: [], memberships: [],
            balances: [], membership: null, notices: [], clients: [], issues: [] };
  location.hash = '';
  emit();
  catalogue().catch(() => {});
});

export async function boot() {
  try {
    const me = await api.get('/me').catch(() => ({ user: null }));
    merge({ user: me.user || null });
    await catalogue();
    merge({ ready: true });
    if (state.user) await refresh();
  } catch (e) {
    merge({ ready: true, error: e.message });
  }
}

/* After "Cannot reach the studio": back to the loading screen, then boot. */
export function retry() {
  merge({ ready: false, error: null });
  return boot();
}

/* A phone puts the app to sleep in a pocket and wakes it an hour later.
   Coming back to the screen reads the studio again, so a class that filled
   or a membership linked at the desk in the meantime is already there. */
let lastRead = Date.now();
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !state.user || Date.now() - lastRead < 60000) return;
  refresh().catch(() => {});
});

export async function refresh() {
  lastRead = Date.now();
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
    const [s, reservations] = await Promise.all([api.get('/admin/state'), api.get('/admin/reservations').catch(() => [])]);
    merge({ ...s, reservations, notices });
  }
}

export async function signIn(email, password) {
  const r = await api.post('/auth/login', { email, password });
  merge({ user: r.user });
  await catalogue();
  await refresh();
  return r.user;
}

export async function register(data) {
  const r = await api.post('/auth/register', data);
  merge({ user: r.user });
  await catalogue();
  await refresh();
  return r.user;
}

/* ---------- the way back in ----------
   Asking for a link answers the same way whichever address it was, so
   there is nothing here to branch on; the screen says the same thing. */
export const forgotPassword = email => api.post('/auth/forgot', { email });

export async function resetWithToken(token, password) {
  const r = await api.post('/auth/reset', { token, password });
  merge({ user: r.user });
  await catalogue();
  await refresh();
  return r.user;
}

export async function verifyEmail(token) {
  const out = await api.post('/auth/verify', { token });
  /* If she was already signed in, the nudge should go now rather than at
     the next reload. */
  if (state.user) merge({ user: { ...state.user, emailVerified: true } });
  return out;
}

export const sendVerification = () => api.post('/auth/verify/send');

export async function signOut() {
  await api.post('/auth/logout');
  state = { ...state, user: null, classes: [], bookings: [], memberships: [], balances: [], membership: null, notices: [] };
  location.hash = '';
  emit();
  /* An administrator was shown the prices; whoever sits down next may not be. */
  await catalogue().catch(() => {});
}

/* ---------- writes ----------
   Each one goes to the server, which reaches the verdict again, and
   then we re-read. No optimistic updates: a booking that the server
   refuses must never look taken. */
const act = fn => async (...args) => { const out = await fn(...args); await refresh(); return out; };

export const book         = act(classId  => api.post('/client/book', { classId }));
export const cancelBooking= act(bookingId=> api.post('/client/cancel', { bookingId }));

export const setQualifications = act(types => api.put('/instructor/qualifications', { types }));
export const setAvailability   = act(availability => api.put('/instructor/availability', { availability }));

export const saveClass        = act(data => api.post('/admin/classes', data));
export const assignInstructor = act((classId, instructorId) => api.post('/admin/classes/' + classId + '/assign', { instructorId }));
export const cancelClass      = act(classId => api.post('/admin/classes/' + classId + '/cancel'));
export const addEmployee      = act(data => api.post('/admin/employees', data));
export const removeEmployee   = act(id => api.del('/admin/employees/' + id));
export const savePlan         = act(data => api.post('/admin/plans', data));
export const archivePlan      = act(id => api.del('/admin/plans/' + id));
export const setShowPrices    = act(on => api.put('/admin/settings', { showPrices: !!on }));
export const resetPassword    = act(id => api.post('/admin/users/' + id + '/password'));
/* Reservations, credits and the timetable. Each returns what the server
   now holds, and the store re-reads everything else behind it. */
export const createReservation = act(data => api.post('/admin/reservations', data));
export const reservation       = id => api.get('/admin/reservations/' + id);
export const updateReservation = act((id, patch) => api.put('/admin/reservations/' + id, patch));
export const newLink           = act(id => api.post('/admin/reservations/' + id + '/link'));
export const bookInto          = act(data => api.post('/admin/bookings', data));
export const moveBooking       = act((id, classId) => api.post('/admin/bookings/' + id + '/move', { classId }));
export const cancelFor         = act((id, credit) => api.post('/admin/bookings/' + id + '/cancel', { credit }));
export const restoreCredit     = act(id => api.post('/admin/bookings/' + id + '/restore'));
export const attendance        = act((id, value) => api.post('/admin/bookings/' + id + '/attendance', { attendance: value }));
export const adjustCredits     = act((membershipId, data) => api.post('/admin/memberships/' + membershipId + '/credits', data));
export const blockPlaces       = act((classId, blocked) => api.post('/admin/classes/' + classId + '/block', { blocked }));
export const saveOffer         = act(data => api.post('/admin/offers', data));
export const setOffer          = act((id, patch) => api.put('/admin/offers/' + id, patch));
export const saveRules         = act(data => api.put('/admin/rules', data));
export const previewTemplate   = data => api.post('/admin/schedule/template/preview', data);
export const saveTemplate      = act(data => api.post('/admin/schedule/template', data));
export const previewClosure    = data => api.post('/admin/schedule/closures/preview', data);
export const closeDay          = act(data => api.post('/admin/schedule/closures', data));
export const reopenDay         = act(date => api.del('/admin/schedule/closures/' + date));
export const updateMembership = act((id, patch) => api.put('/admin/memberships/' + id, patch));
export const markNoticesRead  = act(() => api.post('/notices/read'));

export const roster = classId => api.get('/admin/classes/' + classId + '/roster');
