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

export const bootstrap = async () => ({
  classTypes: await load.classTypes(),
  plans: await load.plans()
});

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
  const state = await load.clientState(user.id, now);
  return {
    ...state,
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

export async function purchaseMembership(user, body) {
  need(user, 'client');
  const plan = await one('select id from plans where id=$1 and not archived', [body.planId]);
  if (!plan) bad(404, 'No such membership');
  const now = new Date();
  return tx(async c => {
    await c.query(`update memberships set status='replaced' where client_id=$1 and status='active'`, [user.id]);
    await c.query(`insert into memberships (client_id, plan_id, starts_on, ends_on, status)
                   values ($1,$2,$3,$4,'active')`, [user.id, plan.id, iso(now), iso(addDays(now, 30))]);
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
  return { ...state, issues: rules.issues(state, now) };
}

export async function roster(user, classId) {
  need(user, 'admin');
  return many(
    `select b.id, b.status, u.name, u.email
       from bookings b join users u on u.id = b.client_id
      where b.class_id = $1 and b.status in ('booked','waitlist')
      order by case b.status when 'booked' then 0 else 1 end, b.created_at`, [classId]);
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
