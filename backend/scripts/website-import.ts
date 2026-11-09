/**
 * Bring the old website's data into this database.
 *
 *   Dry run (default — writes nothing anywhere):
 *     WEBSITE_DATABASE_URL=… DATABASE_URL=… npm run import:website -- --out ./import-report
 *
 *   Apply (only with the studio's approval, after a reviewed dry run, with a snapshot taken):
 *     … npm run import:website -- --apply --actor owner@… --confirm <host>/<database>
 *
 * The website database is always opened read-only. In a dry run this database
 * is too, so Postgres itself refuses any write. Connection strings are never
 * printed — only host and database name.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { applyImport, planImport, type Plan } from '../src/import/website.js';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes('--apply');
const OUT = arg('out') ?? 'import-report';
const SRC = process.env.WEBSITE_DATABASE_URL;
const DST = process.env.DATABASE_URL;
if (!SRC || !DST) {
  console.error('Set WEBSITE_DATABASE_URL (the website database) and DATABASE_URL (the app database).');
  process.exit(1);
}
/** "host:port/database" — what is safe to show, and what --confirm must repeat. */
const where = (url: string) => {
  const u = new URL(url);
  return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
};
const one = (url: string) => new PrismaClient({ datasourceUrl: url + (url.includes('?') ? '&' : '?') + 'connection_limit=1' });

async function main() {
  const src = one(SRC!);
  const dst = APPLY ? new PrismaClient({ datasourceUrl: DST }) : one(DST!);
  try {
    await src.$executeRawUnsafe('SET default_transaction_read_only = on');
    if (!APPLY) await dst.$executeRawUnsafe('SET default_transaction_read_only = on');
    console.log(`website (read-only): ${where(SRC!)}`);
    console.log(`app (${APPLY ? 'WRITE' : 'read-only'}): ${where(DST!)}`);

    const batch = `website-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;
    const plan = await planImport(src, dst, { batch });
    writeReport(plan);
    console.log(JSON.stringify(plan.summary, null, 2));

    if (!APPLY) {
      console.log(`\nDry run: nothing was written. Report: ${OUT}/ (personal data — keep it private, delete after review).`);
      return;
    }
    if (arg('confirm') !== where(DST!)) throw new Error(`Refused: --confirm must be exactly ${where(DST!)}`);
    const actor = await dst.user.findFirst({ where: { email: (arg('actor') ?? '').toLowerCase(), role: 'ADMIN', status: 'ACTIVE' } });
    if (!actor) throw new Error('Refused: --actor must be the email of an active admin (the import is signed with it)');
    const result = await applyImport(dst, plan, { actorId: actor.id });
    writeFileSync(join(OUT, 'reconciliation-after.json'), JSON.stringify(result, null, 2));
    console.log(result.ok ? '\nApplied. Every client reconciles with the website.' : '\nApplied, but some clients do not reconcile — see reconciliation-after.json');
    if (!result.ok) process.exitCode = 2;
  } finally {
    await Promise.all([src.$disconnect(), dst.$disconnect()]);
  }
}

function writeReport(plan: Plan) {
  mkdirSync(OUT, { recursive: true });
  const { writes, ...rest } = plan;
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ ...rest, counts: plan.summary.rows }, null, 2));
  const by = (s: string) => plan.issues.filter((i) => i.severity === s);
  const lines = [
    `# Website → app import — ${plan.summary.batch}`,
    '',
    '## Summary',
    '```json',
    JSON.stringify(plan.summary, null, 2),
    '```',
    '',
    `## Blocking (${by('blocker').length}) — the import is refused until each is decided`,
    ...by('blocker').map((i) => `- [${i.area}] ${i.client ? i.client + ': ' : ''}${i.message} (website id ${i.sourceId})`),
    '',
    `## For review (${by('review').length}) — imported, flagged for the desk`,
    ...by('review').map((i) => `- [${i.area}] ${i.client ? i.client + ': ' : ''}${i.message} (website id ${i.sourceId})`),
    '',
    `## Notes (${by('info').length})`,
    ...by('info').map((i) => `- [${i.area}] ${i.client ? i.client + ': ' : ''}${i.message}`),
    '',
    '## Per client: what the app will show (must equal the website)',
    '| Client | Credits left | Owed (L) | Paid (L) | Upcoming classes |',
    '|---|---:|---:|---:|---:|',
    ...plan.reconciliation.map((r) => `| ${r.name} | ${r.credits} | ${r.owed} | ${r.paid} | ${r.upcoming} |`),
  ];
  writeFileSync(join(OUT, 'report.md'), lines.join('\n'));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
