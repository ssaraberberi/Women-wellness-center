import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma, transaction, advisoryLock, isUniqueViolation, type Tx } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { getSettings, audit } from '../lib/settings.js';
import { TZ, addMinutes, dbDate, hhmmToMinutes, isoWeekday, studioDate, studioDayRange } from '../lib/time.js';
import { notify } from './notify.js';
import { whenText } from './booking.js';

type Actor = { id: string; role: 'CLIENT' | 'STAFF' | 'ADMIN' };
type Interval = { start: number; end: number }; // epoch ms, end exclusive

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export interface Slot {
  startsAt: string;
  time: string;
  therapists: { id: string; name: string }[];
}

/**
 * Every bookable start time for a treatment on a studio day. A slot exists when
 * a qualified therapist is working, not on a break, not booked or blocked or
 * away (including the treatment's turnover buffer), and a room is free for the
 * same span.
 */
export async function spaAvailability(
  db: Tx | typeof prisma,
  opts: { treatmentId: string; date: string; therapistId?: string; excludeAppointmentId?: string; minStart?: Date },
): Promise<Slot[]> {
  const settings = await getSettings(db);
  const treatment = await db.spaTreatment.findUnique({ where: { id: opts.treatmentId } });
  if (!treatment || !treatment.active) throw E.notFound('Treatment');
  if (await db.studioClosure.findUnique({ where: { date: dbDate(opts.date) } })) return [];

  const weekday = isoWeekday(opts.date);
  const { from, to } = studioDayRange(opts.date);
  const therapists = await db.staffProfile.findMany({
    where: {
      active: true,
      isTherapist: true,
      user: { status: 'ACTIVE' },
      qualifications: { some: { treatmentId: treatment.id } },
      ...(opts.therapistId ? { userId: opts.therapistId } : {}),
    },
    include: { therapistAvailability: { where: { weekday } }, user: { include: { profile: true } } },
  });
  if (!therapists.length) return [];
  const ids = therapists.map((t) => t.userId);

  const [appointments, blocks, timeOff, rooms] = await Promise.all([
    db.spaAppointment.findMany({
      where: { status: 'BOOKED', startsAt: { lt: to }, blockedUntil: { gt: from }, ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}) },
      select: { therapistId: true, roomId: true, startsAt: true, blockedUntil: true },
    }),
    db.spaTimeBlock.findMany({ where: { startsAt: { lt: to }, endsAt: { gt: from } } }),
    db.timeOffRequest.findMany({ where: { staffId: { in: ids }, status: 'APPROVED', kind: 'TIME_OFF', startsAt: { lt: to }, endsAt: { gt: from } } }),
    db.spaRoom.findMany({ where: { active: true }, select: { id: true } }),
  ]);
  if (!rooms.length) return [];

  const busy = (therapistId: string): Interval[] => [
    ...appointments.filter((a) => a.therapistId === therapistId).map((a) => ({ start: +a.startsAt, end: +a.blockedUntil })),
    ...blocks.filter((b) => b.therapistId === therapistId || (!b.therapistId && !b.roomId)).map((b) => ({ start: +b.startsAt, end: +b.endsAt })),
    ...timeOff.filter((t) => t.staffId === therapistId).map((t) => ({ start: +t.startsAt, end: +t.endsAt })),
  ];
  const roomBusy = (roomId: string): Interval[] => [
    ...appointments.filter((a) => a.roomId === roomId).map((a) => ({ start: +a.startsAt, end: +a.blockedUntil })),
    ...blocks.filter((b) => b.roomId === roomId).map((b) => ({ start: +b.startsAt, end: +b.endsAt })),
  ];
  const freeRoom = (span: Interval) => rooms.find((r) => !roomBusy(r.id).some((b) => overlaps(b, span)));

  const day = DateTime.fromISO(opts.date, { zone: TZ }).startOf('day');
  const at = (min: number) => +day.plus({ minutes: min });
  const earliest = +(opts.minStart ?? addMinutes(new Date(), 60));
  const length = treatment.durationMin + treatment.bufferMin;

  const slots = new Map<number, Slot>();
  for (const t of therapists) {
    const tBusy = busy(t.userId);
    for (const w of t.therapistAvailability) {
      const open = hhmmToMinutes(w.startTime);
      const close = hhmmToMinutes(w.endTime);
      const brk = w.breakStart && w.breakEnd ? { start: at(hhmmToMinutes(w.breakStart)), end: at(hhmmToMinutes(w.breakEnd)) } : null;
      for (let m = open; m + treatment.durationMin <= close; m += settings.spaSlotStepMin) {
        // The treatment itself must fit in working hours; the buffer may run to closing.
        const span = { start: at(m), end: at(m) + length * 60_000 };
        const treat = { start: span.start, end: at(m + treatment.durationMin) };
        if (span.start < earliest) continue;
        if (brk && overlaps(brk, treat)) continue;
        if (tBusy.some((b) => overlaps(b, span))) continue;
        if (!freeRoom(span)) continue;
        const slot = slots.get(span.start) ?? {
          startsAt: new Date(span.start).toISOString(),
          time: DateTime.fromMillis(span.start, { zone: TZ }).toFormat('HH:mm'),
          therapists: [],
        };
        const p = t.user.profile;
        slot.therapists.push({ id: t.userId, name: p ? `${p.firstName} ${p.lastName}`.trim() : t.user.email });
        slots.set(span.start, slot);
      }
    }
  }
  return [...slots.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Pick a therapist and room for an exact start, or refuse. Caller holds the SPA lock. */
async function allocate(tx: Tx, treatmentId: string, startsAt: Date, therapistId: string | undefined, excludeAppointmentId?: string, actorRole?: Actor['role']) {
  const date = studioDate(startsAt);
  const slots = await spaAvailability(tx, {
    treatmentId,
    date,
    therapistId,
    excludeAppointmentId,
    minStart: actorRole === 'ADMIN' ? new Date() : undefined,
  });
  const slot = slots.find((s) => +new Date(s.startsAt) === +startsAt);
  if (!slot) throw E.conflict('SLOT_TAKEN', 'This time is no longer available');
  const chosen = slot.therapists[0];
  const treatment = await tx.spaTreatment.findUniqueOrThrow({ where: { id: treatmentId } });
  const blockedUntil = addMinutes(startsAt, treatment.durationMin + treatment.bufferMin);
  const room = await tx.$queryRaw<{ id: string }[]>`
    select r.id from spa_rooms r where r.active
      and not exists (select 1 from spa_appointments a where a.room_id = r.id and a.status = 'BOOKED'
                      and a.starts_at < ${blockedUntil} and a.blocked_until > ${startsAt}
                      ${excludeAppointmentId ? prismaRawNotId(excludeAppointmentId) : prismaRawEmpty()})
      and not exists (select 1 from spa_time_blocks b where b.room_id = r.id and b.starts_at < ${blockedUntil} and b.ends_at > ${startsAt})
    order by r.name limit 1`;
  if (!room.length) throw E.conflict('SLOT_TAKEN', 'This time is no longer available');
  return { therapistId: chosen.id, therapistName: chosen.name, roomId: room[0].id, treatment, blockedUntil };
}

const prismaRawNotId = (id: string) => Prisma.sql`and a.id <> ${id}::uuid`;
const prismaRawEmpty = () => Prisma.empty;

/** Use an included treatment from a package when there is one; otherwise pay at the studio. */
async function takeEntitlement(tx: Tx, clientId: string, treatmentId: string, category: string, at: Date) {
  const rows = await tx.$queryRaw<{ id: string; remaining: number }[]>`
    select e.id, e.remaining from spa_entitlements e
    join membership_purchases p on p.id = e.purchase_id
    where e.user_id = ${clientId}::uuid and p.status = 'ACTIVE' and e.remaining > 0
      and e.expires_at > ${at} and e.expires_at > now()
      and (e.treatment_id = ${treatmentId}::uuid or (e.treatment_id is null and (e.category is null or e.category = ${category})))
    order by (e.treatment_id is null), e.expires_at
    limit 1
    for update of e`;
  if (!rows.length) return null;
  await tx.spaEntitlement.update({ where: { id: rows[0].id }, data: { remaining: { decrement: 1 } } });
  return rows[0].id;
}

export async function bookSpa(opts: {
  clientId: string;
  treatmentId: string;
  startsAt: Date;
  therapistId?: string;
  actor: Actor;
  idempotencyKey?: string | null;
  serviceNotes?: string;
}) {
  if (opts.idempotencyKey) {
    const existing = await prisma.spaAppointment.findUnique({ where: { clientId_idempotencyKey: { clientId: opts.clientId, idempotencyKey: opts.idempotencyKey } } });
    if (existing) return existing;
  }
  const treatment = await prisma.spaTreatment.findUnique({ where: { id: opts.treatmentId } });
  if (!treatment || !treatment.active) throw E.notFound('Treatment');
  if (opts.therapistId && !treatment.clientCanChooseTherapist && opts.actor.role === 'CLIENT') {
    throw E.badRequest('THERAPIST_NOT_SELECTABLE', 'The studio assigns the therapist for this treatment');
  }
  const settings = await getSettings();
  if (opts.actor.role === 'CLIENT' && opts.startsAt > addMinutes(new Date(), settings.bookingWindowDays * 1440)) {
    throw E.conflict('BOOKING_NOT_OPEN', 'Booking for this date is not open yet');
  }
  try {
    return await transaction(async (tx) => {
      // One SPA booking decision at a time: the overlap checks below cannot race.
      await advisoryLock(tx, 'spa-schedule');
      const a = await allocate(tx, opts.treatmentId, opts.startsAt, opts.therapistId, undefined, opts.actor.role);
      const entitlementId = await takeEntitlement(tx, opts.clientId, treatment.id, treatment.category, opts.startsAt);
      const appt = await tx.spaAppointment.create({
        data: {
          clientId: opts.clientId,
          therapistId: a.therapistId,
          treatmentId: treatment.id,
          roomId: a.roomId,
          startsAt: opts.startsAt,
          endsAt: addMinutes(opts.startsAt, treatment.durationMin),
          blockedUntil: a.blockedUntil,
          price: treatment.price,
          entitlementId,
          paidWith: entitlementId ? 'ENTITLEMENT' : 'PAY_AT_STUDIO',
          idempotencyKey: opts.idempotencyKey ?? undefined,
          createdById: opts.actor.id,
          serviceNotes: opts.serviceNotes,
        },
        include: { room: true },
      });
      await notify(tx, {
        userId: opts.clientId,
        type: 'SPA_BOOKED',
        dedupeKey: `spa-booked:${appt.id}`,
        params: { treatment: treatment.name, when: whenText(appt.startsAt), therapist: a.therapistName, room: appt.room.name },
        data: { kind: 'spa', appointmentId: appt.id },
      });
      await notify(tx, {
        userId: a.therapistId,
        type: 'STAFF_ASSIGNED',
        dedupeKey: `spa-assigned:${appt.id}`,
        params: { className: treatment.name, when: whenText(appt.startsAt) },
        data: { kind: 'spa', appointmentId: appt.id },
      });
      if (opts.actor.role === 'ADMIN') await audit(tx, opts.actor.id, 'spa.create', 'spa_appointment', appt.id, { clientId: opts.clientId });
      return appt;
    });
  } catch (e) {
    if (isUniqueViolation(e) && opts.idempotencyKey) {
      const existing = await prisma.spaAppointment.findUnique({ where: { clientId_idempotencyKey: { clientId: opts.clientId, idempotencyKey: opts.idempotencyKey } } });
      if (existing) return existing;
    }
    throw e;
  }
}

export async function cancelSpa(appointmentId: string, actor: Actor, opts: { restoreEntitlement?: boolean } = {}) {
  const settings = await getSettings();
  return transaction(async (tx) => {
    await advisoryLock(tx, 'spa-schedule');
    const appt = await tx.spaAppointment.findUnique({ where: { id: appointmentId }, include: { treatment: true } });
    if (!appt || (actor.role === 'CLIENT' && appt.clientId !== actor.id)) throw E.notFound('Appointment');
    if (appt.status !== 'BOOKED') throw E.conflict('NOT_CANCELLABLE', 'This appointment is not active');
    const now = new Date();
    if (actor.role === 'CLIENT' && appt.startsAt <= now) throw E.conflict('CANCEL_CLOSED', 'The appointment has already started');
    const inTime = now <= addMinutes(appt.startsAt, -settings.spaFreeCancelHours * 60);
    const giveBack = appt.entitlementId && (inTime || (actor.role === 'ADMIN' && opts.restoreEntitlement !== false));
    await tx.spaAppointment.update({ where: { id: appt.id }, data: { status: 'CANCELLED', cancelledAt: now } });
    if (giveBack) await tx.spaEntitlement.update({ where: { id: appt.entitlementId! }, data: { remaining: { increment: 1 } } });
    await notify(tx, {
      userId: appt.clientId,
      type: 'SPA_CANCELLED',
      dedupeKey: `spa-cancel:${appt.id}`,
      params: { treatment: appt.treatment.name, when: whenText(appt.startsAt) },
      data: { kind: 'spa', appointmentId: appt.id },
    });
    if (actor.role === 'ADMIN') await audit(tx, actor.id, 'spa.cancel', 'spa_appointment', appt.id, { inTime, giveBack: !!giveBack });
    return { ok: true, inTime, entitlementReturned: !!giveBack };
  });
}

export async function rescheduleSpa(appointmentId: string, startsAt: Date, therapistId: string | undefined, actorId: string) {
  return transaction(async (tx) => {
    await advisoryLock(tx, 'spa-schedule');
    const appt = await tx.spaAppointment.findUnique({ where: { id: appointmentId }, include: { treatment: true } });
    if (!appt) throw E.notFound('Appointment');
    if (appt.status !== 'BOOKED') throw E.conflict('NOT_CANCELLABLE', 'This appointment is not active');
    const a = await allocate(tx, appt.treatmentId, startsAt, therapistId, appt.id, 'ADMIN');
    const updated = await tx.spaAppointment.update({
      where: { id: appt.id },
      data: { startsAt, endsAt: addMinutes(startsAt, appt.treatment.durationMin), blockedUntil: a.blockedUntil, therapistId: a.therapistId, roomId: a.roomId },
    });
    await notify(tx, {
      userId: appt.clientId,
      type: 'SPA_RESCHEDULED',
      dedupeKey: `spa-move:${appt.id}:${+startsAt}`,
      params: { treatment: appt.treatment.name, when: whenText(startsAt) },
      data: { kind: 'spa', appointmentId: appt.id },
    });
    await notify(tx, {
      userId: a.therapistId,
      type: 'STAFF_SCHEDULE_CHANGED',
      dedupeKey: `spa-move-staff:${appt.id}:${+startsAt}`,
      params: { className: appt.treatment.name, when: whenText(startsAt) },
    });
    await audit(tx, actorId, 'spa.reschedule', 'spa_appointment', appt.id, { from: appt.startsAt, to: startsAt });
    return updated;
  });
}

/** Therapist or admin closes an appointment out. */
export async function setSpaOutcome(appointmentId: string, actor: Actor, status: 'COMPLETED' | 'NO_SHOW') {
  const appt = await prisma.spaAppointment.findUnique({ where: { id: appointmentId } });
  if (!appt) throw E.notFound('Appointment');
  if (actor.role === 'STAFF' && appt.therapistId !== actor.id) throw E.notFound('Appointment');
  if (appt.status === 'CANCELLED') throw E.conflict('NOT_CANCELLABLE', 'This appointment was cancelled');
  if (appt.startsAt > new Date()) throw E.conflict('NOT_STARTED', 'The appointment has not started yet');
  return prisma.spaAppointment.update({ where: { id: appointmentId }, data: { status } });
}
