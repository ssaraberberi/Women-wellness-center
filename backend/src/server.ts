import { env } from './env.js';
import { buildApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { getSettings } from './lib/settings.js';
import { startWorker } from './jobs.js';

const app = await buildApp();
await getSettings(); // the settings row exists before the first request needs it
const stopWorker = env.RUN_WORKER ? startWorker(app.log) : () => {};

await app.listen({ port: env.PORT, host: env.HOST });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  stopWorker();
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
