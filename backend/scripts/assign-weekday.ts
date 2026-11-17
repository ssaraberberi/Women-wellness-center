/**
 * Give every class on one weekday to one instructor: the weekly slots (so
 * classes made later are hers too) and every upcoming class still on, booked
 * or not, including ones edited by hand. Past and cancelled classes stay.
 *
 *   WEEKDAY=6 FIRST_NAME=Gresa npx tsx scripts/assign-weekday.ts            preview
 *   WEEKDAY=6 FIRST_NAME=Gresa npx tsx scripts/assign-weekday.ts --apply    do it
 *
 * WEEKDAY is ISO: 1 = Monday … 6 = Saturday, 7 = Sunday. INSTRUCTOR_ID picks
 * her by id when the first name is not enough. Stops, changing nothing, unless
 * exactly one staff member matches. Running it twice is harmless.
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio } from '../src/lib/time.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const weekday = Number(process.env.WEEKDAY);
  const firstName = process.env.FIRST_NAME?.trim();
  const pinned = process.env.INSTRUCTOR_ID?.trim();
  if (!(weekday >= 1 && weekday <= 7) || (!firstName && !pinned)) throw new Error('Set WEEKDAY (1-7) and FIRST_NAME or INSTRUCTOR_ID.');

  const found = await prisma.staffProfile.findMany({
    where: pinned ? { userId: pinned } : { user: { status: { not: 'DELETED' }, profile: { firstName: { equals: firstName, mode: 'insensitive' } } } },
    include: { user: { include: { profile: true } } },
  });
  const usable = found.filter((s) => s.user.status !== 'DISABLED');
  if (usable.length !== 1) {
    const list = found.map((s) => `\n    ${s.userId}  ${s.user.profile?.firstName} ${s.user.profile?.lastName}  <${s.user.email ?? '—'}>  status=${s.user.status} instructor=${s.isInstructor} active=${s.active}`).join('');
    throw new Error(`Expected exactly one staff member ${pinned ?? firstName}, found ${usable.length} usable of ${found.length}.${list || '\n    (nobody: invite her first, as an instructor)'}`);
  }
  const who = usable[0];
  const name = `${who.user.profile?.firstName ?? ''} ${who.user.profile?.lastName ?? ''}`.trim();

  const templates = await prisma.classScheduleTemplate.findMany({ where: { active: true, weekday }, include: { classType: true, instructor: { include: { user: { include: { profile: true } } } } }, orderBy: { startTime: 'asc' } });
  const upcoming = await prisma.classSession.findMany({ where: { status: 'SCHEDULED', startsAt: { gt: new Date() } }, include: { classType: true }, orderBy: { startsAt: 'asc' } });
  // The studio's weekday, not the server's: ISO 'c' in the studio timezone.
  const sessions = upcoming.filter((s) => Number(formatStudio(s.startsAt, 'c')) === weekday);
  const tChange = templates.filter((t) => t.instructorId !== who.userId);
  const sChange = sessions.filter((s) => s.instructorId !== who.userId);

  console.log(APPLY ? 'Applying:' : 'Preview — nothing is changed without --apply:');
  console.log(`  instructor: ${name} <${who.user.email ?? '—'}> status=${who.user.status}${who.isInstructor ? '' : ' (will be marked as instructor)'}${who.active ? '' : ' (will be made active)'}`);
  console.log(`  weekly slots that day: ${templates.length}, ${tChange.length} to change — ${templates.map((t) => `${t.startTime} (${t.instructor?.user.profile?.firstName ?? '—'})`).join(', ')}`);
  console.log(`  upcoming classes that day: ${sessions.length}, ${sChange.length} to change — ${[...new Set(sessions.map((s) => formatStudio(s.startsAt, 'd LLL')))].join(', ')}`);
  if (!APPLY) return;

  await prisma.$transaction(async (tx) => {
    if (!who.isInstructor || !who.active) await tx.staffProfile.update({ where: { userId: who.userId }, data: { isInstructor: true, active: true } });
    if (tChange.length) await tx.classScheduleTemplate.updateMany({ where: { id: { in: tChange.map((t) => t.id) } }, data: { instructorId: who.userId } });
    if (sChange.length) await tx.classSession.updateMany({ where: { id: { in: sChange.map((s) => s.id) } }, data: { instructorId: who.userId } });
  }, { timeout: 60_000 });
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
