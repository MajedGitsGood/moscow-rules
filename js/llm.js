// Single gateway to Claude, through the local proxy at /api/claude (serve.py now, a Worker later).
// The browser never holds an API key. The server chooses the model per call kind
// (karla → Opus, everything else → Haiku) and enforces the token budget; this file just
// tracks what's left and lets callers fall back cleanly when Claude is unavailable.

const SESSION_KEY = 'mr-session';
let status = { llm: false, checked: false, owner: false, remaining: null };

function sessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch { return 'nostorage'; }
}
function ownerToken() {
  try { return localStorage.getItem('mr-owner') || ''; } catch { return ''; }
}

export async function checkLLM() {
  try {
    const r = await fetch('/api/status', { headers: { 'X-Session': sessionId(), 'X-Owner-Token': ownerToken() } });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    status = { llm: !!j.llm, checked: true, owner: !!j.owner, remaining: j.remaining ?? null, reason: j.reason };
  } catch {
    status = { llm: false, checked: true, owner: false, remaining: null, reason: 'No proxy (static hosting or offline).' };
  }
  return status;
}
export const llmStatus = () => status;

export class LLMUnavailable extends Error {}

// kind: 'karla' | 'interpret' | 'voice'. Returns parsed JSON (all calls use structured output).
export async function callClaude(kind, { system, user, schema, maxTokens }) {
  if (!status.llm) throw new LLMUnavailable(status.reason || 'LLM off');
  let r;
  try {
    r = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session': sessionId(), 'X-Owner-Token': ownerToken() },
      body: JSON.stringify({ kind, system, user, schema, max_tokens: maxTokens }),
    });
  } catch (e) {
    throw new LLMUnavailable('Proxy unreachable');
  }
  const j = await r.json().catch(() => ({}));
  if (j.remaining !== undefined) status.remaining = j.remaining;
  if (r.status === 402 || r.status === 503) {
    status.llm = false;
    status.reason = j.error || 'Budget exhausted';
    throw new LLMUnavailable(status.reason);
  }
  if (!r.ok || !j.ok) throw new Error(j.error || `Claude call failed (${r.status})`);
  return JSON.parse(j.text);
}
