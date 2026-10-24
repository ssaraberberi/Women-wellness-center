// A real PostgreSQL on this machine, without installing one: `npm run dev:db`.
// Data lives in backend/.pgdata and survives restarts. Leave it running in its
// own terminal, then use the DATABASE_URL it prints.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.env.DEV_DB_PORT ?? 5433);
const dir = join(process.cwd(), '.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'dua',
  password: 'dua',
  port,
  persistent: true,
});

const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
for (const name of ['dua_app', 'dua_test']) {
  try {
    await pg.createDatabase(name);
  } catch {
    /* already there */
  }
}
console.log(`\nPostgres is running on port ${port}.`);
console.log(`  DATABASE_URL=postgresql://dua:dua@localhost:${port}/dua_app`);
console.log(`  TEST_DATABASE_URL=postgresql://dua:dua@localhost:${port}/dua_test\n`);
console.log('Ctrl+C to stop.');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
