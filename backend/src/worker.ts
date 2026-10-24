// A separate worker process, for when the API runs with RUN_WORKER=false.
import pino from 'pino';
import './env.js';
import { prisma } from './lib/prisma.js';
import { startWorker } from './jobs.js';

const log = pino({ level: 'info' });
const stop = startWorker(log);
const shutdown = async () => {
  stop();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
