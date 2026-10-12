#!/usr/bin/env node
/* ============================================================
   The booking rules, tested against a real Postgres.

     DATABASE_URL=postgres://…/dua_test npm run test:booking

   It wipes and rebuilds the database it is given, so it refuses to run
   unless the database name contains "test". Every case goes through the
   same functions the website and the admin call — the locks, the
   credits, the offers — rather than through a copy of their logic.
   ============================================================ */
import { pool, q, one, tx } from '../../api/_lib/db.js';
import * as booking from '../../api/_lib/booking.js';
import * as schedule from '../../api/_lib/schedule.js';
import { LAUNCH_OFFERS } from '../../api/_lib/catalogue.js';
import { canCancel, cancelDeadline } from '../../shared/rules.js';
import { todayIn, plusDays, weekdayOf, at, clockIn } from '../../shared/domain.js';

const url = process.env.DATABASE_URL || '';
if (!/test/i.test(url.split('/').pop() || '')) {
  console.error('Refusing to run: the database name must contain "test". This wipes it.');
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};
const refuses = async (fn, code, label) => {
  try { await fn(); ok(false, label, 'was allowed'); }
  catch (e) { ok(!code || e.code === code, label, e.code + ': ' + e.message); }
};
const section = s => console.log('\n' + s);

const today = todayIn(new Date());
const admin = { id: null, role: 'admin' };
const person = (n, extra) => ({ name: 'Client ' + n, phone: '069 5' + String(n).padStart(6, '0'), ...(extra || {}) });
let phoneN = 1;
const fresh = () => person(phoneN++);

/* A class on a date, outside any template. */
async function makeClass(date, start, end, capacity) {
  return (await one(`insert into classes (class_type_id, on_date, starts, ends, capacity, pinned)
                     values ('reformer',$1,$2,$3,$4,true) returning id`, [date, start, end, capacity || 5])).id;
}
const taken = async id => (await one(`select count(*)::int as n from bookings where class_id = $1 and status = 'booked'`, [id])).n;
const reserve = (body, actor) => booking.createReservation(body, {}, actor || null);

async function reset() {
  await q(`truncate credit_events, offer_claims, bookings, memberships, reservations, notices, auth_tokens,
                    classes, template_slots, schedule_templates, closures, plan_allowances, plans, offers,
                    rate_events, users restart identity cascade`);
  await q(`insert into class_types (id, name, short_name, sort) values ('reformer','Reformer Pilates','Reformer',1), ('spa','Spa','Spa',2)
           on conflict (id) do nothing`);
  for (const [k, v] of [['opening_date', today], ['cancel_window_min', '30'], ['booking_horizon_days', '60'],
                        ['show_prices', 'on'], ['schedule_synced_on', today]])
    await q(`insert into settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value`, [k, v]);
  for (const [id, name, kind, price, total] of [['single', 'SINGLE', 'single', 2000, 1], ['start', 'DUA START', 'membership', 10000, 4],
                                                 ['routine', 'DUA ROUTINE', 'membership', 13200, 8]]) {
    await q(`insert into plans (id, name, kind, price_all, validity_days) values ($1,$2,$3,$4,30)`, [id, name, kind, price]);
    await q(`insert into plan_allowances (plan_id, class_type_ids, limit_count, period) values ($1,'{reformer}',$2,'month')`, [id, total]);
  }
  await q(LAUNCH_OFFERS);
  admin.id = (await one(`insert into users (role, name, email, password_hash) values ('admin','Admin','a@test.dua','x') returning id`)).id;
}

async function main() {
  await reset();
  const d1 = plusDays(today, 3), d2 = plusDays(today, 4), d3 = plusDays(today, 5);

  section('Capacity and simultaneous bookings');
  {
    const k = await makeClass(d1, '07:00', '08:00', 5);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => reserve({ planId: 'single', people: [fresh()], classIds: [k] })));
    const won = results.filter(r => r.status === 'fulfilled').length;
    ok(won === 5, 'eight people at once for five reformers: exactly five get in', won);
    ok(await taken(k) === 5, 'and the class holds five, not more', await taken(k));
    ok(results.filter(r => r.status === 'rejected').every(r => r.reason.code === 'full'), 'the other three are told it is full');
  }
  {
    const k = await makeClass(d1, '08:15', '09:15', 5);
    await q('update classes set blocked = 2 where id = $1', [k]);
    for (let i = 0; i < 3; i++) await reserve({ planId: 'single', people: [fresh()], classIds: [k] });
    await refuses(() => reserve({ planId: 'single', people: [fresh()], classIds: [k] }), 'full', 'blocked places count: 3 booked + 2 blocked is full');
  }

  section('Double booking');
  {
    const k = await makeClass(d1, '09:30', '10:30', 5);
    const me = fresh();
    await reserve({ planId: 'start', people: [me], classIds: [k] });
    await refuses(() => reserve({ planId: 'start', people: [me], classIds: [k] }), 'already', 'the same person cannot reserve the same class twice');
  }

  section('DUA DUO — two people, two places');
  {
    const k = await makeClass(d2, '07:00', '08:00', 5);
    for (let i = 0; i < 4; i++) await reserve({ planId: 'single', people: [fresh()], classIds: [k] });
    await refuses(() => reserve({ offerId: 'dua-duo', people: [fresh(), fresh()], classIds: [k] }), 'full', 'a Duo cannot take the last single place');
    const k2 = await makeClass(d2, '08:15', '09:15', 5);
    for (let i = 0; i < 3; i++) await reserve({ planId: 'single', people: [fresh()], classIds: [k2] });
    const duo = await reserve({ offerId: 'dua-duo', people: [fresh(), fresh()], classIds: [k2] });
    ok(await taken(k2) === 5, 'a Duo takes two places: 3 + 2 = 5', await taken(k2));
    ok(duo.reservation.totalPrice === 24000 && duo.reservation.unitPrice === 12000, 'priced 12,000 each, 24,000 together', duo.reservation.totalPrice);
    ok(duo.reservation.people.length === 2 && duo.reservation.people.every(p => p.total === 8), 'two packages of 8 classes, one each');
    await refuses(() => reserve({ offerId: 'dua-duo', people: [person(900), person(900)], classIds: [] }), null, 'the two people need different phones');
  }

  section('Credits');
  {
    const ks = [];
    for (let i = 0; i < 6; i++) ks.push(await makeClass(d3, String(7 + i).padStart(2, '0') + ':00', String(7 + i).padStart(2, '0') + ':50', 5));
    await refuses(() => reserve({ planId: 'start', people: [fresh()], classIds: ks.slice(0, 5) }), 'credits', 'four credits cannot book five classes');
    const r = await reserve({ planId: 'start', people: [fresh()], classIds: ks.slice(0, 3) });
    ok(r.reservation.people[0].left === 1 && r.reservation.people[0].reserved === 3, 'three reserved, one left to schedule later', r.reservation.people[0]);
    const v = await booking.publicBookMore({ token: r.token, classIds: [ks[3]] }, {});
    ok(v.people[0].left === 0, 'booked the last one later from her link');
    await refuses(() => booking.publicBookMore({ token: r.token, classIds: [ks[4]] }, {}), 'credits', 'and cannot book a fifth');
    const one0 = v.bookings[0];
    const after = await booking.publicCancel({ token: r.token, bookingId: one0.id });
    ok(after.people[0].left === 1, 'cancelling in time gives the credit back');
    const m = r.reservation.people[0].membershipId;
    await booking.adminCredits(admin, m, { line: 0, delta: 2, reason: 'test' });
    const v2 = await booking.publicReservation({ token: r.token });
    ok(v2.people[0].left === 3 && v2.people[0].total === 6, 'two classes added by hand: 6 in total, 3 left', v2.people[0]);
  }

  section('The opening date');
  {
    await q(`update settings set value = $1 where key = 'opening_date'`, [plusDays(today, 10)]);
    const early = await makeClass(plusDays(today, 9), '07:00', '08:00', 5);
    await refuses(() => reserve({ planId: 'single', people: [fresh()], classIds: [early] }), 'before-opening', 'nothing can be booked before the studio opens');
    const first = await makeClass(plusDays(today, 10), '07:00', '08:00', 5);
    const r = await reserve({ planId: 'routine', people: [fresh()], classIds: [first] });
    ok(r.reservation.people[0].start === plusDays(today, 10), 'a package bought early starts on the opening day', r.reservation.people[0].start);
    await q(`update settings set value = $1 where key = 'opening_date'`, [today]);
  }

  section('The 30-minute rule');
  {
    const k = { date: d1, start: '09:00' };
    const deadline = cancelDeadline(k, { settings: { cancelMinutes: 30 } });
    ok(clockIn(deadline) === '08:30', 'the deadline for a 09:00 class is 08:30 in Tirana', clockIn(deadline));
    ok(canCancel(k, new Date(deadline.getTime()), { settings: { cancelMinutes: 30 } }).ok, 'exactly 30 minutes before: still allowed');
    ok(!canCancel(k, new Date(deadline.getTime() + 60000), { settings: { cancelMinutes: 30 } }).ok, '29 minutes before: not allowed');

    /* A class twenty minutes from now, booked, then cancelled too late. */
    const soon = new Date(Date.now() + 20 * 60000);
    const t20 = clockIn(soon), tEnd = clockIn(new Date(soon.getTime() + 50 * 60000));
    if (todayIn(soon) === today && t20 < tEnd) {
      const kid = await makeClass(today, t20, tEnd, 5);
      const r = await reserve({ planId: 'start', people: [fresh()], classIds: [kid] });
      ok(r.reservation.bookings[0].canCancel === false, 'the booking says it can no longer be cancelled');
      await refuses(() => booking.publicCancel({ token: r.token, bookingId: r.reservation.bookings[0].id }), 'too-late', 'and the server refuses it');
      const v = await booking.publicReservation({ token: r.token });
      ok(v.people[0].left === 3, 'the class still counts as used');
      await booking.adminRestore(admin, r.reservation.bookings[0].id).catch(() => null);
      await booking.adminCancelBooking(admin, r.reservation.bookings[0].id, { credit: 'return' });
      const v2 = await booking.publicReservation({ token: r.token });
      ok(v2.people[0].left === 4, 'the studio can override it and give the credit back');
    } else console.log('  · skipped the live 20-minute case: too close to midnight');
  }

  section('FOUNDING GIRLS — a cap, once each, new clients only');
  {
    await q(`update offers set max_redemptions = 2 where id = 'founding-girls'`);
    const a = await reserve({ offerId: 'founding-girls', planId: 'start', people: [fresh()] });
    ok(a.reservation.unitPrice === 8500 && a.reservation.originalPrice === 10000 && a.reservation.discountPct === 15,
      '15% off 10,000 is 8,500, and both are written on the reservation', a.reservation);
    await refuses(() => reserve({ offerId: 'founding-girls', planId: 'single', people: [fresh()] }), 'plan', 'not on a single class');
    const twice = fresh();
    await reserve({ offerId: 'founding-girls', planId: 'start', people: [twice] });
    await refuses(() => reserve({ offerId: 'founding-girls', planId: 'start', people: [fresh()] }), 'offer-limit', 'the third claim is refused once the cap is reached');
    await q(`update offers set max_redemptions = 30 where id = 'founding-girls'`);
    await refuses(() => reserve({ offerId: 'founding-girls', planId: 'start', people: [twice] }), null, 'the same phone cannot claim it again');
    const regular = fresh();
    await reserve({ planId: 'start', people: [regular] });
    await refuses(() => reserve({ offerId: 'founding-girls', planId: 'start', people: [regular] }), 'offer-new', 'someone who has been before is not new');
    const n = (await one(`select count(*)::int as n from offer_claims where offer_id = 'founding-girls' and status <> 'void'`)).n;
    ok(n === 2, 'claims are counted on the server: 2', n);
  }

  section('Prices are a snapshot');
  {
    const r = await reserve({ planId: 'routine', people: [fresh()] });
    await q(`update plans set price_all = 99999 where id = 'routine'`);
    const v = await booking.publicReservation({ token: r.token });
    ok(v.totalPrice === 13200, 'changing the package price later does not change her reservation', v.totalPrice);
    await q(`update plans set price_all = 13200 where id = 'routine'`);
  }

  section('BRING A BESTIE — bonus classes once the friend buys');
  {
    const me = fresh(), friend = fresh();
    const r = await reserve({ offerId: 'bring-a-bestie', planId: 'start', people: [me], friend });
    ok(r.reservation.people[0].total === 4, 'no bonus yet: 4 classes');
    const old = fresh();
    await reserve({ planId: 'start', people: [old] });
    await refuses(() => reserve({ offerId: 'bring-a-bestie', planId: 'start', people: [fresh()], friend: old }), 'friend-new', 'the friend must be new to DUA');
    const fr = await reserve({ planId: 'start', people: [friend] });
    await booking.adminUpdateReservation(admin, fr.reservation.id || (await one('select id from reservations where ref = $1', [fr.ref])).id, { payment: 'paid' });
    const mine = await booking.publicReservation({ token: r.token });
    ok(mine.people[0].total === 5, 'when the friend pays for her package, the referrer gets 1 bonus class', mine.people[0].total);
    const hers = await booking.publicReservation({ token: fr.token });
    ok(hers.people[0].total === 5, 'and so does the friend', hers.people[0].total);
  }

  section('Weekly template, and overrides for one date');
  {
    /* Two weeks of Tuesdays from next week. */
    let tue = plusDays(today, 1); while (weekdayOf(tue) !== 2) tue = plusDays(tue, 1);
    const tue2 = plusDays(tue, 7);
    const save = (slots, dry) => schedule.saveTemplate(admin, { effectiveFrom: today, slots }, { dryRun: !!dry });
    await save([{ weekday: 2, start: '07:00', end: '08:00', capacity: 5, typeId: 'reformer' },
                { weekday: 2, start: '18:45', end: '19:45', capacity: 5, typeId: 'reformer' }]);
    const row = (d, s) => one(`select * from classes where on_date = $1 and starts = $2 and not cancelled`, [d, s]);
    ok(!!(await row(tue, '07:00')) && !!(await row(tue2, '07:00')), 'the template writes the 07:00 class every Tuesday');

    /* 10 November, in the brief: remove the 07:00, add an 11:00 — that date only. */
    const k7 = await row(tue, '07:00');
    await q(`update classes set cancelled = true, cancel_reason = 'studio', pinned = true where id = $1`, [k7.id]);
    await q(`insert into classes (class_type_id, on_date, starts, ends, capacity, pinned) values ('reformer',$1,'11:00','12:00',5,true)`, [tue]);
    await schedule.ensureSynced(new Date(Date.now() + 86400000 * 0));
    await tx(c => schedule.syncRange(c, today, plusDays(today, 30)));
    ok(!(await row(tue, '07:00')) && !!(await row(tue, '11:00')), 'that Tuesday has no 07:00 and a one-off 11:00');
    ok(!!(await row(tue2, '07:00')) && !(await row(tue2, '11:00')), 'the next Tuesday still follows the template');

    /* Someone books the 18:45 next week; then the template moves it to 19:00. */
    const k18 = await row(tue2, '18:45');
    await reserve({ planId: 'single', people: [fresh()], classIds: [k18.id] });
    const preview = await save([{ weekday: 2, start: '07:00', end: '08:00', capacity: 5, typeId: 'reformer' },
                                { weekday: 2, start: '19:00', end: '20:00', capacity: 5, typeId: 'reformer' }], true);
    ok(preview.dryRun && preview.report.kept.some(x => x.id === k18.id), 'the preview warns about the booked 18:45', preview.report.kept);
    ok(!!(await row(tue2, '18:45')), 'and a preview changes nothing');
    const slots = (await q(`select id, weekday, to_char(starts,'HH24:MI') as s from template_slots`)).rows;
    const s7 = slots.find(s => s.s === '07:00'), s18 = slots.find(s => s.s === '18:45');
    await save([{ id: s7.id, weekday: 2, start: '07:00', end: '08:00', capacity: 5, typeId: 'reformer' },
                { id: s18.id, weekday: 2, start: '19:00', end: '20:00', capacity: 5, typeId: 'reformer' }]);
    ok(!!(await row(tue2, '18:45')) && await taken((await row(tue2, '18:45')).id) === 1, 'the booked class stays where she booked it');
    let tue3 = plusDays(tue2, 7);
    ok(!!(await row(tue3, '19:00')) && !(await row(tue3, '18:45')), 'every other Tuesday moves to 19:00');
    ok(!(await row(tue, '07:00')) && !!(await row(tue, '11:00')), 'and the overridden date is untouched by the template change');

    /* A new version from a later date that is the same week changes nothing. */
    const same = (await q(`select weekday, to_char(starts,'HH24:MI') as s, to_char(ends,'HH24:MI') as e from template_slots`)).rows
      .map(r => ({ weekday: r.weekday, start: r.s, end: r.e, capacity: 5, typeId: 'reformer' }));
    const v2 = await schedule.saveTemplate(admin, { effectiveFrom: plusDays(today, 1), slots: same }, { dryRun: true });
    ok(v2.report.created === 0 && v2.report.removed === 0 && v2.report.kept.length === 0,
      'a new version that is the same week moves nothing and pins nothing', v2.report);
  }

  section('Closing the studio for a day');
  {
    let wed = plusDays(today, 1); while (weekdayOf(wed) !== 3) wed = plusDays(wed, 1);
    await schedule.saveTemplate(admin, { effectiveFrom: today, slots: [
      { weekday: 3, start: '09:00', end: '10:00', capacity: 5, typeId: 'reformer' }] }, {});
    const k = await one(`select id from classes where on_date = $1 and starts = '09:00' and not cancelled`, [wed]);
    const r = await reserve({ planId: 'start', people: [fresh()], classIds: [k.id] });
    const prev = await schedule.closeDay(admin, { date: wed, reason: 'Holiday' }, { dryRun: true });
    ok(prev.affected === 1, 'the preview says one reservation is affected', prev);
    await schedule.closeDay(admin, { date: wed, reason: 'Holiday' }, {});
    const v = await booking.publicReservation({ token: r.token });
    ok(v.people[0].left === 4, 'her credit comes back when the studio closes');
    await refuses(() => reserve({ planId: 'single', people: [fresh()], classIds: [k.id] }), 'cancelled', 'and nobody can book that day');
    await schedule.reopenDay(admin, wed);
    ok(!(await one('select cancelled from classes where id = $1', [k.id])).cancelled, 'reopening the day brings the class back');
  }

  section('A package only covers its own dates');
  {
    const r = await reserve({ planId: 'start', people: [fresh()] }, admin);
    const m = r.reservation.people[0].membershipId;
    await q(`update memberships set ends_on = $2 where id = $1`, [m, plusDays(today, 1)]);
    const later = await makeClass(plusDays(today, 6), '07:00', '08:00', 5);
    await refuses(() => booking.adminBook(admin, { membershipId: m, classIds: [later] }), 'outside', 'an expired package cannot book a class after it ends');
  }

  section('Moving and attendance');
  {
    const a = await makeClass(plusDays(today, 7), '07:00', '08:00', 1);
    const b = await makeClass(plusDays(today, 7), '08:15', '09:15', 1);
    const r1 = await reserve({ planId: 'start', people: [fresh()], classIds: [a] });
    await reserve({ planId: 'start', people: [fresh()], classIds: [b] });
    await refuses(() => booking.adminMove(admin, r1.reservation.bookings[0].id, { classId: b }), 'full', 'a move into a full class is refused');
    const c = await makeClass(plusDays(today, 7), '09:30', '10:30', 1);
    const moved = await booking.adminMove(admin, r1.reservation.bookings[0].id, { classId: c });
    ok(moved.bookings[0].classId === c && await taken(a) === 0, 'moved to a class with room, and the old place is free');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await pool.end();
  process.exit(fail ? 1 : 0);
}
main().catch(async e => { console.error(e); await pool.end(); process.exit(1); });
