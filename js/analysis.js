// The after-action analysis for the debrief. Builds a compact record of the finished game (full
// truth: roles, moles, both sides' orders, what each side was told), finds the moments that
// mattered with simple rules, then asks Claude (Opus) to write the story. Offline, the rule-based
// moments are used directly.
import { callClaude, LLMUnavailable } from './llm.js';
import { DEBRIEF } from './prompts.js';
import { ARCHETYPES, SIDES, SIDE_LABEL } from './world.js';
import { describeOrder } from './engine.js';

const other = (s) => (s === 'control' ? 'karla' : 'control');
const role = (k) => ARCHETYPES[k].label;

export const lastWeek = (game) => Math.max(1, ...game.orderLog.map((x) => x.week));

// Agents standing (alive and loyal) for each side at the end of week w.
export function standingAt(game, w) {
  const out = { control: 0, karla: 0 };
  for (const a of Object.values(game.agents)) {
    const dead = a.eliminated && a.eliminated.week <= w;
    const turned = a.turnedBy && a.turnedWeek && a.turnedWeek <= w;
    if (!dead && !turned) out[a.side]++;
  }
  return out;
}

const cityAt = (a, w) => { let c = a.history[0]?.city; for (const h of a.history) if (h.week <= w) c = h.city; return c; };

// Facts the rules can see on their own: recruitments, ignored warnings, undefended targets, executions.
export function findMoments(game) {
  const moments = [];
  const last = lastWeek(game);
  const inboxAt = (side, w) => game.inbox[side].filter((m) => m.week === w);
  for (const a of Object.values(game.agents)) {
    if (a.turnedWeek) {
      moments.push({ week: a.turnedWeek, side: a.turnedBy, kind: 'recruitment', city: cityAt(a, a.turnedWeek), title: `${a.name} turned by ${SIDE_LABEL[a.turnedBy]}`,
        detail: `${SIDE_LABEL[a.side]}'s ${role(a.archetype)} ${a.first} ${a.name} began working for ${SIDE_LABEL[a.turnedBy]}${a.alive ? ' and was never caught' : ''}.` });
    }
    const e = a.eliminated;
    if (!e) continue;
    const by = e.by;
    if (e.how === 'trapped') {
      const warned = inboxAt(a.side, e.week).some((m) => m.city === e.city && (m.facts?.activities || []).some((x) => x.kind === 'trap'));
      moments.push({ week: e.week, side: by, kind: warned ? 'mistake' : 'strike', city: e.city, title: warned ? `${a.name} ignored a trap warning` : `${SIDE_LABEL[by]}'s trap catches ${a.name}`,
        detail: warned ? `${SIDE_LABEL[a.side]} had been told something was being set up in ${e.city}, and sent ${a.name} in anyway.` : `${a.first} ${a.name} (${role(a.archetype)}) struck into a ready trap in ${e.city}.` });
    } else if (e.how === 'killed') {
      const warned = inboxAt(a.side, e.week).some((m) => (m.facts?.activities || []).some((x) => x.kind === 'prepare' && x.targetId === a.id));
      moments.push({ week: e.week, side: by, kind: warned ? 'mistake' : 'strike', city: e.city, title: warned ? `${a.name} was warned, and still died` : `${SIDE_LABEL[by]} kills ${a.name}`,
        detail: warned ? `${SIDE_LABEL[a.side]}'s reports showed someone studying ${a.name}'s routine; no trap, no lying low.` : `${a.first} ${a.name} (${role(a.archetype)}) killed in ${e.city}.` });
    } else if (e.how === 'executed') {
      moments.push({ week: e.week, side: a.side, kind: a.turnedBy ? 'intel' : 'mistake', city: e.city, title: a.turnedBy ? `${SIDE_LABEL[a.side]} unmasks ${a.name}` : `${SIDE_LABEL[a.side]} executes a loyal agent`,
        detail: a.turnedBy ? `${a.name} was indeed working for ${SIDE_LABEL[a.turnedBy]}.` : `${a.name} was loyal all along.` });
    }
  }
  // The pivotal week: the biggest swing in who was ahead.
  let pw = 1, mag = -1;
  for (let w = 1; w <= last; w++) {
    const a = standingAt(game, w), b = standingAt(game, w - 1);
    const d = Math.abs((a.control - a.karla) - (b.control - b.karla));
    if (d > mag) { mag = d; pw = w; }
  }
  const here = moments.filter((m) => m.week === pw);
  const cityCount = {};
  for (const m of here) cityCount[m.city] = (cityCount[m.city] || 0) + 1;
  const pcity = Object.entries(cityCount).sort((x, y) => y[1] - x[1])[0]?.[0] || game.cities[1];
  // What each side had been told about that city before it gave its orders that week.
  const knew = (side) => game.inbox[side].filter((m) => m.week <= pw && m.week >= pw - 1 && m.city === pcity && m.kind !== 'briefing').map((m) => m.text).slice(-4);
  return {
    moments: moments.sort((x, y) => x.week - y.week),
    pivotal: { week: pw, city: pcity, why: here.length ? here.map((m) => m.title).join('; ') : 'The biggest swing in who was ahead.', controlKnew: knew('control'), karlaKnew: knew('karla') },
  };
}

// A compact, complete record of the game for Claude.
function record(game, found) {
  const name = (id) => game.agents[id]?.name;
  const last = lastWeek(game);
  return {
    cities: game.cities,
    agents: Object.values(game.agents).map((a) => ({ name: a.name, side: SIDE_LABEL[a.side], role: role(a.archetype), turnedBy: a.turnedBy ? SIDE_LABEL[a.turnedBy] : undefined, turnedWeek: a.turnedWeek, fate: a.eliminated ? `${a.eliminated.how} in ${a.eliminated.city}, week ${a.eliminated.week}` : 'alive' })),
    weeks: Array.from({ length: last }, (_, i) => i + 1).map((w) => ({
      week: w,
      standingAfter: standingAt(game, w),
      orders: Object.fromEntries(SIDES.map((s) => [SIDE_LABEL[s], game.orderLog.filter((o) => o.week === w && o.side === s).map((o) => `${name(o.agentId)} (${cityAt(game.agents[o.agentId], w - 1)}): ${o.type === 'lie' ? describeOrder(o, game) + ' (lie told through a mole)' : describeOrder(o, game)}`)])),
      toldNextMorning: Object.fromEntries(SIDES.map((s) => [SIDE_LABEL[s], game.inbox[s].filter((m) => m.week === w + 1 && m.kind !== 'briefing').map((m) => `${m.from ? name(m.from) : 'Station'}${m.lie ? ' (a lie)' : ''}: ${m.text}`)])),
    })),
    outcome: game.outcome,
    rulesFound: found.moments.map((m) => `wk ${m.week}, ${m.city}: ${m.title}`),
  };
}

const SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    moments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          week: { type: 'integer' },
          side: { type: 'string', enum: ['control', 'karla', 'both'] },
          kind: { type: 'string', enum: ['recruitment', 'intel', 'mistake', 'turning-point', 'strike'] },
          title: { type: 'string' },
          detail: { type: 'string' },
          city: { type: 'string' },
        },
        required: ['week', 'side', 'kind', 'title', 'detail', 'city'],
        additionalProperties: false,
      },
    },
    pivotal: {
      type: 'object',
      properties: { week: { type: 'integer' }, city: { type: 'string' }, why: { type: 'string' }, controlKnew: { type: 'array', items: { type: 'string' } }, karlaKnew: { type: 'array', items: { type: 'string' } } },
      required: ['week', 'city', 'why', 'controlKnew', 'karlaKnew'],
      additionalProperties: false,
    },
  },
  required: ['headline', 'summary', 'moments', 'pivotal'],
  additionalProperties: false,
};

function fallbackStory(game, found) {
  const o = game.outcome, s = o.score;
  const lead = o.winner ? `${SIDE_LABEL[o.winner]} finished with ${s[o.winner].standing} agents standing to ${s[other(o.winner)].standing}.` : `Both sides finished with ${s.control.standing} agents standing.`;
  const recruits = found.moments.filter((m) => m.kind === 'recruitment').length;
  const mistakes = found.moments.filter((m) => m.kind === 'mistake').length;
  return {
    headline: o.winner ? `${SIDE_LABEL[o.winner]} held more of their people` : 'Neither side broke through',
    summary: `${lead} ${recruits} agent${recruits === 1 ? ' was' : 's were'} turned, and ${mistakes} loss${mistakes === 1 ? ' was' : 'es were'} avoidable on the information at hand.`,
    moments: found.moments.slice(0, 10),
    pivotal: found.pivotal,
    via: 'rules',
  };
}

export async function analyze(game) {
  const found = findMoments(game);
  try {
    const r = await callClaude('debrief', { system: DEBRIEF, user: JSON.stringify(record(game, found)), schema: SCHEMA, maxTokens: 6000 });
    const last = lastWeek(game);
    const okCity = (c) => game.cities.find((x) => x.toLowerCase() === String(c).toLowerCase());
    const moments = r.moments.filter((m) => m.week >= 1 && m.week <= last).map((m) => ({ ...m, city: okCity(m.city) || null })).slice(0, 10);
    const pivotal = { ...r.pivotal, week: Math.min(Math.max(1, r.pivotal.week), last), city: okCity(r.pivotal.city) || found.pivotal.city };
    return { headline: r.headline, summary: r.summary, moments, pivotal, via: 'claude' };
  } catch (e) {
    if (!(e instanceof LLMUnavailable)) console.warn('debrief analysis fell back:', e.message);
    return fallbackStory(game, found);
  }
}
