import { prisma } from '../lib/prisma.js';
import { TZ } from '../lib/time.js';

/** Every number here is a query over real rows — nothing is estimated or sampled. */
export async function analytics(from: Date, to: Date) {
  const periodMs = +to - +from;
  const prevFrom = new Date(+from - periodMs);

  const [
    revenueByDay,
    revenueTotal,
    salesByProduct,
    occupancy,
    popularTimes,
    popularInstructors,
    spaVolume,
    popularTreatments,
    bookingOutcomes,
    newClients,
    activeNow,
    activePrev,
    creditUsage,
  ] = await Promise.all([
    prisma.$queryRaw<{ day: string; amount: number }[]>`
      select to_char(date_trunc('day', completed_at at time zone ${TZ}), 'YYYY-MM-DD') as day, sum(amount)::int as amount
      from payments where status in ('COMPLETED','REFUNDED') and completed_at >= ${from} and completed_at < ${to}
      group by 1 order by 1`,
    prisma.$queryRaw<{ gross: number; refunds: number }[]>`
      select coalesce((select sum(amount) from payments where status in ('COMPLETED','REFUNDED') and completed_at >= ${from} and completed_at < ${to}),0)::int as gross,
             coalesce((select sum(amount) from refunds where created_at >= ${from} and created_at < ${to}),0)::int as refunds`,
    prisma.$queryRaw<{ name: string; count: number; revenue: number }[]>`
      select p.name_snapshot as name, count(*)::int as count, sum(o.total)::int as revenue
      from membership_purchases p join orders o on o.id = p.order_id
      where o.status = 'PAID' and o.updated_at >= ${from} and o.updated_at < ${to}
      group by 1 order by 2 desc`,
    prisma.$queryRaw<{ sessions: number; capacity: number; booked: number }[]>`
      select count(*)::int as sessions, coalesce(sum(s.capacity),0)::int as capacity,
             coalesce(sum((select count(*) from class_bookings b where b.session_id = s.id and b.status = 'BOOKED')),0)::int as booked
      from class_sessions s where s.status <> 'CANCELLED' and s.starts_at >= ${from} and s.starts_at < ${to}`,
    prisma.$queryRaw<{ weekday: number; hour: number; booked: number }[]>`
      select extract(isodow from s.starts_at at time zone ${TZ})::int as weekday,
             extract(hour from s.starts_at at time zone ${TZ})::int as hour, count(b.id)::int as booked
      from class_sessions s join class_bookings b on b.session_id = s.id and b.status = 'BOOKED'
      where s.starts_at >= ${from} and s.starts_at < ${to}
      group by 1,2 order by 3 desc limit 10`,
    prisma.$queryRaw<{ name: string; booked: number; sessions: number }[]>`
      select trim(coalesce(up.first_name,'') || ' ' || coalesce(up.last_name,'')) as name,
             count(b.id)::int as booked, count(distinct s.id)::int as sessions
      from class_sessions s join user_profiles up on up.user_id = s.instructor_id
      left join class_bookings b on b.session_id = s.id and b.status = 'BOOKED'
      where s.starts_at >= ${from} and s.starts_at < ${to} and s.status <> 'CANCELLED'
      group by 1 order by 2 desc limit 10`,
    prisma.$queryRaw<{ status: string; count: number }[]>`
      select status::text, count(*)::int as count from spa_appointments where starts_at >= ${from} and starts_at < ${to} group by 1`,
    prisma.$queryRaw<{ name: string; count: number; revenue: number }[]>`
      select t.name, count(*)::int as count, sum(case when a.paid_with = 'PAY_AT_STUDIO' then a.price else 0 end)::int as revenue
      from spa_appointments a join spa_treatments t on t.id = a.treatment_id
      where a.starts_at >= ${from} and a.starts_at < ${to} and a.status <> 'CANCELLED'
      group by 1 order by 2 desc limit 10`,
    prisma.$queryRaw<{ status: string; count: number }[]>`
      select b.status::text, count(*)::int as count from class_bookings b join class_sessions s on s.id = b.session_id
      where s.starts_at >= ${from} and s.starts_at < ${to} group by 1`,
    prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: from, lt: to } } }),
    prisma.$queryRaw<{ id: string }[]>`
      select distinct b.user_id as id from class_bookings b join class_sessions s on s.id = b.session_id
      where b.status = 'BOOKED' and s.starts_at >= ${from} and s.starts_at < ${to}`,
    prisma.$queryRaw<{ id: string }[]>`
      select distinct b.user_id as id from class_bookings b join class_sessions s on s.id = b.session_id
      where b.status = 'BOOKED' and s.starts_at >= ${prevFrom} and s.starts_at < ${from}`,
    prisma.$queryRaw<{ type: string; credits: number }[]>`
      select type::text, sum(delta)::int as credits from credit_transactions where created_at >= ${from} and created_at < ${to} group by 1`,
  ]);

  // Money, kept apart: what was booked, what came in, what is still owed. Only payments are revenue;
  // a class taken from a prepaid package adds nothing (the package was counted when it was paid).
  const [singles, collectedBy, owed] = await Promise.all([
    prisma.$queryRaw<{ booked_value: number; count: number }[]>`
      select coalesce(sum(o.total),0)::int as booked_value, count(*)::int as count
      from orders o join class_bookings b on b.id = o.booking_id join class_sessions s on s.id = b.session_id
      where o.status in ('PENDING','PAID') and s.starts_at >= ${from} and s.starts_at < ${to}`,
    prisma.$queryRaw<{ kind: string; amount: number }[]>`
      select case when o.booking_id is not null then 'single' when mp.id is not null then 'membership' else 'other' end as kind, coalesce(sum(p.amount),0)::int as amount
      from payments p join orders o on o.id = p.order_id left join membership_purchases mp on mp.order_id = o.id
      where p.status in ('COMPLETED','REFUNDED') and p.completed_at >= ${from} and p.completed_at < ${to}
      group by 1`,
    prisma.$queryRaw<{ kind: string; amount: number; count: number }[]>`
      select case when booking_id is not null then 'single' else 'membership' end as kind, coalesce(sum(total),0)::int as amount, count(*)::int as count
      from orders where status = 'PENDING' group by 1`,
  ]);
  const collected = Object.fromEntries(collectedBy.map((r) => [r.kind, r.amount]));
  const outstanding = Object.fromEntries(owed.map((r) => [r.kind, { amount: r.amount, count: r.count }]));

  const outcomes = Object.fromEntries(bookingOutcomes.map((r) => [r.status, r.count]));
  const totalBookings = bookingOutcomes.reduce((s, r) => s + r.count, 0);
  const cancelled = (outcomes.CANCELLED ?? 0) + (outcomes.LATE_CANCELLED ?? 0);
  const prevSet = new Set(activePrev.map((r) => r.id));
  const returning = activeNow.filter((r) => prevSet.has(r.id)).length;
  const o = occupancy[0] ?? { sessions: 0, capacity: 0, booked: 0 };

  return {
    period: { from, to },
    revenue: { gross: revenueTotal[0].gross, refunds: revenueTotal[0].refunds, net: revenueTotal[0].gross - revenueTotal[0].refunds, byDay: revenueByDay },
    membershipSales: salesByProduct,
    money: {
      // Single classes held in the period (confirmed, paid or not), at the price agreed when booked.
      singleClassBookedValue: singles[0]?.booked_value ?? 0,
      singleClassBookings: singles[0]?.count ?? 0,
      collected: { single: collected.single ?? 0, membership: collected.membership ?? 0, other: collected.other ?? 0 },
      // Owed right now (not limited to the period): unpaid single classes and packages waiting for payment.
      outstanding: { single: outstanding.single ?? { amount: 0, count: 0 }, membership: outstanding.membership ?? { amount: 0, count: 0 } },
    },
    occupancy: { sessions: o.sessions, capacity: o.capacity, booked: o.booked, rate: o.capacity ? o.booked / o.capacity : 0 },
    popularTimes,
    popularInstructors,
    spa: { byStatus: spaVolume, popularTreatments },
    cancellations: {
      total: totalBookings,
      cancelled,
      late: outcomes.LATE_CANCELLED ?? 0,
      byStudio: outcomes.SESSION_CANCELLED ?? 0,
      rate: totalBookings ? cancelled / totalBookings : 0,
    },
    clients: {
      new: newClients,
      active: activeNow.length,
      returning,
      firstTimeInPeriod: activeNow.length - returning,
      retentionRate: prevSet.size ? returning / prevSet.size : null,
    },
    creditUsage: Object.fromEntries(creditUsage.map((r) => [r.type, r.credits])),
  };
}
