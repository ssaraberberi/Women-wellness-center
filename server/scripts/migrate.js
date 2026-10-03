#!/usr/bin/env node
/* Applies every .sql in migrations/ once, in filename order.
   Safe to run on every deploy — Railway can call it as a release step. */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, q } from '../src/db.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

async function main() {
  await q(`create table if not exists schema_migrations (
             name text primary key, applied_at timestamptz not null default now())`);

  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
  const done = new Set((await q('select name from schema_migrations')).rows.map(r => r.name));

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) { console.log('  · ' + file + ' (already applied)'); continue; }
    const sql = await readFile(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log('  ✓ ' + file);
      applied++;
    } catch (e) {
      await client.query('rollback');
      console.error('  ✗ ' + file + '\n    ' + e.message);
      process.exit(1);
    } finally { client.release(); }
  }
  console.log(applied ? applied + ' migration(s) applied.' : 'Database already up to date.');
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
