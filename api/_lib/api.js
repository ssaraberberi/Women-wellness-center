/* ============================================================
   DUA — the API
   Every verdict comes from shared/rules.js. The browser calls the
   same functions to keep the interface responsive, but nothing it
   says is trusted: each write re-reaches the decision here.
   ============================================================ */
import { q, one, many, tx } from './db.js';
import { hashPassword, verifyPassword, issueToken, revokeToken, adminCode } from './auth.js';
import * as load from './load.js';
import * as rules from '../../shared/rules.js';
import { iso, addDays, periodRange, hhmm } from '../../shared/domain.js';

const bad = (status, message, code) => { const e = new Error(message); e.status = status; e.code = code; throw e; };
const need = (u, ...roles) => { if (!u) bad(401, 'Sign in first'); if (!roles.includes(u.role)) bad(403, 'Not allowed'); };
const trim = v => typeof v === 'string' ? v.trim() : v;
const slug = v => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function requireFields(body, fields) {
  for (const f of fields) if (!trim(body[f])) bad(400, 'Missing ' + f);
}

const notify = (client, userId, text, tone) =>
  client.query('insert into notices (user_id, text, tone) values ($1,$2,$3)', [userId, text, tone || 'info']);

/* ---------- auth ---------- */

export async function register(body) {
  requireFields(body, ['name', 'email', 'phone', 'password']);
  if (String(body.password).length < 8) bad(400, 'Password must be at least 8 characters');
  const wantsAdmin = !!body.code;
  if (wantsAdmin) {
    const code = await adminCode();
    if (!code || body.code !== code) bad(403, 'That admin code is not valid', 'code');
  }
  const taken = await one('select 1 from users where lower(email) = lower($1)', [body.email]);
  if (taken) bad(409, 'That email already has an account', 'email');

  const hash = await hashPassword(body.password);
  const user = await one(
    `insert into users (role, name, email, phone, password_hash) values ($1,$2,$3,$4,$5)
     returning id, role, name, email, phone`,
    [wantsAdmin ? 'admin' : 'client', trim(body.name), trim(body.email), trim(body.phone), hash]);
  return { user, ...(await issueToken(user.id)) };
}

export async function login(body) {
  requireFields(body, ['email', 'password']);
  const row = await one(
    'select id, role, name, email, phone, password_hash, active from users where lower(email) = lower($1)',
    [body.email]);
  /* Same message either way: whether an email has an account is not
     something an unauthenticated caller gets to probe for. */
  if (!row || !(await verifyPassword(body.password, row.password_hash))) bad(401, 'Email or password is wrong');
  if (!row.active) bad(403, 'This account has been removed');
  const { password_hash, active, ...user } = row;
  return { user, ...(await issueToken(row.id)) };
}

export const logout = token => revokeToken(token);

/* ---------- shared reads ---------- */

/* The catalogue everyone reads, priced or not. While the switch is off the
   figures are not merely hidden in the interface — they are left out of the
   answer, so a client reading the response sees what the page shows. The
   studio's own side always has them; it cannot price a package blind. */
export async function bootstrap(user) {
  const [classTypes, plans, { showPrices }] = await Promise.all([
    load.classTypes(), load.plans(), publicSettings()
  ]);
  const priced = showPrices || (user && user.role === 'admin');
  return {
    classTypes,
    plans: priced ? plans : plans.map(({ price, ...rest }) => ({ ...rest, price: null }))
  };
}

export async function notices(user) {
  need(user, 'admin', 'instructor', 'client');
  return many('select id, text, tone, read, created_at from notices where user_id=$1 order by created_at desc limit 20', [user.id]);
}
export async function readNotices(user) {
  need(user, 'admin', 'instructor', 'client');
  await q('update notices set read = true where user_id = $1', [user.id]);
  return { ok: true };
}

/* ---------- client ---------- */

export async function clientState(user) {
  need(user, 'client');
  const now = new Date();
  const [state, { showPrices }] = await Promise.all([load.clientState(user.id, now), publicSettings()]);
  return {
    ...state,
    /* This answer carries the catalogue as well as the client's own things,
       so it has to hold the prices back on the same terms as /bootstrap —
       otherwise the figures come back by the side door. */
    plans: showPrices ? state.plans : state.plans.map(({ price, ...rest }) => ({ ...rest, price: null })),
    instructors: state.instructors.map(i => ({ id: i.id, name: i.name })),   // clients need the name, nothing else
    balances: rules.balances(state, user.id, now),
    membership: rules.membershipOf(state, user.id)
  };
}

export async function book(user, body) {
  need(user, 'client');
  const now = new Date();
  const state = await load.clientState(user.id, now);
  const klass = state.classes.find(c => c.id === body.classId);
  const verdict = rules.canBook(state, user.id, klass, now);
  if (!verdict.ok) bad(409, verdict.message, verdict.code);

  return tx(async c => {
    /* Lock the class so two people cannot take the same last place. */
    await c.query('select id from classes where id = $1 for update', [klass.id]);
    const taken = await c.query(
      `select count(*)::int as n from bookings where class_id=$1 and status='booked'`, [klass.id]);
    if (taken.rows[0].n >= klass.capacity) bad(409, 'Class is full', 'full');

    /* Re-count the allowance under the lock: two tabs, one seat left. */
    const m = rules.membershipOf(state, user.id);
    const a = rules.allowanceFor(state, m.planId, klass.typeId);
    if (a.limit != null) {
      const [from, to] = periodRange(a.per, new Date(klass.date + 'T00:00:00'));
      const used = await c.query(
        `select count(*)::int as n from bookings b join classes k on k.id = b.class_id
          where b.client_id=$1 and b.status in ('booked','late') and not k.cancelled
            and k.class_type_id = any($2) and k.on_date between $3 and $4`,
        [user.id, a.types, from, to]);
      if (used.rows[0].n >= a.limit) bad(409, 'No classes left this ' + a.per, 'no-sessions');
    }

    try {
      await c.query(`insert into bookings (class_id, client_id, status) values ($1,$2,'booked')`, [klass.id, user.id]);
    } catch (e) {
      if (e.code === '23505') bad(409, 'Already booked', 'already');   // the partial unique index
      throw e;
    }
    return { ok: true };
  });
}

export async function joinWaitlist(user, body) {
  need(user, 'client');
  try {
    await q(`insert into bookings (class_id, client_id, status) values ($1,$2,'waitlist')`, [body.classId, user.id]);
  } catch (e) {
    if (e.code === '23505') bad(409, 'Already on this class', 'already');
    throw e;
  }
  return { ok: true };
}

export async function cancelBooking(user, body) {
  need(user, 'client');
  const now = new Date();
  return tx(async c => {
    const b = (await c.query(
      `select b.id, b.class_id, b.status, k.on_date, k.starts
         from bookings b join classes k on k.id = b.class_id
        where b.id = $1 and b.client_id = $2 for update of b`, [body.bookingId, user.id])).rows[0];
    if (!b) bad(404, 'Booking not found');
    if (b.status !== 'booked' && b.status !== 'waitlist') bad(409, 'That booking is not active');

    const klass = { date: b.on_date, start: hhmm(b.starts) };
    const verdict = rules.canCancel(klass, now);
    const status = b.status === 'waitlist' ? 'cancelled' : verdict.late ? 'late' : 'cancelled';
    await c.query('update bookings set status=$1 where id=$2', [status, b.id]);

    /* A seat given up in time goes to whoever is first in line. */
    if (status === 'cancelled' && b.status === 'booked') {
      const next = (await c.query(
        `select id, client_id from bookings where class_id=$1 and status='waitlist'
          order by created_at limit 1 for update skip locked`, [b.class_id])).rows[0];
      if (next) {
        await c.query(`update bookings set status='booked' where id=$1`, [next.id]);
        await notify(c, next.client_id,
          'A place opened in the ' + hhmm(b.starts) + ' class on ' + b.on_date + ' — you are in.', 'good');
      }
    }
    return { ok: true, late: verdict.late };
  });
}

/* Asking for a package, not buying one. Money changes hands at the studio,
   and the studio turns the request active when it has. Until then this row
   grants nothing: every rule reads 'active', so a request books no class. */
export async function requestMembership(user, body) {
  need(user, 'client');
  const plan = await one('select id, name from plans where id=$1 and not archived', [body.planId]);
  if (!plan) bad(404, 'No such package');
  const now = new Date();
  return tx(async c => {
    const open = await c.query(
      `select p.name from memberships m join plans p on p.id = m.plan_id
        where m.client_id = $1 and m.status = 'requested'`, [user.id]);
    if (open.rowCount) bad(409, 'You have already asked for ' + open.rows[0].name +
      '. The studio will confirm it once you have paid.', 'pending');

    /* The dates are provisional: the thirty days are counted from the day it
       is confirmed, not from the day it was asked for. */
    const m = await c.query(
      `insert into memberships (client_id, plan_id, starts_on, ends_on, status)
       values ($1,$2,$3,$4,'requested') returning id`,
      [user.id, plan.id, iso(now), iso(addDays(now, 30))]);

    const admins = await c.query(`select id from users where role='admin' and active`);
    for (const a of admins.rows)
      await notify(c, a.id, user.name + ' asked for ' + plan.name + ' — confirm it once she has paid', 'info');

    return { ok: true, id: m.rows[0].id };
  });
}

/* The studio's half of it: the client paid at the desk, so make it real.
   The thirty days start now, and whatever she held before is replaced. */
export async function confirmMembership(user, id) {
  need(user, 'admin');
  const now = new Date();
  return tx(async c => {
    const req = await c.query(
      `select m.id, m.client_id, p.name from memberships m join plans p on p.id = m.plan_id
        where m.id = $1 and m.status = 'requested' for update`, [id]);
    if (!req.rowCount) bad(404, 'That request is not waiting any more');
    const { client_id, name } = req.rows[0];

    await c.query(`update memberships set status='replaced'
                    where client_id=$1 and status='active'`, [client_id]);
    await c.query(`update memberships set status='active', starts_on=$2, ends_on=$3 where id=$1`,
                  [id, iso(now), iso(addDays(now, 30))]);
    await notify(c, client_id, name + ' is active — thirty days from today. Your calendar is open.', 'good');
    return { ok: true };
  });
}

export async function declineMembership(user, id) {
  need(user, 'admin');
  return tx(async c => {
    const req = await c.query(
      `select m.client_id, p.name from memberships m join plans p on p.id = m.plan_id
        where m.id = $1 and m.status = 'requested' for update`, [id]);
    if (!req.rowCount) bad(404, 'That request is not waiting any more');
    await c.query(`update memberships set status='cancelled' where id=$1`, [id]);
    await notify(c, req.rows[0].client_id,
      req.rows[0].name + ' was not confirmed. Ask at the studio and we will sort it out.', 'warn');
    return { ok: true };
  });
}

/* ---------- instructor ---------- */

export async function instructorState(user) {
  need(user, 'instructor');
  const now = new Date();
  const from = iso(addDays(now, -14)), to = iso(addDays(now, 60));
  const classes = (await load.classesBetween(from, to)).filter(c => c.instructorId === user.id);
  const me = (await load.instructors()).find(i => i.id === user.id);
  const bookings = await load.bookingsForClasses(classes.map(c => c.id), null);
  return { classTypes: await load.classTypes(), classes, bookings, me };
}

export async function setQualifications(user, body) {
  need(user, 'instructor');
  const types = Array.isArray(body.types) ? body.types : [];
  return tx(async c => {
    await c.query('delete from instructor_qualifications where instructor_id=$1', [user.id]);
    for (const t of types)
      await c.query('insert into instructor_qualifications values ($1,$2) on conflict do nothing', [user.id, t]);
    return { ok: true };
  });
}

export async function setAvailability(user, body) {
  need(user, 'instructor');
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const avail = body.availability || {};
  return tx(async c => {
    await c.query('delete from instructor_availability where instructor_id=$1', [user.id]);
    for (const key of Object.keys(avail)) {
      const day = DAY_KEYS.indexOf(key);
      if (day < 0) continue;
      for (const b of avail[key] || []) {
        if (!b || !b.from || !b.to || b.from >= b.to) continue;
        await c.query(`insert into instructor_availability (instructor_id, weekday, starts, ends)
                       values ($1,$2,$3,$4)`, [user.id, day, b.from, b.to]);
      }
    }
    return { ok: true };
  });
}

/* ---------- admin ---------- */

export async function adminState(user) {
  need(user, 'admin');
  const now = new Date();
  const state = await load.adminState(now);
  const { showPrices } = await publicSettings();
  return { ...state, issues: rules.issues(state, now), showPrices };
}

export async function roster(user, classId) {
  need(user, 'admin');
  return many(
    `select b.id, b.status, u.name, u.email
       from bookings b join users u on u.id = b.client_id
      where b.class_id = $1 and b.status in ('booked','waitlist')
      order by case b.status when 'booked' then 0 else 1 end, b.created_at`, [classId]);
}

/* ---------- what the public site is allowed to know ---------- */

/* The only endpoint that answers without a session. It says one thing, and
   says it in the safe direction: anything other than 'on' is off, so a
   missing row, a typo or an unreachable database all keep the prices in. */
export async function publicSettings() {
  const row = await one(`select value from settings where key = 'show_prices'`);
  return { showPrices: !!row && row.value === 'on' };
}

export async function setSettings(user, body) {
  need(user, 'admin');
  if (typeof body.showPrices !== 'boolean') bad(400, 'showPrices is true or false');
  await q(`insert into settings (key, value) values ('show_prices', $1)
           on conflict (key) do update set value = excluded.value`,
          [body.showPrices ? 'on' : 'off']);
  return { showPrices: body.showPrices };
}

/* ---------- packages ---------- */

/* One call saves a plan and the whole of what it allows. The allowances are
   replaced rather than patched: the form shows every row, so what comes back
   is the complete answer, and a row the studio deleted has to disappear. */
export async function savePlan(user, body) {
  need(user, 'admin');
  requireFields(body, ['name']);

  const price = Number(body.price);
  if (!Number.isInteger(price) || price < 0) bad(400, 'Price must be a whole number of lek', 'price');

  const allowances = Array.isArray(body.allowances) ? body.allowances : [];
  if (!allowances.length) bad(400, 'A package has to allow something', 'allowances');

  const types = (await many('select id from class_types')).map(r => r.id);
  for (const a of allowances) {
    if (!Array.isArray(a.types) || !a.types.length) bad(400, 'Every line needs at least one class type', 'allowances');
    for (const t of a.types) if (!types.includes(t)) bad(400, 'No such class type: ' + t, 'allowances');
    if (!['week', 'month'].includes(a.per)) bad(400, 'A line counts per week or per month', 'allowances');
    if (a.limit !== null && a.limit !== undefined && a.limit !== '') {
      const n = Number(a.limit);
      if (!Number.isInteger(n) || n < 1) bad(400, 'A limit is a whole number of classes, or blank for no limit', 'allowances');
    }
  }

  /* An id the studio never sees: made from the name the first time, kept
     afterwards, so a rename cannot orphan the memberships pointing at it. */
  const id = trim(body.id) || slug(body.name);
  if (!id) bad(400, 'That name has no letters or digits in it', 'name');

  return tx(async c => {
    if (!trim(body.id)) {
      const clash = await c.query('select 1 from plans where id = $1', [id]);
      if (clash.rowCount) bad(409, 'A package with that name already exists', 'name');
    }
    await c.query(
      `insert into plans (id, name, price_all, blurb, featured, sort, archived)
       values ($1,$2,$3,$4,$5,$6,false)
       on conflict (id) do update set name = excluded.name, price_all = excluded.price_all,
         blurb = excluded.blurb, featured = excluded.featured, sort = excluded.sort,
         archived = false`,
      [id, trim(body.name), price, trim(body.blurb) || null, !!body.featured, Number(body.sort) || 0]);

    /* Only one package can be the one we point at. */
    if (body.featured) await c.query('update plans set featured = false where id <> $1', [id]);

    await c.query('delete from plan_allowances where plan_id = $1', [id]);
    let n = 0;
    for (const a of allowances)
      await c.query(
        `insert into plan_allowances (plan_id, class_type_ids, limit_count, period, sort)
         values ($1,$2,$3,$4,$5)`,
        [id, a.types, a.limit === '' || a.limit === null || a.limit === undefined ? null : Number(a.limit), a.per, n++]);

    return { id };
  });
}

/* Archived, never deleted: a membership someone already bought points at it,
   and the history has to keep saying what they bought. */
export async function archivePlan(user, id) {
  need(user, 'admin');
  const plan = await one('select id, name from plans where id = $1 and not archived', [id]);
  if (!plan) bad(404, 'No such package');
  const live = await one(
    `select count(*)::int as n from memberships
      where plan_id = $1 and status = 'active' and ends_on >= current_date`, [id]);
  await q('update plans set archived = true, featured = false where id = $1', [id]);
  return { ok: true, stillOn: live.n };
}

export async function addInstructor(user, body) {
  need(user, 'admin');
  requireFields(body, ['name', 'email', 'phone', 'password']);
  const taken = await one('select 1 from users where lower(email)=lower($1)', [body.email]);
  if (taken) bad(409, 'That email already has an account');
  const hash = await hashPassword(body.password);
  return tx(async c => {
    const id = (await c.query(
      `insert into users (role, name, email, phone, password_hash) values ('instructor',$1,$2,$3,$4) returning id`,
      [trim(body.name), trim(body.email), trim(body.phone), hash])).rows[0].id;
    for (const t of body.qualifications || [])
      await c.query('insert into instructor_qualifications values ($1,$2) on conflict do nothing', [id, t]);
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const avail = body.availability || {};
    for (const key of Object.keys(avail))
      for (const b of avail[key] || [])
        await c.query(`insert into instructor_availability (instructor_id, weekday, starts, ends) values ($1,$2,$3,$4)`,
                      [id, DAY_KEYS.indexOf(key), b.from, b.to]);
    return { ok: true, id };
  });
}

/* Removing an instructor ends their access now and leaves their future
   classes visibly unassigned rather than quietly wrong. */
export async function removeInstructor(user, id) {
  need(user, 'admin');
  return tx(async c => {
    const who = (await c.query(`update users set active=false where id=$1 and role='instructor' returning name`, [id])).rows[0];
    if (!who) bad(404, 'No such instructor');
    await c.query('delete from auth_tokens where user_id=$1', [id]);
    const orphaned = (await c.query(
      `update classes set instructor_id = null
        where instructor_id = $1 and on_date >= current_date and not cancelled
        returning id, on_date, starts`, [id])).rows;
    for (const k of orphaned) {
      const rows = (await c.query(`select client_id from bookings where class_id=$1 and status='booked'`, [k.id])).rows;
      for (const r of rows)
        await notify(c, r.client_id,
          'Your ' + k.on_date + ' ' + hhmm(k.starts) + ' class needs a new instructor. Your place is safe.', 'warn');
    }
    return { ok: true, orphaned: orphaned.length };
  });
}

export async function saveClass(user, body) {
  need(user, 'admin');
  requireFields(body, ['typeId', 'date', 'start', 'end', 'capacity']);
  if (body.start >= body.end) bad(400, 'The class must end after it starts');
  const now = new Date();
  const state = await load.adminState(now);
  const draft = {
    id: body.id || 'new', typeId: body.typeId, date: body.date,
    start: body.start, end: body.end, capacity: Number(body.capacity),
    instructorId: body.instructorId || null, cancelled: false
  };
  if (draft.instructorId) {
    const i = state.instructors.find(x => x.id === draft.instructorId);
    const fit = rules.instructorFit(state, i, draft);
    if (fit.status !== 'recommended') bad(409, (i ? i.name : 'That instructor') + ' — ' + fit.why.toLowerCase(), fit.status);
  }

  return tx(async c => {
    if (body.id) {
      const before = (await c.query('select * from classes where id=$1 for update', [body.id])).rows[0];
      if (!before) bad(404, 'No such class');
      const booked = (await c.query(`select count(*)::int n from bookings where class_id=$1 and status='booked'`, [body.id])).rows[0].n;
      if (draft.capacity < booked) bad(409, booked + ' people are already booked; capacity cannot go below that', 'capacity');

      await c.query(`update classes set class_type_id=$1, on_date=$2, starts=$3, ends=$4, capacity=$5, instructor_id=$6
                     where id=$7`,
        [draft.typeId, draft.date, draft.start, draft.end, draft.capacity, draft.instructorId, body.id]);

      const moved = before.on_date !== draft.date || hhmm(before.starts) !== draft.start || hhmm(before.ends) !== draft.end;
      const swapped = before.instructor_id !== draft.instructorId;
      if (moved || swapped) {
        const rows = (await c.query(`select client_id from bookings where class_id=$1 and status='booked'`, [body.id])).rows;
        const who = draft.instructorId
          ? (await c.query('select name from users where id=$1', [draft.instructorId])).rows[0] : null;
        for (const r of rows) {
          if (moved) await notify(c, r.client_id,
            'Your class moved to ' + draft.date + ', ' + draft.start + '–' + draft.end + '.', 'warn');
          if (swapped) await notify(c, r.client_id,
            'Your ' + draft.start + ' class will now be taught by ' + (who ? who.name : 'another instructor') + '.', 'info');
        }
      }
      return { ok: true, id: body.id };
    }
    const id = (await c.query(
      `insert into classes (class_type_id, on_date, starts, ends, capacity, instructor_id)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [draft.typeId, draft.date, draft.start, draft.end, draft.capacity, draft.instructorId])).rows[0].id;
    return { ok: true, id };
  });
}

export async function assignInstructor(user, classId, body) {
  need(user, 'admin');
  const now = new Date();
  const state = await load.adminState(now);
  const klass = state.classes.find(c => c.id === classId);
  if (!klass) bad(404, 'No such class');
  if (body.instructorId) {
    const i = state.instructors.find(x => x.id === body.instructorId);
    const fit = rules.instructorFit(state, i, klass);
    if (fit.status !== 'recommended') bad(409, (i ? i.name : 'That instructor') + ' — ' + fit.why.toLowerCase(), fit.status);
  }
  return saveClass(user, {
    id: classId, typeId: klass.typeId, date: klass.date, start: klass.start,
    end: klass.end, capacity: klass.capacity, instructorId: body.instructorId || null
  });
}

/* The studio cancelling is not the client's doing: places are released,
   not spent. */
export async function cancelClass(user, classId) {
  need(user, 'admin');
  return tx(async c => {
    const k = (await c.query('update classes set cancelled=true where id=$1 returning on_date, starts', [classId])).rows[0];
    if (!k) bad(404, 'No such class');
    const rows = (await c.query(
      `update bookings set status='released' where class_id=$1 and status in ('booked','waitlist') returning client_id`,
      [classId])).rows;
    for (const r of rows)
      await notify(c, r.client_id,
        'The ' + hhmm(k.starts) + ' class on ' + k.on_date + ' was cancelled. Your session has been returned.', 'warn');
    return { ok: true, affected: rows.length };
  });
}

export async function deleteClass(user, classId) {
  need(user, 'admin');
  await cancelClass(user, classId);
  await q('delete from classes where id=$1', [classId]);
  return { ok: true };
}

export async function updateMembership(user, id, body) {
  need(user, 'admin');
  const m = await one('select * from memberships where id=$1', [id]);
  if (!m) bad(404, 'No such membership');
  return tx(async c => {
    if (body.status === 'active' && m.status !== 'active')
      await c.query(`update memberships set status='replaced' where client_id=$1 and status='active' and id<>$2`,
                    [m.client_id, id]);
    await c.query('update memberships set plan_id=$1, ends_on=$2, status=$3 where id=$4',
                  [body.planId || m.plan_id, body.end || m.ends_on, body.status || m.status, id]);
    await notify(c, m.client_id, 'Your membership was updated by the studio.', 'info');
    return { ok: true };
  });
}
