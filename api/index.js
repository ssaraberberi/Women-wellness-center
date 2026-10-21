/* ============================================================
   DUA — the API, as one Vercel Function
   ------------------------------------------------------------
   Everything under /api, plus /healthz, arrives here. Vercel serves the
   marketing site, the app and the shared rules as static files itself,
   so this file is only the routing table and the plumbing around it —
   every decision still lives in _lib/api.js and shared/rules.js.

   The library sits in _lib/ because Vercel turns each file in /api into
   a route, and a leading underscore is how you say "not a route".
   ============================================================ */
import { userForToken } from './_lib/auth.js';
import * as api from './_lib/api.js';
import * as booking from './_lib/booking.js';
import * as schedule from './_lib/schedule.js';
import { registerDevice, forgetDevice, flushPush } from './_lib/push.js';

/* The schedule endpoints are the studio's alone. */
const need = user => {
  if (!user) throw Object.assign(new Error('Sign in first'), { status: 401 });
  if (user.role !== 'admin') throw Object.assign(new Error('Not allowed'), { status: 403 });
};
import { pool, connectionProblem } from './_lib/db.js';
import { mailConfigured, mailFrom } from './_lib/mail.js';
import { VERSION as SCHEMA_VERSION } from './_lib/schema.js';

const PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

/* The few answers that are the same for everybody, and how long the CDN
   may keep them. Short, and served stale while a fresh one is fetched, so
   the booking page opens at once; places are still counted again by the
   server at the moment of booking, so a few seconds old does no harm. */
const SHARED = {
  '/api/public/book': 'public, s-maxage=60, stale-while-revalidate=600',
  '/api/public/classes': 'public, s-maxage=15, stale-while-revalidate=120',
  '/api/public/packages': 'public, s-maxage=60, stale-while-revalidate=600',
  '/api/public/timetable': 'public, s-maxage=300, stale-while-revalidate=3600',
  '/api/public/settings': 'public, s-maxage=60, stale-while-revalidate=600'
};

const send = (res, status, payload, cookie, shared) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('x-content-type-options', 'nosniff');
  /* Nothing else may be cached: every other answer is specific to one
     signed-in person, and Vercel's CDN would otherwise hand it to the next. */
  res.setHeader('cache-control', status === 200 && shared && !cookie ? shared : 'no-store');
  if (cookie) res.setHeader('set-cookie', cookie);
  res.end(JSON.stringify(payload));
};

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
const setCookie = (token, maxAge) =>
  'dua_session=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (PROD ? '; Secure' : '');
/* The phone app keeps its session in the device's secure storage rather
   than a cookie jar, so it is handed the token itself — but only when it
   says it is the app. A browser is never given it: in a page, the cookie
   being unreadable from script is the point. */
const isApp = req => req.headers['x-dua-client'] === 'mobile';
const signedIn = (ctx, r) => {
  ctx.cookie = setCookie(r.token, r.maxAge);
  return isApp(ctx.req) ? { user: r.user, token: r.token } : { user: r.user };
};
/* Authorization: Bearer — the app's way of presenting that token. */
function bearer(req) {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7).trim() || null : null;
}
const clearCookie = () => 'dua_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + (PROD ? '; Secure' : '');

/* Vercel parses a JSON body for us, but only when it is asked for, and the
   stream is still there when it is not. Take whichever one we are given. */
async function body(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
    }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1e6) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

/* ---------- routing ---------- */
const routes = [
  ['POST', /^\/api\/auth\/register$/, async (ctx) => {
    const r = await api.register(await body(ctx.req), meta(ctx.req));
    return signedIn(ctx, r);
  }],
  ['POST', /^\/api\/auth\/login$/, async (ctx) => {
    const r = await api.login(await body(ctx.req), meta(ctx.req));
    return signedIn(ctx, r);
  }],
  ['POST', /^\/api\/auth\/logout$/, async (ctx) => {
    await api.logout(ctx.token);
    ctx.cookie = clearCookie();
    return { ok: true };
  }],
  /* The three that answer without a session, because somebody locked out
     has no session to answer with. Each is rate limited inside _lib. */
  ['POST', /^\/api\/auth\/forgot$/, async ctx => api.forgotPassword(await body(ctx.req), meta(ctx.req))],
  ['POST', /^\/api\/auth\/reset$/,  async ctx => {
    const r = await api.resetWithToken(await body(ctx.req));
    return signedIn(ctx, r);
  }],
  ['POST', /^\/api\/auth\/verify$/, async ctx => api.verifyEmail(await body(ctx.req))],
  ['POST', /^\/api\/auth\/verify\/send$/, ctx => api.sendVerification(ctx.user, meta(ctx.req))],

  ['GET',  /^\/api\/me$/,          ctx => ({ user: ctx.user })],
  ['GET',  /^\/api\/bootstrap$/,   ctx => api.bootstrap(ctx.user)],
  /* No session needed: the marketing page asks this before anyone signs in. */
  ['GET',  /^\/api\/public\/settings$/, () => api.publicSettings()],
  /* The website's own packages section reads this. No session either: it
     is drawn for whoever walks in. */
  ['GET',  /^\/api\/public\/packages$/, () => api.publicPackages()],

  /* The booking page. No session: a customer reserves with her name and
     phone, and comes back with the private link she is given. The link
     travels in the body, never in a URL the server would log. */
  ['GET',  /^\/api\/public\/book$/,                 () => booking.publicCatalogue()],
  ['GET',  /^\/api\/public\/classes$/,              () => booking.publicClasses()],
  ['GET',  /^\/api\/public\/timetable$/,            () => booking.publicTimetable()],
  ['POST', /^\/api\/public\/reservations$/,         async ctx => booking.createReservation(await body(ctx.req), meta(ctx.req), null)],
  ['POST', /^\/api\/public\/reservation$/,          async ctx => booking.publicReservation(await body(ctx.req))],
  ['POST', /^\/api\/public\/reservation\/book$/,    async ctx => booking.publicBookMore(await body(ctx.req), meta(ctx.req))],
  ['POST', /^\/api\/public\/reservation\/cancel$/,  async ctx => booking.publicCancel(await body(ctx.req))],

  ['GET',  /^\/api\/notices$/,     ctx => api.notices(ctx.user)],
  ['POST', /^\/api\/notices\/read$/, ctx => api.readNotices(ctx.user)],

  ['GET',  /^\/api\/client\/state$/,      ctx => api.clientState(ctx.user)],
  ['POST', /^\/api\/client\/book$/,       async ctx => api.book(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/client\/cancel$/,     async ctx => api.cancelBooking(ctx.user, await body(ctx.req))],
  ['GET',  /^\/api\/client\/reservations$/, ctx => api.clientReservations(ctx.user)],
  ['POST', /^\/api\/client\/reservations$/, async ctx => api.clientReserve(ctx.user, await body(ctx.req), meta(ctx.req))],

  /* The phone app's push address, kept while she is signed in on it. */
  ['POST', /^\/api\/me\/devices$/,         async ctx => registerDevice(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/me\/devices\/forget$/, async ctx => forgetDevice(ctx.user, await body(ctx.req))],

  ['GET',  /^\/api\/instructor\/state$/,          ctx => api.instructorState(ctx.user)],
  ['GET',  /^\/api\/instructor\/classes\/([\w-]+)\/roster$/, ctx => api.instructorRoster(ctx.user, ctx.m[1])],
  ['POST', /^\/api\/instructor\/bookings\/([\w-]+)\/attendance$/, async ctx => api.instructorAttendance(ctx.user, ctx.m[1], await body(ctx.req))],
  ['PUT',  /^\/api\/instructor\/qualifications$/, async ctx => api.setQualifications(ctx.user, await body(ctx.req))],
  ['PUT',  /^\/api\/instructor\/availability$/,   async ctx => api.setAvailability(ctx.user, await body(ctx.req))],

  ['GET',  /^\/api\/admin\/state$/,              ctx => api.adminState(ctx.user)],
  ['GET',  /^\/api\/admin\/classes\/([\w-]+)\/roster$/, ctx => api.roster(ctx.user, ctx.m[1])],
  ['POST', /^\/api\/admin\/classes$/,            async ctx => api.saveClass(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/admin\/classes\/([\w-]+)\/assign$/, async ctx => api.assignInstructor(ctx.user, ctx.m[1], await body(ctx.req))],
  ['POST', /^\/api\/admin\/classes\/([\w-]+)\/cancel$/, ctx => api.cancelClass(ctx.user, ctx.m[1])],
  ['DELETE', /^\/api\/admin\/classes\/([\w-]+)$/,       ctx => api.deleteClass(ctx.user, ctx.m[1])],
  ['POST', /^\/api\/admin\/employees$/,                 async ctx => api.addEmployee(ctx.user, await body(ctx.req))],
  ['DELETE', /^\/api\/admin\/employees\/([\w-]+)$/,     ctx => api.removeEmployee(ctx.user, ctx.m[1])],
  ['PUT',  /^\/api\/admin\/memberships\/([\w-]+)$/,     async ctx => api.updateMembership(ctx.user, ctx.m[1], await body(ctx.req))],
  ['POST', /^\/api\/admin\/memberships\/([\w-]+)\/credits$/, async ctx => booking.adminCredits(ctx.user, ctx.m[1], await body(ctx.req))],
  ['PUT',  /^\/api\/admin\/settings$/,                 async ctx => api.setSettings(ctx.user, await body(ctx.req))],
  ['PUT',  /^\/api\/admin\/rules$/,                    async ctx => booking.saveSettings(ctx.user, await body(ctx.req))],

  ['GET',  /^\/api\/admin\/reservations$/,             ctx => booking.adminReservations(ctx.user)],
  ['POST', /^\/api\/admin\/reservations$/,             async ctx => booking.adminCreate(ctx.user, await body(ctx.req), meta(ctx.req))],
  ['GET',  /^\/api\/admin\/reservations\/([\w-]+)$/,   ctx => booking.adminReservation(ctx.user, ctx.m[1])],
  ['PUT',  /^\/api\/admin\/reservations\/([\w-]+)$/,   async ctx => booking.adminUpdateReservation(ctx.user, ctx.m[1], await body(ctx.req))],
  ['POST', /^\/api\/admin\/reservations\/([\w-]+)\/link$/, ctx => booking.adminNewLink(ctx.user, ctx.m[1])],
  ['POST', /^\/api\/admin\/bookings$/,                 async ctx => booking.adminBook(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/admin\/bookings\/([\w-]+)\/move$/,  async ctx => booking.adminMove(ctx.user, ctx.m[1], await body(ctx.req))],
  ['POST', /^\/api\/admin\/bookings\/([\w-]+)\/cancel$/, async ctx => booking.adminCancelBooking(ctx.user, ctx.m[1], await body(ctx.req))],
  ['POST', /^\/api\/admin\/bookings\/([\w-]+)\/restore$/, ctx => booking.adminRestore(ctx.user, ctx.m[1])],
  ['POST', /^\/api\/admin\/bookings\/([\w-]+)\/attendance$/, async ctx => booking.adminAttendance(ctx.user, ctx.m[1], await body(ctx.req))],
  ['POST', /^\/api\/admin\/classes\/([\w-]+)\/block$/,  async ctx => booking.adminBlock(ctx.user, ctx.m[1], await body(ctx.req))],

  ['POST', /^\/api\/admin\/offers$/,                   async ctx => booking.saveOffer(ctx.user, await body(ctx.req))],
  ['PUT',  /^\/api\/admin\/offers\/([\w-]+)$/,         async ctx => booking.setOffer(ctx.user, ctx.m[1], await body(ctx.req))],

  ['POST', /^\/api\/admin\/schedule\/template$/,       async ctx => { need(ctx.user); return schedule.saveTemplate(ctx.user, await body(ctx.req), { dryRun: false }); }],
  ['POST', /^\/api\/admin\/schedule\/template\/preview$/, async ctx => { need(ctx.user); return schedule.saveTemplate(ctx.user, await body(ctx.req), { dryRun: true }); }],
  ['POST', /^\/api\/admin\/schedule\/closures$/,       async ctx => { need(ctx.user); return schedule.closeDay(ctx.user, await body(ctx.req), { dryRun: false }); }],
  ['POST', /^\/api\/admin\/schedule\/closures\/preview$/, async ctx => { need(ctx.user); return schedule.closeDay(ctx.user, await body(ctx.req), { dryRun: true }); }],
  ['DELETE', /^\/api\/admin\/schedule\/closures\/([\d-]+)$/, ctx => { need(ctx.user); return schedule.reopenDay(ctx.user, ctx.m[1]); }],
  ['POST', /^\/api\/admin\/users\/([\w-]+)\/password$/, ctx => api.resetPassword(ctx.user, ctx.m[1])],
  ['POST', /^\/api\/admin\/plans$/,                    async ctx => api.savePlan(ctx.user, await body(ctx.req))],
  ['DELETE', /^\/api\/admin\/plans\/([\w-]+)$/,         ctx => api.archivePlan(ctx.user, ctx.m[1])]
];

/* Vercel sets x-forwarded-for and x-real-ip; the leftmost entry is the
   caller as the edge saw it. Spoofable in principle, which is why it is
   only one of the two limits the throttle applies. */
function callerIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req.headers['x-real-ip'] || '').trim() ||
         (req.socket && req.socket.remoteAddress) || null;
}

/* What the handlers need to know about the request itself: who is asking,
   and which language to write back in. The app sends the second as a
   header, so a letter arrives in the language she was reading. */
function meta(req) {
  const lang = String(req.headers['x-dua-lang'] || '').toLowerCase();
  return { ip: callerIp(req), lang: lang === 'en' ? 'en' : 'sq' };
}

/* A browser will not send a cross-site fetch with our cookie unless the
   cookie allows it, and SameSite=Lax says it does not. This is the belt to
   that pair of braces: a write whose Origin is not ours is refused before
   it reaches any handler. */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;                      // same-origin fetches may omit it
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

/* The rewrite in vercel.json hands us the path it matched, because a
   rewritten request no longer carries it in req.url. Locally there is no
   rewrite and req.url is the whole truth, so take that when it is there. */
function pathOf(req) {
  const url = new URL(req.url || '/', 'http://x');
  const given = url.searchParams.get('__path');
  return given && given.startsWith('/') ? given.split('?')[0] : url.pathname;
}

/* The three ways this goes wrong on a fresh deployment, each with the thing
   to do about it, because the Postgres message alone does not say. */
function hintFor(e) {
  const m = (e.message || '').toLowerCase();
  if (e.code === '42P01' || m.includes('does not exist') && m.includes('relation'))
    return 'The database is reachable but empty. The tables build themselves on the next request; the catalogue comes from scripts/data-single.sql.';
  if (m.includes('password') || m.includes('authentication'))
    return 'The connection string was rejected. Reconnect the Postgres integration to this project.';
  if (m.includes('timeout') || m.includes('enotfound') || m.includes('econnrefused'))
    return 'The database did not answer. Check it is awake, and that DATABASE_URL is the pooled endpoint.';
  return undefined;
}

export default async function handler(req, res) {
  const path = pathOf(req);

  /* The one endpoint that has to answer even when nothing else can, because
     it is the one you call to find out why. */
  if (path === '/healthz') {
    const problem = connectionProblem();
    if (problem) return send(res, 503, { ok: false, error: problem });
    try {
      /* raw, not pool.query: this is the endpoint you call to find out
         what is wrong, so it must answer even when applying the schema
         is the thing that is failing. */
      await pool.raw('select 1');
      const built = await pool.raw(
        `select to_regclass('public.users') is not null as schema,
                (select value from settings where key = 'schema_version') as version,
                (select value from settings where key = 'catalogue_version') as prepared,
                (select count(*) from plans where not archived) as plans,
                (select count(*) from class_types) as class_types`)
        .catch(() => ({ rows: [{ schema: false }] }));
      const row = built.rows[0];
      /* Whether the reset letters can actually go out, the address they go
         out as, and how the last attempt went. Nothing secret in any of
         the three, and the alternative is a studio believing links were
         sent for weeks: a refused send leaves no record at the provider,
         so without this there is nothing to look at at all. */
      row.mail = mailConfigured();
      row.from = mailFrom();
      row.mailLast = await pool.raw(`select value from settings where key = 'mail_last'`)
        .then(r => r.rows[0] ? JSON.parse(r.rows[0].value) : null, () => null);
      if (row.schema && row.version !== SCHEMA_VERSION)
        return send(res, 200, { ok: true, ...row, note: 'schema is ' + (row.version || 'older') +
          ', code wants ' + SCHEMA_VERSION + ' — the next request applies it' });
      return send(res, 200, { ok: true, ...row });
    } catch (e) {
      return send(res, 503, { ok: false, error: e.message, hint: hintFor(e) });
    }
  }

  if (req.method !== 'GET' && !sameOrigin(req))
    return send(res, 403, { error: 'Request came from somewhere else' });

  /* The public reads answer the same to everybody, so they skip the
     session lookup: one database round trip fewer on the pages a
     customer opens first. */
  const shared = req.method === 'GET' ? SHARED[path] : undefined;
  const token = shared ? null : readCookie(req, 'dua_session') || bearer(req);
  const user = shared ? null : await userForToken(token).catch(() => null);

  let wrongMethod = false;
  for (const [method, re, handle] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    /* One path may answer more than one method, so keep looking. */
    if (req.method !== method) { wrongMethod = true; continue; }
    const ctx = { req, res, user, token, m, cookie: null };
    try {
      const out = await handle(ctx);
      /* A write may have left notices behind; they go to the phones now,
         after the transaction that wrote them, and never at its expense. */
      if (req.method !== 'GET')
        await Promise.race([flushPush(), new Promise(r => setTimeout(r, 1500))])
          .catch(e => console.error('push not sent: ' + e.message));
      return send(res, 200, out == null ? { ok: true } : out, ctx.cookie, shared);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(req.method, path, e);
      return send(res, status, { error: e.message || 'Something went wrong', code: e.code });
    }
  }
  if (wrongMethod) return send(res, 405, { error: 'Method not allowed' });
  return send(res, 404, { error: 'No such endpoint' });
}
