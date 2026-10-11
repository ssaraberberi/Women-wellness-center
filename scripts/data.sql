-- ============================================================
-- DUA — the little an empty database needs, by hand.
--
-- You do not normally run this: api/_lib/catalogue.js writes exactly the
-- same rows on the first request to a database that has never had them.
-- It is here for the case where you would rather do it yourself, or where
-- you want to set the registration code to something you chose.
--
-- The packages are NOT here, and nothing in the code writes one. They are
-- the studio's, entered in the admin under Packages, and a package that
-- reappeared because a deployment restarted would not be manageable.
--
-- Every statement is an upsert that only inserts, so running it again
-- never overwrites anything the studio has since changed.
-- ============================================================


-- ─────────────────────────── the admin code ───────────────────────────
-- Whoever types this at /app → Register becomes an administrator, so it
-- is read only by the server and never sent to a browser.
--
-- ►► CHANGE THIS before you run the file. ◄◄

-- `do nothing`, not `do update`: once a code is in the database it is the
-- studio's, and re-running this file to pick up a new package must not
-- quietly put an old one back. To change it, change it in the database:
--
--   update settings set value = 'NEW-CODE' where key = 'admin_registration_code';

insert into settings (key, value) values
  ('admin_registration_code', 'DUA-MW8J-77DC')
on conflict (key) do nothing;


-- ─────────────────────────── prices on the website ───────────────────────────
-- 'off' and the packages show everything but what they cost. The switch is
-- in the app, under Packages, so this line only sets where it starts — and
-- `do nothing` means re-running this file never flips it back.

insert into settings (key, value) values ('show_prices', 'off')
on conflict (key) do nothing;


-- ─────────────────────────── what the studio does ───────────────────────────
-- Nothing in the code knows these names: a row here is what makes
-- "Reformer" appear in the app, and a third row would add a third kind.

insert into class_types (id, name, short_name, sort) values
  ('reformer', 'Reformer Pilates', 'Reformer', 1),
  ('spa',      'Spa',              'Spa',      2)
on conflict (id) do nothing;
