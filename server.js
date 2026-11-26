#!/usr/bin/env node
// Dev server: static files with no-cache headers, plus /api/claude, a small proxy to the Claude API.
//
// The browser never sees an API key. This server picks the model for each call kind (Karla's
// decisions on Opus, everything else on Haiku), caps max_tokens, and enforces a per-session token
// budget for guests. Requests carrying the owner token skip the budget. The request/response
// shape is deliberately tiny so a Cloudflare Worker can replace this file at deploy time.
//
//   npm install
//   cp .env.example .env                  # then put your ANTHROPIC_API_KEY in .env
//   npm start                             # = node --env-file-if-exists=.env server.js, port 8643
// Settings (in .env or the environment): ANTHROPIC_API_KEY, MR_OWNER_TOKEN, MR_GUEST_BUDGET.
//
// Without credentials the game still runs: /api/status reports llm:false and the game uses its
// template report text and the heuristic bot.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS, MAX_TOKENS, EFFORT } from './api/models.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8643);

const GUEST_BUDGET = Number(process.env.MR_GUEST_BUDGET || 300000);
const OWNER_TOKEN = process.env.MR_OWNER_TOKEN || '';

const hasCredentials = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE
  || fs.existsSync(path.join(os.homedir(), '.config', 'anthropic')));
const client = hasCredentials ? new Anthropic() : null;
const offlineReason = hasCredentials ? null : 'No Anthropic credentials on the server (set ANTHROPIC_API_KEY).';

const usage = new Map(); // session -> tokens

const isOwner = (req) => !!OWNER_TOKEN && req.headers['x-owner-token'] === OWNER_TOKEN;
const remaining = (session, owner) => (owner ? null : Math.max(0, GUEST_BUDGET - (usage.get(session) || 0)));

async function callClaude(kind, system, user, schema, maxTokens) {
  const params = {
    model: MODELS[kind],
    max_tokens: Math.min(Number(maxTokens) || MAX_TOKENS[kind], MAX_TOKENS[kind]),
    // Frozen system prompt first so it can be cached across calls.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
    output_config: { effort: EFFORT[kind], format: { type: 'json_schema', schema } },
  };
  if (kind === 'voice') {
    // Haiku: fast structured answers, no extended thinking needed.
    return client.messages.create({ ...params, thinking: { type: 'disabled' } });
  }
  // Opus (Karla): adaptive thinking is always on. Server-side refusal fallbacks, opted in by default.
  try {
    return await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) return client.messages.create(params);
    throw e;
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveStatic(req, res) {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = url === '/' ? 'index.html' : url.slice(1);
  const file = path.resolve(ROOT, rel);
  const blocked = !file.startsWith(ROOT + path.sep) || rel.startsWith('node_modules') || rel.startsWith('.') || rel.startsWith('worker');
  if (blocked || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store, must-revalidate' });
  fs.createReadStream(file).pipe(res);
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 200_000) throw new Error('too large'); }
  return JSON.parse(data || '{}');
}

const server = http.createServer(async (req, res) => {
  const session = String(req.headers['x-session'] || 'anon').slice(0, 64);
  const owner = isOwner(req);
  if (req.method === 'GET' && req.url.startsWith('/api/status')) {
    return json(res, 200, { llm: !!client, reason: offlineReason, owner, remaining: remaining(session, owner), models: MODELS });
  }
  if (req.method === 'POST' && req.url.startsWith('/api/claude')) {
    if (!client) return json(res, 503, { ok: false, error: offlineReason });
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { ok: false, error: 'bad request body' }); }
    const { kind, system, user, schema, max_tokens: maxTokens } = body;
    if (!MODELS[kind] || !system || !user || !schema) return json(res, 400, { ok: false, error: 'bad request' });
    const left = remaining(session, owner);
    if (left !== null && left <= 0) return json(res, 402, { ok: false, error: 'Token budget for this session is spent; the game continues offline.', remaining: 0 });
    let r;
    try {
      r = await callClaude(kind, system, user, schema, maxTokens);
    } catch (e) {
      // Failures are printed here: the game falls back to offline play silently.
      console.error(`[claude] ${kind} FAILED: ${String(e.message || e).slice(0, 300)}`);
      if (e instanceof Anthropic.RateLimitError) return json(res, 429, { ok: false, error: 'rate limited' });
      if (e instanceof Anthropic.AuthenticationError) return json(res, 503, { ok: false, error: 'The server\'s Anthropic credentials were rejected.' });
      if (e instanceof Anthropic.APIConnectionError) return json(res, 502, { ok: false, error: 'Could not reach the Claude API' });
      if (e instanceof Anthropic.APIError) return json(res, 502, { ok: false, error: `Claude API error ${e.status}: ${e.message}` });
      return json(res, 500, { ok: false, error: String(e.message || e) });
    }
    const u = r.usage || {};
    const used = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
    usage.set(session, (usage.get(session) || 0) + used);
    console.log(`[claude] ${kind} ${r.model} in=${u.input_tokens} out=${u.output_tokens} cache_read=${u.cache_read_input_tokens || 0} stop=${r.stop_reason}`);
    if (r.stop_reason === 'refusal') return json(res, 502, { ok: false, error: 'refused', remaining: remaining(session, owner) });
    if (r.stop_reason === 'max_tokens') return json(res, 502, { ok: false, error: 'response cut off', remaining: remaining(session, owner) });
    const text = r.content.find((b) => b.type === 'text')?.text;
    if (!text) return json(res, 502, { ok: false, error: 'no text in response' });
    return json(res, 200, { ok: true, text, remaining: remaining(session, owner) });
  }
  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(405); res.end();
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.error(`Port ${PORT} is already in use (is the game already running?). Try: node server.js ${PORT + 1}`); process.exit(1); }
  throw e;
});
server.listen(PORT, () => {
  console.log(`Moscow Rules on http://localhost:${PORT}  (Claude: ${client ? 'on' : 'off - ' + offlineReason})`);
});
