#!/usr/bin/env node
/* The local stand-in for Vercel: static files from the repository root,
   and everything under /api plus /healthz handed to the same function
   Vercel will run. It exists so the platform can be worked on and tested
   without deploying, and so `npm start` still means something. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

/* The paths Vercel would never serve as files. Keeping the list here means
   a request for the server's own source fails locally exactly as it does
   in production, instead of only being noticed after a deploy. */
const HIDDEN = /^\/(api|server|node_modules|tools|\.)/;

async function serveStatic(req, res, path) {
  let rel = decodeURIComponent(path);
  if (rel.endsWith('/')) rel += 'index.html';
  if (HIDDEN.test(rel)) { res.statusCode = 404; return res.end('Not found'); }
  const full = normalize(join(ROOT, rel));
  if (!full.startsWith(ROOT)) { res.statusCode = 403; return res.end('Nope'); }
  try {
    const info = await stat(full).catch(() => null);
    if (info && info.isDirectory()) return serveStatic(req, res, rel.replace(/\/?$/, '/'));
    /* cleanUrls: /app resolves to app/index.html the way Vercel resolves it. */
    const file = info ? full : (await stat(full + '/index.html').catch(() => null)) ? full + '/index.html'
               : (await stat(full + '.html').catch(() => null)) ? full + '.html' : null;
    if (!file) { res.statusCode = 404; return res.end('Not found'); }
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}

createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/healthz' || path.startsWith('/api/') || path === '/api')
    return handler(req, res).catch(e => {
      console.error(e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    });
  return serveStatic(req, res, path);
}).listen(PORT, () => console.log('DUA, locally, on http://localhost:' + PORT));
