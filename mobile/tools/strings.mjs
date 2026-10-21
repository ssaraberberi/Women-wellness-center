#!/usr/bin/env node
/* Every English string the screens hand to t(), and whether src/lib/sq.ts
   has it. Run after adding a screen: `node tools/strings.mjs` lists what
   is missing, and exits 1 if anything is. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && files.push(p); } })(ROOT);

const str = `'((?:[^'\\\\]|\\\\.)*)'`;
const patterns = [
  new RegExp(`\\bt\\(${str}`, 'g'),
  /\b(?:label|text|sub)="([^"]+)"/g,
  new RegExp(`\\blabel: ${str}`, 'g'),
  /<(?:Title|Eyebrow)[^>]*>([A-Z][^<{]*)<\//g,
  new RegExp(`\\bset(?:Fail|Error|Note)\\(${str}`, 'g'),
  new RegExp(`\\[ *'(?:mon|tue|wed|thu|fri|sat|sun)', ${str} *\\]`, 'g'),
  new RegExp(`(?:pending|confirmed|cancelled|completed): ${str}`, 'g')
];
/* Quoted words inside label={…} and text={…}: the two answers of a ternary. */
const inside = /\b(?:label|text)=\{([^}]*)\}/g;
const quoted = new RegExp(str, 'g');
const found = new Set();
for (const f of files) {
  if (f.endsWith('sq.ts')) continue;
  const src = readFileSync(f, 'utf8');
  for (const re of patterns) for (const m of src.matchAll(re)) found.add(m[1].replace(/\\'/g, "'"));
  for (const m of src.matchAll(inside)) for (const q of m[1].matchAll(quoted))
    if (/^[A-Z+]/.test(q[1])) found.add(q[1].replace(/\\'/g, "'"));
}
const sq = readFileSync(join(ROOT, 'lib', 'sq.ts'), 'utf8');
const missing = [...found].filter(s => !sq.includes(JSON.stringify(s).slice(1, -1).replace(/\\"/g, '"')) &&
  !sq.includes("'" + s.replace(/'/g, "\\'") + "'")).sort();
if (process.argv.includes('--all')) console.log([...found].sort().join('\n'));
else console.log(missing.length ? missing.map(s => '  ' + s).join('\n') : 'Every string has an Albanian line.');
process.exit(missing.length ? 1 : 0);
