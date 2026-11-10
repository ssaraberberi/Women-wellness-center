import type { Tx } from './prisma.js';
import { prisma } from './prisma.js';

/** "Ana Hoxha" → "ana.hoxha"; ë, ç and other marks dropped, anything else not a letter or digit removed. */
export const usernameBase = (firstName: string, lastName: string) => {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  return [clean(firstName), clean(lastName)].filter(Boolean).join('.') || 'klienta';
};

/** A free username for this name: "ana.hoxha", then "ana.hoxha2", "ana.hoxha3"… */
export async function uniqueUsername(db: Tx | typeof prisma, firstName: string, lastName: string) {
  const base = usernameBase(firstName, lastName);
  const taken = new Set(
    (await db.user.findMany({ where: { username: { startsWith: base } }, select: { username: true } })).map((u) => u.username),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
}

/** What a client types to sign in: an email if it has an @, a username otherwise. */
export const loginWhere = (login: string) => {
  const v = login.trim().toLowerCase();
  return v.includes('@') ? { email: v } : { username: v };
};
