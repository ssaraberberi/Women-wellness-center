/* Turns rows into the plain object shared/rules.js expects, so the
   server reaches its verdicts with exactly the code the browser used
   to predict them. Loads a window rather than the whole history —
   the rules only ever look at the period around a class. */
import { many, one } from './db.js';
import { hhmm, todayIn, plusDays } from '../../shared/domain.js';
import { DEFAULTS } from '../../shared/rules.js';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* ---------- the studio's settings ---------- */
export async function settings() {
  const rows = await many(`select key, value from settings
    where key in ('opening_date','cancel_window_min','booking_horizon_days','default_capacity','show_prices')`);
  const v = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const int = (s, d) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : d; };
  return {
    openingDate: /^\d{4}-\d{2}-\d{2}$/.test(v.opening_date || '') ? v.opening_date : DEFAULTS.openingDate,
    cancelMinutes: int(v.cancel_window_min, DEFAULTS.cancelMinutes),
    horizonDays: int(v.booking_horizon_days, DEFAULTS.horizonDays),
    defaultCapacity: int(v.default_capacity, DEFAULTS.defaultCapacity),
    showPrices: v.show_prices === 'on'
  };
}

export async function classTypes() {
  return (await many('select id, name, short_name from class_types order by sort, name'))
    .map(r => ({ id: r.id, name: r.name, short: r.short_name }));
}

export async function plans(includeArchived) {
  const rows = await many(
    `select p.id, p.name, p.price_all, p.blurb, p.featured, p.sort, p.archived,
            p.kind, p.validity_days, p.bookable,
            p.tagline, p.rhythm, p.tagline_en, p.rhythm_en, p.blurb_en,
            a.class_type_ids, a.limit_count, a.period
       from plans p left join plan_allowances a on a.plan_id = p.id
      where ($1 or not p.archived)
      order by p.sort, p.id, a.sort`, [!!includeArchived]);
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.id)) byId.set(r.id, {
      id: r.id, name: r.name, price: r.price_all, blurb: r.blurb, featured: r.featured, sort: r.sort,
      archived: r.archived, kind: r.kind, validityDays: r.validity_days, bookable: r.bookable,
      tagline: r.tagline, rhythm: r.rhythm,
      en: { tagline: r.tagline_en, rhythm: r.rhythm_en, blurb: r.blurb_en },
      allowances: []
    });
    if (r.class_type_ids) byId.get(r.id).allowances.push({
      types: r.class_type_ids, limit: r.limit_count, per: r.period
    });
  }
  return [...byId.values()];
}

/* The credits a package gives, as the lines a customer package stores. */
export const linesOfPlan = p => p.allowances.map(a => ({ types: a.types, total: a.limit }));

const offerRow = r => ({
  id: r.id, title: r.title, description: r.description, kind: r.kind,
  price: r.price_all, original: r.original_all, discountPct: r.discount_pct,
  lines: r.lines || [], validityDays: r.validity_days,
  startsOn: r.starts_on, endsOn: r.ends_on, maxRedemptions: r.max_redemptions,
  newCustomersOnly: r.new_customers_only, eligiblePlans: r.eligible_plans || [],
  persons: r.persons, together: r.together,
  friendRequired: r.friend_required, friendNew: r.friend_new,
  bonusClasses: r.bonus_classes, bonusTo: r.bonus_to, bonusWhen: r.bonus_when,
  eligibility: r.eligibility, active: r.active, archived: r.archived, sort: r.sort,
  en: { description: r.description_en || null, eligibility: r.eligibility_en || null },
  claimed: r.claimed == null ? 0 : Number(r.claimed)
});

export async function offers(includeArchived) {
  return (await many(
    `select o.*, (select count(*) from offer_claims c
                   where c.offer_id = o.id and c.status <> 'void' and c.role = 'buyer') as claimed
       from offers o where ($1 or not o.archived) order by o.sort, o.title`, [!!includeArchived])).map(offerRow);
}
export async function offer(id) {
  const r = await one(
    `select o.*, (select count(*) from offer_claims c
                   where c.offer_id = o.id and c.status <> 'void' and c.role = 'buyer') as claimed
       from offers o where o.id = $1`, [id]);
  return r ? offerRow(r) : null;
}

/* Live means: switched on, not archived, inside its dates, and not used up. */
export function offerIsLive(o, today) {
  if (!o || !o.active || o.archived) return false;
  if (o.startsOn && today < o.startsOn) return false;
  if (o.endsOn && today > o.endsOn) return false;
  if (o.maxRedemptions != null && o.claimed >= o.maxRedemptions) return false;
  return true;
}

export async function instructors() {
  const rows = await many(
    `select u.id, u.name, u.email, u.phone, u.active, coalesce(u.job, 'instructor') as job,
            coalesce(array_agg(distinct q.class_type_id) filter (where q.class_type_id is not null), '{}') as quals
       from users u
       left join instructor_qualifications q on q.instructor_id = u.id
      where u.role = 'instructor'
      group by u.id order by u.name`);
  const bands = await many('select instructor_id, weekday, starts, ends from instructor_availability order by weekday, starts');
  const byWho = new Map();
  for (const b of bands) {
    const key = DAY_KEYS[b.weekday];
    const a = byWho.get(b.instructor_id) || byWho.set(b.instructor_id, {}).get(b.instructor_id);
    (a[key] = a[key] || []).push({ from: hhmm(b.starts), to: hhmm(b.ends) });
  }
  return rows.map(r => ({
    id: r.id, name: r.name, email: r.email, phone: r.phone, active: r.active, job: r.job,
    qualifications: r.quals, availability: byWho.get(r.id) || {}
  }));
}

export const classRow = r => ({
  id: r.id, typeId: r.class_type_id, date: r.on_date,
  start: hhmm(r.starts), end: hhmm(r.ends), capacity: r.capacity,
  instructorId: r.instructor_id, cancelled: r.cancelled, cancelReason: r.cancel_reason || null,
  blocked: r.blocked || 0, pinned: !!r.pinned, slotId: r.slot_id == null ? null : Number(r.slot_id)
});

export async function classesBetween(from, to) {
  return (await many(
    `select id, class_type_id, on_date, starts, ends, capacity, instructor_id, cancelled, cancel_reason,
            blocked, pinned, slot_id
       from classes where on_date between $1 and $2 order by on_date, starts`, [from, to])).map(classRow);
}

export async function classesByIds(ids) {
  if (!ids.length) return [];
  return (await many(
    `select id, class_type_id, on_date, starts, ends, capacity, instructor_id, cancelled, cancel_reason,
            blocked, pinned, slot_id from classes where id = any($1)`, [ids])).map(classRow);
}

const bookingRow = r => ({
  id: r.id, classId: r.class_id, clientId: r.client_id, status: r.status, at: r.created_at,
  membershipId: r.membership_id, reservationId: r.reservation_id, attendance: r.attendance || null
});
const BOOKING_COLS = 'id, class_id, client_id, status, created_at, membership_id, reservation_id, attendance';

export async function bookingsForClasses(ids, clientId) {
  if (!ids.length) return [];
  const rows = clientId
    ? await many(`select ${BOOKING_COLS} from bookings
                   where class_id = any($1) and (status in ('booked','waitlist') or client_id = $2)`, [ids, clientId])
    : await many(`select ${BOOKING_COLS} from bookings where class_id = any($1)`, [ids]);
  return rows.map(bookingRow);
}

/* Every booking that spends a credit from these packages, whatever its date:
   a balance has to count the whole life of a package, not a window. */
export async function bookingsForMemberships(ids) {
  if (!ids.length) return [];
  return (await many(`select ${BOOKING_COLS} from bookings where membership_id = any($1)`, [ids])).map(bookingRow);
}

export const membershipRow = r => ({
  id: r.id, clientId: r.client_id, planId: r.plan_id, offerId: r.offer_id, reservationId: r.reservation_id,
  title: r.title, lines: r.lines || [], start: r.starts_on, end: r.ends_on, status: r.status
});

export async function membershipsFor(clientId) {
  const rows = clientId
    ? await many('select * from memberships where client_id = $1 order by created_at desc', [clientId])
    : await many('select * from memberships order by created_at desc');
  return rows.map(membershipRow);
}

export async function creditEvents(membershipIds) {
  if (membershipIds && !membershipIds.length) return [];
  const rows = membershipIds
    ? await many('select id, membership_id, line, delta, reason, at from credit_events where membership_id = any($1) order by at', [membershipIds])
    : await many('select id, membership_id, line, delta, reason, at from credit_events order by at');
  return rows.map(r => ({ id: r.id, membershipId: r.membership_id, line: r.line, delta: r.delta, reason: r.reason, at: r.at }));
}

export async function templates() {
  const ts = await many('select id, effective_from from schedule_templates order by effective_from');
  const slots = await many(`select id, template_id, weekday, starts, ends, capacity, class_type_id, instructor_id
                              from template_slots order by weekday, starts`);
  return ts.map(t => ({
    id: Number(t.id), effectiveFrom: t.effective_from,
    slots: slots.filter(s => String(s.template_id) === String(t.id)).map(s => ({
      id: Number(s.id), weekday: s.weekday, start: hhmm(s.starts), end: hhmm(s.ends),
      capacity: s.capacity, typeId: s.class_type_id, instructorId: s.instructor_id
    }))
  }));
}

export async function closures(fromDate) {
  return (await many('select on_date, reason from closures where on_date >= $1 order by on_date', [fromDate]))
    .map(r => ({ date: r.on_date, reason: r.reason }));
}

/* Bookings and credit events for everything the given packages touch,
   with the classes those bookings are in folded into the class list. */
async function withPackages(memberships, classes) {
  const ids = memberships.map(m => m.id);
  const [pkgBookings, events] = await Promise.all([bookingsForMemberships(ids), creditEvents(ids)]);
  const have = new Set(classes.map(c => c.id));
  const extra = await classesByIds([...new Set(pkgBookings.map(b => b.classId))].filter(id => !have.has(id)));
  return { pkgBookings, events, classes: classes.concat(extra) };
}
const mergeBookings = (a, b) => { const seen = new Map(a.map(x => [x.id, x])); b.forEach(x => seen.set(x.id, x)); return [...seen.values()]; };

/* The working set for one client's decisions. */
export async function clientState(clientId, now) {
  const today = todayIn(now);
  const st = await settings();
  const from = plusDays(today, -45);
  const to = plusDays(today > st.openingDate ? today : st.openingDate, st.horizonDays + 1);
  const [types, pl, ins, memberships, cls] = await Promise.all([
    classTypes(), plans(), instructors(), membershipsFor(clientId), classesBetween(from, to)
  ]);
  const { pkgBookings, events, classes } = await withPackages(memberships, cls);
  const bookings = mergeBookings(await bookingsForClasses(classes.map(c => c.id), clientId), pkgBookings);
  return { settings: st, classTypes: types, plans: pl, instructors: ins, classes, bookings, memberships, creditEvents: events };
}

/* Everything the admin screens read. Same shape, wider window. */
export async function adminState(now) {
  const today = todayIn(now);
  const st = await settings();
  const to = plusDays(today > st.openingDate ? today : st.openingDate, Math.max(st.horizonDays, 60) + 1);
  const [cls, types, pl, ins, memberships, offs, tpl, closed] = await Promise.all([
    classesBetween(plusDays(today, -35), to), classTypes(), plans(), instructors(), membershipsFor(null),
    offers(true), templates(), closures(plusDays(today, -7))
  ]);
  const { pkgBookings, events, classes } = await withPackages(memberships.filter(m => m.status === 'active'), cls);
  const bookings = mergeBookings(await bookingsForClasses(classes.map(c => c.id), null), pkgBookings);
  const clients = await many(
    `select id, name, email, phone, created_at from users where role='client' and active order by name`);
  return {
    settings: st, classTypes: types, plans: pl, instructors: ins, classes, bookings, memberships, clients,
    creditEvents: events, offers: offs, templates: tpl, closures: closed
  };
}

export const classById = async id => (await classesByIds([id]))[0] || null;
