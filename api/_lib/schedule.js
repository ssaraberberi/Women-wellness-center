/* ============================================================
   DUA — the weekly schedule and the classes it makes
   ------------------------------------------------------------
   The studio describes an ordinary week once: a template of time slots
   per weekday, effective from a date until the next template takes over.
   From it, real classes are written ahead of time — about three months —
   so that every booking points at a real row that can be locked, counted
   and moved.

   The rules that keep this honest:

   - A class edited for one date is pinned. The template never touches a
     pinned class again, so a change made for 10 November stays exactly
     as it was made, and every other Tuesday follows the template.
   - A class someone has booked is never silently moved or deleted by a
     template change. It is left as it is, pinned, and reported back, so
     the studio decides what happens to those people.
   - A closed day cancels its classes and gives every credit back. The
     template does not bring them back while the day is closed.

   Every change is computed as a plan first and only then applied, so the
   same code answers "what would this do" (a preview, rolled back) and
   "do it".
   ============================================================ */
import { tx, one } from './db.js';
import * as load from './load.js';
import { todayIn, plusDays, weekdayOf, hhmm, minutes } from '../../shared/domain.js';

export const SYNC_DAYS = 90;
const bad = (status, message, code) => { const e = new Error(message); e.status = status; e.code = code; throw e; };
const TIME = /^\d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const notify = (c, userId, text, tone) =>
  c.query('insert into notices (user_id, text, tone) values ($1,$2,$3)', [userId, text, tone || 'info']);

/* ---------- making the classes ---------- */

/* Brings the classes between two dates in line with the templates and the
   closed days. Runs inside the caller's transaction, under a lock, so two
   requests cannot both write the same week. */
export async function syncRange(c, from, to) {
  await c.query('select pg_advisory_xact_lock(4207)');
  const ts = (await c.query('select id, effective_from from schedule_templates order by effective_from')).rows;
  const slots = (await c.query(`select id, template_id, weekday, starts, ends, capacity, class_type_id, instructor_id
                                  from template_slots`)).rows;
  const closed = new Set((await c.query('select on_date from closures where on_date between $1 and $2', [from, to])).rows.map(r => r.on_date));
  const existing = (await c.query(
    `select k.id, k.slot_id, k.on_date, k.starts, k.ends, k.capacity, k.class_type_id, k.instructor_id,
            k.pinned, k.cancelled,
            (select count(*)::int from bookings b where b.class_id = k.id and b.status = 'booked') as booked
       from classes k where k.on_date between $1 and $2 and k.slot_id is not null for update`, [from, to])).rows;

  const report = { created: 0, updated: 0, removed: 0, kept: [] };
  const bySlotDate = new Map(existing.map(k => [k.slot_id + '|' + k.on_date, k]));

  for (let d = from; d <= to; d = plusDays(d, 1)) {
    const t = ts.filter(x => x.effective_from <= d).pop();
    const wd = weekdayOf(d);
    const want = closed.has(d) || !t ? [] : slots.filter(s => String(s.template_id) === String(t.id) && s.weekday === wd);
    const wantIds = new Set(want.map(s => String(s.id)));

    const adopted = new Set();
    for (const s of want) {
      let k = bySlotDate.get(s.id + '|' + d);
      if (!k) {
        /* A class from an earlier version of the template, at the same time
           and of the same kind, is the same class: it is handed over to the
           new slot rather than deleted and made again — so a new version that
           changes nothing changes nothing, and nobody's booking moves. */
        /* Matched by the slot it was made from, not by its own time: a
           class moved or cancelled for that one date still stands for that
           slot, and keeps standing for it — the override is never undone. */
        const origin = x => slots.find(o => String(o.id) === String(x.slot_id));
        const twin = existing.find(x => {
          if (x.on_date !== d || wantIds.has(String(x.slot_id)) || adopted.has(x.id)) return false;
          const o = origin(x);
          return o && o.weekday === s.weekday && hhmm(o.starts) === hhmm(s.starts) && hhmm(o.ends) === hhmm(s.ends) &&
                 o.class_type_id === s.class_type_id;
        });
        if (twin) {
          adopted.add(twin.id);
          await c.query('update classes set slot_id = $2 where id = $1', [twin.id, s.id]);
          twin.slot_id = s.id;
          k = twin;
        }
      }
      if (!k) {
        await c.query(
          `insert into classes (class_type_id, on_date, starts, ends, capacity, instructor_id, slot_id)
           values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing`,
          [s.class_type_id, d, s.starts, s.ends, s.capacity, s.instructor_id, s.id]);
        report.created++;
        continue;
      }
      if (k.pinned || k.cancelled) continue;
      const moved = hhmm(k.starts) !== hhmm(s.starts) || hhmm(k.ends) !== hhmm(s.ends) || k.class_type_id !== s.class_type_id;
      const capOk = s.capacity >= k.booked;
      const same = !moved && k.capacity === s.capacity && (k.instructor_id || null) === (s.instructor_id || null);
      if (same) continue;
      if (k.booked && (moved || !capOk)) {
        /* People are booked into it as it stands: it stays as it stands. */
        await c.query('update classes set pinned = true where id = $1', [k.id]);
        report.kept.push({ id: k.id, date: d, start: hhmm(k.starts), booked: k.booked, why: moved ? 'time' : 'capacity' });
        continue;
      }
      await c.query(
        `update classes set starts=$2, ends=$3, capacity=$4, class_type_id=$5, instructor_id=$6 where id=$1`,
        [k.id, s.starts, s.ends, s.capacity, s.class_type_id, s.instructor_id]);
      report.updated++;
    }

    /* Template classes this day that the template no longer has. */
    for (const k of existing.filter(x => x.on_date === d && !wantIds.has(String(x.slot_id)) && !adopted.has(x.id))) {
      if (k.pinned || k.cancelled) continue;
      if (closed.has(d)) continue;                       // a closed day cancels; it does not delete
      if (k.booked) {
        await c.query('update classes set pinned = true where id = $1', [k.id]);
        report.kept.push({ id: k.id, date: d, start: hhmm(k.starts), booked: k.booked, why: 'removed' });
        continue;
      }
      await c.query(`delete from classes where id = $1 and not exists
                       (select 1 from bookings b where b.class_id = $1)`, [k.id]);
      report.removed++;
    }
  }
  return report;
}

/* Called before anything reads the timetable. Cheap when it has already
   run today: one settings row. */
let syncedOn = null;
export async function ensureSynced(now) {
  const today = todayIn(now);
  if (syncedOn === today) return;
  const row = await one(`select value from settings where key = 'schedule_synced_on'`);
  if (row && row.value === today) { syncedOn = today; return; }
  await tx(async c => {
    await syncRange(c, today, plusDays(today, SYNC_DAYS));
    await c.query(`insert into settings (key, value) values ('schedule_synced_on', $1)
                   on conflict (key) do update set value = excluded.value`, [today]);
  });
  syncedOn = today;
}
const resync = () => { syncedOn = null; };

/* ---------- the template ---------- */

function cleanSlots(slots, types, staff) {
  if (!Array.isArray(slots)) bad(400, 'The template has no slots', 'slots');
  return slots.map(s => {
    const weekday = Number(s.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) bad(400, 'A slot needs a weekday', 'slots');
    if (!TIME.test(String(s.start)) || !TIME.test(String(s.end))) bad(400, 'Every slot needs a start and an end time', 'slots');
    if (minutes(s.start) >= minutes(s.end)) bad(400, 'A slot must end after it starts', 'slots');
    const capacity = Number(s.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 60) bad(400, 'Capacity is a whole number of places', 'slots');
    if (!types.includes(s.typeId)) bad(400, 'No such class type: ' + s.typeId, 'slots');
    const instructorId = s.instructorId || null;
    if (instructorId && !staff.includes(instructorId)) bad(400, 'No such employee', 'slots');
    return { id: s.id ? Number(s.id) : null, weekday, start: s.start, end: s.end, capacity, typeId: s.typeId, instructorId };
  }).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}

/* Saves the week as it applies from a date. The same date updates that
   template in place; a new date starts a new one, and the old one keeps
   every date before it. dryRun answers what it would do, and changes
   nothing. */
export async function saveTemplate(user, body, opts) {
  const now = new Date();
  const today = todayIn(now);
  const from = String(body.effectiveFrom || '');
  if (!DATE.test(from)) bad(400, 'Pick the date the schedule starts', 'effectiveFrom');
  if (from < today) bad(400, 'A new schedule cannot start in the past', 'effectiveFrom');

  const types = (await load.classTypes()).map(t => t.id);
  const staff = (await load.instructors()).filter(i => i.active).map(i => i.id);
  const slots = cleanSlots(body.slots, types, staff);
  /* Two slots overlapping in one room is a mistake, not a schedule. */
  for (let i = 1; i < slots.length; i++) {
    const a = slots[i - 1], b = slots[i];
    if (a.weekday === b.weekday && minutes(b.start) < minutes(a.end))
      bad(400, 'Two slots overlap on the same day', 'slots');
  }

  const DRY = Symbol('dry');
  try {
    return await tx(async c => {
      await c.query('select pg_advisory_xact_lock(4207)');
      let t = (await c.query('select id from schedule_templates where effective_from = $1', [from])).rows[0];
      if (!t) t = (await c.query('insert into schedule_templates (effective_from) values ($1) returning id', [from])).rows[0];
      const old = (await c.query('select id from template_slots where template_id = $1', [t.id])).rows.map(r => Number(r.id));
      const keep = new Set();
      for (const s of slots) {
        if (s.id && old.includes(s.id)) {
          keep.add(s.id);
          await c.query(`update template_slots set weekday=$2, starts=$3, ends=$4, capacity=$5, class_type_id=$6, instructor_id=$7 where id=$1`,
            [s.id, s.weekday, s.start, s.end, s.capacity, s.typeId, s.instructorId]);
        } else {
          await c.query(`insert into template_slots (template_id, weekday, starts, ends, capacity, class_type_id, instructor_id)
                         values ($1,$2,$3,$4,$5,$6,$7)`, [t.id, s.weekday, s.start, s.end, s.capacity, s.typeId, s.instructorId]);
        }
      }
      /* Removed slots: their future classes go if nobody is in them, and
         stay — pinned, reported — if somebody is. Then the slot goes, and
         what stayed is a standalone class the template no longer owns. */
      const gone = old.filter(id => !keep.has(id));
      const kept = [];
      let removed = 0;
      if (gone.length) {
        const future = (await c.query(
          `select k.id, k.on_date, k.starts, k.pinned, k.cancelled,
                  (select count(*)::int from bookings b where b.class_id = k.id and b.status = 'booked') as booked
             from classes k where k.slot_id = any($1) and k.on_date >= $2 for update`, [gone, today])).rows;
        for (const k of future) {
          if (k.pinned || k.cancelled) continue;
          if (k.booked) {
            await c.query('update classes set pinned = true where id = $1', [k.id]);
            kept.push({ id: k.id, date: k.on_date, start: hhmm(k.starts), booked: k.booked, why: 'removed' });
          } else {
            await c.query(`delete from classes where id = $1 and not exists (select 1 from bookings b where b.class_id = $1)`, [k.id]);
            removed++;
          }
        }
        await c.query('delete from template_slots where id = any($1)', [gone]);
      }
      const report = await syncRange(c, today, plusDays(today, SYNC_DAYS));
      report.removed += removed;
      report.kept = kept.concat(report.kept);
      if (opts && opts.dryRun) { const e = new Error('dry'); e[DRY] = report; throw e; }
      await c.query(`insert into settings (key, value) values ('schedule_synced_on', $1)
                     on conflict (key) do update set value = excluded.value`, [today]);
      resync();
      return { ok: true, report };
    });
  } catch (e) {
    if (e && e[DRY]) return { ok: true, dryRun: true, report: e[DRY] };
    throw e;
  }
}

/* ---------- closed days ---------- */

export async function closeDay(user, body, opts) {
  const date = String(body.date || '');
  if (!DATE.test(date)) bad(400, 'Pick a date', 'date');
  if (date < todayIn(new Date())) bad(400, 'That day is already over', 'date');
  const reason = String(body.reason || '').trim().slice(0, 120) || null;
  return tx(async c => {
    const rows = (await c.query(
      `select k.id, k.starts, k.on_date,
              (select count(*)::int from bookings b where b.class_id = k.id and b.status = 'booked') as booked
         from classes k where k.on_date = $1 and not k.cancelled for update`, [date])).rows;
    const affected = rows.reduce((n, r) => n + r.booked, 0);
    if (opts && opts.dryRun) return { ok: true, dryRun: true, classes: rows.length, affected };

    await c.query(`insert into closures (on_date, reason) values ($1,$2)
                   on conflict (on_date) do update set reason = excluded.reason`, [date, reason]);
    for (const k of rows) {
      await c.query(`update classes set cancelled = true, cancel_reason = 'closure' where id = $1`, [k.id]);
      const out = (await c.query(
        `update bookings set status = 'released' where class_id = $1 and status in ('booked','waitlist') returning client_id`, [k.id])).rows;
      for (const r of out)
        await notify(c, r.client_id, 'The studio is closed on ' + date + '. Your ' + hhmm(k.starts) +
          ' class is cancelled and the class is back in your package.', 'warn');
    }
    return { ok: true, classes: rows.length, affected };
  });
}

/* Reopening brings back the classes the closure cancelled — the ones that
   had no other reason to be cancelled. People who were booked were told and
   given their credit back, so they are not re-booked behind their backs. */
export async function reopenDay(user, date) {
  if (!DATE.test(String(date || ''))) bad(400, 'Pick a date', 'date');
  return tx(async c => {
    const gone = await c.query('delete from closures where on_date = $1 returning on_date', [date]);
    if (!gone.rowCount) bad(404, 'That day is not closed', 'date');
    const back = await c.query(
      `update classes set cancelled = false, cancel_reason = null
        where on_date = $1 and cancelled and cancel_reason = 'closure' returning id`, [date]);
    await syncRange(c, date, date);
    return { ok: true, restored: back.rowCount };
  });
}
