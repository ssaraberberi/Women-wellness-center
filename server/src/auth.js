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
    `select u.id, u.role, u.name, u.email, u.phone, u.active
       from auth_tokens t join users u on u.id = t.user_id
      where t.token_hash = $1 and t.expires_at > now()`, [digest(token)]);
  if (!row || !row.active) return null;
  return row;
}

export const revokeToken = token => token ? q('delete from auth_tokens where token_hash = $1', [digest(token)]) : null;
export const revokeAllFor = userId => q('delete from auth_tokens where user_id = $1', [userId]);
export const sweepTokens = () => q('delete from auth_tokens where expires_at < now()');

export async function adminCode() {
  const row = await one(`select value from settings where key = 'admin_registration_code'`);
  return row ? row.value : null;
}
