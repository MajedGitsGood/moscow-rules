// Agent voices for the morning traffic (Haiku, template fallback). Claude only rewrites what the
// engine already reported; factsCheck makes sure no rewrite adds, drops or changes a fact.
import { callClaude, LLMUnavailable } from './llm.js';
import { VOICE, VOICE_PLAIN } from './prompts.js';
import { lexMode } from './lexicon.js';
import { ARCHETYPES } from './world.js';

// Guard against invented intelligence. Text Claude writes for an agent may only mention the cities
// and agents that appear in its source (the cable, or the engine's template), and may not describe
// a place as quiet/empty/etc. unless the source already does. Anything else falls back to template.
const OBSERVATION = /\b(quiet|calm|empty|deserted|nothing (to report|stirring|doing)|no sign|no one|nobody|all clear|clean|no opposition|nothing here)\b/i;
// Footprints are ambiguous on purpose: a rewrite may not turn one into a verdict (a strike, a trap,
// surveillance) unless the source already names it.
const VERDICT = /\b(prepar\w*|trap\w*|strik\w*|surveil\w*|hunt\w*|kill\w*|target\w*|assassin\w*|ambush\w*|stak\w* out|casing)\b/i;
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
  if (VERDICT.test(candidate) && !VERDICT.test(source)) return false;
  return true;
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
// template msg.text stays the source of truth.
export async function voiceMorning(game, side) {
  const fresh = game.inbox[side].filter((m) => m.week === game.week && !m.voiced && m.kind !== 'briefing');
  if (!fresh.length) return;
  const senderOf = (m) => {
    const a = m.from ? game.agents[m.from] : null;
    if (!a) return { label: 'Station (headquarters staff)', facts: '' };
    const what = a.side === side ? `our ${ARCHETYPES[a.archetype].label}` : 'their agent, secretly working for us';
    return { label: `${a.first} ${a.name}, ${what}, in ${m.city}`, facts: `${a.first} ${a.name} ${m.city || ''}` };
  };
  try {
    const user = JSON.stringify({
      reader: side === 'control' ? 'Control, head of the Circus' : 'Karla, head of Moscow Centre',
      messages: fresh.map((m) => ({ id: m.id, kind: m.kind, from: senderOf(m).label, text: m.text })),
    });
    const r = await callClaude('voice', { system: lexMode() === 'smiley' ? VOICE : VOICE_PLAIN, user, schema: VOICE_SCHEMA, maxTokens: 2000 });
    for (const v of r.messages) {
      const m = fresh.find((x) => x.id === v.id);
      if (!m) continue;
      const extra = senderOf(m).facts;
      if (factsCheck(game, `${m.text} ${extra}`, v.text) && factsCheck(game, m.text, `${v.text} ${extra}`, { preserve: true })) m.voiced = v.text;
      else console.warn('voice rewrite dropped (changed facts):', v.text);
    }
  } catch (e) {
    if (!(e instanceof LLMUnavailable)) console.warn('voices fell back:', e.message);
  }
}
