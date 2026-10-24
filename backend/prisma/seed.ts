/**
 * Development data: `npm run seed` (adds only to an empty database) or
 * `npm run seed -- --fresh` (wipes everything first).
 *
 * Refuses to run when APP_ENV=production. The accounts all use @dua.dev,
 * which is what DEV_LOGIN_CODE is limited to.
 */
import { env } from '../src/env.js';
import { prisma } from '../src/lib/prisma.js';
import { DEFAULT_OPENING_HOURS } from '../src/lib/settings.js';
import { dbDate, studioNow } from '../src/lib/time.js';
import { generateSessions } from '../src/services/schedule.js';
import { createOrder, recordManualPayment } from '../src/services/orders.js';
import { bookClass } from '../src/services/booking.js';
import { bookSpa, spaAvailability } from '../src/services/spa.js';

if (env.APP_ENV === 'production' && !process.argv.includes('--i-know-this-is-production')) {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const fresh = process.argv.includes('--fresh');

async function wipe() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`truncate ${tables.map((t) => `"${t.tablename}"`).join(', ')} restart identity cascade`);
}

async function main() {
  if (fresh) await wipe();
  else if (await prisma.classType.count()) {
    console.log('The database already has data. Use `npm run seed -- --fresh` to start over.');
    return;
  }

  await prisma.studioSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, openingHours: DEFAULT_OPENING_HOURS } });

  // ─── people ───
  const person = (email: string, role: 'CLIENT' | 'STAFF' | 'ADMIN', firstName: string, lastName: string, phone: string, extra: object = {}) =>
    prisma.user.create({
      data: {
        email,
        role,
        emailVerifiedAt: new Date(),
        ...extra,
        profile: { create: { firstName, lastName, phone } },
        notificationPrefs: { create: {} },
      },
    });

  const owner = await person('owner@dua.dev', 'ADMIN', 'Dua', 'Owner', '+355 69 710 4072', { isOwner: true });
  const ines = await person('ines@dua.dev', 'STAFF', 'Ines', 'Vidal', '+355 69 100 0001');
  const marta = await person('marta@dua.dev', 'STAFF', 'Marta', 'Hoxha', '+355 69 100 0002');
  const elisa = await person('elisa@dua.dev', 'STAFF', 'Elisa', 'Kola', '+355 69 100 0003');
  const ana = await person('ana@dua.dev', 'STAFF', 'Ana', 'Meta', '+355 69 100 0004');
  const sara = await person('sara@dua.dev', 'CLIENT', 'Sara', 'Berberi', '+355 69 123 4567');
  const klea = await person('klea@dua.dev', 'CLIENT', 'Klea', 'Duka', '+355 69 222 3344');
  const others = await Promise.all(
    ['Ana Lika', 'Era Basha', 'Joana Prifti', 'Dea Leka', 'Rita Gjoka', 'Nora Shehu'].map((n, i) => {
      const [f, l] = n.split(' ');
      return person(`${f.toLowerCase()}.${l.toLowerCase()}@dua.dev`, 'CLIENT', f, l, `+355 68 300 00${10 + i}`);
    }),
  );

  await prisma.staffProfile.createMany({
    data: [
      { userId: ines.id, isInstructor: true, bio: 'Reformer, 8 vjet përvojë. Teknikë e pastër, ritëm i qetë.', compensationModel: 'PER_CLASS', compensationRate: 2500 },
      { userId: marta.id, isInstructor: true, bio: 'Flow dhe forcë. Klasat e saj mbarojnë gjithmonë me buzëqeshje.', compensationModel: 'HOURLY', compensationRate: 2200 },
      { userId: elisa.id, isInstructor: true, bio: 'Mat dhe mobilitet.', compensationModel: 'PER_CLASS', compensationRate: 2000 },
      { userId: ana.id, isTherapist: true, bio: 'Terapiste masazhi dhe drenazhi limfatik.', compensationModel: 'FIXED_SALARY', compensationRate: 90000, canViewClientNotes: true },
    ],
  });

  // ─── Pilates ───
  const ct = async (name: string, nameEn: string, difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS', format: string, description: string, descriptionEn: string, imageKey: string) =>
    prisma.classType.create({ data: { name, nameEn, difficulty, format, description, descriptionEn, durationMin: 50, defaultCapacity: format === 'MAT' ? 10 : 8, creditsRequired: 1, imageKey } });
  const basics = await ct('Reformer Basics', 'Reformer Basics', 'BEGINNER', 'REFORMER', 'Hyrje e qetë në reformer: frymëmarrje, qendër, kontroll.', 'A calm introduction to the reformer: breath, centre, control.', 'reformer-room');
  const flow = await ct('Reformer Flow', 'Reformer Flow', 'INTERMEDIATE', 'REFORMER', 'Një klasë dinamike që fokusohet në forcë, kontroll dhe fleksibilitet duke përdorur reformer.', 'A dynamic class focused on strength, control and flexibility on the reformer.', 'reformer-evening');
  const inter = await ct('Reformer Intermediate', 'Reformer Intermediate', 'ADVANCED', 'REFORMER', 'Sekuenca më të gjata dhe rezistencë më e lartë.', 'Longer sequences and more resistance.', 'studio-reformers');
  const mat = await ct('Mat Class', 'Mat Class', 'ALL_LEVELS', 'MAT', 'Pilates në tapet — forcë e thellë pa makineri.', 'Mat Pilates — deep strength, no machine.', 'mat-studio');

  const validFrom = dbDate(studioNow().minus({ days: 7 }).toISODate()!);
  const slots: [typeof basics, string, number[], string][] = [
    [basics, ines.id, [1, 2, 3, 4, 5], '07:00'],
    [flow, marta.id, [1, 2, 3, 4, 5], '08:00'],
    [inter, ines.id, [1, 3, 5], '09:00'],
    [mat, elisa.id, [1, 2, 3, 4, 5, 6], '10:00'],
    [flow, ines.id, [1, 2, 3, 4, 5], '17:00'],
    [basics, marta.id, [1, 2, 3, 4, 5], '18:00'],
    [inter, marta.id, [2, 4], '19:00'],
    [flow, ines.id, [6], '09:00'],
    [basics, marta.id, [6], '11:00'],
  ];
  for (const [type, instructorId, days, startTime] of slots) {
    for (const weekday of days) {
      await prisma.classScheduleTemplate.create({
        data: { classTypeId: type.id, instructorId, weekday, startTime, durationMin: 50, capacity: type.defaultCapacity, validFrom },
      });
    }
  }
  const generated = await generateSessions(35);

  // ─── SPA ───
  await prisma.spaRoom.createMany({ data: [{ name: 'Room 1' }, { name: 'Room 2' }] });
  const tr = (name: string, nameEn: string, category: string, durationMin: number, price: number, description: string, benefits: string, imageKey: string) =>
    prisma.spaTreatment.create({ data: { name, nameEn, category, durationMin, price, description, benefits, imageKey, bufferMin: 10 } });
  const treatments = [
    await tr('Relax Massage', 'Relax Massage', 'RELAX', 30, 2600, 'Masazh i lehtë për të liruar tensionin e ditës.', 'Qetëson sistemin nervor · përmirëson gjumin', 'massage-hands'),
    await tr('Relax Massage', 'Relax Massage', 'RELAX', 60, 4500, 'Një orë e plotë qetësie, me vajra të ngrohtë.', 'Relaksim i thellë · qarkullim më i mirë', 'massage-hands'),
    await tr('Deep Tissue', 'Deep Tissue', 'DEEP_TISSUE', 60, 4800, 'Presion i thellë mbi muskujt e lodhur.', 'Liron nyjet muskulore · lehtëson dhimbjen kronike', 'treatment-corridor'),
    await tr('Lymphatic Drainage', 'Lymphatic Drainage', 'LYMPHATIC', 60, 5200, 'Lëvizje ritmike që ndihmojnë qarkullimin limfatik.', 'Ul ënjtjen · ndjesi lehtësie', 'recovery-wood'),
    await tr('Sports Massage', 'Sports Massage', 'SPORTS', 45, 4200, 'Për muskujt pas stërvitjes.', 'Rikuperim më i shpejtë · më shumë lëvizshmëri', 'massage-hands'),
    await tr('Maderoterapi', 'Maderotherapy', 'MADERO', 50, 5000, 'Masazh me vegla druri për modelim.', 'Tonifikim · qarkullim', 'recovery-wood'),
    await tr('Shpinë, qafë & shpatulla', 'Back, neck & shoulders', 'BACK_NECK', 30, 2800, 'Fokus te zonat që mbajnë stresin e zyrës.', 'Lehtëson tensionin e qafës · qëndrim më i mirë', 'treatment-corridor'),
  ];
  await prisma.therapistQualification.createMany({ data: treatments.map((t) => ({ therapistId: ana.id, treatmentId: t.id })) });
  for (const weekday of [1, 2, 3, 4, 5, 6]) {
    await prisma.therapistAvailability.create({
      data: weekday === 6 ? { therapistId: ana.id, weekday, startTime: '10:00', endTime: '15:00' } : { therapistId: ana.id, weekday, startTime: '10:00', endTime: '19:00', breakStart: '13:30', breakEnd: '14:15' },
    });
  }

  // ─── packages ───
  const product = (data: Parameters<typeof prisma.membershipProduct.create>[0]['data']) => prisma.membershipProduct.create({ data });
  const trial = await product({ kind: 'TRIAL', name: 'Klasa e parë', nameEn: 'First class', price: 990, classCredits: 1, validityDays: 14, firstTimeOnly: true, maxPerClient: 1, sortOrder: 0, description: 'Provo reformer-in për herë të parë.', terms: 'Vetëm për klientet e reja. E vlefshme 14 ditë.', imageKey: 'reformer-room' });
  await product({ kind: 'SINGLE', name: 'Klasë e vetme', nameEn: 'Single class', price: 1800, classCredits: 1, validityDays: 30, sortOrder: 1, description: 'Një klasë, kur të duash.', terms: 'E vlefshme 30 ditë.', imageKey: 'studio-reformers' });
  const four = await product({ kind: 'PACKAGE', name: '4 klasa / muaj', nameEn: '4 classes / month', price: 8000, classCredits: 4, validityDays: 30, sessionsPerWeekHint: 1, sortOrder: 2, description: '1 herë në javë', terms: 'Kreditet skadojnë pas 30 ditësh.', imageKey: 'reformer-evening' });
  const eight = await product({ kind: 'PACKAGE', name: '8 klasa / muaj', nameEn: '8 classes / month', price: 14500, classCredits: 8, validityDays: 30, sessionsPerWeekHint: 2, sortOrder: 3, description: '2 herë në javë', terms: 'Kreditet skadojnë pas 30 ditësh.', imageKey: 'studio-correction' });
  await product({ kind: 'PACKAGE', name: '12 klasa / muaj', nameEn: '12 classes / month', price: 19900, classCredits: 12, validityDays: 30, sessionsPerWeekHint: 3, sortOrder: 4, description: '3 herë në javë', terms: 'Kreditet skadojnë pas 30 ditësh.', imageKey: 'studio-reformers' });
  await product({ kind: 'DUO', name: 'DUA DUO', nameEn: 'DUA DUO', price: 12000, originalPrice: 14500, classCredits: 8, validityDays: 30, sessionsPerWeekHint: 2, sortOrder: 5, description: '2 herë në javë, me shoqen', terms: '8 kredite të përbashkëta për ty dhe shoqen, të rezervuara nga llogaria jote.', imageKey: 'reformer-room' });
  await product({
    kind: 'COMBO', name: 'DUA RESET', nameEn: 'DUA RESET', price: 13500, classCredits: 4, validityDays: 30, sortOrder: 6,
    description: '4 klasa + 1 masazh relaksues 60 min', terms: 'E vlefshme 30 ditë.', imageKey: 'massage-hands',
    spaItems: { create: [{ treatmentId: treatments[1].id, quantity: 1 }] },
  });
  await product({
    kind: 'COMBO', name: 'DUA ROUTINE + RELAX', nameEn: 'DUA ROUTINE + RELAX', price: 21000, classCredits: 8, validityDays: 30, sortOrder: 7,
    description: '8 klasa + 2 trajtime SPA sipas zgjedhjes', terms: 'Trajtimet SPA: çdo masazh relaksues ose shpinë/qafë.', imageKey: 'recovery-wood',
    spaItems: { create: [{ category: 'RELAX', quantity: 1 }, { category: 'BACK_NECK', quantity: 1 }] },
  });
  await product({
    kind: 'SPA', name: '5 masazhe relaksuese', nameEn: '5 relax massages', price: 20000, originalPrice: 22500, classCredits: 0, validityDays: 90, sortOrder: 8,
    description: '5 × 60 min', terms: 'E vlefshme 90 ditë.', imageKey: 'massage-hands',
    spaItems: { create: [{ treatmentId: treatments[1].id, quantity: 5 }] },
  });

  await prisma.promotionCode.create({ data: { code: 'FOUNDING20', description: '20% për klientet themeluese', discountType: 'PERCENT', discountValue: 20, firstTimeOnly: true, maxRedemptions: 30 } });
  await prisma.announcement.createMany({
    data: [
      { title: 'Mirë se erdhe në DUA', titleEn: 'Welcome to DUA', body: 'Studio jonë e re në Komunën e Parisit është gati. Rezervo klasën e parë me 990 L.', bodyEn: 'Our new studio in Komuna e Parisit is ready. Book your first class for 990 L.', kind: 'NEWS' },
      { title: 'FOUNDING20', titleEn: 'FOUNDING20', body: '20% zbritje në paketën e parë për 30 klientet e para.', bodyEn: '20% off your first package for the first 30 clients.', kind: 'OFFER' },
    ],
  });

  // ─── Sara: an active package, two bookings, a SPA appointment ───
  const saraOrder = await createOrder({ userId: sara.id, productId: eight.id, actorId: owner.id });
  await recordManualPayment({ orderId: saraOrder.id, method: 'CARD_AT_STUDIO', actorId: owner.id, note: 'Seed' });
  const reset = await prisma.membershipProduct.findFirstOrThrow({ where: { name: 'DUA RESET' } });
  const saraReset = await createOrder({ userId: sara.id, productId: reset.id, actorId: owner.id });
  await recordManualPayment({ orderId: saraReset.id, method: 'CASH', actorId: owner.id, note: 'Seed' });

  const upcoming = await prisma.classSession.findMany({ where: { startsAt: { gt: new Date(Date.now() + 26 * 3600_000) } }, orderBy: { startsAt: 'asc' }, take: 40 });
  const pick = (title: string, n: number) => upcoming.filter((s) => s.classTypeId === title)[n];
  for (const s of [pick(flow.id, 0), pick(mat.id, 1), pick(basics.id, 2)].filter(Boolean)) {
    await bookClass(sara.id, s!.id, { actor: { id: sara.id, role: 'CLIENT' } });
  }

  // Five other clients with packages, filling one class completely so the waiting list can be tried.
  const full = pick(flow.id, 1)!;
  await prisma.classSession.update({ where: { id: full.id }, data: { capacity: 5 } });
  for (const c of others.slice(0, 5)) {
    const o = await createOrder({ userId: c.id, productId: four.id, actorId: owner.id });
    await recordManualPayment({ orderId: o.id, method: 'CASH', actorId: owner.id });
    await bookClass(c.id, full.id, { actor: { id: c.id, role: 'CLIENT' } });
  }
  // Klea has ordered a trial and not paid yet — it waits on the admin's Orders screen.
  await createOrder({ userId: klea.id, productId: trial.id, actorId: klea.id });

  const spaDay = studioNow().plus({ days: 2 });
  const date = (spaDay.weekday === 7 ? spaDay.plus({ days: 1 }) : spaDay).toISODate()!;
  const slots2 = await spaAvailability(prisma, { treatmentId: treatments[1].id, date });
  if (slots2.length) {
    await bookSpa({ clientId: sara.id, treatmentId: treatments[1].id, startsAt: new Date(slots2[Math.min(8, slots2.length - 1)].startsAt), actor: { id: sara.id, role: 'CLIENT' } });
  }

  // The seed's own notifications should not be emailed out.
  await prisma.notification.updateMany({ where: { status: 'PENDING' }, data: { status: 'SKIPPED' } });

  console.log(`Seeded: ${generated} classes, 7 treatments, 9 packages.`);
  console.log('Dev accounts (code: DEV_LOGIN_CODE when APP_ENV=development):');
  console.log('  Admin/owner   owner@dua.dev');
  console.log('  Instructor    ines@dua.dev   (also marta@dua.dev, elisa@dua.dev)');
  console.log('  Therapist     ana@dua.dev');
  console.log('  Client        sara@dua.dev   (active packages, bookings, SPA)');
  console.log('  Client        klea@dua.dev   (no package yet; a trial waiting for payment)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
