// ── AgentVille bridge: HTTP API + SSE + dashboard ────────
// Listens on 127.0.0.1 only. Control endpoints (approve, orders, settings,
// setup) require the per-install token that is injected into the dashboard,
// so other websites in the browser can't steer your agents.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createVillage } from './core/village.mjs';
import {
  PACKAGE_DIR, paths, loadData, loadSettings, loadPrices, createSaver, writeJSON, readTranscriptLines,
} from './store.mjs';
import { integrationStatus, installIntegrations, uninstallIntegrations } from './setup.mjs';
import { parseClaudeLimits } from './core/usage.mjs';
import { latestCodexLimits } from './codex-limits.mjs';

export const VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')).version;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.txt': 'text/plain',
};

export function loadToken(home) {
  const file = path.join(home, 'token');
  try {
    const t = fs.readFileSync(file, 'utf8').trim();
    if (t.length >= 32) return t;
  } catch { /* create below */ }
  const token = crypto.randomBytes(24).toString('hex');
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(file, token, { mode: 0o600 });
  return token;
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

/**
 * Start the bridge.
 * @param {{ port?: number, home?: string, staticDir?: string, quiet?: boolean, host?: string }} opts
 */
export async function startServer(opts = {}) {
  const port = Number(opts.port ?? process.env.AGENTVILLE_PORT ?? 4242);
  const host = opts.host || '127.0.0.1';
  const p = paths(opts.home);
  const staticDir = opts.staticDir || path.join(PACKAGE_DIR, 'dist');
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);
  const token = loadToken(p.home);

  const { data, migrated } = loadData(p);
  if (migrated) log('  ✨ Imported your existing dwarves from the old AgentVille data');

  const clients = new Set();
  const broadcast = (msg) => {
    const frame = `data: ${JSON.stringify(msg)}\n\n`;
    for (const res of clients) res.write(frame);
  };

  let saver;
  const village = createVillage({
    data,
    settings: loadSettings(p),
    prices: loadPrices(p),
    emit: (msg) => { broadcast(msg); opts.onEvent?.(msg); },
    onChange: () => saver.schedule(),
    hasViewers: () => clients.size > 0 || !!opts.hasViewers?.(),
    readTranscript: readTranscriptLines,
  });
  saver = createSaver(p.data, () => village.data);
  const ticker = setInterval(() => village.tick(), 5000);
  ticker.unref();

  // Codex writes plan limits into its rollouts — pick up the latest even when no session runs.
  const pollCodexLimits = () => {
    const found = latestCodexLimits();
    const known = village.data.limits.codex?.updatedAt || 0;
    if (found && found.at > known) village.setLimits('codex', found.limits);
  };
  pollCodexLimits();
  const limitTimer = setInterval(pollCodexLimits, 5 * 60_000);
  limitTimer.unref();

  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  const allowedOrigins = new Set([...allowedHosts].map(h => `http://${h}`).concat(['http://localhost:5173', 'http://127.0.0.1:5173']));

  function guard(req, res, { control }) {
    if (!allowedHosts.has(req.headers.host || '')) { send(res, 403, { error: 'bad host' }); return false; }
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) { send(res, 403, { error: 'bad origin' }); return false; }
    if (req.method === 'POST' && !String(req.headers['content-type'] || '').includes('application/json')) {
      send(res, 415, { error: 'json only' }); return false;
    }
    if (control && req.headers['x-agentville-token'] !== token) { send(res, 401, { error: 'token required' }); return false; }
    return true;
  }

  function serveStatic(req, res, pathname) {
    let file = path.normalize(path.join(staticDir, decodeURIComponent(pathname)));
    if (!file.startsWith(staticDir)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(staticDir, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('AgentVille bridge is running. Dashboard not built — run `npm run build`.');
      return;
    }
    const ext = path.extname(file);
    if (ext === '.html') {
      const html = fs.readFileSync(file, 'utf8')
        .replace('<head>', `<head><meta name="agentville-token" content="${token}"><meta name="agentville-live" content="1">`);
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' });
      res.end(html);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  }

  const routes = {
    'POST /api/hook': { control: false, run: async (body) => ({ ok: true, output: await village.handleHook(body) }) },
    'POST /api/statusline': {
      control: false,
      run: (body) => {
        const limits = parseClaudeLimits(body.rate_limits);
        if (limits) village.setLimits('claude', limits);
        return { ok: true };
      },
    },
    'POST /api/heartbeat': { control: false, run: (body) => ({ ok: true, agentId: village.handleHeartbeat(body) }) },
    'GET /api/health': { control: false, run: () => ({ ok: true, name: 'agentville', version: VERSION, pid: process.pid }) },
    'GET /api/state': { control: false, run: () => village.snapshot() },
    'GET /api/stats': { control: false, run: () => village.stats() },
    'GET /api/status': { control: false, run: () => village.status() },
    'GET /api/leaderboard': { control: false, run: () => ({ leaderboard: village.leaderboard() }) },
    'GET /api/setup': { control: false, run: () => integrationStatus() },
    'POST /api/setup': { control: true, run: (body) => installIntegrations({ targets: body.targets }) },
    'POST /api/setup/uninstall': { control: true, run: (body) => uninstallIntegrations({ targets: body.targets }) },
    'POST /api/settings': {
      control: true,
      run: (body) => {
        const s = village.updateSettings(body);
        writeJSON(p.settings, s);
        return s;
      },
    },
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    const key = `${req.method} ${url.pathname}`;

    if (url.pathname === '/events' && req.method === 'GET') {
      if (!guard(req, res, { control: false })) return;
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(village.snapshot())}\n\n`);
      clients.add(res);
      const keepalive = setInterval(() => res.write(': keepalive\n\n'), 25_000);
      req.on('close', () => { clearInterval(keepalive); clients.delete(res); });
      return;
    }

    // Dynamic control routes
    const reqMatch = /^\/api\/requests\/([\w-]+)$/.exec(url.pathname);
    const agentMatch = /^\/api\/agents\/([\w-]+)\/(orders|leash)$/.exec(url.pathname);
    let route = routes[key];
    if (!route && req.method === 'POST' && reqMatch) {
      route = { control: true, run: (body) => ({ ok: village.respond(reqMatch[1], body.release ? null : body) }) };
    } else if (!route && req.method === 'POST' && agentMatch) {
      route = agentMatch[2] === 'orders'
        ? { control: true, run: (body) => ({ ok: village.sendOrder(agentMatch[1], body.text) }) }
        : { control: true, run: (body) => ({ ok: village.setLeash(agentMatch[1], body.on) }) };
    }

    if (route) {
      if (!guard(req, res, route)) return;
      try {
        const body = req.method === 'POST' ? await readBody(req) : {};
        send(res, 200, await route.run(body));
      } catch (err) {
        send(res, 400, { error: err.message || 'bad request' });
      }
      return;
    }

    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
      if (!guard(req, res, { control: false })) return;
      serveStatic(req, res, url.pathname);
      return;
    }
    send(res, 404, { error: 'not found' });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const close = () => new Promise((resolve) => {
    clearInterval(ticker);
    clearInterval(limitTimer);
    saver.flush();
    for (const c of clients) c.end();
    server.close(() => resolve());
    server.closeAllConnections?.();
  });

  return { server, village, close, url: `http://localhost:${port}`, token, port, clients };
}
