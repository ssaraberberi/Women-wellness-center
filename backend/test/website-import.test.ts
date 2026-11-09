import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { makeUser, prisma, resetDb } from './helpers.js';
import { applyImport, planImport } from '../src/import/website.js';
import { analytics } from '../src/services/analytics.js';
import { studioDate } from '../src/lib/time.js';

/**
 * A real copy of the website's schema, in its own local database, filled with
 * the kinds of rows the studio has: a client already in the app, a DUO, an
 * offer used, someone sharing a phone, upcoming and past classes, adjustments.
 */
const WEB_URL = (process.env.TEST_DATABASE_URL ?? 'postgresql://dua:dua@localhost:5433/dua_test').replace(/\/[^/?]+(\?|$)/, '/dua_website_test$1');
let web: PrismaClient;

const day = (n: number) => studioDate(new Date(Date.now() + n * 86_400_000));
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

beforeAll(async () => {
  const exists = await prisma.$queryRawUnsafe<unknown[]>(`select 1 from pg_database where datname = 'dua_website_test'`);
  if (!exists.length) await prisma.$executeRawUnsafe('create database dua_website_test');
  web = new PrismaClient({ datasourceUrl: WEB_URL });
});
afterAll(async () => {
  await web.$disconnect();
  await prisma.$disconnect();
});

async function buildWebsite(extra: string[] = []) {
  for (const s of ['drop schema if exists public cascade', 'create schema public']) await web.$executeRawUnsafe(s);
  const schema = readFileSync(new URL('./fixtures/website-schema.sql', import.meta.url), 'utf8');
  for (const stmt of schema.split(/;\s*\n/).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)*$/.test(s))) await web.$executeRawUnsafe(stmt);
  const sql = [
    `insert into class_types (id, name, short_name) values ('reformer','Reformer','R'), ('spa','Spa','S')`,
    `insert into plans (id, name, price_all, kind, validity_days) values ('p8','8 klasa',12000,'membership',30), ('unl','Pa limit',30000,'membership',30)`,
    `update plans set archived = true where id = 'unl'`,
    `insert into plan_allowances (plan_id, class_type_ids, limit_count, period) values ('p8','{reformer}',8,'month'), ('unl','{reformer}',null,'month')`,
    `insert into offers (id, title, kind, price_all, original_all, lines, validity_days, persons, together, active) values ('duo','DUA DUO','bundle',20000,24000,'[{"types":["reformer"],"total":8}]',30,2,true,true)`,
    `insert into offers (id, title, kind, discount_pct, eligible_plans, max_redemptions, new_customers_only, active) values ('fg','FOUNDING GIRLS','discount',15,'{p8}',30,true,true)`,
    `insert into offers (id, title, kind, bonus_classes, bonus_to, bonus_when, friend_required, eligible_plans, active) values ('bestie','BRING A BESTIE','bonus',1,'both','friend_paid',true,'{p8}',true)`,
    `insert into users (id, role, name, email, email_verified, phone, phone_key, password_hash, active) values
      ('${uid(1)}','client','Ana Linked','ana@mail.test',true,'069 111 1111','691111111','scrypt$16384$abc$def',true),
      ('${uid(2)}','client','Bea Duo',null,false,'069 222 2222','692222222','nologin',true),
      ('${uid(3)}','client','Klea Buyer','klea@mail.test',false,'069 333 3333','693333333','nologin',true),
      ('${uid(4)}','client','Dora Twin','dora@mail.test',false,'069 000 0000','690000000','nologin',true),
      ('${uid(5)}','client','Eva Old',null,false,'069 555 5555','695555555','nologin',false),
      ('${uid(9)}','admin','Website Admin','admin@site.test',true,null,null,'x',true)`,
    `insert into reservations (id, ref, status, payment, source, plan_id, offer_id, title, unit_price, original_price, discount_pct, persons, total_price, terms, updated_at) values
      ('${uid(11)}','DUA-AAAA1','confirmed','paid','web','p8','fg','8 klasa · FOUNDING GIRLS',10200,12000,15,1,10200,'{"together":true}', now() - interval '3 days'),
      ('${uid(12)}','DUA-BBBB2','pending','unpaid','web',null,'duo','DUA DUO',20000,24000,null,2,40000,'{"together":true}', now()),
      ('${uid(13)}','DUA-CCCC3','pending','unpaid','web','p8',null,'8 klasa',12000,null,null,1,12000,'{}', now()),
      ('${uid(14)}','DUA-DDDD4','cancelled','unpaid','web','p8',null,'8 klasa',12000,null,null,1,12000,'{}', now())`,
    `insert into memberships (id, client_id, plan_id, offer_id, reservation_id, title, lines, starts_on, ends_on, status, created_at) values
      ('${uid(21)}','${uid(1)}','p8','fg','${uid(11)}','8 klasa · FOUNDING GIRLS','[{"types":["reformer"],"total":8}]','${day(-5)}','${day(25)}','active', now() - interval '5 days'),
      ('${uid(22)}','${uid(3)}',null,'duo','${uid(12)}','DUA DUO','[{"types":["reformer"],"total":8}]','${day(0)}','${day(29)}','active', now() - interval '1 day'),
      ('${uid(23)}','${uid(2)}',null,'duo','${uid(12)}','DUA DUO','[{"types":["reformer"],"total":8}]','${day(0)}','${day(29)}','active', now() - interval '1 day' + interval '1 second'),
      ('${uid(24)}','${uid(4)}','p8',null,'${uid(13)}','8 klasa','[{"types":["reformer"],"total":8}]','${day(-3)}','${day(27)}','active', now() - interval '3 days'),
      ('${uid(25)}','${uid(5)}','p8',null,'${uid(14)}','8 klasa','[{"types":["reformer"],"total":8}]','${day(-40)}','${day(-10)}','cancelled', now() - interval '40 days')`,
    `insert into classes (id, class_type_id, on_date, starts, ends, capacity) values
      ('${uid(31)}','reformer','${day(1)}','08:00','08:50',5),
      ('${uid(32)}','reformer','${day(-2)}','08:00','08:50',5),
      ('${uid(33)}','reformer','${day(-1)}','09:00','09:50',5)`,
    `insert into bookings (id, class_id, client_id, status, membership_id, reservation_id, attendance, created_at) values
      ('${uid(41)}','${uid(31)}','${uid(1)}','booked','${uid(21)}','${uid(11)}',null, now() - interval '2 days'),
      ('${uid(42)}','${uid(32)}','${uid(1)}','booked','${uid(21)}','${uid(11)}','attended', now() - interval '4 days'),
      ('${uid(43)}','${uid(31)}','${uid(3)}','booked','${uid(22)}','${uid(12)}',null, now() - interval '1 day'),
      ('${uid(44)}','${uid(31)}','${uid(2)}','booked','${uid(23)}','${uid(12)}',null, now() - interval '1 day'),
      ('${uid(45)}','${uid(33)}','${uid(4)}','late','${uid(24)}','${uid(13)}',null, now() - interval '2 days'),
      ('${uid(46)}','${uid(33)}','${uid(4)}','cancelled','${uid(24)}','${uid(13)}',null, now() - interval '3 days')`,
    `insert into credit_events (membership_id, line, delta, reason, at) values ('${uid(21)}',0,1,'Desk gift', now() - interval '1 day')`,
    `insert into offer_claims (offer_id, client_id, reservation_id, role, status) values ('fg','${uid(1)}','${uid(11)}','buyer','claimed'), ('duo','${uid(3)}','${uid(12)}','buyer','claimed'), ('duo','${uid(2)}','${uid(12)}','friend','claimed')`,
    ...extra,
  ];
  for (const s of sql) await web.$executeRawUnsafe(s);
}

/** The app side: Ana already has an account (verified), someone shares Dora's phone, the class tomorrow exists. */
async function buildApp() {
  const admin = await makeUser('ADMIN');
  const ana = await prisma.user.create({ data: { email: 'ana@mail.test', role: 'CLIENT', emailVerifiedAt: new Date(), profile: { create: { firstName: 'Ana', lastName: 'App' } } } });
  const twin = await makeUser('CLIENT'); // phone +355690000000, Dora's
  const ct = await prisma.classType.create({ data: { name: 'Reformer', creditsRequired: 1 } });
  const { studioDateTime } = await import('../src/lib/time.js');
  const tomorrow = await prisma.classSession.create({ data: { classTypeId: ct.id, startsAt: studioDateTime(day(1), '08:00'), endsAt: studioDateTime(day(1), '08:50'), capacity: 5 } });
  await prisma.membershipProduct.create({ data: { kind: 'SINGLE', name: 'Klasë e vetme', price: 1800, classCredits: 1, validityDays: 30 } });
  return { admin, ana, twin, tomorrow };
}

const count = async () =>
  Object.fromEntries(await Promise.all(['user', 'order', 'payment', 'membershipPurchase', 'creditWallet', 'classBooking', 'offer'].map(async (m) => [m, await (prisma as never as Record<string, { count: () => Promise<number> }>)[m].count()])));

describe('importing the website', () => {
  beforeEach(() => resetDb());

  it('a dry run writes nothing, and says exactly what would move', async () => {
    await buildWebsite();
    await buildApp();
    const before = await count();
    const plan = await planImport(web, prisma, { batch: 't1' });
    expect(await count()).toEqual(before);
    expect(plan.issues.filter((i) => i.severity === 'blocker')).toEqual([]);
    expect(plan.summary.people).toMatchObject({ websiteClients: 5, linked: 1, review: 1, phoneOnly: 2 });
    expect(plan.summary.money).toMatchObject({ paid: { n: 1, total: 10200 }, owed: { n: 2, total: 52000 }, cancelled: { n: 1 } });
    // The archived unlimited package nobody holds is listed, not imported.
    expect(plan.issues.some((i) => i.severity === 'review' && i.sourceId === 'unl')).toBe(true);
  });

  it('applies once: same people, same credits, same debts, same classes — and refuses a second run', async () => {
    await buildWebsite();
    const app = await buildApp();
    const plan = await planImport(web, prisma, { batch: 't2' });
    const result = await applyImport(prisma, plan, { actorId: app.admin.id });
    expect(result.clients.filter((c) => !c.ok)).toEqual([]);

    // Ana is the app's Ana: no second account. Her package: 8 + 1 gift − 1 past − 1 tomorrow = 7.
    expect(await prisma.user.count({ where: { email: 'ana@mail.test' } })).toBe(1);
    const anaWallet = await prisma.creditWallet.findFirstOrThrow({ where: { userId: app.ana.id } });
    expect(anaWallet.remaining).toBe(7);
    const ledger = await prisma.creditTransaction.findMany({ where: { walletId: anaWallet.id }, orderBy: { createdAt: 'asc' } });
    expect(ledger.reduce((s, t) => s + t.delta, 0)).toBe(7); // the ledger explains the balance
    expect(ledger[ledger.length - 1].balanceAfter).toBe(7);

    // The DUO: one order owed, two packages paired and together, booked together tomorrow.
    const duoOrder = await prisma.order.findUniqueOrThrow({ where: { reference: 'DUA-BBBB2' }, include: { purchase: true } });
    expect(duoOrder).toMatchObject({ status: 'PENDING', total: 40000 });
    // A new DUO costs what it cost on the website: 20,000 each, 40,000 for the two.
    expect(await prisma.membershipProduct.findFirstOrThrow({ where: { kind: 'DUO' } })).toMatchObject({ price: 40000, originalPrice: 48000, persons: 2 });
    const pair = await prisma.membershipPurchase.findMany({ where: { pairId: duoOrder.purchase!.pairId! }, include: { wallet: true } });
    expect(pair).toHaveLength(2);
    expect(pair.every((p) => p.status === 'ACTIVE' && p.together && p.wallet!.remaining === 7)).toBe(true); // kept, though unpaid (decision 1)
    const duoBookings = await prisma.classBooking.findMany({ where: { sessionId: app.tomorrow.id, pairId: { not: null } } });
    expect(duoBookings).toHaveLength(2);
    expect(new Set(duoBookings.map((b) => b.pairId)).size).toBe(1);
    expect(await prisma.classBooking.count({ where: { sessionId: app.tomorrow.id, status: 'BOOKED' } })).toBe(3);

    // Dora: same phone as an app client — her own profile, flagged; late cancel used a class.
    const dora = await prisma.user.findUniqueOrThrow({ where: { email: 'dora@mail.test' }, include: { clientNotes: true } });
    expect(dora.id).not.toBe(app.twin.id);
    expect(dora.clientNotes[0].body).toContain(app.twin.id);
    expect((await prisma.creditWallet.findFirstOrThrow({ where: { userId: dora.id } })).remaining).toBe(7);

    // Eva: phone only, inactive, cancelled package — kept, nothing deleted.
    expect(await prisma.userProfile.count({ where: { firstName: 'Eva', phone: '+355695555555' } })).toBe(1);

    // Money: the paid reservation is revenue on the day it was paid; the unpaid ones are owed, not revenue.
    const payment = await prisma.payment.findFirstOrThrow({ where: { provider: 'website-import' } });
    expect(payment.amount).toBe(10200);
    expect(+payment.completedAt!).toBeLessThan(Date.now() - 2 * 86_400_000);
    const a = await analytics(new Date(Date.now() - 7 * 86_400_000), new Date(Date.now() + 86_400_000));
    expect(a.revenue.gross).toBe(10200);
    expect(a.money.outstanding.membership.amount).toBe(52000);

    // Offers came over with their rules and their use.
    const fg = await prisma.offer.findFirstOrThrow({ where: { title: 'FOUNDING GIRLS' }, include: { eligibleProducts: true } });
    expect(fg).toMatchObject({ kind: 'DISCOUNT', discountPct: 15, maxRedemptions: 30, newClientsOnly: true });
    expect(fg.eligibleProducts).toHaveLength(1);
    expect(await prisma.offerClaim.count({ where: { offerId: fg.id, clientId: app.ana.id } })).toBe(1);
    expect(await prisma.offer.findFirstOrThrow({ where: { title: 'BRING A BESTIE' } })).toMatchObject({ kind: 'BONUS', bonusWhen: 'FRIEND_PAID', bonusClasses: 1 });

    // A second run is refused: nothing can be imported twice.
    const again = await planImport(web, prisma, { batch: 't3' });
    expect(again.issues.some((i) => i.severity === 'blocker' && i.area === 'run')).toBe(true);
    await expect(applyImport(prisma, again, { actorId: app.admin.id })).rejects.toThrow(/Refused/);
  });

  it('stops on what it cannot bring over safely: unlimited packages, missing or over-full classes', async () => {
    await buildWebsite([
      `insert into memberships (id, client_id, plan_id, title, lines, starts_on, ends_on, status) values ('${uid(26)}','${uid(5)}','unl','Pa limit','[{"types":["reformer"],"total":null}]','${day(0)}','${day(20)}','active')`,
      `insert into classes (id, class_type_id, on_date, starts, ends, capacity) values ('${uid(34)}','reformer','${day(2)}','10:00','10:50',5)`,
      `insert into bookings (class_id, client_id, status) values ('${uid(34)}','${uid(4)}','booked')`,
    ]);
    const app = await buildApp();
    await prisma.classSession.update({ where: { id: app.tomorrow.id }, data: { capacity: 2 } });
    const plan = await planImport(web, prisma, { batch: 't4' });
    const blockers = plan.issues.filter((i) => i.severity === 'blocker').map((i) => i.message);
    expect(blockers.some((m) => m.includes('Unlimited'))).toBe(true);
    expect(blockers.some((m) => m.includes('no app class at that minute'))).toBe(true);
    expect(blockers.some((m) => m.includes('over capacity'))).toBe(true);
    const before = await count();
    await expect(applyImport(prisma, plan, { actorId: app.admin.id })).rejects.toThrow(/blocking/);
    expect(await count()).toEqual(before);
  });
});
