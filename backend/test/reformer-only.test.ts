import { execFileSync } from 'node:child_process';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { makeClientWithCredits, makeUser, prisma, resetDb } from './helpers.js';

const run = (...args: string[]) =>
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/reformer-only.ts', ...args], { env: process.env, encoding: 'utf8' });

describe('scripts/reformer-only.ts', () => {
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it('previews without changing anything, then turns SPA off and keeps only Reformer', async () => {
    await makeUser('ADMIN', { isOwner: true });
    const therapist = await makeUser('STAFF', { therapist: true });
    const client = await makeClientWithCredits(2);
    const treatment = await prisma.spaTreatment.create({ data: { name: 'Relax', category: 'RELAX', durationMin: 60, price: 3000 } });
    const room = await prisma.spaRoom.create({ data: { name: 'Room 1' } });
    await prisma.therapistAvailability.create({ data: { therapistId: therapist.id, weekday: 1, startTime: '10:00', endTime: '18:00' } });
    const startsAt = new Date(Date.now() + 2 * 86_400_000);
    const appt = await prisma.spaAppointment.create({
      data: { clientId: client.id, therapistId: therapist.id, treatmentId: treatment.id, roomId: room.id, startsAt, endsAt: new Date(+startsAt + 3_600_000), blockedUntil: new Date(+startsAt + 4_200_000), price: 3000 },
    });
    const past = await prisma.spaAppointment.create({
      data: { clientId: client.id, therapistId: therapist.id, treatmentId: treatment.id, roomId: room.id, status: 'COMPLETED', startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() - 82_800_000), blockedUntil: new Date(Date.now() - 82_000_000), price: 3000 },
    });
    const combo = await prisma.membershipProduct.create({ data: { kind: 'COMBO', name: 'Combo', price: 9000, classCredits: 4, validityDays: 30, spaItems: { create: { category: 'RELAX', quantity: 1 } } } });
    const reformerOnly = await prisma.membershipProduct.create({ data: { kind: 'PACKAGE', name: 'Reformer 8', price: 8000, classCredits: 8, validityDays: 30 } });
    const reformer = await prisma.classType.create({ data: { name: 'Reformer Flow', format: 'REFORMER' } });
    const mat = await prisma.classType.create({ data: { name: 'Mat', format: 'MAT' } });
    const matSlot = await prisma.classScheduleTemplate.create({ data: { classTypeId: mat.id, weekday: 2, startTime: '09:00', durationMin: 50, capacity: 5, validFrom: new Date() } });
    const matClass = await prisma.classSession.create({ data: { classTypeId: mat.id, templateId: matSlot.id, startsAt, endsAt: new Date(+startsAt + 3_000_000), capacity: 5 } });

    const preview = run();
    expect(preview).toContain('SPA appointments to cancel:  1');
    expect((await prisma.spaAppointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('BOOKED');

    run('--apply');
    expect((await prisma.spaAppointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('CANCELLED');
    expect((await prisma.spaAppointment.findUniqueOrThrow({ where: { id: past.id } })).status).toBe('COMPLETED'); // history stays
    expect(await prisma.notification.count({ where: { userId: client.id, type: 'SPA_CANCELLED' } })).toBeGreaterThan(0);
    expect(await prisma.therapistAvailability.count()).toBe(0);
    expect((await prisma.spaTreatment.findUniqueOrThrow({ where: { id: treatment.id } })).active).toBe(false);
    expect((await prisma.spaRoom.findUniqueOrThrow({ where: { id: room.id } })).active).toBe(false);
    expect((await prisma.staffProfile.findUniqueOrThrow({ where: { userId: therapist.id } })).isTherapist).toBe(false);
    expect((await prisma.membershipProduct.findUniqueOrThrow({ where: { id: combo.id } })).active).toBe(false);
    expect((await prisma.membershipProduct.findUniqueOrThrow({ where: { id: reformerOnly.id } })).active).toBe(true);
    expect((await prisma.classType.findUniqueOrThrow({ where: { id: reformer.id } })).active).toBe(true);
    expect((await prisma.classType.findUniqueOrThrow({ where: { id: mat.id } })).active).toBe(false);
    expect(await prisma.classSession.findUnique({ where: { id: matClass.id } })).toBeNull(); // unbooked, removed

    // Twice is harmless.
    expect(run('--apply')).toContain('0 SPA appointment(s) cancelled');
  });
});
