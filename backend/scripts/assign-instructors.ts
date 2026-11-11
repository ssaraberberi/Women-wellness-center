/**
 * Give every class an instructor by the hour it starts (studio time):
 *
 *   07, 08, 16, 17, 18, 19, 20  → Almira
 *   09, 10, 11, 12, 13, 14      → Neda
 *
 *   npx tsx scripts/assign-instructors.ts            preview, changes nothing
 *   npx tsx scripts/assign-instructors.ts --apply    do it
 *
 * Changed: the weekly slots (so classes made from now on get the right
 * instructor) and every upcoming class that is still on, including ones edited
 * by hand. Classes that already happened or were cancelled stay as they are.
 *
 *   15                          → off: no class at that hour
 *
 * An off hour is handled like removing a weekly slot in the admin: the slot
 * stops, and its upcoming classes nobody booked (or waits for) are deleted.
 * A booked one stays and is listed, so the desk can move or cancel it.
 * A class at any other hour (21:00 …) is left alone and listed.
 * Running it twice is harmless.
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio } from '../src/lib/time.js';

const APPLY = process.argv.includes('--apply');

const BY_HOUR: Record<number, 'Almira' | 'Neda'> = {
  7: 'Almira', 8: 'Almira', 16: 'Almira', 17: 'Almira', 18: 'Almira', 19: 'Almira', 20: 'Almira',
  9: 'Neda', 10: 'Neda', 11: 'Neda', 12: 'Neda', 13: 'Neda', 14: 'Neda',
};
const OFF_HOURS = new Set([15]);

async function instructor(firstName: string) {
  const found = await prisma.staffProfile.findMany({
    where: { user: { status: { not: 'DELETED' }, profile: { firstName: { equals: firstName, mode: 'insensitive' } } } },
    include: { user: { include: { profile: true } } },
  });
  // Pinned by id when the name is not enough: ALMIRA_ID=… NEDA_ID=…
  const pinned = process.env[`${firstName.toUpperCase()}_ID`];
  // Otherwise the one who actually teaches: an active instructor, not a disabled account.
  const teaching = found.filter((s) => s.isInstructor && s.active && s.user.status === 'ACTIVE');
  const pick = pinned ? found.filter((s) => s.userId === pinned) : teaching.length === 1 ? teaching : found;
  if (pick.length !== 1) {
    const list = await Promise.all(
      found.map(async (s) => {
        const [classes, slots] = await Promise.all([prisma.classSession.count({ where: { instructorId: s.userId } }), prisma.classScheduleTemplate.count({ where: { instructorId: s.userId } })]);
        return `\n    ${s.userId}  ${s.user.profile?.firstName} ${s.user.profile?.lastName}  <${s.user.email ?? s.user.username ?? '—'}>  role=${s.user.role} status=${s.user.status} instructor=${s.isInstructor} active=${s.active} classes=${classes} weeklySlots=${slots} since=${s.createdAt.toISOString().slice(0, 10)}`;
      }),
    );
    throw new Error(`Expected exactly one staff member named ${firstName}, found ${found.length}:${list.join('')}`);
  }
  const s = pick[0];
  return { id: s.userId, name: `${s.user.profile?.firstName ?? ''} ${s.user.profile?.lastName ?? ''}`.trim(), isInstructor: s.isInstructor, active: s.active };
}

async function main() {
  const people = { Almira: await instructor('Almira'), Neda: await instructor('Neda') };
  const nameOf = (id: string | null) => (id === people.Almira.id ? people.Almira.name : id === people.Neda.id ? people.Neda.name : id ? 'someone else' : '—');

  console.log(APPLY ? 'Applying:' : 'Preview — nothing is changed without --apply:');
  for (const p of Object.values(people)) {
    console.log(`  ${p.name}${p.isInstructor ? '' : ' (will be marked as instructor)'}${p.active ? '' : ' (INACTIVE staff — will be made active)'}`);
  }

  const now = new Date();
  const templates = await prisma.classScheduleTemplate.findMany({ where: { active: true }, include: { classType: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] });
  const sessions = await prisma.classSession.findMany({ where: { status: 'SCHEDULED', startsAt: { gt: now } }, include: { classType: true, _count: { select: { bookings: true, waitlist: true } } }, orderBy: { startsAt: 'asc' } });
  const tOff: string[] = [];
  const tOffLabel: string[] = [];
  const sOff: string[] = [];
  const sOffKept: string[] = [];

  const tChanges: { id: string; to: string }[] = [];
  const tSkipped: string[] = [];
  for (const t of templates) {
    const hour = Number(t.startTime.slice(0, 2));
    if (OFF_HOURS.has(hour)) { tOff.push(t.id); tOffLabel.push(`${'MTWTFSS'[t.weekday - 1]} ${t.startTime} ${t.classType.name}`); continue; }
    const who = BY_HOUR[hour];
    if (!who) { tSkipped.push(`${'MTWTFSS'[t.weekday - 1]} ${t.startTime} ${t.classType.name}`); continue; }
    if (t.instructorId !== people[who].id) tChanges.push({ id: t.id, to: people[who].id });
  }

  const sChanges = new Map<string, string[]>(); // instructor id → session ids
  const sSkipped: string[] = [];
  const summary = new Map<string, number>();
  for (const s of sessions) {
    const hour = Number(formatStudio(s.startsAt, 'H'));
    if (OFF_HOURS.has(hour)) {
      if (s._count.bookings || s._count.waitlist) sOffKept.push(`${formatStudio(s.startsAt, 'EEE d LLL HH:mm')} ${s.classType.name} (${s._count.bookings} booking(s), ${s._count.waitlist} waiting)`);
      else sOff.push(s.id);
      continue;
    }
    const who = BY_HOUR[hour];
    if (!who) { sSkipped.push(`${formatStudio(s.startsAt, 'EEE d LLL HH:mm')} ${s.classType.name}`); continue; }
    if (s.instructorId === people[who].id) continue;
    const key = `${String(hour).padStart(2, '0')}:00  ${nameOf(s.instructorId)} → ${people[who].name}`;
    summary.set(key, (summary.get(key) ?? 0) + 1);
    sChanges.set(people[who].id, [...(sChanges.get(people[who].id) ?? []), s.id]);
  }

  console.log(`  weekly slots: ${templates.length} active, ${tChanges.length} to change, ${tSkipped.length} at other hours`);
  console.log(`  upcoming classes: ${sessions.length}, ${[...sChanges.values()].flat().length} to change, ${sSkipped.length} at other hours`);
  for (const [k, n] of [...summary].sort()) console.log(`    ${k}: ${n}`);
  console.log(`  off hours (${[...OFF_HOURS].map((h) => `${String(h).padStart(2, '0')}:00`).join(', ')}): ${tOff.length} weekly slot(s) stopped${tOffLabel.length ? ` (${tOffLabel.join('; ')})` : ''}, ${sOff.length} upcoming class(es) removed, ${sOffKept.length} kept because someone booked`);
  for (const k of sOffKept) console.log(`    KEPT, booked: ${k}`);
  if (tSkipped.length) console.log(`  weekly slots left alone: ${tSkipped.join('; ')}`);
  if (sSkipped.length) console.log(`  upcoming classes left alone (first 20): ${sSkipped.slice(0, 20).join('; ')}`);

  if (!APPLY) return;
  await prisma.$transaction(async (tx) => {
    for (const p of Object.values(people)) {
      if (!p.isInstructor || !p.active) await tx.staffProfile.update({ where: { userId: p.id }, data: { isInstructor: true, active: true } });
    }
    for (const id of Object.values(people).map((p) => p.id)) {
      const tIds = tChanges.filter((c) => c.to === id).map((c) => c.id);
      if (tIds.length) await tx.classScheduleTemplate.updateMany({ where: { id: { in: tIds } }, data: { instructorId: id } });
      const sIds = sChanges.get(id) ?? [];
      if (sIds.length) await tx.classSession.updateMany({ where: { id: { in: sIds } }, data: { instructorId: id } });
    }
    if (tOff.length) await tx.classScheduleTemplate.updateMany({ where: { id: { in: tOff } }, data: { active: false } });
    // Checked again inside the transaction: a booking made since the preview keeps its class.
    if (sOff.length) await tx.classSession.deleteMany({ where: { id: { in: sOff }, bookings: { none: {} }, waitlist: { none: {} } } });
  }, { timeout: 60_000 });
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
