import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { getApp, makeUser, prisma, resetDb, creditsOf } from './helpers.js';
import { TZ } from '../src/lib/time.js';

/** A weekday at least two days ahead, in studio time. */
function nextWeekday() {
  let d = DateTime.now().setZone(TZ).plus({ days: 2 });
  while (d.weekday > 5) d = d.plus({ days: 1 });
  return d;
}

async function spaSetup(therapists = 1, rooms = 1) {
  const treatment = await prisma.spaTreatment.create({ data: { name: 'Relax', category: 'RELAX', durationMin: 60, bufferMin: 15, price: 4500 } });
  const day = nextWeekday();
  const staff = [];
  for (let i = 0; i < therapists; i++) {
    const t = await makeUser('STAFF', { therapist: true });
    await prisma.therapistQualification.create({ data: { therapistId: t.id, treatmentId: treatment.id } });
    await prisma.therapistAvailability.create({ data: { therapistId: t.id, weekday: day.weekday, startTime: '10:00', endTime: '13:00', breakStart: '11:30', breakEnd: '12:00' } });
    staff.push(t);
  }
  for (let i = 0; i < rooms; i++) await prisma.spaRoom.create({ data: { name: `Room ${i + 1}` } });
  return { treatment, date: day.toISODate()!, staff };
}

const at = (date: string, time: string) => DateTime.fromISO(`${date}T${time}`, { zone: TZ }).toUTC().toISO();

describe('SPA availability and booking', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('offers only times that fit hours, breaks and buffers', async () => {
    const app = await getApp();
    const { treatment, date } = await spaSetup();
    const c = await makeUser('CLIENT');
    const slots = (await app.inject({ method: 'GET', url: `/spa/availability?treatmentId=${treatment.id}&date=${date}`, headers: c.auth })).json();
    const times = slots.map((s: { time: string }) => s.time);
    // 60 min treatment, break 11:30–12:00, close 13:00, 15-minute steps.
    expect(times).toEqual(['10:00', '10:15', '10:30', '12:00']);
  });

  it('two clients racing for the same slot: one wins, the buffer is respected', async () => {
    const app = await getApp();
    const { treatment, date } = await spaSetup();
    const [a, b] = await Promise.all([makeUser('CLIENT'), makeUser('CLIENT')]);
    const payload = { treatmentId: treatment.id, startsAt: at(date, '10:00') };
    const res = await Promise.all([
      app.inject({ method: 'POST', url: '/spa/appointments', headers: a.auth, payload }),
      app.inject({ method: 'POST', url: '/spa/appointments', headers: b.auth, payload }),
    ]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const slots = (await app.inject({ method: 'GET', url: `/spa/availability?treatmentId=${treatment.id}&date=${date}`, headers: a.auth })).json();
    // 10:00–11:00 + 15 min buffer: the next start is 11:15 at the earliest, which hits the break, so only 12:00 remains.
    expect(slots.map((s: { time: string }) => s.time)).toEqual(['12:00']);
  });

  it('a free therapist without a free room is not a slot', async () => {
    const app = await getApp();
    const { treatment, date } = await spaSetup(2, 1);
    const [a, b] = await Promise.all([makeUser('CLIENT'), makeUser('CLIENT')]);
    const first = await app.inject({ method: 'POST', url: '/spa/appointments', headers: a.auth, payload: { treatmentId: treatment.id, startsAt: at(date, '10:00') } });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: 'POST', url: '/spa/appointments', headers: b.auth, payload: { treatmentId: treatment.id, startsAt: at(date, '10:00') } });
    expect(second.json().error.code).toBe('SLOT_TAKEN');
  });

  it('a closed day has no slots', async () => {
    const app = await getApp();
    const { treatment, date } = await spaSetup();
    await prisma.studioClosure.create({ data: { date: new Date(`${date}T00:00:00Z`) } });
    const c = await makeUser('CLIENT');
    const slots = (await app.inject({ method: 'GET', url: `/spa/availability?treatmentId=${treatment.id}&date=${date}`, headers: c.auth })).json();
    expect(slots).toEqual([]);
  });
});

describe('packages and payments', () => {
  beforeEach(resetDb);

  it('an order stays unpaid and gives nothing until a payment is recorded', async () => {
    const app = await getApp();
    const c = await makeUser('CLIENT');
    const admin = await makeUser('ADMIN');
    const product = await prisma.membershipProduct.create({ data: { kind: 'PACKAGE', name: '8 klasa', price: 14500, classCredits: 8, validityDays: 30 } });
    const order = (await app.inject({ method: 'POST', url: '/orders', headers: c.auth, payload: { productId: product.id } })).json();
    expect(order.status).toBe('PENDING');
    expect(await creditsOf(c.id)).toBe(0);

    // A client cannot mark her own order paid.
    expect((await app.inject({ method: 'POST', url: `/admin/orders/${order.id}/payments`, headers: c.auth, payload: { method: 'CASH' } })).statusCode).toBe(403);
    const wrong = await app.inject({ method: 'POST', url: `/admin/orders/${order.id}/payments`, headers: admin.auth, payload: { method: 'CASH', amount: 100 } });
    expect(wrong.json().error.code).toBe('AMOUNT_MISMATCH');
    const paid = await app.inject({ method: 'POST', url: `/admin/orders/${order.id}/payments`, headers: admin.auth, payload: { method: 'CASH' } });
    expect(paid.statusCode).toBe(200);
    expect(await creditsOf(c.id)).toBe(8);
    const twice = await app.inject({ method: 'POST', url: `/admin/orders/${order.id}/payments`, headers: admin.auth, payload: { method: 'CASH' } });
    expect(twice.statusCode).toBe(409);
    expect(await prisma.auditLog.count({ where: { action: 'payment.record' } })).toBe(1);
  });

  it('a later price change does not touch what was already bought', async () => {
    const app = await getApp();
    const c = await makeUser('CLIENT');
    const admin = await makeUser('ADMIN');
    const product = await prisma.membershipProduct.create({ data: { kind: 'PACKAGE', name: '4 klasa', price: 8000, classCredits: 4, validityDays: 30 } });
    await app.inject({ method: 'POST', url: '/orders', headers: c.auth, payload: { productId: product.id } });
    await app.inject({ method: 'PATCH', url: `/admin/products/${product.id}`, headers: admin.auth, payload: { price: 9000, classCredits: 3 } });
    const p = await prisma.membershipPurchase.findFirstOrThrow({ where: { userId: c.id } });
    expect([p.priceSnapshot, p.classCredits]).toEqual([8000, 4]);
  });

  it('promotion codes: discount, first-time rule and redemption cap', async () => {
    const app = await getApp();
    const product = await prisma.membershipProduct.create({ data: { kind: 'PACKAGE', name: '8 klasa', price: 10000, classCredits: 8, validityDays: 30 } });
    await prisma.promotionCode.create({ data: { code: 'FOUNDING20', discountType: 'PERCENT', discountValue: 20, firstTimeOnly: true, maxRedemptions: 1 } });
    const a = await makeUser('CLIENT');
    const b = await makeUser('CLIENT');
    const o = (await app.inject({ method: 'POST', url: '/orders', headers: a.auth, payload: { productId: product.id, promoCode: 'founding20' } })).json();
    expect([o.subtotal, o.discount, o.total]).toEqual([10000, 2000, 8000]);
    const exhausted = await app.inject({ method: 'POST', url: '/orders', headers: b.auth, payload: { productId: product.id, promoCode: 'FOUNDING20' } });
    expect(exhausted.json().error.code).toBe('PROMO_EXHAUSTED');
  });

  it('a trial is for first-time clients only', async () => {
    const app = await getApp();
    const trial = await prisma.membershipProduct.create({ data: { kind: 'TRIAL', name: 'Trial', price: 990, classCredits: 1, validityDays: 14, firstTimeOnly: true } });
    const c = await makeUser('CLIENT');
    expect((await app.inject({ method: 'POST', url: '/orders', headers: c.auth, payload: { productId: trial.id } })).statusCode).toBe(200);
    const again = await app.inject({ method: 'POST', url: '/orders', headers: c.auth, payload: { productId: trial.id } });
    expect(again.json().error.code).toBe('TRIAL_NOT_ELIGIBLE');
  });

  it('a combo package grants SPA entitlements that pay for an appointment', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const c = await makeUser('CLIENT');
    const treatment = await prisma.spaTreatment.create({ data: { name: 'Relax', category: 'RELAX', durationMin: 60, price: 4500 } });
    const t = await makeUser('STAFF', { therapist: true });
    await prisma.therapistQualification.create({ data: { therapistId: t.id, treatmentId: treatment.id } });
    const day = nextWeekday();
    await prisma.therapistAvailability.create({ data: { therapistId: t.id, weekday: day.weekday, startTime: '10:00', endTime: '18:00' } });
    await prisma.spaRoom.create({ data: { name: 'Room 1' } });
    const combo = await prisma.membershipProduct.create({
      data: { kind: 'COMBO', name: 'DUA RESET', price: 13500, classCredits: 4, validityDays: 30, spaItems: { create: [{ category: 'RELAX', quantity: 1 }] } },
    });
    const order = (await app.inject({ method: 'POST', url: '/orders', headers: c.auth, payload: { productId: combo.id } })).json();
    await app.inject({ method: 'POST', url: `/admin/orders/${order.id}/payments`, headers: admin.auth, payload: { method: 'CARD_AT_STUDIO' } });
    expect(await creditsOf(c.id)).toBe(4);
    const appt = (await app.inject({ method: 'POST', url: '/spa/appointments', headers: c.auth, payload: { treatmentId: treatment.id, startsAt: at(day.toISODate()!, '10:00') } })).json();
    expect(appt.paidWith).toBe('ENTITLEMENT');
    const second = (await app.inject({ method: 'POST', url: '/spa/appointments', headers: c.auth, payload: { treatmentId: treatment.id, startsAt: at(day.toISODate()!, '14:00') } })).json();
    expect(second.paidWith).toBe('PAY_AT_STUDIO');
    // Cancelling in time gives the entitlement back.
    await app.inject({ method: 'POST', url: `/spa/appointments/${appt.id}/cancel`, headers: c.auth });
    expect((await prisma.spaEntitlement.findFirstOrThrow({ where: { userId: c.id } })).remaining).toBe(1);
  });
});
