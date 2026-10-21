#!/usr/bin/env node
/* ============================================================
   The phone app's side of the API, over HTTP, against the demo studio.

     DATABASE_URL=postgres://…/dua_test npm run reset
     DATABASE_URL=postgres://…/dua_test npm run test:mobile

   It starts the same handler `npm start` serves on a free port and talks
   to it the way the app does: no cookie jar, a Bearer token, and the
   x-dua-client header. It also checks the website's way in has not moved:
   a browser signing in still gets a cookie and never the token.
   ============================================================ */
import { createServer } from 'node:http';
import handler from '../../api/index.js';
import { pool, one, q } from '../../api/_lib/db.js';

const url = process.env.DATABASE_URL || '';
if (!/test/i.test(url.split('/').pop() || '')) {
  console.error('Refusing to run: the database name must contain "test".');
  process.exit(1);
}
process.env.PUSH_DISABLED = '1';
const PASSWORD = process.env.SEED_PASSWORD || 'demo1234';

let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra).slice(0, 300) : '')); }
};
const section = s => console.log('\n' + s);

const server = createServer((req, res) => handler(req, res));
await new Promise(r => server.listen(0, r));
const base = 'http://127.0.0.1:' + server.address().port;

async function call(method, path, { token, body, app = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (app) headers['x-dua-client'] = 'mobile';
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, cookie: res.headers.get('set-cookie'), json: await res.json().catch(() => null) };
}
const signIn = async email => (await call('POST', '/api/auth/login', { body: { email, password: PASSWORD } })).json;

try {
  section('Signing in from the app');
  const web = await call('POST', '/api/auth/login', { app: false, body: { email: 'admin@dua-pilates.com', password: PASSWORD } });
  ok(web.status === 200 && /dua_session=/.test(web.cookie || ''), 'a browser still gets the cookie');
  ok(web.json && !web.json.token, 'and never the token in the body');

  const admin = await signIn('admin@dua-pilates.com');
  ok(admin && typeof admin.token === 'string' && admin.token.length > 20, 'the app is handed a token');
  const me = await call('GET', '/api/me', { token: admin.token });
  ok(me.json && me.json.user && me.json.user.role === 'admin', 'Bearer signs the app in');
  const none = await call('GET', '/api/admin/state', {});
  ok(none.status === 401, 'without it, nothing');
  const state = await call('GET', '/api/admin/state', { token: admin.token });
  ok(state.status === 200 && Array.isArray(state.json.classes), 'the admin state reads over Bearer');

  section('The instructor');
  const elira = await signIn('elira@dua-pilates.com');
  const ist = await call('GET', '/api/instructor/state', { token: elira.token });
  ok(ist.status === 200, 'her own state');
  const mine = ist.json.classes.find(c => ist.json.bookings.some(b => b.classId === c.id && b.status === 'booked'));
  ok(!!mine, 'she leads a class with somebody booked');
  if (mine) {
    const roster = await call('GET', '/api/instructor/classes/' + mine.id + '/roster', { token: elira.token });
    ok(roster.status === 200 && roster.json.length > 0 && roster.json[0].name, 'she reads its roster');
    const b = roster.json[0];
    const mark = await call('POST', '/api/instructor/bookings/' + b.id + '/attendance', { token: elira.token, body: { attendance: 'attended' } });
    ok(mark.status === 200, 'and marks attendance');
    const row = await one('select attendance from bookings where id = $1', [b.id]);
    ok(row.attendance === 'attended', 'which is written');
    await call('POST', '/api/instructor/bookings/' + b.id + '/attendance', { token: elira.token, body: { attendance: null } });
  }
  const other = ist.json.classes.length
    ? await one('select id from classes where instructor_id is distinct from $1 limit 1', [ist.json.me.id]) : null;
  if (other) {
    const peek = await call('GET', '/api/instructor/classes/' + other.id + '/roster', { token: elira.token });
    ok(peek.status === 403, 'another instructor\'s roster is refused');
  }
  const asClient = await call('GET', '/api/instructor/state', { token: (await signIn('sara@example.com')).token });
  ok(asClient.status === 403, 'a client cannot read it');

  section('The client');
  const email = 'mobile' + Date.now() + '@example.com';
  const reg = await call('POST', '/api/auth/register', { body: { name: 'Mobile Tester', email, phone: '069 3' + String(Date.now()).slice(-6), password: 'longenough1' } });
  ok(reg.status === 200 && reg.json.token && reg.json.user.role === 'client', 'registers and is signed in');
  const cat = await call('GET', '/api/public/book');
  const plan = cat.json.plans.find(p => p.kind !== 'single') || cat.json.plans[0];
  ok(!!plan, 'the catalogue has a package to choose');
  const cs0 = await call('GET', '/api/client/state', { token: reg.json.token });
  const klass = cs0.json.classes.find(k => !k.cancelled && k.typeId === (plan.lines[0].types[0]) &&
    new Date(k.date + 'T' + k.start) > new Date(Date.now() + 86400000));
  const made = await call('POST', '/api/client/reservations', { token: reg.json.token,
    body: { planId: plan.id, classIds: klass ? [klass.id] : [] } });
  ok(made.status === 200 && /^DUA-/.test(made.json.ref), 'reserves a package as herself', made.json);
  const res = await one('select r.source, m.client_id from reservations r join memberships m on m.reservation_id = r.id where r.ref = $1', [made.json.ref]);
  ok(res && res.source === 'app' && res.client_id === reg.json.user.id, 'on her own account, marked as from the app');
  const cs = await call('GET', '/api/client/state', { token: reg.json.token });
  ok(cs.json.memberships.length === 1, 'the package is hers');
  const list = await call('GET', '/api/client/reservations', { token: reg.json.token });
  ok(list.status === 200 && list.json.length === 1 && list.json[0].ref === made.json.ref, 'and listed under her reservations');
  if (klass) {
    const bk = cs.json.bookings.find(b => b.classId === klass.id && b.clientId === reg.json.user.id && b.status === 'booked');
    ok(!!bk, 'the class she picked is booked');
    const cancel = await call('POST', '/api/client/cancel', { token: reg.json.token, body: { bookingId: bk && bk.id } });
    ok(cancel.status === 200, 'and she can cancel it in time');
  }

  section('Push');
  const bad = await call('POST', '/api/me/devices', { token: reg.json.token, body: { token: 'nope' } });
  ok(bad.status === 400, 'a token that is not Expo\'s is refused');
  const dev = 'ExponentPushToken[test-' + Date.now() + ']';
  const add = await call('POST', '/api/me/devices', { token: reg.json.token, body: { token: dev, platform: 'ios', lang: 'en' } });
  ok(add.status === 200 && !!(await one('select 1 as x from push_devices where token = $1', [dev])), 'a phone is registered');
  const forget = await call('POST', '/api/me/devices/forget', { token: reg.json.token, body: { token: dev } });
  ok(forget.status === 200 && !(await one('select 1 as x from push_devices where token = $1', [dev])), 'and forgotten on sign-out');
  const out = await call('POST', '/api/auth/logout', { token: reg.json.token });
  const after = await call('GET', '/api/me', { token: reg.json.token });
  ok(out.status === 200 && after.json.user === null, 'signing out ends the token');
  await q('delete from users where email = $1', [email]).catch(() => {});
} catch (e) {
  fail++;
  console.error(e);
} finally {
  server.close();
  await pool.end().catch(() => {});
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
