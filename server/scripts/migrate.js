#!/usr/bin/env node
/* Applies scripts/schema.sql and then scripts/data.sql.

   There is no ledger and nothing to keep in step: both files are written
   to be run as often as you like, so this is the same thing as pasting
   them into the Neon SQL editor, for people who would rather type a
   command. Each file runs in one transaction — a file that fails leaves
   the database as it was. */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../../api/_lib/db.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts');
const FILES = ['schema.sql', 'data.sql'];

async function main() {
  for (const file of FILES) {
    const sql = await readFile(join(DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('commit');
      console.log('  ✓ scripts/' + file);
    } catch (e) {
      await client.query('rollback').catch(() => {});
      console.error('  ✗ scripts/' + file + '\n    ' + e.message);
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }
  }
  console.log('Schema and catalogue are in place. Register the first administrator\n' +
              'at /app with the code in scripts/data.sql.');
}

main().catch(e => { console.error(e); process.exitCode = 1; })
      .finally(() => pool.end());
