-- ============================================================
-- DUA — the catalogue, as ONE statement.
--
-- Same contents as data.sql, wrapped in a DO block so it survives a
-- client that allows a single command per request. If your editor runs
-- several statements happily, use data.sql instead; it reads better.
--
-- Change the registration code before you run it.
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


  -- ─────────────────────────── the spa, and the two together ───────────────────────────
  -- The website prices twenty-two things; the app used to sell six of them.
  -- These are the rest, in the same ids the page tags its cards with.
  --
  -- One caveat worth knowing: the schema has a single 'spa' class type, so a
  -- relax, a lymph and a sculpt hour are the same thing to it. The packages
  -- differ by name, price and count, which is what a client is choosing
  -- between anyway — but the timetable cannot yet say which kind an hour is.

  insert into plans (id, name, price_all, blurb, featured, sort) values
    -- single treatments
    ('relax',        'DUA RELAX',         3900,  'Total relaxation. One hour.',                     false, 10),
    ('lymph',        'DUA LYMPH',         4200,  'Lightness and recovery. One hour.',               false, 11),
    ('sculpt',       'DUA SCULPT',        4200,  'Firming and body care. One hour.',                false, 12),
    ('deep',         'DUA DEEP RECOVERY', 4200,  'Release and restore. One hour.',                  false, 13),
    -- not 'signature': that id belonged to a membership this catalogue
    -- replaced, and an archived row still points at it.
    ('spa-signature','DUA SIGNATURE',     5900,  'The full DUA experience. Ninety minutes.',        false, 14),
    -- treatments bought several at a time
    ('relax-pack',   'RELAX PACK',        10800, 'Three relax hours.',                              false, 20),
    ('lymph-pack',   'LYMPH PACK',        19500, 'Five lymphatic hours.',                           false, 21),
    ('sculpt-pack',  'SCULPT PACK',       19500, 'Five sculpt hours.',                              false, 22),
    -- movement and recovery together
    ('reset',        'DUA RESET',         9900,  'Four classes and one massage.',                   false, 30),
    ('routine-relax','DUA ROUTINE + RELAX',19500,'Eight classes and two massages.',                 false, 31),
    ('sculpt-combo', 'DUA SCULPT COMBO',  27900, 'Eight classes and four sculpt hours.',            false, 32),
    ('light-lean',   'DUA LIGHT & LEAN',  31900, 'Twelve classes and four lymphatic hours.',        false, 33),
    ('balance',      'DUA BALANCE',       19900, 'Eight classes and two lymphatic hours.',          false, 34),
    ('weekend',      'DUA WEEKEND RESET', 5200,  'One class and one massage.',                      false, 35),
    ('duo',          'DUA DUO',           10900, 'For two: a class and a massage each. Ask at the studio.', false, 36)
  on conflict (id) do update
    set name      = excluded.name,
        price_all = excluded.price_all,
        blurb     = excluded.blurb,
        featured  = excluded.featured,
        sort      = excluded.sort,
        archived  = false;

  delete from plan_allowances
   where plan_id in ('relax','lymph','sculpt','deep','spa-signature',
                     'relax-pack','lymph-pack','sculpt-pack',
                     'reset','routine-relax','sculpt-combo','light-lean','balance','weekend','duo');

  insert into plan_allowances (plan_id, class_type_ids, limit_count, period, sort) values
    ('relax',         array['spa'],      1,  'month', 0),
    ('lymph',         array['spa'],      1,  'month', 0),
    ('sculpt',        array['spa'],      1,  'month', 0),
    ('deep',          array['spa'],      1,  'month', 0),
    ('spa-signature', array['spa'],      1,  'month', 0),
    ('relax-pack',    array['spa'],      3,  'month', 0),
    ('lymph-pack',    array['spa'],      5,  'month', 0),
    ('sculpt-pack',   array['spa'],      5,  'month', 0),
    ('reset',         array['reformer'], 4,  'month', 0),
    ('reset',         array['spa'],      1,  'month', 1),
    ('routine-relax', array['reformer'], 8,  'month', 0),
    ('routine-relax', array['spa'],      2,  'month', 1),
    ('sculpt-combo',  array['reformer'], 8,  'month', 0),
    ('sculpt-combo',  array['spa'],      4,  'month', 1),
    ('light-lean',    array['reformer'], 12, 'month', 0),
    ('light-lean',    array['spa'],      4,  'month', 1),
    ('balance',       array['reformer'], 8,  'month', 0),
    ('balance',       array['spa'],      2,  'month', 1),
    ('weekend',       array['reformer'], 1,  'month', 0),
    ('weekend',       array['spa'],      1,  'month', 1),
    ('duo',           array['reformer'], 1,  'month', 0),
    ('duo',           array['spa'],      1,  'month', 1);


  -- The four plans this replaced. Archived rather than deleted, because a
  -- membership may still point at one.
  update plans set archived = true
   where id in ('essential', 'signature', 'unlimited', 'wellness');
end $$;
