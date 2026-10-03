/* Turns rows into the plain object shared/rules.js expects, so the
   server reaches its verdicts with exactly the code the browser used
   to predict them. Loads a window rather than the whole history —
   the rules only ever look at the period around a class. */
import { many, one } from './db.js';
import { iso, addDays, hhmm } from '../../shared/domain.js';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export async function classTypes() {
  return (await many('select id, name, short_name from class_types order by sort, name'))
    .map(r => ({ id: r.id, name: r.name, short: r.short_name }));
}

export async function plans() {
  const rows = await many(
    `select p.id, p.name, p.price_all, p.blurb, p.featured,
            a.class_type_ids, a.limit_count, a.period
       from plans p left join plan_allowances a on a.plan_id = p.id
      where not p.archived
      order by p.sort, p.id, a.sort`);
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.id)) byId.set(r.id, {
      id: r.id, name: r.name, price: r.price_all, blurb: r.blurb, featured: r.featured, allowances: []
    });
    if (r.class_type_ids) byId.get(r.id).allowances.push({
      types: r.class_type_ids, limit: r.limit_count, per: r.period
    });
  }
  return [...byId.values()];
}

export async function instructors() {
  const rows = await many(
    `select u.id, u.name, u.email, u.phone, u.active,
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
    id: r.id, name: r.name, email: r.email, phone: r.phone, active: r.active,
    qualifications: r.quals, availability: byWho.get(r.id) || {}
  }));
}

export async function classesBetween(from, to) {
  return (await many(
    `select id, class_type_id, on_date, starts, ends, capacity, instructor_id, cancelled
       from classes where on_date between $1 and $2 order by on_date, starts`, [from, to]))
    .map(r => ({
      id: r.id, typeId: r.class_type_id, date: r.on_date,
      start: hhmm(r.starts), end: hhmm(r.ends), capacity: r.capacity,
      instructorId: r.instructor_id, cancelled: r.cancelled
    }));
}

export async function bookingsForClasses(ids, clientId) {
  if (!ids.length) return [];
  const rows = clientId
    ? await many(`select id, class_id, client_id, status, created_at from bookings
                   where class_id = any($1) and (status in ('booked','waitlist') or client_id = $2)`, [ids, clientId])
    : await many(`select id, class_id, client_id, status, created_at from bookings where class_id = any($1)`, [ids]);
  return rows.map(r => ({ id: r.id, classId: r.class_id, clientId: r.client_id, status: r.status, at: r.created_at }));
}

export async function membershipsFor(clientId) {
  const rows = clientId
    ? await many('select * from memberships where client_id = $1 order by created_at desc', [clientId])
    : await many('select * from memberships order by created_at desc');
  return rows.map(r => ({
    id: r.id, clientId: r.client_id, planId: r.plan_id,
    start: r.starts_on, end: r.ends_on, status: r.status
  }));
}

/* The working set for one client's decisions: a window wide enough to
   cover the booking horizon and the month an allowance is counted over. */
export async function clientState(clientId, now) {
  const from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = iso(addDays(now, 40));
  const classes = await classesBetween(from, to);
  const [types, pl, ins, memberships] = await Promise.all([
    classTypes(), plans(), instructors(), membershipsFor(clientId)
  ]);
  const bookings = await bookingsForClasses(classes.map(c => c.id), clientId);
  return { classTypes: types, plans: pl, instructors: ins, classes, bookings, memberships };
}

/* Everything the admin screens read. Same shape, wider window. */
export async function adminState(now) {
  const from = iso(addDays(now, -35));
  const to = iso(addDays(now, 60));
  const classes = await classesBetween(from, to);
  const [types, pl, ins, memberships] = await Promise.all([
    classTypes(), plans(), instructors(), membershipsFor(null)
  ]);
  const bookings = await bookingsForClasses(classes.map(c => c.id), null);
  const clients = await many(
    `select id, name, email, phone, created_at from users where role='client' and active order by name`);
  return { classTypes: types, plans: pl, instructors: ins, classes, bookings, memberships, clients };
}

export const classById = async id => {
  const rows = await classesBetween('0001-01-01', '9999-12-31');   // small studio; index on id is not the cost here
  return rows.find(c => c.id === id) || null;
};
