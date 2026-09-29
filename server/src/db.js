/* The one pool, and the small helpers everything else uses. */
import pg from 'pg';

/* Postgres DATE and TIME come back as strings, not Date objects, so a
   class on the 21st is the 21st whatever timezone the server runs in. */
pg.types.setTypeParser(1082, v => v);   // date
pg.types.setTypeParser(1083, v => v);   // time
pg.types.setTypeParser(1114, v => v);   // timestamp without tz

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Railway provides it when a Postgres service is attached;\n' +
                'locally, copy server/.env.example to .env and fill it in.');
  process.exit(1);
}

/* Railway's internal network needs no TLS; its public proxy does, and
   presents a certificate this client will not have a root for. */
const external = /proxy\.rlwy\.net|\.railway\.app/.test(url);
export const pool = new pg.Pool({
  connectionString: url,
  ssl: process.env.PGSSL === 'off' ? false
     : (external || process.env.PGSSL === 'on') ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PGPOOL || 10),
  idleTimeoutMillis: 30000
});

pool.on('error', e => console.error('idle client error', e.message));

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
