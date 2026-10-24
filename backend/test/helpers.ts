import type { FastifyInstance } from 'fastify';
import type { Role } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { DEFAULT_OPENING_HOURS } from '../src/lib/settings.js';
import { signAccessToken } from '../src/services/tokens.js';
import { activatePurchase } from '../src/services/orders.js';

export { prisma };

let app: FastifyInstance | null = null;
export async function getApp() {
  app ??= await buildApp({ logger: false });
  return app;
}

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`truncate ${tables.map((t) => `"${t.tablename}"`).join(', ')} restart identity cascade`);
  await prisma.studioSettings.create({ data: { id: 1, openingHours: DEFAULT_OPENING_HOURS, freeCancelHours: 12, bookingWindowDays: 30 } });
}

let n = 0;
export async function makeUser(role: Role = 'CLIENT', extra: { isOwner?: boolean; instructor?: boolean; therapist?: boolean; canViewClientNotes?: boolean } = {}) {
  n++;
  const u = await prisma.user.create({
    data: {
      email: `user${n}-${Date.now()}@test.dev`,
      role,
      isOwner: extra.isOwner ?? false,
      profile: { create: { firstName: `User${n}`, lastName: 'Test', phone: '+355690000000' } },
      ...(role === 'STAFF' || extra.instructor || extra.therapist
        ? { staffProfile: { create: { isInstructor: !!extra.instructor, isTherapist: !!extra.therapist, canViewClientNotes: !!extra.canViewClientNotes } } }
        : {}),
    },
  });
  const token = await signAccessToken(u.id, u.role);
  return { ...u, token, auth: { authorization: `Bearer ${token}` } };
}

/** A client holding an active package with `credits` credits, expiring in `days` days. */
export async function makeClientWithCredits(credits: number, days = 30) {
  const u = await makeUser('CLIENT');
  const product = await prisma.membershipProduct.create({ data: { kind: 'PACKAGE', name: `P${credits}`, price: 1000, classCredits: credits, validityDays: days } });
  const purchase = await prisma.membershipPurchase.create({
    data: { userId: u.id, productId: product.id, nameSnapshot: product.name, priceSnapshot: product.price, classCredits: credits, validityDays: days },
  });
  await prisma.$transaction((tx) => activatePurchase(tx, purchase.id));
  return u;
}

let classType: { id: string } | null = null;
export async function makeSession(opts: { inHours: number; capacity?: number; instructorId?: string; credits?: number }) {
  classType = await prisma.classType.create({ data: { name: 'Reformer Flow', creditsRequired: opts.credits ?? 1 } });
  const startsAt = new Date(Date.now() + opts.inHours * 3600_000);
  return prisma.classSession.create({
    data: { classTypeId: classType.id, startsAt, endsAt: new Date(+startsAt + 50 * 60_000), capacity: opts.capacity ?? 5, instructorId: opts.instructorId },
  });
}

export async function creditsOf(userId: string) {
  const w = await prisma.creditWallet.findMany({ where: { userId } });
  return w.reduce((s, x) => s + x.remaining, 0);
}
