import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export type Tx = Prisma.TransactionClient;

/**
 * Serializable is not needed: every place that must not race takes a row lock
 * (`select … for update`) or an advisory lock first. Read committed + locks is
 * both correct and fast.
 */
export function transaction<T>(fn: (tx: Tx) => Promise<T>, timeoutMs = 15_000): Promise<T> {
  return prisma.$transaction(fn, { timeout: timeoutMs, maxWait: 10_000 });
}

/** Transaction-scoped advisory lock keyed by any string. */
export async function advisoryLock(tx: Tx, key: string) {
  await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${key}))`;
}

export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}
