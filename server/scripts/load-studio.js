#!/usr/bin/env node
/* The studio's own price list and timetable, written in one go.

   This is not the demo (`npm run reset`) and it is not run by any deploy:
   it is the posters the studio printed — Pilates, Spa, Paketat, Wellness
   Combos and the November offers — typed in once, by hand, the same way
   the admin screens would type them. Run it against a database when you
   want it to hold exactly that list, and run it again after changing a
   price below.

   - Packages are upserted by id. Re-running brings back the prices here,
     so a price changed in the admin afterwards is overwritten by the next
     run — change it here too, or stop running this.
   - Offers: the three launch offers are left as they are (catalogue.js
     already writes them); LUKS PËR DY, which has to be booked by two
     people, is an offer rather than a package and is upserted.
   - The timetable is one weekly template, Monday to Saturday, fourteen
     Reformer classes a day, 07:00 to 20:50. It applies from the opening
     date, or today if that has passed, and is saved through the same
     code the Schedule screen uses — a class somebody is booked into is
     never moved or deleted, only pinned and reported.

     npm run load:studio                 packages, offers and timetable
     npm run load:studio -- --packages   packages and offers only
     npm run load:studio -- --schedule   timetable only
     npm run load:studio -- --dry-run    say what the timetable would change */
import { pool, q, tx } from '../../api/_lib/db.js';
import { saveTemplate } from '../../api/_lib/schedule.js';
import * as load from '../../api/_lib/load.js';
import { todayIn, hhmm } from '../../shared/domain.js';

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run');
const ONLY_PACKAGES = ARGS.includes('--packages');
const ONLY_SCHEDULE = ARGS.includes('--schedule');

/* ---------- the price list ----------
   One entry per package: id, name, kind, price in lek, days it is valid
   for, and what it allows as [class types, how many]. Every spa treatment
   books a 'spa' class, so a Sculpt Pack is five spa credits; the name and
   the note say which treatment. The ids are new ones on purpose: an older
   build used the short names (relax, sculpt, relax-pack…) and those are
   reserved for its undo in catalogue.js. */
const R = ['reformer'], S = ['spa'];
const PLANS = [
  /* PILATES — Reformer classes */
  { id: 'reformer-first', name: '1 KLASË · PROVË', kind: 'single', price: 1400, days: 30, lines: [[R, 1]],
    tagline: 'Vetëm një herë', taglineEn: 'Once only',
    blurb: 'Për klientë të rinj, një herë për person.', blurbEn: 'For new clients, once per person.' },
  { id: 'reformer-single', name: '1 KLASË', kind: 'single', price: 2400, days: 30, lines: [[R, 1]],
    tagline: 'Pa paketë mujore', taglineEn: 'Without a monthly package' },
  { id: 'reformer-4', name: '4 KLASA / MUAJ', kind: 'membership', price: 8000, days: 30, lines: [[R, 4]],
    tagline: 'Fillimi', taglineEn: 'The start', rhythm: '1x në javë', rhythmEn: 'Once a week' },
  { id: 'reformer-8', name: '8 KLASA / MUAJ', kind: 'membership', price: 14500, days: 30, lines: [[R, 8]], featured: true,
    tagline: 'Ritmi i duhur', taglineEn: 'The sweet spot', rhythm: '2x në javë', rhythmEn: 'Twice a week' },
  { id: 'reformer-12', name: '12 KLASA / MUAJ', kind: 'membership', price: 18500, days: 30, lines: [[R, 12]],
    tagline: 'Për rezultate', taglineEn: 'For results', rhythm: '3x në javë', rhythmEn: '3x a week' },
  { id: 'reformer-16', name: '16 KLASA / MUAJ', kind: 'membership', price: 24000, days: 30, lines: [[R, 16]],
    tagline: 'Pa pushim', taglineEn: 'All in', rhythm: '4x në javë', rhythmEn: '4x a week' },

  /* SPA — one treatment each */
  { id: 'spa-relax-30', name: 'MASAZH RELAKSUES', kind: 'single', price: 2600, days: 30, lines: [[S, 1]],
    rhythm: '30 min', rhythmEn: '30 min' },
  { id: 'spa-relax-60', name: 'MASAZH RELAKSUES', kind: 'single', price: 4500, days: 30, lines: [[S, 1]],
    rhythm: '60 min', rhythmEn: '60 min' },
  { id: 'spa-lymph-60', name: 'DRENAZH LIMFATIK', kind: 'single', price: 5200, days: 30, lines: [[S, 1]],
    rhythm: '60 min', rhythmEn: '60 min' },
  { id: 'spa-sculpt-60', name: 'MASAZH ANTICELULIT / SCULPT', kind: 'single', price: 5200, days: 30, lines: [[S, 1]],
    rhythm: '60 min', rhythmEn: '60 min' },
  { id: 'spa-deep-60', name: 'MASAZH I THELLË', kind: 'single', price: 5200, days: 30, lines: [[S, 1]],
    tagline: 'Tension muskulor', taglineEn: 'Muscle tension', rhythm: '60 min', rhythmEn: '60 min' },
  { id: 'spa-neck-40', name: 'QAFË, SHPATULLA, SHPINË & SKALP', kind: 'single', price: 3900, days: 30, lines: [[S, 1]],
    tagline: 'Masazh qafe, shpatullash, shpine të sipërme dhe skalpi',
    taglineEn: 'Neck, shoulders, upper back and scalp', rhythm: '40 min', rhythmEn: '40 min' },
  { id: 'spa-recovery-90', name: 'RELAKS + RECOVERY', kind: 'single', price: 7100, days: 30, lines: [[S, 1]],
    rhythm: '90 min', rhythmEn: '90 min' },

  /* PAKETAT — spa packs */
  { id: 'spa-pack-relax', name: 'RELAX PACK', kind: 'package', price: 12000, days: 60, lines: [[S, 3]],
    tagline: '3 × Relax 60 min', taglineEn: '3 × Relax 60 min' },
  { id: 'spa-pack-lymph', name: 'LYMPH PACK', kind: 'package', price: 23500, days: 60, lines: [[S, 5]],
    tagline: '5 × Lymph 60 min', taglineEn: '5 × Lymph 60 min' },
  { id: 'spa-pack-sculpt', name: 'SCULPT PACK', kind: 'package', price: 23500, days: 60, lines: [[S, 5]],
    tagline: '5 × Sculpt 60 min', taglineEn: '5 × Sculpt 60 min' },

  /* WELLNESS COMBOS — Reformer and spa together. The card builds the
     "4 Pilates + 1 Spa" line itself; the tagline is the saving. */
  { id: 'combo-best-of-both', name: 'BEST OF BOTH', kind: 'membership', price: 6000, days: 30, lines: [[R, 1], [S, 1]],
    tagline: '20% ulje', taglineEn: '20% off', blurb: '1 Reformer + 1 Relax 60 min', blurbEn: '1 Reformer + 1 Relax 60 min' },
  { id: 'combo-little-affair', name: 'LITTLE AFFAIR', kind: 'membership', price: 11500, days: 30, lines: [[R, 4], [S, 1]],
    tagline: '14% ulje', taglineEn: '14% off', blurb: '4 Reformer + 1 Relax 60 min', blurbEn: '4 Reformer + 1 Relax 60 min' },
  { id: 'combo-good-life', name: 'GOOD LIFE', kind: 'membership', price: 21000, days: 30, lines: [[R, 8], [S, 2]],
    tagline: '11% ulje', taglineEn: '11% off', blurb: '8 Reformer + 2 Relax 60 min', blurbEn: '8 Reformer + 2 Relax 60 min' },
  { id: 'combo-sculpt-club', name: 'SCULPT CLUB', kind: 'membership', price: 31500, days: 30, lines: [[R, 8], [S, 4]],
    tagline: '11% ulje', taglineEn: '11% off', blurb: '8 Reformer + 4 Sculpt', blurbEn: '8 Reformer + 4 Sculpt' },
  { id: 'combo-float-mode', name: 'FLOAT MODE', kind: 'membership', price: 35500, days: 30, lines: [[R, 12], [S, 4]],
    tagline: '10% ulje', taglineEn: '10% off', blurb: '12 Reformer + 4 Lymph', blurbEn: '12 Reformer + 4 Lymph' }
];

/* LUKS PËR DY is 9,900 L for two people, so it is a two-person bundle at
   4,950 each; 6,900 is what the two items cost apart (2,400 + 4,500). */
const LUKS_PER_DY = `
insert into offers (id, title, description, description_en, kind, price_all, original_all, lines, validity_days,
                    persons, together, eligibility, eligibility_en, active, sort)
values ('luks-per-dy', 'LUKS PËR DY',
        '2 persona: 1 Reformer + 1 masazh relaksues 60 min secila. 9,900 L për të dyja.',
        '2 people: 1 Reformer + 1 relax massage 60 min each. 9,900 L for both.',
        'bundle', 4950, 6900, '[{"types":["reformer"],"total":1},{"types":["spa"],"total":1}]', 30,
        2, true, 'Për dy persona që rezervojnë bashkë.', 'For two people booking together.', true, 4)
on conflict (id) do update set
  title = excluded.title, description = excluded.description, description_en = excluded.description_en,
  kind = excluded.kind, price_all = excluded.price_all, original_all = excluded.original_all,
  lines = excluded.lines, validity_days = excluded.validity_days, persons = excluded.persons,
  together = excluded.together, eligibility = excluded.eligibility, eligibility_en = excluded.eligibility_en,
  archived = false`;

/* ---------- the timetable ----------
   Monday (1) to Saturday (6), on the hour, fifty minutes each. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6];
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const pad = n => String(n).padStart(2, '0');

async function loadPackages() {
  await tx(async c => {
    for (const [i, p] of PLANS.entries()) {
      await c.query(
        `insert into plans (id, name, price_all, blurb, featured, sort, archived,
                            tagline, rhythm, tagline_en, rhythm_en, blurb_en, kind, validity_days, bookable)
         values ($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11,$12,$13,true)
         on conflict (id) do update set name = excluded.name, price_all = excluded.price_all,
           blurb = excluded.blurb, featured = excluded.featured, sort = excluded.sort,
           archived = false, tagline = excluded.tagline, rhythm = excluded.rhythm,
           tagline_en = excluded.tagline_en, rhythm_en = excluded.rhythm_en,
           blurb_en = excluded.blurb_en, kind = excluded.kind, validity_days = excluded.validity_days`,
        [p.id, p.name, p.price, p.blurb || null, !!p.featured, i,
         p.tagline || null, p.rhythm || null, p.taglineEn || null, p.rhythmEn || null, p.blurbEn || null,
         p.kind, p.days]);
      await c.query('delete from plan_allowances where plan_id = $1', [p.id]);
      for (const [n, [types, total]] of p.lines.entries())
        await c.query(
          `insert into plan_allowances (plan_id, class_type_ids, limit_count, period, sort) values ($1,$2,$3,'month',$4)`,
          [p.id, types, total, n]);
    }
    /* Only one package is the one the website points at. */
    await c.query('update plans set featured = false where featured and id <> all($1)',
      [PLANS.filter(p => p.featured).map(p => p.id)]);
    await c.query(LUKS_PER_DY);
  });
  console.log('  ✓ ' + PLANS.length + ' packages and LUKS PËR DY');

  const others = (await q('select id, name from plans where not archived and id <> all($1) order by sort',
    [PLANS.map(p => p.id)])).rows;
  if (others.length)
    console.log('    also offered, and not in this list: ' + others.map(r => r.name + ' (' + r.id + ')').join(', ') +
                ' — archive them under Packages if they should go');
  const prices = (await q(`select value from settings where key = 'show_prices'`)).rows[0];
  if (!prices || prices.value !== 'on')
    console.log('    prices are hidden on the website; turn them on under Packages when ready');
}

async function loadSchedule() {
  const st = await load.settings();
  const today = todayIn(new Date());
  const from = today > st.openingDate ? today : st.openingDate;
  const capacity = st.defaultCapacity;

  /* Keep the ids of slots already there at the same time, so saving again
     changes nothing rather than replacing every class. */
  const t = (await q('select id from schedule_templates where effective_from = $1', [from])).rows[0];
  const had = t ? (await q('select id, weekday, starts, ends, class_type_id from template_slots where template_id = $1', [t.id])).rows : [];
  const slots = [];
  for (const weekday of WEEKDAYS)
    for (const h of HOURS) {
      const start = pad(h) + ':00', end = pad(h) + ':50';
      const same = had.find(s => s.weekday === weekday && hhmm(s.starts) === start && hhmm(s.ends) === end &&
                                 s.class_type_id === 'reformer');
      slots.push({ id: same ? same.id : null, weekday, start, end, capacity, typeId: 'reformer', instructorId: null });
    }

  const r = await saveTemplate(null, { effectiveFrom: from, slots }, { dryRun: DRY });
  const k = r.report;
  console.log('  ' + (DRY ? '·' : '✓') + ' timetable from ' + from + ': ' + slots.length + ' classes a week, ' +
              capacity + ' places each' + (DRY ? ' (dry run, nothing saved)' : ''));
  console.log('    classes over the next 90 days: ' + k.created + ' new, ' + k.updated + ' changed, ' + k.removed + ' removed');
  for (const x of k.kept)
    console.log('    kept as it was, ' + x.booked + ' booked: ' + x.date + ' ' + x.start + ' (' + x.why + ')');
  const later = (await q('select effective_from from schedule_templates where effective_from > $1 order by 1', [from])).rows;
  if (later.length)
    console.log('    note: a schedule starting ' + later.map(x => x.effective_from).join(', ') +
                ' takes over from that date; change or remove it under Schedule');
}

async function main() {
  if (!ONLY_SCHEDULE && !DRY) await loadPackages();
  if (!ONLY_PACKAGES) await loadSchedule();
}

main().catch(e => { console.error('  ✗ ' + e.message); process.exitCode = 1; })
      .finally(() => pool.end());
