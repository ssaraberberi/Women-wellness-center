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
 * A class at any other hour (15:00, 21:00 …) is left alone and listed.
 * Running it twice is harmless.
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio } from '../src/lib/time.js';

const APPLY = process.argv.includes('--apply');

const BY_HOUR: Record<number, 'Almira' | 'Neda'> = {
  7: 'Almira', 8: 'Almira', 16: 'Almira', 17: 'Almira', 18: 'Almira', 19: 'Almira', 20: 'Almira',
  9: 'Neda', 10: 'Neda', 11: 'Neda', 12: 'Neda', 13: 'Neda', 14: 'Neda',
};

async function instructor(firstName: string) {
  const found = await prisma.staffProfile.findMany({
    where: { user: { status: { not: 'DELETED' }, profile: { firstName: { equals: firstName, mode: 'insensitive' } } } },
    include: { user: { include: { profile: true } } },
  });
  if (found.length !== 1) {
    const list = found.map((s) => `${s.user.profile?.firstName} ${s.user.profile?.lastName} <${s.user.email ?? s.user.username}>`).join(', ');
    throw new Error(`Expected exactly one staff member named ${firstName}, found ${found.length}${list ? `: ${list}` : ''}`);
  }
  const s = found[0];
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
  const sessions = await prisma.classSession.findMany({ where: { status: 'SCHEDULED', startsAt: { gt: now } }, include: { classType: true }, orderBy: { startsAt: 'asc' } });

  const tChanges: { id: string; to: string }[] = [];
  const tSkipped: string[] = [];
  for (const t of templates) {
    const who = BY_HOUR[Number(t.startTime.slice(0, 2))];
    if (!who) { tSkipped.push(`${'MTWTFSS'[t.weekday - 1]} ${t.startTime} ${t.classType.name}`); continue; }
    if (t.instructorId !== people[who].id) tChanges.push({ id: t.id, to: people[who].id });
  }

  const sChanges = new Map<string, string[]>(); // instructor id → session ids
  const sSkipped: string[] = [];
  const summary = new Map<string, number>();
  for (const s of sessions) {
    const hour = Number(formatStudio(s.startsAt, 'H'));
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
  }, { timeout: 60_000 });
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
