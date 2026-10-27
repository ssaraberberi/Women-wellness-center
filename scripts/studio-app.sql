-- ============================================================
-- DUA — price list and timetable for the app's database
-- (the Prisma schema in backend/ on the `app` branch:
--  membership_products, spa_treatments, class_schedule_templates, …)
--
-- Paste it all into the database console and run it. One transaction,
-- safe to run again: rows are matched by name and updated, never doubled.
-- ============================================================
begin;

-- ─────────────── studio settings ───────────────
-- Make sure the settings row exists, and open Monday–Saturday 07:00–21:00
-- (Saturday was 09:00–15:00 by default); Sunday stays closed.
insert into studio_settings (id, opening_hours, updated_at)
values (1, '{}'::jsonb, now())
on conflict (id) do nothing;

update studio_settings set
  opening_hours = '{"1":{"open":"07:00","close":"21:00"},"2":{"open":"07:00","close":"21:00"},
                    "3":{"open":"07:00","close":"21:00"},"4":{"open":"07:00","close":"21:00"},
                    "5":{"open":"07:00","close":"21:00"},"6":{"open":"07:00","close":"21:00"},"7":null}'::jsonb,
  updated_at = now()
where id = 1;


-- ─────────────── SPA treatments ───────────────
-- name, name_en, category, minutes, price
create temp table t_treat on commit drop as
select * from (values
  ('Masazh relaksues',                                      'Relax massage',                         'RELAX',       30, 2600),
  ('Masazh relaksues',                                      'Relax massage',                         'RELAX',       60, 4500),
  ('Drenazh limfatik',                                      'Lymphatic drainage',                    'LYMPHATIC',   60, 5200),
  ('Masazh anticelulit / sculpt',                           'Anti-cellulite / sculpt massage',       'MADERO',      60, 5200),
  ('Masazh i thellë, tension muskulor',                     'Deep tissue, muscle tension',           'DEEP_TISSUE', 60, 5200),
  ('Masazh qafe, shpatullash, shpine të sipërme dhe skalpi','Neck, shoulders, upper back and scalp', 'BACK_NECK',   40, 3900),
  ('Relaks + recovery',                                     'Relax + recovery',                      'RELAX',       90, 7100)
) v(name, name_en, category, minutes, price);

update spa_treatments s set name_en = t.name_en, category = t.category, price = t.price, active = true
  from t_treat t where lower(s.name) = lower(t.name) and s.duration_min = t.minutes;

insert into spa_treatments (id, name, name_en, category, duration_min, price)
select gen_random_uuid(), t.name, t.name_en, t.category, t.minutes, t.price
  from t_treat t
 where not exists (select 1 from spa_treatments s where lower(s.name) = lower(t.name) and s.duration_min = t.minutes);

-- At least one room, or no SPA appointment can be booked.
insert into spa_rooms (id, name)
select gen_random_uuid(), 'Room 1' where not exists (select 1 from spa_rooms);


-- ─────────────── packages (membership_products) ───────────────
-- name, name_en, kind, price, original price, class credits, days valid,
-- times a week, first time only, max per client, description, description_en, sort
create temp table t_prod on commit drop as
select * from (values
  -- PILATES
  ('1 klasë · provë',  '1 class · trial', 'TRIAL',   1400, null::int, 1,  30, null::int, true,  1,    'Vetëm një herë, për klientë të rinj.', 'Once only, for new clients.', 0),
  ('1 klasë',          '1 class',         'SINGLE',  2400, null,      1,  30, null,      false, null, 'Pa paketë mujore.',                    'Without a monthly package.',  1),
  ('4 klasa / muaj',   '4 classes / month','PACKAGE', 8000, null,     4,  30, 1,         false, null, '1x në javë',                           'Once a week',                 2),
  ('8 klasa / muaj',   '8 classes / month','PACKAGE', 14500, null,    8,  30, 2,         false, null, '2x në javë',                           'Twice a week',                3),
  ('12 klasa / muaj',  '12 classes / month','PACKAGE',18500, null,    12, 30, 3,         false, null, '3x në javë',                           '3x a week',                   4),
  ('16 klasa / muaj',  '16 classes / month','PACKAGE',24000, null,    16, 30, 4,         false, null, '4x në javë',                           '4x a week',                   5),
  -- PAKETAT (SPA)
  ('Relax Pack',       'Relax Pack',      'SPA',     12000, null,     0,  60, null,      false, null, '3 × Relax 60 min',                     '3 × Relax 60 min',            10),
  ('Lymph Pack',       'Lymph Pack',      'SPA',     23500, null,     0,  60, null,      false, null, '5 × Lymph 60 min',                     '5 × Lymph 60 min',            11),
  ('Sculpt Pack',      'Sculpt Pack',     'SPA',     23500, null,     0,  60, null,      false, null, '5 × Sculpt 60 min',                    '5 × Sculpt 60 min',           12),
  -- WELLNESS COMBOS
  ('Best of Both',     'Best of Both',    'COMBO',   6000,  7500,     1,  30, null,      false, null, '1 Reformer + 1 Relax 60 min · 20% ulje', '1 Reformer + 1 Relax 60 min · 20% off', 20),
  ('Luks për dy',      'Luxury for two',  'COMBO',   9900,  13800,    2,  30, null,      false, null, '2 persona: 1 Reformer + 1 Relax 60 min secila · 28% ulje', '2 people: 1 Reformer + 1 Relax 60 min each · 28% off', 21),
  ('Little Affair',    'Little Affair',   'COMBO',   11500, 13400,    4,  30, null,      false, null, '4 Reformer + 1 Relax 60 min · 14% ulje', '4 Reformer + 1 Relax 60 min · 14% off', 22),
  ('Good Life',        'Good Life',       'COMBO',   21000, 23500,    8,  30, null,      false, null, '8 Reformer + 2 Relax 60 min · 11% ulje', '8 Reformer + 2 Relax 60 min · 11% off', 23),
  ('Sculpt Club',      'Sculpt Club',     'COMBO',   31500, 35300,    8,  30, null,      false, null, '8 Reformer + 4 Sculpt · 11% ulje',      '8 Reformer + 4 Sculpt · 11% off',       24),
  ('Float Mode',       'Float Mode',      'COMBO',   35500, 39300,    12, 30, null,      false, null, '12 Reformer + 4 Lymph · 10% ulje',      '12 Reformer + 4 Lymph · 10% off',       25),
  -- OFERTAT E NËNTORIT
  ('DUA DUO',          'DUA DUO',         'DUO',     12000, 14500,    8,  30, 2,         false, null, 'Dy shoqe, dy herë në javë: 8 klasa në muaj, për person.', 'Two friends, twice a week: 8 classes a month, per person.', 30)
) v(name, name_en, kind, price, original_price, credits, days, per_week, first_only, max_per, description, description_en, sort);

update membership_products p set
  name_en = t.name_en, kind = t.kind::"ProductKind", price = t.price, original_price = t.original_price,
  class_credits = t.credits, validity_days = t.days, sessions_per_week_hint = t.per_week,
  first_time_only = t.first_only, max_per_client = t.max_per, description = t.description,
  description_en = t.description_en, sort_order = t.sort, active = true, updated_at = now()
  from t_prod t where lower(p.name) = lower(t.name);

insert into membership_products (id, kind, name, name_en, description, description_en, price, original_price,
                                 class_credits, validity_days, sessions_per_week_hint, first_time_only,
                                 max_per_client, sort_order, terms, terms_en, updated_at)
select gen_random_uuid(), t.kind::"ProductKind", t.name, t.name_en, t.description, t.description_en, t.price,
       t.original_price, t.credits, t.days, t.per_week, t.first_only, t.max_per, t.sort,
       'E vlefshme ' || t.days || ' ditë nga aktivizimi.', 'Valid ' || t.days || ' days from activation.', now()
  from t_prod t
 where not exists (select 1 from membership_products p where lower(p.name) = lower(t.name));

-- What SPA each package includes: product, treatment name, minutes, how many.
create temp table t_items on commit drop as
select * from (values
  ('Relax Pack',    'Masazh relaksues',            60, 3),
  ('Lymph Pack',    'Drenazh limfatik',            60, 5),
  ('Sculpt Pack',   'Masazh anticelulit / sculpt', 60, 5),
  ('Best of Both',  'Masazh relaksues',            60, 1),
  ('Luks për dy',   'Masazh relaksues',            60, 2),
  ('Little Affair', 'Masazh relaksues',            60, 1),
  ('Good Life',     'Masazh relaksues',            60, 2),
  ('Sculpt Club',   'Masazh anticelulit / sculpt', 60, 4),
  ('Float Mode',    'Drenazh limfatik',            60, 4)
) v(product, treatment, minutes, quantity);

delete from membership_product_spa_items
 where product_id in (select p.id from membership_products p join t_prod t on lower(p.name) = lower(t.name));

insert into membership_product_spa_items (id, product_id, treatment_id, quantity)
select gen_random_uuid(), p.id, s.id, i.quantity
  from t_items i
  join membership_products p on lower(p.name) = lower(i.product)
  join lateral (select id from spa_treatments s
                 where lower(s.name) = lower(i.treatment) and s.duration_min = i.minutes
                 order by s.created_at limit 1) s on true;


-- ─────────────── FOUNDING GIRLS · BRING A BESTIE ───────────────
-- 15% off the first package for the first 30 new clients.
insert into promotion_codes (id, code, description, discount_type, discount_value, first_time_only, max_redemptions, valid_until, active)
values (gen_random_uuid(), 'FOUNDINGGIRLS', 'FOUNDING GIRLS: 30 vajzat e para marrin 15% ulje në paketën e parë.',
        'PERCENT', 15, true, 30, '2026-12-01 00:00+01', true)
on conflict (code) do update set description = excluded.description, discount_type = excluded.discount_type,
  discount_value = excluded.discount_value, first_time_only = excluded.first_time_only,
  max_redemptions = excluded.max_redemptions, valid_until = excluded.valid_until, active = true;

-- The November offers on the app's news. BRING A BESTIE has no automatic
-- rule in the app: the bonus class is added by hand (credits → add).
insert into announcements (id, title, title_en, body, body_en, kind, starts_at, ends_at)
select gen_random_uuid(), a.title, a.title, a.body, a.body_en, 'OFFER', now(), '2026-12-01 00:00+01'
  from (values
    ('DUA DUO',        'Dy shoqe, dy herë në javë! 8 klasa në muaj për 12,000 L për person (në vend të 14,500).',
                       'Two friends, twice a week! 8 classes a month for 12,000 L per person (instead of 14,500).'),
    ('FOUNDING GIRLS', '30 vajzat e para që bëhen pjesë e DUA përfitojnë 15% ulje. Kodi: FOUNDINGGIRLS',
                       'The first 30 girls who join DUA get 15% off. Code: FOUNDINGGIRLS'),
    ('BRING A BESTIE', 'Sill një shoqe në DUA dhe përfitoni 1 klasë bonus secila, kur ajo blen paketë.',
                       'Bring a friend to DUA and you each get 1 bonus class when she buys a package.')
  ) a(title, body, body_en)
 where not exists (select 1 from announcements x where x.title = a.title and x.kind = 'OFFER');


-- ─────────────── the timetable: Mon–Sat, 07:00–20:50 ───────────────
-- A Reformer class type, if there is none yet.
insert into class_types (id, name, name_en, description, description_en, format, duration_min, default_capacity)
select gen_random_uuid(), 'Reformer Pilates', 'Reformer Pilates',
       'Klasë reformer 50 minuta për të gjitha nivelet.', 'A 50-minute reformer class for every level.',
       'REFORMER', 50, coalesce((select default_class_capacity from studio_settings where id = 1), 8)
 where not exists (select 1 from class_types where name = 'Reformer Pilates');

-- Fourteen classes a day, Monday (1) to Saturday (6), from 2 November or
-- today, whichever is later. Slots already there are left alone.
create temp table t_week on commit drop as
select (select id from class_types where name = 'Reformer Pilates' order by created_at limit 1) as type_id,
       greatest((now() at time zone 'Europe/Tirane')::date, date '2026-11-02') as from_date,
       coalesce((select default_class_capacity from studio_settings where id = 1), 8) as capacity;

insert into class_schedule_templates (id, class_type_id, weekday, start_time, duration_min, capacity, valid_from)
select gen_random_uuid(), w.type_id, d, lpad(h::text, 2, '0') || ':00', 50, w.capacity, w.from_date
  from t_week w
 cross join generate_series(1, 6) d
 cross join generate_series(7, 20) h
 where not exists (select 1 from class_schedule_templates t
                    where t.class_type_id = w.type_id and t.weekday = d and t.active
                      and t.start_time = lpad(h::text, 2, '0') || ':00');

-- The classes themselves, for the schedule horizon (60 days by default),
-- so they show now. The app's hourly job makes the same ones and skips
-- these: (template, start) is unique.
insert into class_sessions (id, class_type_id, template_id, instructor_id, starts_at, ends_at, capacity, updated_at)
select gen_random_uuid(), t.class_type_id, t.id, t.instructor_id,
       (day::date + t.start_time::time) at time zone 'Europe/Tirane',
       (day::date + t.start_time::time + make_interval(mins => t.duration_min)) at time zone 'Europe/Tirane',
       t.capacity, now()
  from class_schedule_templates t
  join t_week w on t.class_type_id = w.type_id
 cross join generate_series((now() at time zone 'Europe/Tirane')::date,
                            (now() at time zone 'Europe/Tirane')::date
                              + coalesce((select schedule_horizon_days from studio_settings where id = 1), 60),
                            interval '1 day') day
 where t.active
   and extract(isodow from day) = t.weekday
   and day::date >= t.valid_from
   and (t.valid_until is null or day::date <= t.valid_until)
   and day::date not in (select date from studio_closures)
   and (day::date + t.start_time::time) at time zone 'Europe/Tirane' > now()
on conflict (template_id, starts_at) do nothing;

commit;

-- What is there now.
select 'spa treatments' as what, count(*) as n from spa_treatments where active
union all select 'packages', count(*) from membership_products where active
union all select 'weekly Reformer slots', count(*) from class_schedule_templates
           where active and class_type_id = (select id from class_types where name = 'Reformer Pilates' order by created_at limit 1)
union all select 'upcoming classes', count(*) from class_sessions where starts_at > now() and status = 'SCHEDULED';
