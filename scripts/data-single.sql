-- ============================================================
-- DUA — the catalogue, as ONE statement.
--
-- Same contents as data.sql, wrapped in a DO block so it
-- survives a client that allows a single command per request — the
-- Vercel storage query box, Neon's HTTP driver, anything that sends
-- SQL as a prepared statement. If your editor runs several statements
-- happily, use data.sql instead; it reads better.
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


  -- ─────────────────────────── what the studio does ───────────────────────────
  -- The studio offers reformer Pilates and the spa.  Nothing in the code
  -- knows these names: add a row here and it appears in the app.

  insert into class_types (id, name, short_name, sort) values
    ('reformer', 'Reformer Pilates', 'Reformer', 1),
    ('spa',      'Spa',              'Spa',      2)
  on conflict (id) do update
    set name = excluded.name, short_name = excluded.short_name, sort = excluded.sort;


  -- ─────────────────────────── the plans ───────────────────────────
  -- price_all is in Albanian lek, whole numbers.
  --
  -- ►► These are placeholders.  Put your own prices in before you sell one. ◄◄

  insert into plans (id, name, price_all, blurb, featured, sort) values
    ('essential', 'Essential', 11900, 'Reformer, eight times a month.',                        false, 1),
    ('signature', 'Signature', 16900, 'Reformer, twelve times a month.',                       true,  2),
    ('unlimited', 'Unlimited', 24900, 'Reformer, as often as you like.',                       false, 3),
    ('wellness',  'Wellness',  28900, 'Reformer twelve times, and the spa once a month.',      false, 4)
  on conflict (id) do update
    set name      = excluded.name,
        price_all = excluded.price_all,
        blurb     = excluded.blurb,
        featured  = excluded.featured,
        sort      = excluded.sort;


  -- What each plan lets you book.  limit_count null means no limit.
  -- Rewritten whole each time, so removing a line here removes the allowance.

  delete from plan_allowances
   where plan_id in ('essential', 'signature', 'unlimited', 'wellness');

  insert into plan_allowances (plan_id, class_type_ids, limit_count, period, sort) values
    ('essential', array['reformer'],  8,    'month', 0),
    ('signature', array['reformer'],  12,   'month', 0),
    ('unlimited', array['reformer'],  null, 'month', 0),
    ('wellness',  array['reformer'],  12,   'month', 0),
    ('wellness',  array['spa'],       1,    'month', 1);
end $$;
