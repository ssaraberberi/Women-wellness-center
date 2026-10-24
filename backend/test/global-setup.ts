import { execSync } from 'node:child_process';

/** Bring the test database to the current migrations before any test runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://dua:dua@localhost:5433/dua_test';
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
