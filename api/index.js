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
import { pool, connectionProblem } from './_lib/db.js';
import { VERSION as SCHEMA_VERSION } from './_lib/schema.js';

const PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

const send = (res, status, payload, cookie) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('x-content-type-options', 'nosniff');
  /* Nothing here may be cached: every answer is specific to one signed-in
     person, and Vercel's CDN would otherwise hand it to the next one. */
  res.setHeader('cache-control', 'no-store');
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
    const r = await api.register(await body(ctx.req));
    ctx.cookie = setCookie(r.token, r.maxAge);
    return { user: r.user };
  }],
  ['POST', /^\/api\/auth\/login$/, async (ctx) => {
    const r = await api.login(await body(ctx.req), { ip: callerIp(ctx.req) });
    ctx.cookie = setCookie(r.token, r.maxAge);
    return { user: r.user };
  }],
  ['POST', /^\/api\/auth\/logout$/, async (ctx) => {
    await api.logout(ctx.token);
    ctx.cookie = clearCookie();
    return { ok: true };
  }],
  ['GET',  /^\/api\/me$/,          ctx => ({ user: ctx.user })],
  ['GET',  /^\/api\/bootstrap$/,   ctx => api.bootstrap(ctx.user)],
  /* No session needed: the marketing page asks this before anyone signs in. */
  ['GET',  /^\/api\/public\/settings$/, () => api.publicSettings()],
  ['GET',  /^\/api\/notices$/,     ctx => api.notices(ctx.user)],
  ['POST', /^\/api\/notices\/read$/, ctx => api.readNotices(ctx.user)],

  ['GET',  /^\/api\/client\/state$/,      ctx => api.clientState(ctx.user)],
  ['POST', /^\/api\/client\/book$/,       async ctx => api.book(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/client\/waitlist$/,   async ctx => api.joinWaitlist(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/client\/cancel$/,     async ctx => api.cancelBooking(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/client\/membership$/, async ctx => api.requestMembership(ctx.user, await body(ctx.req))],

  ['GET',  /^\/api\/instructor\/state$/,          ctx => api.instructorState(ctx.user)],
  ['PUT',  /^\/api\/instructor\/qualifications$/, async ctx => api.setQualifications(ctx.user, await body(ctx.req))],
  ['PUT',  /^\/api\/instructor\/availability$/,   async ctx => api.setAvailability(ctx.user, await body(ctx.req))],

  ['GET',  /^\/api\/admin\/state$/,              ctx => api.adminState(ctx.user)],
  ['GET',  /^\/api\/admin\/classes\/([\w-]+)\/roster$/, ctx => api.roster(ctx.user, ctx.m[1])],
  ['POST', /^\/api\/admin\/classes$/,            async ctx => api.saveClass(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/admin\/classes\/([\w-]+)\/assign$/, async ctx => api.assignInstructor(ctx.user, ctx.m[1], await body(ctx.req))],
  ['POST', /^\/api\/admin\/classes\/([\w-]+)\/cancel$/, ctx => api.cancelClass(ctx.user, ctx.m[1])],
  ['DELETE', /^\/api\/admin\/classes\/([\w-]+)$/,       ctx => api.deleteClass(ctx.user, ctx.m[1])],
  ['POST', /^\/api\/admin\/instructors$/,               async ctx => api.addInstructor(ctx.user, await body(ctx.req))],
  ['DELETE', /^\/api\/admin\/instructors\/([\w-]+)$/,   ctx => api.removeInstructor(ctx.user, ctx.m[1])],
  ['PUT',  /^\/api\/admin\/memberships\/([\w-]+)$/,     async ctx => api.updateMembership(ctx.user, ctx.m[1], await body(ctx.req))],
  ['POST', /^\/api\/admin\/memberships\/([\w-]+)\/confirm$/, ctx => api.confirmMembership(ctx.user, ctx.m[1])],
  ['POST', /^\/api\/admin\/memberships\/([\w-]+)\/decline$/, ctx => api.declineMembership(ctx.user, ctx.m[1])],
  ['PUT',  /^\/api\/admin\/settings$/,                 async ctx => api.setSettings(ctx.user, await body(ctx.req))],
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
    return 'The database is reachable but empty. Run scripts/schema.sql and then scripts/data.sql.';
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
                (select count(*) from class_types) as class_types`)
        .catch(() => ({ rows: [{ schema: false }] }));
      const row = built.rows[0];
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

  const token = readCookie(req, 'dua_session');
  const user = await userForToken(token).catch(() => null);

  for (const [method, re, handle] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    if (req.method !== method) return send(res, 405, { error: 'Method not allowed' });
    const ctx = { req, res, user, token, m, cookie: null };
    try {
      const out = await handle(ctx);
      return send(res, 200, out == null ? { ok: true } : out, ctx.cookie);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(req.method, path, e);
      return send(res, status, { error: e.message || 'Something went wrong', code: e.code });
    }
  }
  return send(res, 404, { error: 'No such endpoint' });
}
