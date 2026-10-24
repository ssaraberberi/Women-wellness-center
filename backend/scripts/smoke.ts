// End-to-end smoke test against a running API: `npx tsx scripts/smoke.ts [baseUrl]`.
// Signs in as each dev account (needs APP_ENV=development and DEV_LOGIN_CODE) and
// walks the main journeys. Exits non-zero on the first failure.
const base = process.argv[2] ?? 'http://localhost:4000';
const code = process.env.DEV_LOGIN_CODE ?? '000000';

async function call(method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as any;
  return { status: res.status, json };
}

function check(cond: unknown, what: string, extra?: unknown) {
  if (!cond) {
    console.error('FAIL', what, extra ?? '');
    process.exit(1);
  }
  console.log('ok  ', what);
}

async function signIn(email: string) {
  const r1 = await call('POST', '/auth/otp/request', undefined, { email });
  check(r1.status === 200, `otp request ${email}`, r1.json);
  const r2 = await call('POST', '/auth/otp/verify', undefined, { email, code });
  check(r2.status === 200 && r2.json.status === 'signed_in', `otp verify ${email}`, r2.json);
  return r2.json as { accessToken: string; refreshToken: string };
}

const today = new Date().toISOString().slice(0, 10);
const in14 = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

check((await call('GET', '/health')).json?.ok, 'health');

// Client
const sara = await signIn('sara@dua.dev');
const me = await call('GET', '/me', sara.accessToken);
check(me.json.role === 'CLIENT', 'client role');
const home = await call('GET', '/me/home', sara.accessToken);
check(home.status === 200 && home.json.membership, 'home with membership', home.json);
const sessions = await call('GET', `/sessions?from=${today}&to=${in14}`, sara.accessToken);
check(sessions.status === 200 && sessions.json.length > 10, 'sessions list');
const target = sessions.json.find((s: any) => s.available > 0 && !s.myBookingId && new Date(s.startsAt) > new Date(Date.now() + 86_400_000));
const key = `smoke-${Date.now()}`;
const b1 = await call('POST', `/sessions/${target.id}/book`, sara.accessToken, undefined, { 'Idempotency-Key': key });
check(b1.status === 200 && b1.json.status === 'BOOKED', 'book class', b1.json);
const b2 = await call('POST', `/sessions/${target.id}/book`, sara.accessToken, undefined, { 'Idempotency-Key': key });
check(b2.status === 200 && b2.json.id === b1.json.id, 'retried booking returns the same booking');
const b3 = await call('POST', `/sessions/${target.id}/book`, sara.accessToken);
check(b3.status === 409 && b3.json.error.code === 'ALREADY_BOOKED', 'double booking refused');
const c1 = await call('POST', `/bookings/${b1.json.id}/cancel`, sara.accessToken);
check(c1.status === 200 && c1.json.refunded, 'cancel in time refunds', c1.json);
const full = sessions.json.find((s: any) => s.available === 0 && !s.myBookingId);
if (full) {
  const w = await call('POST', `/sessions/${full.id}/waitlist`, sara.accessToken);
  check(w.status === 200 && w.json.position >= 1, 'join waitlist', w.json);
}
const mem = await call('GET', '/me/memberships', sara.accessToken);
check(mem.status === 200 && mem.json.summary.remainingCredits > 0, 'memberships');
const treatments = await call('GET', '/spa/treatments', sara.accessToken);
check(treatments.json.length >= 5, 'spa treatments');
let booked = false;
for (let d = 1; d < 8 && !booked; d++) {
  const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
  const av = await call('GET', `/spa/availability?treatmentId=${treatments.json[0].id}&date=${date}`, sara.accessToken);
  if (av.json?.length) {
    const ap = await call('POST', '/spa/appointments', sara.accessToken, { treatmentId: treatments.json[0].id, startsAt: av.json[0].startsAt });
    check(ap.status === 200, 'spa booking', ap.json);
    const again = await call('POST', '/spa/appointments', sara.accessToken, { treatmentId: treatments.json[0].id, startsAt: av.json[0].startsAt });
    check(again.status === 409, 'same SPA slot refused for the only therapist', again.json);
    booked = true;
  }
}
check(booked, 'found a SPA slot');
check((await call('GET', '/admin/dashboard', sara.accessToken)).status === 403, 'client cannot reach admin');

// Refresh rotation
const r1 = await call('POST', '/auth/refresh', undefined, { refreshToken: sara.refreshToken });
check(r1.status === 200, 'refresh');
const r2 = await call('POST', '/auth/refresh', undefined, { refreshToken: sara.refreshToken });
check(r2.status === 401, 'reused refresh token is refused');
const r3 = await call('POST', '/auth/refresh', undefined, { refreshToken: r1.json.refreshToken });
check(r3.status === 401, 'reuse revoked the whole family');

// Admin
const owner = await signIn('owner@dua.dev');
const dash = await call('GET', '/admin/dashboard?period=week', owner.accessToken);
check(dash.status === 200 && typeof dash.json.metrics.bookings === 'number', 'admin dashboard', dash.json);
const orders = await call('GET', '/admin/orders?status=PENDING', owner.accessToken);
check(orders.json.length >= 1, 'pending orders');
const pay = await call('POST', `/admin/orders/${orders.json[0].id}/payments`, owner.accessToken, { method: 'CASH' });
check(pay.status === 200, 'record payment', pay.json);
const an = await call('GET', `/admin/analytics?from=${today}&to=${in14}`, owner.accessToken);
check(an.status === 200 && an.json.occupancy, 'analytics');
const clients = await call('GET', '/admin/clients?q=sara', owner.accessToken);
check(clients.json.length === 1, 'client search');
const detail = await call('GET', `/admin/clients/${clients.json[0].id}`, owner.accessToken);
check(detail.status === 200 && detail.json.purchases.length >= 1, 'client detail');

// Staff
const ines = await signIn('ines@dua.dev');
const today2 = await call('GET', '/staff/today', ines.accessToken);
check(today2.status === 200, 'staff today', today2.json);
const sched = await call('GET', `/staff/schedule?from=${today}&to=${in14}`, ines.accessToken);
check(sched.json.sessions.length > 0, 'staff schedule');
const part = await call('GET', `/staff/sessions/${sched.json.sessions[0].id}`, ines.accessToken);
check(part.status === 200 && Array.isArray(part.json.participants), 'participants');
check((await call('GET', '/admin/clients', ines.accessToken)).status === 403, 'staff cannot reach admin');

console.log('\nAll smoke checks passed.');
