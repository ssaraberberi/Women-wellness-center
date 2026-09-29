/* ============================================================
   DUA — HTTP server
   Serves the API and the app from one origin, so there is no CORS
   and the sign-in cookie is simply first-party.
   ============================================================ */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { userForToken, sweepTokens } from './auth.js';
import * as api from './api.js';
import { pool } from './db.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.PORT || 3000);
const PROD = process.env.NODE_ENV === 'production';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const send = (res, status, body, headers) => {
  res.writeHead(status, Object.assign({
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff'
  }, headers || {}));
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
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

async function body(req) {
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

/* ---------- static ----------
   This service is the platform, not the public site: it serves the app,
   the shared rules it imports, and the brand assets they reference, and
   nothing else. dua-pilates.com is a separate deployment. */
const SERVE = ['/app/', '/shared/', '/assets/'];

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '/app')
    return send(res, 302, '', { location: '/app/', 'content-type': 'text/plain' });
  if (rel === '/app/') rel = '/app/index.html';
  if (!SERVE.some(p => rel.startsWith(p))) return send(res, 404, { error: 'Not found' });
  const full = normalize(join(ROOT, rel));
  if (!full.startsWith(ROOT)) return send(res, 403, { error: 'Nope' });   // no climbing out of the tree
  try {
    const info = await stat(full);
    if (info.isDirectory()) return serveStatic(req, res, rel.replace(/\/?$/, '/index.html'));
    const buf = await readFile(full);
    const type = MIME[extname(full).toLowerCase()] || 'application/octet-stream';
    const cache = /\.(woff2|png|jpg|svg)$/.test(full) ? 'public, max-age=86400' : 'no-cache';
    return send(res, 200, buf, { 'content-type': type, 'cache-control': cache });
  } catch {
    return send(res, 404, { error: 'Not found' });
  }
}

/* ---------- routing ---------- */
const routes = [
  ['POST', /^\/api\/auth\/register$/, async (ctx) => {
    const r = await api.register(await body(ctx.req));
    ctx.cookie = setCookie(r.token, r.maxAge);
    return { user: r.user };
  }],
  ['POST', /^\/api\/auth\/login$/, async (ctx) => {
    const r = await api.login(await body(ctx.req));
    ctx.cookie = setCookie(r.token, r.maxAge);
    return { user: r.user };
  }],
  ['POST', /^\/api\/auth\/logout$/, async (ctx) => {
    await api.logout(ctx.token);
    ctx.cookie = clearCookie();
    return { ok: true };
  }],
  ['GET',  /^\/api\/me$/,          ctx => ({ user: ctx.user })],
  ['GET',  /^\/api\/bootstrap$/,   () => api.bootstrap()],
  ['GET',  /^\/api\/notices$/,     ctx => api.notices(ctx.user)],
  ['POST', /^\/api\/notices\/read$/, ctx => api.readNotices(ctx.user)],

  ['GET',  /^\/api\/client\/state$/,      ctx => api.clientState(ctx.user)],
  ['POST', /^\/api\/client\/book$/,       async ctx => api.book(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/client\/waitlist$/,   async ctx => api.joinWaitlist(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/client\/cancel$/,     async ctx => api.cancelBooking(ctx.user, await body(ctx.req))],
  ['POST', /^\/api\/client\/membership$/, async ctx => api.purchaseMembership(ctx.user, await body(ctx.req))],

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
  ['PUT',  /^\/api\/admin\/memberships\/([\w-]+)$/,     async ctx => api.updateMembership(ctx.user, ctx.m[1], await body(ctx.req))]
];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;

  if (path === '/healthz') {
    try { await pool.query('select 1'); return send(res, 200, { ok: true }); }
    catch (e) { return send(res, 503, { ok: false, error: e.message }); }
  }
  if (!path.startsWith('/api/')) return serveStatic(req, res, path);

  const token = readCookie(req, 'dua_session');
  const user = await userForToken(token).catch(() => null);

  for (const [method, re, handler] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    if (req.method !== method) return send(res, 405, { error: 'Method not allowed' });
    const ctx = { req, res, user, token, m, cookie: null };
    try {
      const out = await handler(ctx);
      return send(res, 200, out == null ? { ok: true } : out, ctx.cookie ? { 'set-cookie': ctx.cookie } : undefined);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(req.method, path, e);
      return send(res, status, { error: e.message || 'Something went wrong', code: e.code });
    }
  }
  return send(res, 404, { error: 'No such endpoint' });
});

server.listen(PORT, () => console.log('DUA platform on :' + PORT));

setInterval(() => sweepTokens().catch(() => {}), 6 * 3600 * 1000).unref();

for (const sig of ['SIGTERM', 'SIGINT'])
  process.on(sig, () => server.close(() => pool.end().then(() => process.exit(0))));
