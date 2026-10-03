#!/usr/bin/env node
/* The demo studio: four instructors, a month of timetable, clients
   part-way through their memberships, classes filling up.

   The catalogue it stands on — the admin code, the class types, the plans —
   lives in scripts/data.sql and must already be in the database. This file
   only adds people and the week around them.

   Every account it creates shares one password, from SEED_PASSWORD. Never
   give it a database that real people sign in to. Pass --fresh to wipe
   first. */
import { pool, q, tx } from '../../api/_lib/db.js';
import { hashPassword } from '../../api/_lib/auth.js';
import { iso, addDays, startOfWeek, DAY_KEYS } from '../../shared/domain.js';

const PASSWORD = process.env.SEED_PASSWORD || 'demo1234';
const FRESH = process.argv.includes('--fresh');

const today = new Date(); today.setHours(0, 0, 0, 0);
const monday = startOfWeek(today);
const day = n => iso(addDays(monday, n));

const band = (from, to) => ({ from, to });
const INSTRUCTORS = [
  ['Elira Hoxha', 'elira@dua-pilates.com', '069 710 4073', ['reformer'],
    { mon: [band('09:00','20:00')], tue: [band('09:00','20:00')], wed: [band('12:00','18:00')],
      thu: [band('09:00','20:00')], fri: [band('09:00','17:00')] }],
  ['Ana Leka', 'ana@dua-pilates.com', '069 710 4074', ['reformer'],
    { mon: [band('13:00','19:00')], tue: [band('13:00','19:00')], wed: [band('08:00','19:00')],
      thu: [band('13:00','19:00')], fri: [band('13:00','19:00')], sat: [band('09:00','14:00')] }],
  ['Era Meta', 'era@dua-pilates.com', '069 710 4075', ['reformer'],
    { mon: [band('11:00','15:00')], tue: [band('11:00','15:00')], wed: [band('11:00','15:00')],
      thu: [band('11:00','15:00')], fri: [band('11:00','15:00')], sun: [band('10:00','14:00')] }],
  ['Jona Rexha', 'jona@dua-pilates.com', '069 710 4076', ['spa'],
    { mon: [band('10:00','18:00')], tue: [band('10:00','18:00')], wed: [band('10:00','18:00')],
      thu: [band('10:00','18:00')], fri: [band('10:00','18:00')] }]
];

/* weekday offset from Monday, type, start, end, capacity, instructor index */
const TIMETABLE = [
  [0, 'reformer', '09:00', '10:00', 10, 0],
  [0, 'reformer', '11:00', '12:00', 10, 2],
  [0, 'reformer', '16:00', '17:00', 10, 0],
  [0, 'reformer', '18:00', '19:00', 10, 1],
  [1, 'reformer', '09:00', '10:00', 10, 0],
  [1, 'reformer', '12:00', '13:00', 10, 2],
  [1, 'reformer', '18:00', '19:00', 10, 1],
  [2, 'reformer', '09:00', '10:00', 10, 1],
  [2, 'reformer', '13:00', '14:00', 10, 2],
  [2, 'reformer', '17:00', '18:00', 10, 0],
  [3, 'reformer', '09:00', '10:00', 10, 0],
  [3, 'reformer', '12:00', '13:00', 10, 2],
  [3, 'reformer', '18:00', '19:00', 10, 1],
  [4, 'reformer', '09:00', '10:00', 10, 0],
  [4, 'reformer', '11:00', '12:00', 10, 2],
  [4, 'reformer', '16:00', '17:00', 10, 0],
  [5, 'reformer', '10:00', '11:00', 10, 1],
  [5, 'reformer', '11:30', '12:30', 10, 1],
  [6, 'reformer', '11:00', '12:00', 10, 2]
];

const NAMED = [
  ['Sara Berberi', 'sara@example.com', 'signature'],
  ['Enkelejda Gjoka', 'enke@example.com', 'essential'],
  ['Kejsi Dervishi', 'kejsi@example.com', 'unlimited'],
  ['Ana Përmeti', 'anap@example.com', null]          // membership already expired
];
const FILLER = ['Arta','Blerta','Denisa','Elona','Fjolla','Greta','Ilda','Jorida','Klea','Lira',
                'Megi','Nora','Olta','Pranvera','Rea','Silva','Teuta','Vera','Xhesi','Ylli'];

async function main() {
  const pw = await hashPassword(PASSWORD);

  await tx(async c => {
    if (FRESH) {
      await c.query(`truncate bookings, memberships, notices, auth_tokens,
                              instructor_availability, instructor_qualifications,
                              classes, plan_allowances, plans, class_types, users, settings
                     restart identity cascade`);
      console.log('wiped existing data');
    }

    const mkUser = async (role, name, email, phone) => {
      const r = await c.query(
        `insert into users (role, name, email, phone, password_hash) values ($1,$2,$3,$4,$5)
         on conflict (lower(email)) do update set name = excluded.name returning id`,
        [role, name, email, phone, pw]);
      return r.rows[0].id;
    };

    await mkUser('admin', 'Studio Admin', 'admin@dua-pilates.com', '069 710 4072');

    const instrIds = [];
    for (const [name, email, phone, quals, avail] of INSTRUCTORS) {
      const id = await mkUser('instructor', name, email, phone);
      instrIds.push(id);
      await c.query('delete from instructor_qualifications where instructor_id = $1', [id]);
      for (const t of quals)
        await c.query('insert into instructor_qualifications values ($1,$2)', [id, t]);
      await c.query('delete from instructor_availability where instructor_id = $1', [id]);
      for (const key of Object.keys(avail))
        for (const b of avail[key])
          await c.query(`insert into instructor_availability (instructor_id, weekday, starts, ends)
                         values ($1,$2,$3,$4)`, [id, DAY_KEYS.indexOf(key), b.from, b.to]);
    }

    /* Four weeks of timetable: last week for history, three ahead. */
    const classIds = [];
    for (let w = -1; w <= 2; w++)
      for (const [d, type, start, end, cap, who] of TIMETABLE) {
        const r = await c.query(
          `insert into classes (class_type_id, on_date, starts, ends, capacity, instructor_id)
           values ($1,$2,$3,$4,$5,$6) returning id, on_date, starts`,
          [type, day(d + w * 7), start, end, cap, instrIds[who]]);
        classIds.push(r.rows[0]);
      }
    for (const d of [1, 3])
      await c.query(`insert into classes (class_type_id, on_date, starts, ends, capacity, instructor_id)
                     values ('spa', $1, '15:00', '16:00', 1, $2)`, [day(d), instrIds[3]]);

    /* One class placed outside its instructor's hours — the drift the
       admin's attention list exists to catch. Ana finishes at 14:00. */
    await c.query(`insert into classes (class_type_id, on_date, starts, ends, capacity, instructor_id)
                   values ('reformer', $1, '16:00', '17:00', 10, $2)`, [day(12), instrIds[1]]);

    const clientIds = {};
    for (const [name, email, plan] of NAMED) {
      const id = await mkUser('client', name, email, '069 200 ' + (1000 + Object.keys(clientIds).length));
      clientIds[email] = id;
      if (plan)
        await c.query(`insert into memberships (client_id, plan_id, starts_on, ends_on, status)
                       values ($1,$2,$3,$4,'active')`,
                      [id, plan, iso(addDays(today, -12)), iso(addDays(today, 18))]);
      else
        await c.query(`insert into memberships (client_id, plan_id, starts_on, ends_on, status)
                       values ($1,'essential',$2,$3,'cancelled')`,
                      [id, iso(addDays(today, -45)), iso(addDays(today, -15))]);
    }

    const fillerIds = [];
    for (let i = 0; i < FILLER.length; i++) {
      const id = await mkUser('client', FILLER[i] + ' D.', 'client' + (i + 1) + '@example.com', '069 300 ' + (1000 + i));
      fillerIds.push(id);
      await c.query(`insert into memberships (client_id, plan_id, starts_on, ends_on, status)
                     values ($1,$2,$3,$4,'active')`,
                    [id, i % 3 === 0 ? 'unlimited' : i % 3 === 1 ? 'signature' : 'essential',
                     iso(addDays(today, -10)), iso(addDays(today, 20))]);
    }

    /* Demand that looks like a real week, and one evening already full. */
    const t = iso(today);
    let filled = 0;
    for (const k of classIds) {
      const future = k.on_date >= t;
      const want = future ? (filled * 7) % 9 : (filled % 4);
      for (let i = 0; i < want && i < fillerIds.length; i++)
        await c.query(`insert into bookings (class_id, client_id, status) values ($1,$2,'booked')
                       on conflict do nothing`, [k.id, fillerIds[i]]);
      filled++;
    }
    const hot = classIds.find(k => k.on_date === t && String(k.starts).startsWith('18:'));
    if (hot) for (const id of fillerIds.slice(0, 10))
      await c.query(`insert into bookings (class_id, client_id, status) values ($1,$2,'booked')
                     on conflict do nothing`, [hot.id, id]);

    /* A little history for the named clients. */
    const past = classIds.filter(k => k.on_date < t);
    for (let i = 0; i < past.length; i += 3)
      await c.query(`insert into bookings (class_id, client_id, status) values ($1,$2,'booked')
                     on conflict do nothing`, [past[i].id, clientIds['sara@example.com']]);
  });

  const n = async t => (await q('select count(*)::int as n from ' + t)).rows[0].n;
  console.log('demo studio:',
    await n('users'), 'users ·', await n('classes'), 'classes ·',
    await n('memberships'), 'memberships ·', await n('bookings'), 'bookings');
  console.log('Every demo account signs in with: ' + PASSWORD);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
