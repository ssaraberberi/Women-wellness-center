import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

/** At least 8 characters with a letter and a digit. */
export const zPassword = z
  .string()
  .min(8, 'WEAK_PASSWORD')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'WEAK_PASSWORD');

/** "scrypt$N$r$p$salt$hash" — the parameters travel with the hash so they can change later. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  // With no stored hash, still spend the same time so a stranger cannot tell who has a password.
  const [algo, n, r, p, salt, hash] = (stored ?? DUMMY).split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const got = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return !!stored && got.length === expected.length && timingSafeEqual(got, expected);
}

const DUMMY = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(KEYLEN).toString('base64')}`;
