// The hosted Claude proxy: a Cloudflare Worker that does what server.js does locally, for the game
// served from GitHub Pages. The browser never sees the API key.
//
// Because it is public, it is locked down:
//   - it only accepts the game's own system prompts (they are byte-stable, so they can be compared
//     exactly), each paired with the call kind that uses it, and caps the size of the game data;
//   - each visitor (by IP) gets a daily token budget, and the whole site a global daily cap; once
//     either is spent the game quietly plays offline (the same 402 the local server sends);
//   - the owner token (a secret) skips both budgets;
//   - only the site's own origin may call it (CORS).
//
// Settings: secrets ANTHROPIC_API_KEY and OWNER_TOKEN (wrangler secret put ...); vars in wrangler.toml.
// See worker/README.md for deployment.
import { MODELS, MAX_TOKENS, EFFORT } from '../api/models.js';
import { KARLA, KARLA_PLACEMENT, VOICE, VOICE_PLAIN, DEBRIEF, DEBRIEF_PLAIN } from '../js/prompts.js';

const PROMPTS = { karla: [KARLA, KARLA_PLACEMENT], voice: [VOICE, VOICE_PLAIN], debrief: [DEBRIEF, DEBRIEF_PLAIN] };
const MAX_USER_CHARS = 60_000; // the largest real request (a late-game Karla view) is well under this
const API = 'https://api.anthropic.com/v1/messages';

const day = () => new Date().toISOString().slice(0, 10);

function cors(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session, X-Owner-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (env, req, code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(env, req) } });

// Token budgets in KV. Not transactional, which is fine for a spending guard.
async function budget(env, ip) {
  const d = day(), visitorKey = `v:${d}:${ip}`, siteKey = `site:${d}`;
  const [v, s] = await Promise.all([env.BUDGET.get(visitorKey), env.BUDGET.get(siteKey)]);
  const visitorLeft = Number(env.VISITOR_DAILY_TOKENS) - Number(v || 0);
  const siteLeft = Number(env.SITE_DAILY_TOKENS) - Number(s || 0);
  return {
    left: Math.max(0, Math.min(visitorLeft, siteLeft)),
    siteSpent: siteLeft <= 0,
    async spend(n) {
      const ttl = { expirationTtl: 60 * 60 * 48 };
      await Promise.all([env.BUDGET.put(visitorKey, String(Number(v || 0) + n), ttl), env.BUDGET.put(siteKey, String(Number(s || 0) + n), ttl)]);
    },
  };
}

async function callClaude(env, kind, system, user, schema, maxTokens) {
  const body = {
    model: MODELS[kind],
    max_tokens: Math.min(Number(maxTokens) || MAX_TOKENS[kind], MAX_TOKENS[kind]),
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
    output_config: { effort: EFFORT[kind], format: { type: 'json_schema', schema } },
  };
  const headers = { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' };
  const post = (b, h) => fetch(API, { method: 'POST', headers: h, body: JSON.stringify(b) });
  if (kind === 'voice') return post({ ...body, thinking: { type: 'disabled' } }, headers);
  // Opus: server-side refusal fallbacks if the API offers them; plain call otherwise.
  const r = await post({ ...body, fallbacks: 'default' }, { ...headers, 'anthropic-beta': 'server-side-fallback-2026-07-01' });
  return r.status === 400 ? post(body, headers) : r;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
    const owner = !!env.OWNER_TOKEN && req.headers.get('X-Owner-Token') === env.OWNER_TOKEN;
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const hasKey = !!env.ANTHROPIC_API_KEY;

    if (req.method === 'GET' && url.pathname === '/api/status') {
      const b = owner ? null : await budget(env, ip);
      return json(env, req, 200, { llm: hasKey && (owner || b.left > 0), owner, remaining: owner ? null : b.left, reason: !hasKey ? 'Claude is not configured.' : b && b.left <= 0 ? (b.siteSpent ? "Today's Claude budget is spent; playing offline." : 'Your Claude budget for today is spent; playing offline.') : null, models: MODELS });
    }

    if (req.method === 'POST' && url.pathname === '/api/claude') {
      if (!hasKey) return json(env, req, 503, { ok: false, error: 'Claude is not configured.' });
      let body;
      try { body = await req.json(); } catch { return json(env, req, 400, { ok: false, error: 'bad request body' }); }
      const { kind, system, user, schema, max_tokens: maxTokens } = body || {};
      if (!PROMPTS[kind]?.includes(system) || typeof user !== 'string' || user.length > MAX_USER_CHARS || !schema || typeof schema !== 'object') {
        return json(env, req, 400, { ok: false, error: 'bad request' });
      }
      const b = owner ? null : await budget(env, ip);
      if (b && b.left <= 0) return json(env, req, 402, { ok: false, error: b.siteSpent ? "Today's Claude budget is spent; the game continues offline." : 'Your Claude budget for today is spent; the game continues offline.', remaining: 0 });

      let r, j;
      try { r = await callClaude(env, kind, system, user, schema, maxTokens); j = await r.json(); } catch { return json(env, req, 502, { ok: false, error: 'Could not reach the Claude API' }); }
      if (r.status === 429) return json(env, req, 429, { ok: false, error: 'rate limited' });
      if (r.status === 401 || r.status === 403) return json(env, req, 503, { ok: false, error: "The server's Anthropic credentials were rejected." });
      if (!r.ok) return json(env, req, 502, { ok: false, error: `Claude API error ${r.status}: ${j?.error?.message || ''}`.trim() });

      const u = j.usage || {};
      const used = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
      if (b) await b.spend(used);
      const left = b ? Math.max(0, b.left - used) : null;
      if (j.stop_reason === 'refusal') return json(env, req, 502, { ok: false, error: 'refused', remaining: left });
      if (j.stop_reason === 'max_tokens') return json(env, req, 502, { ok: false, error: 'response cut off', remaining: left });
      const text = (j.content || []).find((c) => c.type === 'text')?.text;
      if (!text) return json(env, req, 502, { ok: false, error: 'no text in response' });
      return json(env, req, 200, { ok: true, text, remaining: left });
    }
    return json(env, req, 404, { ok: false, error: 'not found' });
  },
};
