import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@prisma/client';
import { z, type ZodType } from 'zod';
import { E } from './errors.js';
import { env } from '../env.js';
import { authenticate, type AuthUser } from '../services/tokens.js';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Who may call: nobody signed in, anyone signed in, or a set of roles. */
type Access = 'public' | 'user' | Role[];

interface RouteDef<B extends ZodType, Q extends ZodType, P extends ZodType> {
  method: Method;
  url: string;
  access: Access;
  summary: string;
  tags: string[];
  body?: B;
  query?: Q;
  params?: P;
  /** Per-route limit on top of the global one, e.g. { max: 5, timeWindow: '1 minute' }. */
  rateLimit?: { max: number; timeWindow: string };
}

export interface Ctx<B, Q, P> {
  body: B;
  query: Q;
  params: P;
  user: AuthUser;
  req: FastifyRequest;
  reply: FastifyReply;
  lang: 'sq' | 'en';
  idempotencyKey: string | null;
}

const toJson = (s: ZodType | undefined) => {
  if (!s) return undefined;
  try {
    return z.toJSONSchema(s, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' }) as object;
  } catch {
    return { type: 'object' };
  }
};

/**
 * One route: documented in OpenAPI from its zod schemas, validated with zod,
 * and refused before the handler runs if the caller's role is not allowed.
 */
export function route<B extends ZodType = ZodType<undefined>, Q extends ZodType = ZodType<undefined>, P extends ZodType = ZodType<undefined>>(
  app: FastifyInstance,
  def: RouteDef<B, Q, P>,
  handler: (ctx: Ctx<z.output<B>, z.output<Q>, z.output<P>>) => Promise<unknown>,
) {
  app.route({
    method: def.method,
    url: def.url,
    // Tests drive many sign-ins from one address; the per-address OTP limits stay on.
    config: def.rateLimit && env.APP_ENV !== 'test' ? { rateLimit: def.rateLimit } : undefined,
    schema: Object.fromEntries(
      Object.entries({
        summary: def.summary,
        tags: def.tags,
        body: toJson(def.body),
        querystring: toJson(def.query),
        params: toJson(def.params),
        security: def.access === 'public' ? [] : [{ bearer: [] }],
      }).filter(([, v]) => v !== undefined),
    ),
    handler: async (req, reply) => {
      let user: AuthUser | null = null;
      if (def.access !== 'public') {
        user = await authenticate(req.headers.authorization);
        if (Array.isArray(def.access) && !def.access.includes(user.role)) throw E.forbidden();
      }
      const parse = <T extends ZodType | undefined>(schema: T, value: unknown, where: string) => {
        if (!schema) return undefined;
        const r = schema.safeParse(value ?? {});
        if (!r.success) {
          throw E.badRequest('VALIDATION', `Invalid ${where}`, z.flattenError(r.error));
        }
        return r.data;
      };
      const lang = String(req.headers['accept-language'] ?? '').startsWith('en') ? 'en' : 'sq';
      const key = req.headers['idempotency-key'];
      return handler({
        body: parse(def.body, req.body, 'body') as z.output<B>,
        query: parse(def.query, req.query, 'query') as z.output<Q>,
        params: parse(def.params, req.params, 'params') as z.output<P>,
        user: user as AuthUser,
        req,
        reply,
        lang,
        idempotencyKey: typeof key === 'string' && key.length <= 128 ? key : null,
      });
    },
  });
}

// Shared schema pieces.
export const zId = z.uuid();
export const zIdParams = z.object({ id: z.uuid() });
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
export const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm');
