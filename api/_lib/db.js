/* The one pool, and the small helpers everything else uses. */
import pg from 'pg';
import { ensureSchema } from './schema.js';

/* Postgres DATE and TIME come back as strings, not Date objects, so a
   class on the 21st is the 21st whatever timezone the server runs in. */
pg.types.setTypeParser(1082, v => v);   // date
pg.types.setTypeParser(1083, v => v);   // time
pg.types.setTypeParser(1114, v => v);   // timestamp without tz

/* Built on first use, not on import. A function whose module throws while
   loading fails with nothing to read — no message, no stack, just
   FUNCTION_INVOCATION_FAILED — so the one thing most likely to be wrong,
   a missing or misnamed connection string, has to be reportable instead. */
let built = null;

export function connectionProblem() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) return null;
  /* Name the ones that are there. Vercel's Postgres integrations let you
     set a prefix, and a prefixed DATABASE_URL is the usual reason this
     file finds nothing. Names only — never a value. */
  const seen = Object.keys(process.env)
    .filter(k => /DATABASE|POSTGRES|NEON|SUPABASE|^PG[A-Z]*$/.test(k))
    .sort();
  return 'DATABASE_URL is not set.' + (seen.length
    ? ' The database-looking variables this deployment can see are: ' + seen.join(', ') +
      '. If one of those is the connection string, the integration was given a ' +
      'custom prefix; reconnect it without one, or copy the value to DATABASE_URL.'
    : ' This deployment has no database variables at all — connect the Postgres ' +
      'integration to this project, for the Production environment.');
}

function build() {
  const problem = connectionProblem();
  if (problem) throw new Error(problem);
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  /* Every hosted provider wants TLS and none of them chain to a root this
     client carries, so turn it on for anything that is not this machine.
     PGSSL=on/off overrides, for the odd setup that disagrees. */
  const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';

  /* A function is one request at a time, so one connection is the right
     size: a pool of ten per instance is how a serverless app runs a
     database out of connections. Point DATABASE_URL at the pooled endpoint. */
  const serverless = !!process.env.VERCEL;

  const p = new pg.Pool({
    connectionString: url,
    ssl: process.env.PGSSL === 'off' ? false
       : (process.env.PGSSL === 'on' || !local) ? { rejectUnauthorized: false } : false,
    max: Number(process.env.PGPOOL || (serverless ? 1 : 10)),
    idleTimeoutMillis: serverless ? 10000 : 30000,
    connectionTimeoutMillis: 10000
  });
  p.on('error', e => console.error('idle client error', e.message));
  return p;
}

const get = () => (built ||= build());

/* Every way into the database goes through here, so the schema is in
   place before the first query of an instance rather than whenever
   somebody remembers. */
const ready = () => ensureSchema({ connect: () => get().connect() });

/* Everything already asks the pool for these three, so keep the shape. */
export const pool = {
  query: async (text, params) => { await ready(); return get().query(text, params); },
  connect: async () => { await ready(); return get().connect(); },
  /* The one that must not wait on the schema: it is how /healthz asks
     whether the database answers at all. */
  raw: (text, params) => get().query(text, params),
  end: () => built ? built.end() : Promise.resolve()
};


export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const many = async (text, params) => (await pool.query(text, params)).rows;

/* Everything that must not half-happen runs in here. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    try { await client.query('rollback'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}
