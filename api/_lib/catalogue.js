/* ============================================================
   DUA — what a new database needs before anyone can use it
   ------------------------------------------------------------
   Not the packages. The studio writes those herself, in the admin, and
   the app must never put one there: a package that reappears because a
   deployment restarted is not a package anybody can manage.

   What is here is the little that cannot be entered through a screen,
   because without it there is no screen to enter it through: the two
   class types everything else refers to, the switch that keeps prices
   off the website, and the administrator registration code — without
   which an empty database has no way to make its first administrator.

   Written once, to a database that has never had it, and then never
   again: the check is for the presence of settings.catalogue_version,
   not for a version mismatch. Whatever is in those tables afterwards is
   the studio's.

   If you are tempted to add rows here that belong to the studio —
   packages, prices, class times — that is what the admin screens are
   for. This file learned that the hard way; see the undo below.
   ============================================================ */

export const VERSION = '2026-10-11b';

/* The names are not known to the code: a row here is what makes
   "Reformer" appear in the app, and a third row would add a third kind. */
const BOOTSTRAP = `
insert into class_types (id, name, short_name, sort) values
  ('reformer', 'Reformer Pilates', 'Reformer', 1),
  ('spa',      'Spa',              'Spa',      2)
on conflict (id) do nothing;

insert into settings (key, value) values ('show_prices', 'off')
on conflict (key) do nothing;
`;

/* ---------- the undo ----------
   One build of this file, 2026-10-11a, wrote a catalogue of twenty-one
   packages into whatever database it found. That was the wrong call —
   the studio enters her own, and the website is where the public list
   lives — so this takes exactly those rows back out, once, and only
   from a database that build wrote to.

   A row anybody has actually used is left alone: a membership pointing
   at a package is a record of money, and nothing here is worth breaking
   it for. Allowances follow the package by cascade. */
const WRITTEN_BY_A = [
  'try-dua', 'single', 'start', 'routine', 'glow', 'obsessed',
  'relax', 'lymph', 'sculpt', 'deep', 'spa-signature',
  'relax-pack', 'lymph-pack', 'sculpt-pack',
  'reset', 'routine-relax', 'sculpt-combo', 'light-lean', 'balance', 'weekend', 'duo'
];

async function undoA(client) {
  const gone = await client.query(
    `delete from plans
      where id = any($1::text[])
        and not exists (select 1 from memberships m where m.plan_id = plans.id)
      returning id`, [WRITTEN_BY_A]);
  const kept = await client.query(
    `select id from plans where id = any($1::text[])`, [WRITTEN_BY_A]);
  console.log('removed ' + gone.rowCount + ' package(s) a previous build had written' +
    (kept.rowCount ? '; kept ' + kept.rows.map(r => r.id).join(', ') + ' — somebody has a membership on them' : ''));
}

/* ---------- the administrator registration code ----------
   Whoever types this at /app → Register becomes an administrator, and on
   an empty database nobody can become one without it. It is the one
   secret in this file, so it is not written into the repository:
   ADMIN_REGISTRATION_CODE if the deployment sets one, otherwise a random
   code written to the log, where the operator can read it and nobody
   else can. Only ever when the database has none — a code already there
   belongs to the studio, and putting an old one back would be worse than
   leaving it alone. */
function freshCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = n => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join('');
  return 'DUA-' + pick(4) + '-' + pick(4);
}

async function adminCode(client) {
  const have = await client.query("select 1 from settings where key = 'admin_registration_code'");
  if (have.rowCount) return;
  const code = process.env.ADMIN_REGISTRATION_CODE || freshCode();
  await client.query(
    `insert into settings (key, value) values ('admin_registration_code', $1)
     on conflict (key) do nothing`, [code]);
  console.log('this database had no administrator registration code; it is now ' + code +
              ' — change it from the admin screen once you are in.');
}

let applied = null;

export function ensureCatalogue(pool) {
  if (!applied) applied = apply(pool).catch(function (e) { applied = null; throw e; });
  return applied;
}

async function apply(pool) {
  const client = await pool.connect();
  try {
    const at = await client.query(
      "select value from settings where key = 'catalogue_version'"
    ).then(r => r.rows[0] && r.rows[0].value, () => null);
    if (at === VERSION) return;

    await client.query('begin');
    /* A database that has never been touched gets the little it needs. One
       that has is the studio's: nothing is written to it but the undo. */
    if (!at) {
      await client.query(BOOTSTRAP);
      await adminCode(client);
    } else if (at === '2026-10-11a') {
      await undoA(client);
    }
    await client.query(
      `insert into settings (key, value) values ('catalogue_version', $1)
       on conflict (key) do update set value = excluded.value`, [VERSION]);
    await client.query('commit');
    console.log('database prepared: ' + VERSION + (at ? ' (was ' + at + ')' : ' (new database)'));
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
