// Claude as a player (Opus). It sees only viewFor(side), the same fog-of-war a human gets,
// and returns cables (text + intended order) that the engine validates. If anything goes wrong
// (no proxy, budget spent, invalid output) it falls back to the heuristic bot for that week.
import { callClaude } from '../llm.js';
import { KARLA, KARLA_PLACEMENT } from '../prompts.js';
import { ARCHETYPES, RULES } from '../world.js';
import { validateOrders, validatePlacement } from '../engine.js';
import { heuristicOrders, heuristicPlacement } from './heuristic.js';

const lastClaim = (s) => (s.claims.length ? s.claims[s.claims.length - 1] : null);

// A compact, readable rendering of the view, so Opus spends tokens on thinking, not parsing.
function summarize(view, journal) {
  const label = (k) => ARCHETYPES[k].label;
  return {
    week: view.week,
    weeksTotal: RULES.weeks,
    cities: view.cities,
    limits: view.limits,
    tally: view.tally,
    yourAgents: view.own.filter((a) => a.alive).map((a) => ({ name: a.name, archetype: label(a.archetype), city: a.city })),
    yourLosses: view.own.filter((a) => !a.alive).map((a) => ({ name: a.name, archetype: label(a.archetype), how: a.eliminated.how, week: a.eliminated.week })),
    britishAgentsYouHaveTurned: view.assets.map((a) => ({ name: a.name, archetype: label(a.archetype), city: a.city })),
    britishAgentsSighted: Object.values(view.sightings).map((s) => {
      const c = lastClaim(s);
      return { name: s.name, lastSeen: s.lastCity, week: s.lastWeek, reportedArchetype: c ? `${label(c.archetype)} (per ${c.source}, wk ${c.week})` : 'unknown', status: s.fate || 'active' };
    }),
    trafficThisWeek: view.inbox.filter((m) => m.week === view.week).map((m) => ({ kind: m.kind, from: m.from, text: m.text })),
    earlierTraffic: view.inbox.filter((m) => m.week < view.week && m.week >= view.week - 3).map((m) => ({ week: m.week, kind: m.kind, from: m.from, text: m.text })),
    yourJournalSoFar: journal.slice(-4),
  };
}

const ORDER_SCHEMA = {
  type: 'object',
  properties: {
    cables: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          text: { type: 'string' },
          order: { type: 'string', enum: ['move', 'watch', 'strike', 'expose', 'recruit', 'lielow', 'feed'] },
          city: { type: ['string', 'null'] },
          target: { type: ['string', 'null'] },
        },
        required: ['agent', 'text', 'order', 'city', 'target'],
        additionalProperties: false,
      },
    },
    journal: { type: 'string' },
  },
  required: ['cables', 'journal'],
  additionalProperties: false,
};

function toOrders(game, side, view, r) {
  const byName = (n, pool) => pool.find((a) => n && (a.name.toLowerCase() === n.toLowerCase() || n.toLowerCase().includes(a.name.toLowerCase())));
  const mine = view.own.filter((a) => a.alive);
  const enemies = Object.values(view.sightings).filter((s) => s.fate !== 'eliminated');
  const orders = [];
  for (const c of r.cables.slice(0, RULES.cablesPerWeek)) {
    const a = c.order === 'feed' ? byName(c.agent, view.assets) : byName(c.agent, mine);
    if (!a || orders.some((o) => o.agentId === a.id)) continue;
    const o = { agentId: a.id, type: c.order, text: c.text };
    if (c.order === 'feed') o.message = c.text;
    if (c.order === 'move') o.city = view.cities.find((x) => x.toLowerCase() === (c.city || '').toLowerCase());
    if (['strike', 'expose', 'recruit'].includes(c.order)) {
      const t = c.target && c.target !== 'any' ? byName(c.target, enemies) : null;
      o.targetId = t ? t.id : 'any';
    }
    if (o.type === 'move' && !o.city) continue;
    orders.push(o);
  }
  // Drop anything the engine would reject, one order at a time.
  const valid = [];
  for (const o of orders) if (!validateOrders(game, side, [...valid, o]).length) valid.push(o);
  return valid;
}

export async function claudeOrders(game, side, view) {
  try {
    const r = await callClaude('karla', { system: KARLA, user: JSON.stringify(summarize(view, game.journal[side])), schema: ORDER_SCHEMA, maxTokens: 6000 });
    return { orders: toOrders(game, side, view, r), journal: r.journal, via: 'claude' };
  } catch (e) {
    console.warn('Karla fell back to the offline bot:', e.message);
    return { orders: heuristicOrders(view, game.seed), journal: null, via: 'bot' };
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
    const user = JSON.stringify({ cities: view.cities, yourAgents: view.own.map((a) => ({ name: a.name, archetype: ARCHETYPES[a.archetype].label })), britishAgentsYouHaveTurned: view.assets.map((a) => ({ name: a.name, archetype: ARCHETYPES[a.archetype].label })) });
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
