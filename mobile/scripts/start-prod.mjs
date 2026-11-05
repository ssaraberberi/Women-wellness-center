// `npm run start:prod`: Expo on this computer, talking to the production API.
// A variable already in the environment wins over .env, and EXPO_PUBLIC_*
// values are baked into the bundle, so the cache is cleared (-c) to stop a
// bundle built against development from being served again.
import { spawn } from 'node:child_process';

const PROD_API = 'https://api-prod-production-19a0.up.railway.app';

console.log(`\n  API: ${PROD_API}  (PRODUCTION — real clients, real data)\n`);
const child = spawn('npx', ['expo', 'start', '-c', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_API_URL: PROD_API },
});
child.on('exit', (code) => process.exit(code ?? 0));
