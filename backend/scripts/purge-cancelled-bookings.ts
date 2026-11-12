/**
 * Remove cancelled bookings that were a desk mistake, with every trace they left,
 * as if they had never been made. The client, her packages and her balance stay.
 *
 *   PURGE_PHONE=+355697758985 PURGE_AT="2026-11-12 17:00" npx tsx scripts/purge-cancelled-bookings.ts            preview
 *   PURGE_PHONE=+355697758985 PURGE_AT="2026-11-12 17:00" npx tsx scripts/purge-cancelled-bookings.ts --apply    do it
 *
 * Only CANCELLED bookings of that client in the class starting at PURGE_AT
 * (studio time). Removed with them: the audit entries naming them, their
 * credit movements (only when they net to zero — the session went back to the
 * package — so no balance changes), their unpaid single-class order, the
 * notifications about them, and (by cascade) their manage links and attendance.
 * Stops without changing anything if a booking has a payment or its credits do
 * not net to zero.
 */
import { prisma } from '../src/lib/prisma.js';
import { formatStudio, TZ } from '../src/lib/time.js';
import { DateTime } from 'luxon';

const APPLY = process.argv.includes('--apply');

async function main() {
  const phone = process.env.PURGE_PHONE;
  const at = process.env.PURGE_AT;
  if (!phone || !at) throw new Error('Set PURGE_PHONE and PURGE_AT ("yyyy-MM-dd HH:mm", studio time).');
  const startsAt = DateTime.fromFormat(at, 'yyyy-MM-dd HH:mm', { zone: TZ });
  if (!startsAt.isValid) throw new Error(`PURGE_AT is not "yyyy-MM-dd HH:mm": ${at}`);

  const session = await prisma.classSession.findFirst({ where: { startsAt: startsAt.toJSDate() }, include: { classType: true } });
  if (!session) throw new Error(`No class starts at ${at}`);
  const users = await prisma.user.findMany({ where: { profile: { phone } }, include: { profile: true } });
  if (users.length !== 1) throw new Error(`Expected one person with phone ${phone}, found ${users.length}`);
  const user = users[0];

  const bookings = await prisma.classBooking.findMany({
    where: { sessionId: session.id, userId: user.id, status: 'CANCELLED' },
    include: { order: { include: { payments: true } } },
    orderBy: { bookedAt: 'asc' },
  });
  const ids = bookings.map((b) => b.id);
  console.log(APPLY ? 'Applying:' : 'Preview — nothing is changed without --apply:');
  console.log(`  class: ${session.classType.name} ${formatStudio(session.startsAt, 'EEE d LLL HH:mm')}`);
  console.log(`  client: ${user.profile?.firstName} ${user.profile?.lastName} ${phone} (kept, with her packages)`);
  console.log(`  cancelled bookings: ${bookings.length}`);
  for (const b of bookings) console.log(`    ${b.id} booked ${formatStudio(b.bookedAt, 'd LLL HH:mm')} cancelled ${b.cancelledAt ? formatStudio(b.cancelledAt, 'd LLL HH:mm') : '?'} source=${b.source} credits=${b.creditsUsed} refunded=${b.creditRefunded}${b.order ? ` order=${b.order.reference} ${b.order.status} payments=${b.order.payments.length}` : ''}`);
  if (!ids.length) return;

  const paid = bookings.filter((b) => b.order && b.order.payments.length);
  if (paid.length) throw new Error(`Stopped: ${paid.length} booking(s) have a payment on their order. Nothing changed.`);

  const credits = await prisma.creditTransaction.findMany({ where: { bookingId: { in: ids } }, orderBy: { createdAt: 'asc' } });
  for (const id of ids) {
    const net = credits.filter((c) => c.bookingId === id).reduce((n, c) => n + c.delta, 0);
    if (net !== 0) throw new Error(`Stopped: credits for booking ${id} net to ${net}, not 0 — removing them would change her balance. Nothing changed.`);
  }
  console.log(`  credit movements (net 0): ${credits.length}${credits.length ? ` — ${credits.map((c) => `${c.type} ${c.delta > 0 ? '+' : ''}${c.delta}`).join(', ')}` : ''}`);

  const like = ids.map((id) => `%${id}%`);
  const audits = await prisma.$queryRaw<{ id: string; action: string; created_at: Date }[]>`
    select id, action, created_at from audit_logs
     where entity_id = any(${ids}::text[]) or data::text like any(${like}::text[])
     order by created_at`;
  console.log(`  audit entries: ${audits.length}${audits.length ? ` — ${audits.map((a) => `${a.action} ${formatStudio(a.created_at, 'd LLL HH:mm')}`).join(', ')}` : ''}`);

  const notes = await prisma.$queryRaw<{ id: string; type: string; channel: string }[]>`
    select id, type, channel::text from notifications where data::text like any(${like}::text[])`;
  console.log(`  notifications about them: ${notes.length}${notes.length ? ` — ${notes.map((n) => `${n.type}/${n.channel}`).join(', ')}` : ''}`);

  const orders = bookings.filter((b) => b.order).map((b) => b.order!.id);
  console.log(`  unpaid orders: ${orders.length}`);

  if (!APPLY) return;
  await prisma.$transaction(async (tx) => {
    if (audits.length) await tx.auditLog.deleteMany({ where: { id: { in: audits.map((a) => a.id) } } });
    if (notes.length) await tx.notification.deleteMany({ where: { id: { in: notes.map((n) => n.id) } } });
    if (credits.length) await tx.creditTransaction.deleteMany({ where: { id: { in: credits.map((c) => c.id) } } });
    if (orders.length) await tx.order.deleteMany({ where: { id: { in: orders } } });
    await tx.classBooking.deleteMany({ where: { id: { in: ids }, status: 'CANCELLED' } });
  });
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
