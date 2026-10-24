import { DateTime } from 'luxon';
import { prisma, transaction } from '../lib/prisma.js';
import { getSettings, audit } from '../lib/settings.js';
import { TZ, addMinutes, fromDbDate, studioDateTime, dbDate, studioDayRange } from '../lib/time.js';
import { cancelSession } from './booking.js';
import { cancelSpa } from './spa.js';

/**
 * Weekly templates become dated classes, `scheduleHorizonDays` ahead. A class
 * that was edited by hand (`detached`) or that has bookings is never touched
 * by regeneration; the rest is created, and only created — the unique
 * (template, start) pair makes running this twice harmless.
 */
export async function generateSessions(days?: number) {
  const settings = await getSettings();
  const horizon = days ?? settings.scheduleHorizonDays;
  const today = DateTime.now().setZone(TZ).startOf('day');
  const templates = await prisma.classScheduleTemplate.findMany({ where: { active: true }, include: { classType: true } });
  const closures = new Set((await prisma.studioClosure.findMany({ where: { date: { gte: dbDate(today.toISODate()!) } } })).map((c) => fromDbDate(c.date)));

  const rows = [];
  for (let i = 0; i <= horizon; i++) {
    const day = today.plus({ days: i });
    const date = day.toISODate()!;
    if (closures.has(date)) continue;
    for (const t of templates) {
      if (t.weekday !== day.weekday) continue;
      if (fromDbDate(t.validFrom) > date) continue;
      if (t.validUntil && fromDbDate(t.validUntil) < date) continue;
      const startsAt = studioDateTime(date, t.startTime);
      if (startsAt <= new Date()) continue;
      rows.push({
        classTypeId: t.classTypeId,
        templateId: t.id,
        instructorId: t.instructorId,
        startsAt,
        endsAt: addMinutes(startsAt, t.durationMin),
        capacity: t.capacity,
      });
    }
  }
  const res = await prisma.classSession.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

/**
 * After a template changes: future classes from it that nobody has booked and
 * nobody edited by hand are removed and generated again from the new shape.
 */
export async function regenerateTemplate(templateId: string) {
  const now = new Date();
  const removable = await prisma.classSession.findMany({
    where: { templateId, startsAt: { gt: now }, detached: false, bookings: { none: {} }, waitlist: { none: {} } },
    select: { id: true },
  });
  await prisma.classSession.deleteMany({ where: { id: { in: removable.map((r) => r.id) } } });
  // Booked classes that no longer match stay as they are, pinned.
  await prisma.classSession.updateMany({ where: { templateId, startsAt: { gt: now }, detached: false }, data: { detached: true } });
  return generateSessions();
}

/** Close the studio for a day: every class and SPA appointment that day is cancelled with credits returned. */
export async function addClosure(date: string, reason: string | undefined, actorId: string) {
  const closure = await prisma.studioClosure.upsert({ where: { date: dbDate(date) }, update: { reason }, create: { date: dbDate(date), reason } });
  const { from, to } = studioDayRange(date);
  const sessions = await prisma.classSession.findMany({ where: { startsAt: { gte: from, lt: to }, status: 'SCHEDULED' }, select: { id: true } });
  let affected = 0;
  for (const s of sessions) affected += (await cancelSession(s.id, actorId, reason ?? 'Studio closed')).affected;
  const appts = await prisma.spaAppointment.findMany({ where: { startsAt: { gte: from, lt: to }, status: 'BOOKED' }, select: { id: true } });
  for (const a of appts) {
    await cancelSpa(a.id, { id: actorId, role: 'ADMIN' }, { restoreEntitlement: true });
    affected++;
  }
  await transaction((tx) => audit(tx, actorId, 'closure.add', 'studio_closure', closure.id, { date, reason, affected }));
  return { closure, cancelledSessions: sessions.length, affectedClients: affected };
}
