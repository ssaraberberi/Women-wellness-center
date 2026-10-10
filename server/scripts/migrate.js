#!/usr/bin/env node
/* The schema applies itself now — the app does it on its first query, so
   a deploy can no longer arrive before its own tables. This is here for
   the times you want it done on purpose, and to load the catalogue.

   scripts/data.sql is the one half still yours: the registration code,
   the class types and the packages. It is an upsert, so running it again
   rewrites those rows and touches nothing else. */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../../api/_lib/db.js';
import { VERSION } from '../../api/_lib/schema.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts');

async function main() {
  await pool.query('select 1');          // applies the schema if it is behind
  console.log('  ✓ schema ' + VERSION);

  const sql = await readFile(join(DIR, 'data.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log('  ✓ scripts/data.sql');
  } catch (e) {
    await client.query('rollback').catch(() => {});
    console.error('  ✗ scripts/data.sql\n    ' + e.message);
    process.exitCode = 1;
    return;
  } finally {
    client.release();
  }
  console.log('Ready. Register the first administrator at /app with the code in scripts/data.sql.');
}

main().catch(e => { console.error(e); process.exitCode = 1; })
      .finally(() => pool.end());
