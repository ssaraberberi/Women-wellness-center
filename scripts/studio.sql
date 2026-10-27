-- ============================================================
-- DUA — the studio's price list and timetable, by hand.
--
-- The SQL twin of `npm run load:studio`: paste the whole file into the
-- database console (Neon → SQL Editor) and run it. One transaction, safe
-- to run again: packages are upserted by id, and the timetable only adds
-- what is missing.
--
-- Needs the schema to exist — open the site once first.
-- ============================================================
begin;

-- ─────────────────────────── the packages ───────────────────────────
-- id, name, kind, price (lek), days valid, featured, tagline, tagline_en,
-- rhythm, rhythm_en, blurb, blurb_en, reformer credits, spa credits
create temp table studio_plans on commit drop as
select * from (values
  -- PILATES
  ('reformer-first',  '1 KLASË · PROVË', 'single',     1400, 30, false, 'Vetëm një herë', 'Once only', null, null,
     'Për klientë të rinj, një herë për person.', 'For new clients, once per person.', 1, 0),
  ('reformer-single', '1 KLASË',          'single',     2400, 30, false, 'Pa paketë mujore', 'Without a monthly package', null, null, null, null, 1, 0),
  ('reformer-4',      '4 KLASA / MUAJ',   'membership', 8000, 30, false, 'Fillimi', 'The start', '1x në javë', 'Once a week', null, null, 4, 0),
  ('reformer-8',      '8 KLASA / MUAJ',   'membership', 14500, 30, true, 'Ritmi i duhur', 'The sweet spot', '2x në javë', 'Twice a week', null, null, 8, 0),
  ('reformer-12',     '12 KLASA / MUAJ',  'membership', 18500, 30, false, 'Për rezultate', 'For results', '3x në javë', '3x a week', null, null, 12, 0),
  ('reformer-16',     '16 KLASA / MUAJ',  'membership', 24000, 30, false, 'Pa pushim', 'All in', '4x në javë', '4x a week', null, null, 16, 0),
  -- SPA
  ('spa-relax-30',    'MASAZH RELAKSUES', 'single', 2600, 30, false, null, null, '30 min', '30 min', null, null, 0, 1),
  ('spa-relax-60',    'MASAZH RELAKSUES', 'single', 4500, 30, false, null, null, '60 min', '60 min', null, null, 0, 1),
  ('spa-lymph-60',    'DRENAZH LIMFATIK', 'single', 5200, 30, false, null, null, '60 min', '60 min', null, null, 0, 1),
  ('spa-sculpt-60',   'MASAZH ANTICELULIT / SCULPT', 'single', 5200, 30, false, null, null, '60 min', '60 min', null, null, 0, 1),
  ('spa-deep-60',     'MASAZH I THELLË', 'single', 5200, 30, false, 'Tension muskulor', 'Muscle tension', '60 min', '60 min', null, null, 0, 1),
  ('spa-neck-40',     'QAFË, SHPATULLA, SHPINË & SKALP', 'single', 3900, 30, false,
     'Masazh qafe, shpatullash, shpine të sipërme dhe skalpi', 'Neck, shoulders, upper back and scalp', '40 min', '40 min', null, null, 0, 1),
  ('spa-recovery-90', 'RELAKS + RECOVERY', 'single', 7100, 30, false, null, null, '90 min', '90 min', null, null, 0, 1),
  -- PAKETAT
  ('spa-pack-relax',  'RELAX PACK',  'package', 12000, 60, false, '3 × Relax 60 min', '3 × Relax 60 min', null, null, null, null, 0, 3),
  ('spa-pack-lymph',  'LYMPH PACK',  'package', 23500, 60, false, '5 × Lymph 60 min', '5 × Lymph 60 min', null, null, null, null, 0, 5),
  ('spa-pack-sculpt', 'SCULPT PACK', 'package', 23500, 60, false, '5 × Sculpt 60 min', '5 × Sculpt 60 min', null, null, null, null, 0, 5),
  -- WELLNESS COMBOS
  ('combo-best-of-both',  'BEST OF BOTH',  'membership', 6000,  30, false, '20% ulje', '20% off', null, null, '1 Reformer + 1 Relax 60 min', '1 Reformer + 1 Relax 60 min', 1, 1),
  ('combo-little-affair', 'LITTLE AFFAIR', 'membership', 11500, 30, false, '14% ulje', '14% off', null, null, '4 Reformer + 1 Relax 60 min', '4 Reformer + 1 Relax 60 min', 4, 1),
  ('combo-good-life',     'GOOD LIFE',     'membership', 21000, 30, false, '11% ulje', '11% off', null, null, '8 Reformer + 2 Relax 60 min', '8 Reformer + 2 Relax 60 min', 8, 2),
  ('combo-sculpt-club',   'SCULPT CLUB',   'membership', 31500, 30, false, '11% ulje', '11% off', null, null, '8 Reformer + 4 Sculpt', '8 Reformer + 4 Sculpt', 8, 4),
  ('combo-float-mode',    'FLOAT MODE',    'membership', 35500, 30, false, '10% ulje', '10% off', null, null, '12 Reformer + 4 Lymph', '12 Reformer + 4 Lymph', 12, 4)
) as v(id, name, kind, price, days, featured, tagline, tagline_en, rhythm, rhythm_en, blurb, blurb_en, reformer, spa);

insert into plans (id, name, price_all, blurb, featured, sort, archived,
                   tagline, rhythm, tagline_en, rhythm_en, blurb_en, kind, validity_days, bookable)
select id, name, price, blurb, featured, (row_number() over ())::int - 1, false,
       tagline, rhythm, tagline_en, rhythm_en, blurb_en, kind, days, true
  from studio_plans
on conflict (id) do update set name = excluded.name, price_all = excluded.price_all,
  blurb = excluded.blurb, featured = excluded.featured, sort = excluded.sort,
  archived = false, tagline = excluded.tagline, rhythm = excluded.rhythm,
  tagline_en = excluded.tagline_en, rhythm_en = excluded.rhythm_en,
  blurb_en = excluded.blurb_en, kind = excluded.kind, validity_days = excluded.validity_days;

-- What each package allows: replaced whole, as the admin form does.
delete from plan_allowances where plan_id in (select id from studio_plans);
insert into plan_allowances (plan_id, class_type_ids, limit_count, period, sort)
select id, array['reformer'], reformer, 'month', 0 from studio_plans where reformer > 0
union all
select id, array['spa'], spa, 'month', case when reformer > 0 then 1 else 0 end from studio_plans where spa > 0;

-- Only one package is the one the website points at.
update plans set featured = false
 where featured and id not in (select id from studio_plans where featured);


-- ─────────────────────────── LUKS PËR DY ───────────────────────────
-- 9,900 L for two people: a two-person bundle at 4,950 each. 6,900 is what
-- the two items cost apart (2,400 + 4,500). The other November offers
-- (DUA DUO, FOUNDING GIRLS, BRING A BESTIE) are already in the database.
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
  archived = false;


-- ─────────────────────────── the timetable ───────────────────────────
-- Monday to Saturday, 07:00–20:50, a Reformer class every hour, from the
-- opening date (or today, if that has passed), at the default capacity.
create temp table studio_week on commit drop as
select greatest((now() at time zone 'Europe/Tirane')::date,
                coalesce((select value::date from settings where key = 'opening_date'), '2026-11-02')) as from_date,
       coalesce((select value::int from settings where key = 'default_capacity'), 5) as capacity;

insert into schedule_templates (effective_from)
select from_date from studio_week
on conflict (effective_from) do nothing;

-- The slots, added only where that weekday and hour is not there already.
insert into template_slots (template_id, weekday, starts, ends, capacity, class_type_id)
select t.id, d, make_time(h, 0, 0), make_time(h, 50, 0), w.capacity, 'reformer'
  from studio_week w
  join schedule_templates t on t.effective_from = w.from_date
 cross join generate_series(1, 6) d          -- 1 = Monday … 6 = Saturday
 cross join generate_series(7, 20) h         -- 07:00 … 20:00 starts
 where not exists (select 1 from template_slots s
                    where s.template_id = t.id and s.weekday = d and s.starts = make_time(h, 0, 0));

-- The classes for the next 90 days, written now so they show at once.
-- The app would make the same rows on its own; the unique (slot, date)
-- index means neither side can make a second one.
insert into classes (class_type_id, on_date, starts, ends, capacity, slot_id)
select s.class_type_id, day::date, s.starts, s.ends, s.capacity, s.id
  from studio_week w
  join schedule_templates t on t.effective_from = w.from_date
  join template_slots s on s.template_id = t.id
 cross join generate_series(w.from_date, (now() at time zone 'Europe/Tirane')::date + 90, interval '1 day') day
 where extract(dow from day) = s.weekday
   and day::date not in (select on_date from closures)
   and not exists (select 1 from schedule_templates later
                    where later.effective_from > t.effective_from and later.effective_from <= day::date)
on conflict do nothing;

-- Have the app check the timetable again on its next request.
delete from settings where key = 'schedule_synced_on';

commit;

-- What is there now.
select 'packages' as what, count(*) as n from plans where not archived
union all
select 'classes, Mon–Sat from ' || (select min(on_date) from classes where slot_id is not null), count(*)
  from classes where slot_id is not null and not cancelled;
