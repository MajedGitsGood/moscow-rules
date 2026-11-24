// Claude as a player (Opus). It sees only viewFor(side), the same fog of war a human gets, and
// returns orders that the engine validates one by one. Anything invalid is dropped; if the call
// fails entirely (no proxy, budget spent, refusal) the heuristic bot plays that week instead.
import { callClaude } from '../llm.js';
import { KARLA, KARLA_PLACEMENT } from '../prompts.js';
import { ARCHETYPES, RULES } from '../world.js';
import { validateOrders, validatePlacement, legalOrders } from '../engine.js';
import { heuristicOrders, heuristicPlacement } from './heuristic.js';

const label = (k) => ARCHETYPES[k].label;

function summarize(game, view) {
  const name = (id) => game.agents[id]?.name;
  const intelOn = (id) => {
    const i = view.intel[id];
    if (!i) return {};
    const r = i.roles.at(-1);
    return {
      reportedRole: r ? `${label(r.archetype)} (per ${r.source}, wk ${r.week})` : undefined,
      suspicions: i.suspicions.length ? i.suspicions.map((s) => `${s.kind} by ${s.source}, wk ${s.week}`) : undefined,
    };
  };
  return {
    week: view.week, weeksTotal: RULES.weeks, ordersAllowed: RULES.ordersPerWeek, cities: view.cities,
    score: view.score,
    yourAgents: view.own.filter((a) => a.alive).map((a) => ({
      name: a.name, role: label(a.archetype), city: a.city,
      preparedStrikeOn: a.prep ? name(a.prep.targetId) : undefined,
      canDo: legalOrders(game, view.side, a.id).map((l) => l.targets ? `${l.type} [${l.targets.map(name).join(', ')}]` : l.type),
      ...intelOn(a.id),
    })),
    yourLosses: view.own.filter((a) => !a.alive).map((a) => `${a.name} (${label(a.archetype)}), ${a.eliminated.how}, wk ${a.eliminated.week}`),
    yourTraps: view.traps.map((t) => `${t.city} (${t.active ? 'ready' : 'ready next week'})`),
    yourApproaches: Object.entries(view.approachProgress).map(([id, n]) => `${name(id)}: ${n}/${RULES.approachesToTurn}`),
    britishAgents: view.enemies.filter((e) => e.alive).map((e) => ({
      name: e.name, cover: e.cover, city: e.city,
      ...(e.asset ? { workingForYou: true, role: label(e.archetype) } : intelOn(e.id)),
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
          type: { type: 'string', enum: ['move', 'surveil', 'lielow', 'prepare', 'strike', 'trap', 'approach', 'vet', 'brief', 'lie'] },
          city: { type: ['string', 'null'], description: 'move: destination' },
          target: { type: ['string', 'null'], description: 'prepare/strike/approach/vet: agent name' },
          planKind: { type: ['string', 'null'], enum: ['strike', 'trap', null], description: 'brief only' },
          planCity: { type: ['string', 'null'], description: 'brief only' },
          lieKind: { type: ['string', 'null'], enum: ['hide', 'frame', 'alarm', null], description: 'lie only (British agents working for you)' },
          lieTarget: { type: ['string', 'null'], description: 'lie frame: which British agent to frame' },
        },
        required: ['agent', 'type', 'city', 'target', 'planKind', 'planCity', 'lieKind', 'lieTarget'],
        additionalProperties: false,
      },
    },
    execute: { type: 'array', items: { type: 'string' } },
    journal: { type: 'string' },
  },
  required: ['orders', 'execute', 'journal'],
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
    if (c.type === 'brief') o.plan = { kind: c.planKind || 'strike', city: city(c.planCity) };
    if (c.type === 'lie') o.lie = { kind: c.lieKind || 'hide', targetId: byName(c.lieTarget)?.id };
    if (!validateOrders(game, side, [...valid, o]).length) valid.push(o);
    if (valid.length >= RULES.ordersPerWeek) break;
  }
  const executions = (r.execute || []).map(byName).filter((a) => a && a.side === side && a.alive).map((a) => a.id);
  return { orders: valid, executions };
}

export async function claudeOrders(game, side, view) {
  try {
    const r = await callClaude('karla', { system: KARLA, user: JSON.stringify(summarize(game, view)), schema: ORDER_SCHEMA, maxTokens: 8000 });
    return { ...toOrders(game, side, r), journal: r.journal, via: 'claude' };
  } catch (e) {
    console.warn('Karla fell back to the offline bot:', e.message);
    return { orders: heuristicOrders(game, view, game.seed), executions: [], journal: null, via: 'bot' };
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
      yourAgents: view.own.map((a) => ({ name: a.name, role: label(a.archetype), cover: a.cover })),
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
