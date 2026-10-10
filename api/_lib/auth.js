/* Passwords and sign-in tokens.
   scrypt from node:crypto — no native build step, which keeps the
   Railway deploy to `npm install` and nothing else. */
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { q, one } from './db.js';

const scrypt = promisify(_scrypt);
const N = 16384, KEYLEN = 64;

export async function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(plain, salt, KEYLEN, { N });
  return 'scrypt$' + N + '$' + salt + '$' + key.toString('hex');
}

export async function verifyPassword(plain, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, n, salt, hex] = stored.split('$');
  const key = await scrypt(plain, salt, KEYLEN, { N: Number(n) });
  const want = Buffer.from(hex, 'hex');
  return key.length === want.length && timingSafeEqual(key, want);
}

/* An address with no account used to come back instantly while a real one
   took the time scrypt takes, which told anyone watching the clock which
   addresses exist. Burning the same work on a throwaway hash removes the
   difference. */
const NOBODY = 'scrypt$' + N + '$' + '0'.repeat(32) + '$' + '0'.repeat(KEYLEN * 2);
export const burnPasswordTime = plain => verifyPassword(plain, NOBODY).catch(() => false);

/* ---------- too many wrong guesses ----------
   Counted per address and per caller, over a rolling window. Both are
   needed: one address under attack from everywhere, and one caller
   working through a list of addresses, are the same attack from two
   sides. The answer never says which limit was hit. */
const WINDOW_MIN = 15, MAX_PER_EMAIL = 8, MAX_PER_IP = 20;

/* The throttle protects sign-in; it must never be the reason sign-in
   stops working. It once was — a deploy landed before its table and
   every attempt, right password included, answered 500. So all three go
   through this: the counting is best effort, and if it cannot be done
   it is logged and the attempt proceeds. Anyone who can break the table
   is already inside the database. */
async function best(what, fn, fallback) {
  try { return await fn(); }
  catch (e) { console.error('sign-in throttle (' + what + ') unavailable: ' + e.message); return fallback; }
}

export const signinBlocked = (email, ip) => best('read', async () => {
  await q(`delete from signin_failures where at < now() - ($1 || ' minutes')::interval`, [WINDOW_MIN * 4]);
  const row = await one(
    `select
       count(*) filter (where lower(email) = lower($1))::int as by_email,
       count(*) filter (where ip is not distinct from $2)::int as by_ip
     from signin_failures
     where at > now() - ($3 || ' minutes')::interval`, [email || '', ip || null, WINDOW_MIN]);
  return !!row && (row.by_email >= MAX_PER_EMAIL || row.by_ip >= MAX_PER_IP);
}, false);

export const recordSigninFailure = (email, ip) => best('write', () =>
  q('insert into signin_failures (email, ip) values ($1,$2)', [email || '', ip || null]), null);

export const clearSigninFailures = email => best('clear', () =>
  q('delete from signin_failures where lower(email) = lower($1)', [email || '']), null);

/* Tokens are random and opaque; only their hash is stored, so a copy of
   the table is not a copy of everyone's session. */
const TOKEN_DAYS = 30;
const digest = t => createHash('sha256').update(t).digest('hex');

export async function issueToken(userId) {
  const token = randomBytes(32).toString('base64url');
  await q(`insert into auth_tokens (token_hash, user_id, expires_at)
           values ($1, $2, now() + ($3 || ' days')::interval)`, [digest(token), userId, TOKEN_DAYS]);
  return { token, maxAge: TOKEN_DAYS * 86400 };
}

export async function userForToken(token) {
  if (!token) return null;
  const row = await one(
    `select u.id, u.role, u.name, u.email, u.phone, u.active,
            u.email_verified as "emailVerified"
       from auth_tokens t join users u on u.id = t.user_id
      where t.token_hash = $1 and t.expires_at > now()`, [digest(token)]);
  if (!row || !row.active) return null;
  return row;
}

export const revokeToken = token => token ? q('delete from auth_tokens where token_hash = $1', [digest(token)]) : null;
export const revokeAllFor = userId => q('delete from auth_tokens where user_id = $1', [userId]);
export const sweepTokens = () => q('delete from auth_tokens where expires_at < now()');

/* ---------- one-time links ----------
   A password reset and an email confirmation are the same mechanism with
   two lifetimes. The link carries a random token; the table keeps only its
   digest, so whoever reads the table cannot sign in with it. Claiming is
   one UPDATE: the row is marked used in the same statement that checks it
   was not, so the same link in two tabs opens once. */
const CODE_HOURS = { reset: 1, verify: 24 };

export async function issueCode(userId, kind) {
  const token = randomBytes(32).toString('base64url');
  /* Asking again replaces the link rather than adding a second one: the
     newest letter is the one she will open, and the older link should
     stop working the moment it stops being the one we mean. */
  await q('delete from auth_codes where user_id = $1 and kind = $2 and used_at is null', [userId, kind]);
  await q(`insert into auth_codes (token_hash, user_id, kind, expires_at)
           values ($1, $2, $3, now() + ($4 || ' hours')::interval)`,
          [digest(token), userId, kind, CODE_HOURS[kind] || 1]);
  return token;
}

export async function claimCode(token, kind) {
  if (!token) return null;
  const row = await one(
    `update auth_codes set used_at = now()
      where token_hash = $1 and kind = $2 and used_at is null and expires_at > now()
      returning user_id`, [digest(token), kind]);
  return row ? row.user_id : null;
}

export const sweepCodes = () => q('delete from auth_codes where expires_at < now() - interval \'7 days\'');

/* ---------- how often a link may be asked for ----------
   An inbox is somebody else's property: a form that mails on demand must
   not be usable to flood one, or to find out at speed which addresses have
   accounts. Counted per address and per caller, like wrong passwords.

   Fail-open, for the same reason sign-in is: a reset link is the way back
   in, and a counting table that cannot be read must not be what locks
   somebody out of her own studio. Resend's own daily cap is the backstop
   if that ever happens. */
const CODE_WINDOW_MIN = 60, MAX_CODES_PER_EMAIL = 4, MAX_CODES_PER_IP = 15;

export const codeRequestBlocked = (email, ip) => best('link read', async () => {
  await q(`delete from auth_code_requests where at < now() - ($1 || ' minutes')::interval`, [CODE_WINDOW_MIN * 4]);
  const row = await one(
    `select
       count(*) filter (where lower(email) = lower($1))::int as by_email,
       count(*) filter (where ip is not distinct from $2)::int as by_ip
     from auth_code_requests
     where at > now() - ($3 || ' minutes')::interval`, [email || '', ip || null, CODE_WINDOW_MIN]);
  return !!row && (row.by_email >= MAX_CODES_PER_EMAIL || row.by_ip >= MAX_CODES_PER_IP);
}, false);

export const recordCodeRequest = (email, ip) => best('link write', () =>
  q('insert into auth_code_requests (email, ip) values ($1,$2)', [email || '', ip || null]), null);

export async function adminCode() {
  const row = await one(`select value from settings where key = 'admin_registration_code'`);
  return row ? row.value : null;
}
