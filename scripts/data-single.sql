-- ============================================================
-- DUA — the catalogue, as ONE statement.
--
-- Same contents as data.sql, wrapped in a DO block so it survives a
-- client that allows a single command per request — the Vercel storage
-- query box, Neon's HTTP driver, anything that sends SQL as a prepared
-- statement. If your editor runs several statements happily, use
-- data.sql instead; it reads better.
--
-- Run this second. Change the registration code before you do.
-- ============================================================

do $$
begin
  -- ─────────────────────────── the admin code ───────────────────────────
  -- Whoever types this at /app → Register becomes an administrator, so it
  -- is read only by the server and never sent to a browser.
  --
  -- ►► CHANGE THIS before you run the file. ◄◄

  insert into settings (key, value) values
    ('admin_registration_code', 'DUA-MW8J-77DC')
  on conflict (key) do update set value = excluded.value;


  -- ─────────────────────────── prices on the website ───────────────────────────
  -- 'off' and the packages show everything but what they cost. The switch is
  -- in the app, under Packages, so this line only sets where it starts — and
  -- `do nothing` means re-running this file never flips it back.

  insert into settings (key, value) values ('show_prices', 'off')
  on conflict (key) do nothing;


  -- ─────────────────────────── what the studio does ───────────────────────────
  -- The studio offers reformer Pilates and the spa.  Nothing in the code
  -- knows these names: add a row here and it appears in the app.

  insert into class_types (id, name, short_name, sort) values
    ('reformer', 'Reformer Pilates', 'Reformer', 1),
    ('spa',      'Spa',              'Spa',      2)
  on conflict (id) do update
    set name = excluded.name, short_name = excluded.short_name, sort = excluded.sort;


  -- ─────────────────────────── the plans ───────────────────────────
  -- The six packages, the same ones the website prices. price_all is in
  -- Albanian lek, whole numbers.
  --
  -- The allowance model counts classes within a period, so each pack is
  -- written as its classes per month — which is what "around 2x per week"
  -- comes to. "New clients only" and "once only" on TRY DUA are not rules
  -- the schema can hold; they are watched at the desk for now.

  insert into plans (id, name, price_all, blurb, featured, sort) values
    ('try-dua',  'TRY DUA',      1200,  'Meet DUA. One reformer class, for new clients, once.', false, 1),
    ('single',   'SINGLE CLASS', 2200,  'Your class, your time. One reformer class, no package.', false, 2),
    ('start',    'DUA START',    7200,  'Build the habit. Four classes, around once a week.',     false, 3),
    ('routine',  'DUA ROUTINE',  13200, 'The sweet spot. Eight classes, around twice a week.',    true,  4),
    ('glow',     'DUA GLOW',     18000, 'Take it further. Twelve classes, around three a week.',  false, 5),
    ('obsessed', 'DUA OBSESSED', 22400, 'For the Pilates girls. Sixteen classes, four a week.',   false, 6)
  on conflict (id) do update
    set name      = excluded.name,
        price_all = excluded.price_all,
        blurb     = excluded.blurb,
        featured  = excluded.featured,
        sort      = excluded.sort;


  -- What each plan lets you book.  limit_count null means no limit.
  -- Rewritten whole each time, so removing a line here removes the allowance.

  delete from plan_allowances
   where plan_id in ('try-dua', 'single', 'start', 'routine', 'glow', 'obsessed');

  insert into plan_allowances (plan_id, class_type_ids, limit_count, period, sort) values
    ('try-dua',  array['reformer'],  1,  'month', 0),
    ('single',   array['reformer'],  1,  'month', 0),
    ('start',    array['reformer'],  4,  'month', 0),
    ('routine',  array['reformer'],  8,  'month', 0),
    ('glow',     array['reformer'],  12, 'month', 0),
    ('obsessed', array['reformer'],  16, 'month', 0);

  -- The four plans this replaced. Archived rather than deleted, because a
  -- membership may still point at one.
  update plans set archived = true
   where id in ('essential', 'signature', 'unlimited', 'wellness');
end $$;
