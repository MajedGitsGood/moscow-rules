// Offline cable interpreter: keyword matching, used when no LLM is available (and as a safety net
// if the LLM returns something unusable). Turns free text into one engine order.
import { ARCHETYPES } from './world.js';

const VERBS = {
  strike: /\b(kill|eliminat\w*|strike|hit|remove|terminat\w*|liquidat\w*|assassinat\w*|take (him|her|them) out|take care of|deal with|neutrali[sz]e|wet work|clean house|(doesn't|does not|won't|never) see)\b/i,
  expose: /\b(expose|burn|blow (him|her|them|(his|her|their) cover)|unmask|out (him|her|them))\b/i,
  recruit: /\b(recruit|turn|approach|pitch|cultivate|flip|buy|befriend|sound out|quiet word|(has|have) a price)\b/i,
  watch: /\b(watch|observe|surveil\w*|report|look|see|scout|eyes on|count|who('s| is| are)|anyone|anybody|what('s| is) (happening|going on|the picture)|picture|worth talking to)\b/i,
  move: /\b(go|move|travel|proceed|relocate|head|get to|transfer|fly|drive|take the train|cross)\b/i,
  lielow: /\b(lie low|stay put|hold|wait|do nothing|stand down|sit tight|go quiet)\b/i,
};

export function keywordInterpret({ agent, text, cities, enemies }) {
  const t = ` ${text} `;
  const city = cities.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(t)) || null;
  const target = enemies.find((e) => new RegExp(`\\b${e.name}\\b`, 'i').test(t)) || null;
  let order = null;
  for (const k of ['strike', 'expose', 'recruit', 'lielow', 'watch', 'move']) {
    if (VERBS[k].test(t)) { order = k; break; }
  }
  // Naming another city means going there first: nothing else can happen until they arrive.
  if (order !== 'lielow' && city && city !== agent.city) order = 'move';
  if (order === 'move' && (!city || city === agent.city)) order = city ? 'lielow' : null;
  return finalize({ agent, order, city, targetId: target ? target.id : 'any', clarity: order ? 0.8 : 0.2 });
}

// Shared by both interpreters: check the order fits the agent, and build the in-character reply.
export function finalize({ agent, order, city, targetId, clarity, reply }) {
  const role = ARCHETYPES[agent.archetype].label;
  if (!order || clarity < 0.5) {
    return { type: 'lielow', unclear: true, reply: reply || `I don't follow your cable. I'm holding in ${agent.city} until you tell me plainly what you want.` };
  }
  const mismatch =
    (order === 'strike' && agent.archetype !== 'scalphunter') ||
    (order === 'expose' && agent.archetype !== 'lamplighter') ||
    (order === 'recruit' && agent.archetype !== 'talentspotter');
  if (mismatch) {
    return { type: 'lielow', unclear: true, reply: `That isn't my line of work. I'm a ${role}. Holding in ${agent.city}.` };
  }
  const o = { type: order, reply };
  if (order === 'move') o.city = city;
  if (['strike', 'expose', 'recruit'].includes(order)) o.targetId = targetId || 'any';
  return o;
}

export function describeOrder(o, game) {
  const name = (id) => (id && id !== 'any' ? game.agents[id]?.name : null);
  switch (o.type) {
    case 'move': return `Move to ${o.city}`;
    case 'watch': return 'Watch their city and report';
    case 'strike': return name(o.targetId) ? `Strike at ${name(o.targetId)}` : 'Strike at whoever is there';
    case 'expose': return name(o.targetId) ? `Expose ${name(o.targetId)} as a Ferret` : 'Expose any Ferret there';
    case 'recruit': return name(o.targetId) ? `Recruit ${name(o.targetId)}` : 'Recruit whoever is there';
    case 'feed': return 'Pass this story to their handler';
    default: return o.unclear ? 'Unclear; will hold position' : 'Lie low';
  }
}
