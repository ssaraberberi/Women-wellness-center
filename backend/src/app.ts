import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Prisma } from '@prisma/client';
import { env, isProd } from './env.js';
import { AppError } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { clientRoutes } from './routes/client.js';
import { staffRoutes } from './routes/staff.js';
import { adminOpsRoutes } from './routes/admin-ops.js';
import { adminPeopleRoutes } from './routes/admin-people.js';
import { adminCommerceRoutes } from './routes/admin-commerce.js';

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : // JSON logs on any deployed server (Railway sets NODE_ENV=production in both environments).
          isProd || process.env.NODE_ENV === 'production'
          ? { level: 'info', redact: ['req.headers.authorization', 'body.refreshToken', 'body.code'] }
          : { level: 'info', transport: { target: 'pino-pretty', options: { singleLine: true, ignore: 'pid,hostname' } } },
    trustProxy: true, // Railway terminates TLS in front of us
    bodyLimit: 256 * 1024,
  });

  // Validation is zod's job (lib/http.ts); the JSON schemas are only for the docs.
  app.setValidatorCompiler(() => () => true);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()) : false });
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: {
      info: { title: 'DUA Pilates & SPA API', version: '1.0.0', description: 'Times are ISO-8601 UTC; studio dates are Europe/Tirane. Amounts are whole ALL.' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if ((err as FastifyError).statusCode === 429) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    }
    if ((err as FastifyError).statusCode && (err as FastifyError).statusCode! < 500) {
      return reply.code((err as FastifyError).statusCode!).send({ error: { code: 'BAD_REQUEST', message: err.message } });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side' } });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'No such endpoint' } }));

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(clientRoutes);
  await app.register(staffRoutes);
  await app.register(adminOpsRoutes);
  await app.register(adminPeopleRoutes);
  await app.register(adminCommerceRoutes);
  return app;
}
