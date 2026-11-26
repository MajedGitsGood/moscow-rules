// Claude as a player (Opus). It sees only viewFor(side), the same fog of war a human gets, and
// returns orders that the engine validates one by one. Anything invalid is dropped; if the call
// fails entirely (no proxy, budget spent, refusal) the heuristic bot plays that week instead.
import { callClaude } from '../llm.js';
import { KARLA, KARLA_PLACEMENT } from '../prompts.js';
import { ARCHETYPES, RULES } from '../world.js';
import { validateOrders, validatePlacement, legalOrders, FEEDABLE, ordersPerWeek } from '../engine.js';
import { heuristicOrders, heuristicPlacement } from './heuristic.js';

const label = (k) => ARCHETYPES[k].label;

// Everything in your own records that bears on whether one of your agents still works for you, across
// the whole game: how their orders turned out, vetting verdicts and accusations. Facts only, no
// verdict; the rules (WORLD) say what a turned agent's failed orders look like. Positions are public,
// so where both agents stood that week is fair to use.
export function loyaltyRecord(game, side, a) {
  const name = (id) => game.agents[id]?.name;
  const inbox = game.inbox[side];
  const at = (x, w) => x.history?.find((h) => h.week === w)?.city;
  const aliveAt = (x, w) => !x.eliminated || x.eliminated.week > w;
  const out = [];
  for (const o of game.orderLog.filter((x) => x.side === side && x.agentId === a.id)) {
    const w = o.week, t = game.agents[o.targetId], said = inbox.filter((m) => m.week === w + 1 && m.from === a.id);
    if (o.type === 'strike' && said.some((m) => /slipped away/.test(m.text))) out.push(`wk ${w}: ordered to strike ${name(o.targetId)}; reported the target "slipped away", though they were in ${at(t, w)} and not lying low`);
    if (o.type === 'approach' && t && at(t, w) === at(a, w) && aliveAt(t, w) && !said.some((m) => m.facts?.approach === t.id || m.facts?.turned === t.id)) out.push(`wk ${w}: pitched ${name(o.targetId)} in ${at(a, w)}; no report came back and the pitch made no progress`);
    if (o.type === 'trap') {
      const night = o.when === 'tonight' ? w : w + 1, city = at(a, w);
      const lost = inbox.filter((m) => m.week === night + 1 && m.kind === 'event' && m.tone === 'loss' && m.city === city && /found dead/.test(m.text));
      if (lost.length && at(a, night) === city) out.push(`wk ${night}: their trap was due that night in ${city}, yet ${lost.map((m) => m.text.replace(/ was found dead.*/, '')).join(', ')} was killed there and no one was caught`);
    }
  }
  for (const m of inbox) {
    if (m.facts?.vet === a.id) out.push(`wk ${m.week}: vetted by ${name(m.from)}: ${m.facts.verdict === 'turned' ? 'TURNED' : 'clean'}`);
    if (m.facts?.accused === a.id) out.push(`wk ${m.week}: ${name(m.from)} accused them of being turned`);
  }
  return out.length ? out : undefined;
}

function summarize(game, view) {
  const name = (id) => game.agents[id]?.name;
  // What each British agent has been seen doing in the last few weeks: certain sightings (a
  // Lamplighter's word, a witness, a Ferret) and footprints, which are only clues.
  const seen = {};
  const verb = { prepare: 'prepared a strike on', strike: 'attacked', trap: 'set a trap', surveil: 'surveilled' };
  const FP = { asking: 'asking about', shadowing: 'turning up where this agent goes:', room: 'took a room overlooking a landmark', faces: 'unfamiliar faces around them', courier: 'met someone off the night train', routine: 'keeping regular hours' };
  for (const m of view.inbox.filter((x) => x.week >= view.week - 3)) {
    for (const act of m.facts?.activities || []) {
      (seen[act.id] ||= []).push(`wk ${m.week}, certain: ${verb[act.kind] || act.kind}${act.targetId ? ' ' + name(act.targetId) : ''} in ${m.city}`);
    }
    for (const fp of m.facts?.signs || []) {
      (seen[fp.id] ||= []).push(`wk ${m.week}, footprint: ${FP[fp.sign] || fp.sign}${fp.targetId ? ' ' + name(fp.targetId) : ''} in ${m.city}`);
    }
  }
  const intelOn = (id) => {
    const i = view.intel[id];
    if (!i) return {};
    const r = i.roles.at(-1);
    return { reportedRole: r ? `${label(r.archetype)} (per ${r.source}, wk ${r.week})` : undefined };
  };
  return {
    week: view.week, weeksTotal: RULES.weeks, ordersAllowed: ordersPerWeek(game), cities: view.cities,
    rosterPerSide: Object.entries(game.roster || RULES.roster).map(([k, n]) => `${n} ${label(k)}${n > 1 ? 's' : ''}`).join(', '),
    score: view.score,
    yourAgents: view.own.filter((a) => a.alive).map((a) => ({
      name: a.name, role: label(a.archetype), city: a.city,
      preparedStrikeOn: a.prep ? name(a.prep.targetId) : undefined,
      canDo: legalOrders(game, view.side, a.id).map((l) => l.targets ? `${l.type} [${l.targets.map(name).join(', ')}]` : l.when ? `${l.type} [${l.when.join(', ')}]` : l.type),
      ...intelOn(a.id),
      loyaltyRecord: loyaltyRecord(game, view.side, game.agents[a.id]),
    })),
    yourLosses: view.own.filter((a) => !a.alive).map((a) => `${a.name} (${label(a.archetype)}), ${a.eliminated.how}, wk ${a.eliminated.week}`),
    yourTraps: view.traps.map((t) => `${t.city} (catches ${t.active ? 'tonight' : 'next week'} only)`),
    yourApproaches: Object.entries(view.approachProgress).map(([id, n]) => `${name(id)}: ${n}/${RULES.approachesToTurn}`),
    britishAgents: view.enemies.filter((e) => e.alive).map((e) => ({
      name: e.name, city: e.city,
      ...(e.asset ? { workingForYou: true, role: label(e.archetype), standingInstruction: e.stance === 'obey' ? 'carry out British orders' : 'make British orders fail' } : intelOn(e.id)),
      seenDoing: seen[e.id],
    })),
    britishLosses: view.enemies.filter((e) => !e.alive).map((e) => e.name),
    trafficThisWeek: view.inbox.filter((m) => m.week === view.week).map((m) => ({ kind: m.kind, from: name(m.from) || 'Station', city: m.city, text: m.text })),
    earlierTraffic: view.inbox.filter((m) => m.week < view.week && m.week >= view.week - 2).map((m) => ({ week: m.week, from: name(m.from) || 'Station', text: m.text })),
    yourJournalSoFar: game.journal[view.side].slice(-4),
  };
}

const ORDER_SCHEMA = {
  type: 'object',
  properties: {
    orders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          type: { type: 'string', enum: ['move', 'surveil', 'lielow', 'prepare', 'strike', 'trap', 'approach', 'vet', 'feed', 'lie'] },
          city: { type: ['string', 'null'], description: 'move: destination' },
          target: { type: ['string', 'null'], description: 'prepare/strike/approach/vet: agent name' },
          when: { type: 'string', enum: ['tonight', 'next', 'none'], description: "trap only: tonight (Ferrets only) or next; 'none' for other orders" },
          fakeType: { type: 'string', enum: [...FEEDABLE, 'none'], description: "feed only: the fake order they are told (its target, city or when go in those fields); 'none' for other orders" },
          lieKind: { type: 'string', enum: ['hide', 'frame', 'alarm', 'none'], description: "lie only (British agents working for you); 'none' for other orders" },
          lieTarget: { type: ['string', 'null'], description: 'lie frame: which British agent to frame' },
          why: { type: 'string', description: 'your reason for this order: one short sentence, at most 15 words' },
        },
        required: ['agent', 'type', 'city', 'target', 'when', 'fakeType', 'lieKind', 'lieTarget', 'why'],
        additionalProperties: false,
      },
    },
    execute: { type: 'array', items: { type: 'string' }, description: 'names of your own agents to execute now' },
    resign: { type: 'boolean', description: 'true only if the game is lost beyond any realistic recovery' },
    instructions: { type: 'array', description: 'Standing instructions for British agents working for you', items: { type: 'object', properties: { agent: { type: 'string' }, stance: { type: 'string', enum: ['obey', 'sabotage'] } }, required: ['agent', 'stance'], additionalProperties: false } },
    journal: { type: 'string' },
  },
  required: ['orders', 'execute', 'instructions', 'resign', 'journal'],
  additionalProperties: false,
};

function toOrders(game, side, r) {
  const byName = (n) => n && Object.values(game.agents).find((a) => a.name.toLowerCase() === n.toLowerCase());
  const city = (c) => game.cities.find((x) => x.toLowerCase() === (c || '').toLowerCase());
  const valid = [];
  for (const c of r.orders) {
    const a = byName(c.agent);
    if (!a) continue;
    const o = { agentId: a.id, type: c.type };
    if (c.type === 'move') o.city = city(c.city);
    if (['prepare', 'strike', 'approach', 'vet'].includes(c.type)) o.targetId = byName(c.target)?.id;
    // Keep only the sentence: a stray tail of JSON ("','lieTarget':null}") is cut off.
    if (c.why) o.why = String(c.why).split(/['"]\s*[,}]/)[0].replace(/\s+/g, ' ').replace(/['",\s]+$/, '').trim().slice(0, 120);
    if (c.type === 'trap') o.when = c.when === 'tonight' && a.archetype === 'ferret' ? 'tonight' : 'next';
    if (c.type === 'feed') {
      const f = { type: c.fakeType };
      if (['prepare', 'strike', 'approach', 'vet'].includes(f.type)) f.targetId = byName(c.target)?.id;
      if (f.type === 'move') f.city = city(c.city);
      if (f.type === 'trap') f.when = c.when === 'tonight' && a.archetype === 'ferret' ? 'tonight' : 'next';
      o.fake = f;
    }
    if (c.type === 'lie') o.lie = { kind: ['frame', 'alarm'].includes(c.lieKind) ? c.lieKind : 'hide', targetId: byName(c.lieTarget)?.id };
    if (!validateOrders(game, side, [...valid, o]).length) valid.push(o);
    if (valid.length >= ordersPerWeek(game)) break;
  }
  const executions = (r.execute || []).map(byName).filter((a) => a && a.side === side && a.alive).map((a) => a.id);
  const stances = (r.instructions || []).map((x) => ({ id: byName(x.agent)?.id, stance: x.stance })).filter((x) => x.id && game.agents[x.id].turnedBy === side);
  return { orders: valid, executions, stances, resign: r.resign === true };
}

export async function claudeOrders(game, side, view) {
  try {
    // A refusal is usually a one-off: ask once more before handing the week to the offline bot.
    const ask = () => callClaude('karla', { system: KARLA, user: JSON.stringify(summarize(game, view)), schema: ORDER_SCHEMA, maxTokens: 8000 });
    let r;
    try { r = await ask(); } catch (e) { if (!/refus/i.test(e.message)) throw e; r = await ask(); }
    return { ...toOrders(game, side, r), journal: r.journal, via: 'claude' };
  } catch (e) {
    console.warn('Karla fell back to the offline bot:', e.message);
    // Leave a trace in the debrief, so a passive week can be explained.
    return { orders: heuristicOrders(game, view, game.seed), executions: [], stances: [], resign: false, journal: `(This week's orders came from the offline bot: ${e.message})`, via: 'bot', error: e.message };
  }
}

const PLACEMENT_SCHEMA = {
  type: 'object',
  properties: {
    placement: { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' }, city: { type: 'string' } }, required: ['agent', 'city'], additionalProperties: false } },
    journal: { type: 'string' },
  },
  required: ['placement', 'journal'],
  additionalProperties: false,
};

export async function claudePlacement(game, side, view) {
  try {
    const user = JSON.stringify({
      cities: view.cities,
      yourAgents: view.own.map((a) => ({ name: a.name, role: label(a.archetype) })),
      britishAgentsWorkingForYou: view.enemies.filter((e) => e.asset).map((e) => ({ name: e.name, role: label(e.archetype) })),
    });
    const r = await callClaude('karla', { system: KARLA_PLACEMENT, user, schema: PLACEMENT_SCHEMA, maxTokens: 4000 });
    const placement = {};
    for (const p of r.placement) {
      const a = view.own.find((x) => x.name.toLowerCase() === p.agent.toLowerCase());
      const city = view.cities.find((c) => c.toLowerCase() === p.city.toLowerCase());
      if (a && city) placement[a.id] = city;
    }
    if (validatePlacement(game, side, placement).length) throw new Error('invalid placement');
    return { placement, journal: r.journal, via: 'claude' };
  } catch (e) {
    console.warn('Karla placement fell back:', e.message);
    return { placement: heuristicPlacement(view, game.seed), journal: null, via: 'bot' };
  }
}
