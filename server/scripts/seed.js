#!/usr/bin/env node
/* The demo studio: four employees, a weekly template that writes the
   timetable, packages, the launch offers, and customers with reservations
   made through the same booking engine the website uses.

   Every account it creates shares one password, from SEED_PASSWORD. Never
   give it a database that real people sign in to. Pass --fresh to wipe
   first. It moves the opening date to a week ago, so the demo has classes
   to book today. */
import { pool, q, tx } from '../../api/_lib/db.js';
import { hashPassword } from '../../api/_lib/auth.js';
import { syncRange } from '../../api/_lib/schedule.js';
import { LAUNCH_OFFERS } from '../../api/_lib/catalogue.js';
import { createReservation, adminUpdateReservation, adminAttendance } from '../../api/_lib/booking.js';
import { todayIn, plusDays, DAY_KEYS, at } from '../../shared/domain.js';

const PASSWORD = process.env.SEED_PASSWORD || 'demo1234';
const FRESH = process.argv.includes('--fresh');
const today = todayIn(new Date());
const opening = plusDays(today, -7);

const band = (from, to) => ({ from, to });
/* name, email, phone, job, qualifications, availability */
const STAFF = [
  ['Elira Hoxha', 'elira@dua-pilates.com', '069 710 4073', 'instructor', ['reformer'],
    { mon: [band('07:00', '21:00')], tue: [band('07:00', '21:00')], wed: [band('07:00', '21:00')],
      thu: [band('07:00', '21:00')], fri: [band('07:00', '21:00')], sat: [band('07:00', '13:00')] }],
  ['Ana Leka', 'ana@dua-pilates.com', '069 710 4074', 'instructor', ['reformer'],
    { mon: [band('07:00', '21:00')], tue: [band('07:00', '21:00')], wed: [band('07:00', '21:00')],
      thu: [band('07:00', '21:00')], fri: [band('07:00', '21:00')], sat: [band('07:00', '21:00')] }],
  ['Era Meta', 'era@dua-pilates.com', '069 710 4075', 'instructor', ['reformer'],
    { mon: [band('16:00', '21:00')], wed: [band('16:00', '21:00')], fri: [band('16:00', '21:00')] }],
  ['Jona Rexha', 'jona@dua-pilates.com', '069 710 4076', 'therapist', ['spa'],
    { mon: [band('10:00', '18:00')], tue: [band('10:00', '18:00')], wed: [band('10:00', '18:00')],
      thu: [band('10:00', '18:00')], fri: [band('10:00', '18:00')] }]
];

/* The example week the studio described: Monday to Saturday, six classes. */
const TIMES = [['07:00', '08:00'], ['08:15', '09:15'], ['09:30', '10:30'], ['17:30', '18:30'], ['18:45', '19:45'], ['20:00', '21:00']];

/* id, name, kind, price, validity, featured, sort, [types, total][] */
const PLANS = [
  ['try-dua', 'TRY DUA', 'single', 1200, 30, false, 0, [[['reformer'], 1]]],
  ['single', 'SINGLE CLASS', 'single', 2200, 30, false, 1, [[['reformer'], 1]]],
  ['start', 'DUA START', 'membership', 7200, 30, false, 2, [[['reformer'], 4]]],
  ['routine', 'DUA ROUTINE', 'membership', 13200, 30, true, 3, [[['reformer'], 8]]],
  ['glow', 'DUA GLOW', 'membership', 18000, 30, false, 4, [[['reformer'], 12]]],
  ['obsessed', 'DUA OBSESSED', 'membership', 22400, 30, false, 5, [[['reformer'], 16]]],
  ['ten-pack', 'CLASS PACK 10', 'package', 19000, 60, false, 6, [[['reformer'], 10]]],
  ['relax-pack', 'RELAX PACK', 'package', 10800, 60, false, 7, [[['spa'], 3]]]
];

async function main() {
  const pw = await hashPassword(PASSWORD);
  const staffIds = [];
  let adminId;

  await tx(async c => {
    if (FRESH) {
      await c.query(`truncate credit_events, offer_claims, bookings, memberships, reservations, notices, auth_tokens, auth_codes,
                              instructor_availability, instructor_qualifications, classes, template_slots, schedule_templates,
                              closures, plan_allowances, plans, offers, class_types, rate_events, users, settings
                     restart identity cascade`);
      console.log('wiped existing data');
    }
    await c.query(`insert into class_types (id, name, short_name, sort) values
                     ('reformer', 'Reformer Pilates', 'Reformer', 1), ('spa', 'Spa', 'Spa', 2)
                   on conflict (id) do nothing`);
    await c.query(LAUNCH_OFFERS);
    for (const [k, v] of [['show_prices', 'on'], ['opening_date', opening], ['cancel_window_min', '30'],
                          ['booking_horizon_days', '35'], ['default_capacity', '5']])
      await c.query(`insert into settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value`, [k, v]);

    for (const [id, name, kind, price, validity, featured, sort, lines] of PLANS) {
      const made = await c.query(
        `insert into plans (id, name, kind, price_all, validity_days, featured, sort) values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do nothing returning id`, [id, name, kind, price, validity, featured, sort]);
      if (!made.rowCount) continue;
      let n = 0;
      for (const [types, total] of lines)
        await c.query(`insert into plan_allowances (plan_id, class_type_ids, limit_count, period, sort) values ($1,$2,$3,'month',$4)`,
          [id, types, total, n++]);
    }

    const mkUser = async (role, name, email, phone, job) => (await c.query(
      `insert into users (role, job, name, email, phone, phone_key, password_hash) values ($1,$2,$3,$4,$5,
         nullif(regexp_replace(regexp_replace(regexp_replace(regexp_replace($5, '\\D', '', 'g'), '^00', ''), '^355', ''), '^0', ''), ''), $6)
       on conflict (lower(email)) do update set name = excluded.name, job = excluded.job returning id`,
      [role, job || null, name, email, phone, pw])).rows[0].id;

    adminId = await mkUser('admin', 'Studio Admin', 'admin@dua-pilates.com', '069 710 4072');
    for (const [name, email, phone, job, quals, avail] of STAFF) {
      const id = await mkUser('instructor', name, email, phone, job);
      staffIds.push(id);
      await c.query('delete from instructor_qualifications where instructor_id = $1', [id]);
      for (const t of quals) await c.query('insert into instructor_qualifications values ($1,$2)', [id, t]);
      await c.query('delete from instructor_availability where instructor_id = $1', [id]);
      for (const key of Object.keys(avail))
        for (const b of avail[key])
          await c.query(`insert into instructor_availability (instructor_id, weekday, starts, ends) values ($1,$2,$3,$4)`,
            [id, DAY_KEYS.indexOf(key), b.from, b.to]);
    }

    /* The weekly template, from the opening date. */
    const t = (await c.query(`insert into schedule_templates (effective_from) values ($1)
                              on conflict (effective_from) do update set effective_from = excluded.effective_from returning id`, [opening])).rows[0];
    await c.query('delete from template_slots where template_id = $1', [t.id]);
    for (let wd = 1; wd <= 6; wd++)
      for (let i = 0; i < TIMES.length; i++) {
        const who = i >= 3 && (wd === 1 || wd === 3 || wd === 5) ? staffIds[2] : staffIds[(i + wd) % 2];
        await c.query(`insert into template_slots (template_id, weekday, starts, ends, capacity, class_type_id, instructor_id)
                       values ($1,$2,$3,$4,5,'reformer',$5)`, [t.id, wd, TIMES[i][0], TIMES[i][1], wd === 6 ? staffIds[1] : who]);
      }
    for (const wd of [2, 4])
      await c.query(`insert into template_slots (template_id, weekday, starts, ends, capacity, class_type_id, instructor_id)
                     values ($1,$2,'15:00','16:00',1,'spa',$3)`, [t.id, wd, staffIds[3]]);
    await syncRange(c, opening, plusDays(today, 90));
    await c.query(`insert into settings (key, value) values ('schedule_synced_on', $1)
                   on conflict (key) do update set value = excluded.value`, [today]);
  });

  /* Reservations, made the way the studio makes them at the desk. */
  const admin = { id: adminId, role: 'admin' };
  const upcoming = (await q(
    `select id, on_date, starts from classes where class_type_id = 'reformer' and not cancelled and on_date >= $1
      order by on_date, starts`, [today])).rows.filter(k => at(k.on_date, String(k.starts)) > new Date());
  const past = (await q(`select id from classes where class_type_id = 'reformer' and on_date between $1 and $2 order by on_date, starts`,
    [opening, plusDays(today, -1)])).rows;
  const pick = (from, n, step) => Array.from({ length: n }, (_, i) => upcoming[from + i * (step || 3)]).filter(Boolean).map(k => k.id);

  const make = async (people, planId, offerId, classIds, extra) => {
    try {
      const r = await createReservation({ people, planId, offerId, classIds, status: 'confirmed', start: opening, ...(extra || {}) }, {}, admin);
      return r.reservation;
    } catch (e) { console.log('  skipped a demo reservation: ' + e.message); return null; }
  };
  const p = (name, phone, email) => ({ name, phone, email });

  const sara = await make([p('Sara Berberi', '069 200 1000', 'sara@example.com')], 'routine', null, pick(0, 3, 4));
  await make([p('Enkelejda Gjoka', '069 200 1001', 'enke@example.com')], 'start', null, pick(1, 2, 5));
  await make([p('Kejsi Dervishi', '069 200 1002', 'kejsi@example.com')], 'obsessed', null, pick(2, 4, 3));
  await make([p('Ana Përmeti', '069 200 1003', 'anap@example.com')], 'glow', 'founding-girls', pick(5, 2, 6), { status: 'pending' });
  await make([p('Arta Dema', '069 300 1000'), p('Blerta Dema', '069 300 1001')], null, 'dua-duo', pick(3, 3, 7));
  await make([p('Denisa Kola', '069 300 1002')], 'routine', 'bring-a-bestie', pick(6, 1, 1),
    { friend: p('Elona Kola', '069 300 1003'), status: 'pending' });
  const fill = ['Fjolla', 'Greta', 'Ilda', 'Jorida', 'Klea', 'Lira', 'Megi', 'Nora'];
  for (let i = 0; i < fill.length; i++)
    await make([p(fill[i] + ' D.', '069 400 ' + (1000 + i))], i % 2 ? 'start' : 'routine', null, pick(i, 2, 2));

  /* Reserving needs no password, so these clients have none. The demo
     gives the ones with an email the demo password, to sign in to the app. */
  await q(`update users set password_hash = $1 where role = 'client' and email is not null and password_hash = 'nologin'`, [pw]);

  /* One of them came last week; one has paid. */
  if (sara && past[0]) {
    const pkg = sara.people[0].membershipId;
    await q(`insert into bookings (class_id, client_id, status, membership_id, reservation_id, attendance)
             select $1, client_id, 'booked', id, reservation_id, 'attended' from memberships where id = $2
             on conflict do nothing`, [past[0].id, pkg]);
    await adminUpdateReservation(admin, sara.id, { payment: 'paid' });
  }

  const n = async t => (await q('select count(*)::int as n from ' + t)).rows[0].n;
  console.log('demo studio:', await n('users'), 'users ·', await n('classes'), 'classes ·',
    await n('reservations'), 'reservations ·', await n('bookings'), 'bookings');
  console.log('Opening date set to ' + opening + ' so the demo has classes to book today.');
  console.log('Every demo account signs in with: ' + PASSWORD);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
