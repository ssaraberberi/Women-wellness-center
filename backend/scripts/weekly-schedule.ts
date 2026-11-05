/**
 * The studio's ordinary week as recurring templates: Monday to Saturday, a
 * class every hour from 07:00 to 21:00. The 07:00 class and every class from
 * 16:00 on are Almira's; the rest have no instructor, for the others to take.
 *
 *   npx tsx scripts/weekly-schedule.ts                    preview, changes nothing
 *   npx tsx scripts/weekly-schedule.ts --apply            save it, valid from today
 *   npx tsx scripts/weekly-schedule.ts --apply --from 2026-11-09
 *
 * Options: --type <class type name> (needed when there is more than one),
 * --capacity <n> (default: the class type's), --instructor <name> (default Almira).
 *
 * Monday–Saturday templates that are not part of this week are stopped the
 * way the admin's "stop slot" does it, and one at the same hour and class type
 * is changed in place. Either way a class someone has booked stays as it is.
 * Sunday is left alone.
 */
import { prisma } from '../src/lib/prisma.js';
import { personName } from '../src/lib/dto.js';
import { dbDate, studioNow } from '../src/lib/time.js';
import { generateSessions, regenerateTemplate } from '../src/services/schedule.js';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes('--apply');
const FROM = arg('from') ?? studioNow().toISODate()!;
const WHO = (arg('instructor') ?? 'Almira').toLowerCase();

const DAYS = [1, 2, 3, 4, 5, 6]; // ISO: 1 = Monday … 6 = Saturday
const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i); // starts 07:00 … 20:00, last ends 21:00
const isAlmiras = (h: number) => h === 7 || h >= 16;
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const DURATION = 60;

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(FROM)) throw new Error(`--from must be YYYY-MM-DD, not "${FROM}"`);

  const types = await prisma.classType.findMany({ where: { active: true } });
  const wanted = arg('type')?.toLowerCase();
  const typeMatches = wanted ? types.filter((t) => t.name.toLowerCase() === wanted) : types;
  if (typeMatches.length !== 1)
    throw new Error(
      `${wanted ? `No single class type named "${arg('type')}"` : types.length ? 'More than one class type, pick one with --type' : 'No active class type'}. ` +
        `There are: ${types.map((t) => `"${t.name}"`).join(', ') || 'none'}`,
    );
  const type = typeMatches[0];
  const capacity = Number(arg('capacity') ?? type.defaultCapacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new Error('--capacity is a whole number from 1 to 100');

  const staff = await prisma.staffProfile.findMany({ where: { isInstructor: true, active: true }, include: { user: { include: { profile: true } } } });
  const who = staff.filter((s) => personName(s.user.profile).toLowerCase().includes(WHO));
  if (who.length !== 1)
    throw new Error(
      who.length
        ? `More than one instructor matches "${WHO}": ${who.map((s) => personName(s.user.profile)).join(', ')}`
        : `No active instructor named "${WHO}". Add her as staff with "instructor" first.`,
    );
  const almira = who[0];
  const almiraName = personName(almira.user.profile);

  console.log(`${APPLY ? 'Saving' : 'Preview'} — from ${FROM}, Monday to Saturday, ${type.name}, ${capacity} places:`);
  for (const h of HOURS) console.log(`  ${hh(h)}–${hh(h + 1)}  ${isAlmiras(h) ? almiraName : 'others (no instructor)'}`);
  console.log();

  const existing = await prisma.classScheduleTemplate.findMany({ where: { active: true, weekday: { in: DAYS } } });
  const used = new Set<string>();
  let created = 0, changed = 0, unchanged = 0;

  for (const weekday of DAYS) {
    for (const h of HOURS) {
      const data = { classTypeId: type.id, instructorId: isAlmiras(h) ? almira.userId : null, weekday, startTime: hh(h), durationMin: DURATION, capacity };
      const same = existing.find((t) => !used.has(t.id) && t.weekday === weekday && t.startTime === data.startTime && t.classTypeId === type.id);
      if (same) {
        used.add(same.id);
        if (same.instructorId === data.instructorId && same.durationMin === DURATION && same.capacity === capacity) {
          unchanged++;
          continue;
        }
        changed++;
        if (APPLY) {
          await prisma.classScheduleTemplate.update({ where: { id: same.id }, data });
          await regenerateTemplate(same.id);
        }
        continue;
      }
      created++;
      if (APPLY) await prisma.classScheduleTemplate.create({ data: { ...data, validFrom: dbDate(FROM) } });
    }
  }

  const stop = existing.filter((t) => !used.has(t.id));
  let removedSessions = 0;
  if (APPLY) {
    for (const t of stop) {
      await prisma.classScheduleTemplate.update({ where: { id: t.id }, data: { active: false } });
      const { count } = await prisma.classSession.deleteMany({
        where: { templateId: t.id, startsAt: { gt: new Date() }, detached: false, bookings: { none: {} }, waitlist: { none: {} } },
      });
      removedSessions += count;
    }
  }

  console.log(`Templates: ${created} new, ${changed} changed, ${unchanged} already right, ${stop.length} stopped.`);
  for (const t of stop) console.log(`  stop: weekday ${t.weekday} ${t.startTime} (${t.durationMin} min)`);

  if (!APPLY) {
    console.log('\nNothing was changed. Run again with --apply to save it.');
    return;
  }
  const generated = await generateSessions();
  const pinned = stop.length
    ? await prisma.classSession.count({ where: { templateId: { in: stop.map((t) => t.id) }, startsAt: { gt: new Date() }, status: 'SCHEDULED' } })
    : 0;
  console.log(`Classes: ${generated} generated, ${removedSessions} unbooked ones removed from stopped slots.`);
  if (pinned) console.log(`${pinned} booked class(es) from stopped slots were kept as they are — check them in the admin calendar.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
