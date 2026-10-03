#!/usr/bin/env node
/* Is the database reachable, built, and filled? Prints what it finds, and
   says which file to run when something is missing. */
import { pool, q, one } from '../../api/_lib/db.js';

const counts = ['users', 'class_types', 'plans', 'plan_allowances', 'classes', 'memberships', 'bookings'];

try {
  const v = await one('select current_setting($1) as v', ['server_version']);
  console.log('connected to Postgres ' + v.v);
  const built = await one(`select count(*)::int as n from information_schema.tables
                           where table_schema='public' and table_name='users'`);
  if (!built.n) { console.log('no schema yet — run scripts/schema.sql'); process.exit(1); }
  for (const t of counts) {
    const r = await one('select count(*)::int as n from ' + t);
    console.log('  ' + t.padEnd(18) + r.n);
  }
  const code = await one(`select 1 from settings where key='admin_registration_code'`);
  console.log('  admin code set    ' + (code ? 'yes' : 'NO — run scripts/data.sql'));
  const admins = await one(`select count(*)::int as n from users where role='admin'`);
  if (code && !admins.n)
    console.log('\nNo administrator yet. Register at /app with the code in scripts/data.sql.');
  await pool.end();
} catch (e) {
  console.error('could not reach the database: ' + e.message);
  process.exit(1);
}
