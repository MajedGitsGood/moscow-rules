// Cable pipeline: free text → engine order (Haiku interpreter, keyword fallback), and agent voices
// for the morning traffic (Haiku, template fallback). Neither ever decides what is true.
import { callClaude, LLMUnavailable } from './llm.js';
import { INTERPRETER, VOICE } from './prompts.js';
import { keywordInterpret, finalize } from './interpret.js';
import { ARCHETYPES, other } from './world.js';
import { viewFor } from './engine.js';

const INTERPRET_SCHEMA = {
  type: 'object',
  properties: {
    order: { type: 'string', enum: ['move', 'watch', 'strike', 'expose', 'recruit', 'lielow'] },
    city: { type: ['string', 'null'] },
    target: { type: ['string', 'null'] },
    clarity: { type: 'number' },
    reply: { type: 'string' },
  },
  required: ['order', 'city', 'target', 'clarity', 'reply'],
  additionalProperties: false,
};

function enemiesKnown(game, side) {
  return Object.values(viewFor(game, side).sightings)
    .filter((s) => s.fate !== 'eliminated')
    .map((s) => ({ id: s.id, name: s.name }));
}

// Guard against invented intelligence. Text Claude writes for an agent may only mention the cities
// and agents that appear in its source (the cable, or the engine's template), and may not describe
// a place as quiet/empty/etc. unless the source already does. Anything else falls back to template.
const OBSERVATION = /\b(quiet|calm|empty|deserted|nothing (to report|stirring|doing)|no sign|no one|nobody|all clear|clean|no opposition|nothing here)\b/i;
// With `preserve`, every name, city and role in the source must also survive into the candidate.
export function factsCheck(game, source, candidate, { preserve = false } = {}) {
  if (!candidate) return false;
  // Key facts: cities, surnames, roles. First names may be dropped but never invented.
  const key = [...game.cities, ...Object.values(game.agents).map((a) => a.name),
    ...Object.values(ARCHETYPES).map((a) => a.label.replace('-', '.?'))];
  const firsts = Object.values(game.agents).map((a) => a.first);
  const has = (t, w, f = 'i') => new RegExp(`\\b${w}\\b`, f).test(t);
  for (const w of key) if (has(candidate, w) && !has(source, w)) return false;
  // First names are case-sensitive so "Guy" the agent doesn't trip on "a guy".
  for (const w of firsts) if (has(candidate, w, '') && !has(source, w, '')) return false;
  if (preserve) for (const w of key) if (has(source, w) && !has(candidate, w)) return false;
  if (OBSERVATION.test(candidate) && !OBSERVATION.test(source)) return false;
  return true;
}

// Returns an engine order (minus agentId/text, which the caller adds) plus `via`.
export async function interpretCable(game, side, agentId, text) {
  const agent = game.agents[agentId];
  // Feeding a turned enemy asset needs no interpretation: the text is the story.
  if (agent.side !== side) return { type: 'feed', message: text, via: 'direct' };
  const enemies = enemiesKnown(game, side);
  try {
    const user = JSON.stringify({
      agent: { name: `${agent.first} ${agent.name}`, archetype: ARCHETYPES[agent.archetype].label, city: agent.city, serves: side === 'control' ? 'the Circus (British)' : 'Moscow Centre' },
      cities: game.cities,
      knownEnemyAgents: enemies.map((e) => e.name),
      cable: text,
    });
    const r = await callClaude('interpret', { system: INTERPRETER, user, schema: INTERPRET_SCHEMA, maxTokens: 400 });
    let targetId = null;
    if (r.target === 'any') targetId = 'any';
    else if (r.target) {
      const e = enemies.find((x) => x.name.toLowerCase() === r.target.toLowerCase() || r.target.toLowerCase().includes(x.name.toLowerCase()));
      targetId = e ? e.id : 'any';
    }
    const city = game.cities.find((c) => c.toLowerCase() === (r.city || '').toLowerCase()) || null;
    let order = r.order;
    if (order === 'move' && (!city || city === agent.city)) order = city ? 'lielow' : null;
    // The agent hasn't done anything yet, so its reply may only echo the cable and its own whereabouts.
    const self = `${agent.city} ${agent.first} ${agent.name} ${ARCHETYPES[agent.archetype].label}`;
    const reply = factsCheck(game, `${text} ${self}`, r.reply) ? r.reply : undefined;
    return { ...finalize({ agent, order, city, targetId, clarity: r.clarity, reply }), via: 'claude' };
  } catch (e) {
    if (!(e instanceof LLMUnavailable)) console.warn('interpreter fell back:', e.message);
    return { ...keywordInterpret({ agent, text, cities: game.cities, enemies }), via: 'keywords' };
  }
}

const VOICE_SCHEMA = {
  type: 'object',
  properties: {
    messages: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'], additionalProperties: false } },
  },
  required: ['messages'],
  additionalProperties: false,
};

// Rewrites this week's incoming messages for one side in character. Stores msg.voiced; the
// template msg.text stays as the source of truth (and is what the notebook parses).
export async function voiceMorning(game, side) {
  // Leaks are verbatim, briefings are fixed, and clarification replies were already written in
  // character (and fact-checked) when the cable was read.
  const fresh = game.inbox[side].filter((m) => m.week === game.week && !m.voiced && !['leak', 'briefing', 'clarify'].includes(m.kind));
  if (!fresh.length) return;
  const agentOf = (m) => (m.agentId ? game.agents[m.agentId] : null);
  try {
    const user = JSON.stringify({
      reader: side === 'control' ? 'Control, head of the Circus' : 'Karla, head of Moscow Centre',
      messages: fresh.map((m) => {
        const a = agentOf(m);
        const sender = m.from === 'Station' ? 'Station (headquarters staff)' : `${m.from}${a && a.side === side ? `, our ${ARCHETYPES[a.archetype].label}` : ''}`;
        return { id: m.id, kind: m.kind, from: sender, text: m.text };
      }),
    });
    const r = await callClaude('voice', { system: VOICE, user, schema: VOICE_SCHEMA, maxTokens: 1500 });
    for (const v of r.messages) {
      const m = fresh.find((x) => x.id === v.id);
      if (m && factsCheck(game, `${m.text} ${m.from}`, v.text) && factsCheck(game, m.text, `${v.text} ${m.from}`, { preserve: true })) m.voiced = v.text;
      else if (m) console.warn('voice rewrite dropped (added facts):', v.text);
    }
  } catch (e) {
    if (!(e instanceof LLMUnavailable)) console.warn('voices fell back:', e.message);
  }
}

export { other };
