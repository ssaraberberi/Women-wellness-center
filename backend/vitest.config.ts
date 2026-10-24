import { defineConfig } from 'vitest/config';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://dua:dua@localhost:5433/dua_test';
if (!/test/.test(url)) throw new Error('TEST_DATABASE_URL must name a test database: the tests wipe it.');

export default defineConfig({
  test: {
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false, // one database, wiped per file
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      APP_ENV: 'test',
      DATABASE_URL: url,
      JWT_SECRET: 'test-secret-test-secret-test-secret-000000',
      OTP_PEPPER: 'test-pepper-test-pepper-test-pepper-000000',
      DEV_LOGIN_CODE: '',
      RESEND_API_KEY: '',
      RUN_WORKER: 'false',
    },
  },
});
