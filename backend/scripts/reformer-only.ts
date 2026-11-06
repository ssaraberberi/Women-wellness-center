/**
 * Turn SPA off for good and leave Reformer as the only thing to book.
 *
 *   npx tsx scripts/reformer-only.ts            preview, changes nothing
 *   npx tsx scripts/reformer-only.ts --apply    do it
 *
 * SPA:
 *  - every upcoming SPA appointment is cancelled the way the desk does it:
 *    a package treatment goes back to the client, and she is told;
 *  - therapists' weekly hours and upcoming SPA time blocks are deleted —
 *    there are no SPA times to book any more;
 *  - every treatment and room is switched off, every staff member stops being a therapist;
 *  - packages that include SPA (SPA-only and combos) stop being sold.
 * Classes:
 *  - class types that are not Reformer are switched off and their weekly slots
 *    stopped; their upcoming classes nobody booked are removed, booked ones stay.
 *
 * Nothing that already happened is deleted: past appointments, payments,
 * purchases and SPA entitlements stay for the records. Running it twice is harmless.
 */
import { prisma } from '../src/lib/prisma.js';
import { cancelSpa } from '../src/services/spa.js';
import { formatStudio } from '../src/lib/time.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const now = new Date();
  // Cancellations are recorded as done by the studio: the owner (or any active admin).
  const admin =
    (await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE', isOwner: true } })) ??
    (await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } }));
  if (!admin) throw new Error('No active admin to record the cancellations under.');

  const [appts, hours, blocks, treatments, rooms, therapists, spaProducts, otherTypes] = await Promise.all([
    prisma.spaAppointment.findMany({ where: { status: 'BOOKED', startsAt: { gt: now } }, include: { treatment: true, client: { include: { profile: true } } }, orderBy: { startsAt: 'asc' } }),
    prisma.therapistAvailability.count(),
    prisma.spaTimeBlock.count({ where: { endsAt: { gt: now } } }),
    prisma.spaTreatment.count({ where: { active: true } }),
    prisma.spaRoom.count({ where: { active: true } }),
    prisma.staffProfile.count({ where: { isTherapist: true } }),
    prisma.membershipProduct.findMany({ where: { active: true, spaItems: { some: {} } }, select: { id: true, name: true } }),
    prisma.classType.findMany({ where: { active: true, NOT: { format: 'REFORMER' } }, select: { id: true, name: true, format: true } }),
  ]);
  const otherTemplates = otherTypes.length
    ? await prisma.classScheduleTemplate.findMany({ where: { active: true, classTypeId: { in: otherTypes.map((t) => t.id) } }, select: { id: true } })
    : [];

  console.log(APPLY ? 'Applying:' : 'Preview — nothing is changed without --apply:');
  console.log(`  SPA appointments to cancel:  ${appts.length}`);
  for (const a of appts) {
    const who = a.client.profile ? `${a.client.profile.firstName} ${a.client.profile.lastName}`.trim() : a.client.email;
    console.log(`    ${formatStudio(a.startsAt, 'd LLL HH:mm')}  ${a.treatment.name}  — ${who}`);
  }
  console.log(`  therapist weekly hours:      ${hours} row(s) deleted`);
  console.log(`  upcoming SPA time blocks:    ${blocks} deleted`);
  console.log(`  treatments / rooms off:      ${treatments} / ${rooms}`);
  console.log(`  staff no longer therapists:  ${therapists}`);
  console.log(`  packages with SPA, off sale: ${spaProducts.length}${spaProducts.length ? ` (${spaProducts.map((p) => p.name).join(', ')})` : ''}`);
  console.log(`  non-Reformer class types:    ${otherTypes.length}${otherTypes.length ? ` (${otherTypes.map((t) => `${t.name} [${t.format}]`).join(', ')})` : ''}, ${otherTemplates.length} weekly slot(s) stopped`);

  if (!APPLY) {
    console.log('\nRun again with --apply to do it.');
    return;
  }

  let cancelled = 0;
  for (const a of appts) {
    await cancelSpa(a.id, { id: admin.id, role: 'ADMIN' }, { restoreEntitlement: true });
    cancelled++;
  }
  await prisma.$transaction([
    prisma.therapistAvailability.deleteMany({}),
    prisma.spaTimeBlock.deleteMany({ where: { endsAt: { gt: now } } }),
    prisma.spaTreatment.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.spaRoom.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.staffProfile.updateMany({ where: { isTherapist: true }, data: { isTherapist: false } }),
    prisma.membershipProduct.updateMany({ where: { id: { in: spaProducts.map((p) => p.id) } }, data: { active: false } }),
    prisma.classType.updateMany({ where: { id: { in: otherTypes.map((t) => t.id) } }, data: { active: false } }),
    prisma.classScheduleTemplate.updateMany({ where: { id: { in: otherTemplates.map((t) => t.id) } }, data: { active: false } }),
  ]);
  const removed = otherTemplates.length
    ? await prisma.classSession.deleteMany({
        where: { templateId: { in: otherTemplates.map((t) => t.id) }, startsAt: { gt: now }, detached: false, bookings: { none: {} }, waitlist: { none: {} } },
      })
    : { count: 0 };
  const keptBooked = otherTypes.length
    ? await prisma.classSession.count({ where: { classTypeId: { in: otherTypes.map((t) => t.id) }, startsAt: { gt: now }, status: 'SCHEDULED' } })
    : 0;
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'studio.reformer_only',
      entityType: 'studio_settings',
      entityId: '1',
      data: { cancelledSpa: cancelled, spaProductsOff: spaProducts.length, classTypesOff: otherTypes.length, removedSessions: removed.count },
    },
  });

  console.log(`\nDone: ${cancelled} SPA appointment(s) cancelled and their clients told; ${removed.count} unbooked non-Reformer class(es) removed.`);
  if (keptBooked) console.log(`${keptBooked} booked non-Reformer class(es) were kept — cancel them from the admin calendar if they should not happen.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
