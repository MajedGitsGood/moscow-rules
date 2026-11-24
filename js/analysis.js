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
  // The latest report naming this agent's role, in the two weeks before.
  const intelOn = (side, w, id) => game.inbox[side].filter((m) => m.week <= w && m.week >= w - 2 && (m.facts?.roles || []).some((r) => r.id === id)).pop();
  // A leak from a mole, in the two weeks before, that pointed at this city or this agent.
  const leakAbout = (side, w, city, id) => game.inbox[side].find((m) => m.kind === 'source' && m.week <= w && m.week >= w - 2
    && (m.facts?.plan?.city === city || m.facts?.city === city || m.from === id));
  for (const a of Object.values(game.agents)) {
    if (a.turnedWeek) {
      moments.push({ week: a.turnedWeek, side: a.turnedBy, kind: 'recruitment', city: cityAt(a, a.turnedWeek), title: `${a.name} turned by ${SIDE_LABEL[a.turnedBy]}`,
        detail: `${SIDE_LABEL[a.side]}'s ${role(a.archetype)} ${a.first} ${a.name} began working for ${SIDE_LABEL[a.turnedBy]}${a.alive ? ' and was never caught' : ''}.` });
    }
    const e = a.eliminated;
    if (!e) continue;
    const by = e.by;
    if (e.how === 'trapped') {
      // Warned: a Lamplighter saw the trap being set, or footprints that could mean one.
      const warn = inboxAt(a.side, e.week).find((m) => m.city === e.city && ((m.facts?.activities || []).some((x) => x.kind === 'trap')
        || (m.facts?.signs || []).some((x) => ['room', 'faces'].includes(x.sign))));
      moments.push({ week: e.week, side: by, kind: warn ? 'mistake' : 'strike', city: e.city, title: warn ? `${a.name} ignored the signs of a trap` : `${SIDE_LABEL[by]}'s trap catches ${a.name}`,
        detail: warn ? `There were signs of a trap in ${e.city}, and ${SIDE_LABEL[a.side]} sent ${a.name} in anyway.` : `${a.first} ${a.name} (${role(a.archetype)}) struck into a ready trap in ${e.city}.`,
        chain: warn ? { receiver: a.side, source: 'true', told: warn.text, did: `Sent ${a.name} to strike in ${e.city} anyway.`, result: `${a.name} caught in the trap.`, favoured: by }
          : leakAbout(by, e.week, e.city, a.id) && { receiver: by, source: 'leaked', told: leakAbout(by, e.week, e.city, a.id).text, did: `Set a trap in ${e.city}.`, result: `${a.name} walked into it.`, favoured: by } });
    } else if (e.how === 'killed') {
      // Warned: a Lamplighter saw the preparation, or someone was seen asking about or shadowing the victim.
      const warn = inboxAt(a.side, e.week).find((m) => (m.facts?.activities || []).some((x) => x.kind === 'prepare' && x.targetId === a.id)
        || (m.facts?.signs || []).some((x) => ['asking', 'shadowing'].includes(x.sign) && x.targetId === a.id));
      moments.push({ week: e.week, side: by, kind: warn ? 'mistake' : 'strike', city: e.city, title: warn ? `${a.name} ignored the signs, and died` : `${SIDE_LABEL[by]} kills ${a.name}`,
        detail: warn ? `There were signs someone was after ${a.name}; no trap, no lying low.` : `${a.first} ${a.name} (${role(a.archetype)}) killed in ${e.city}.`,
        chain: warn ? { receiver: a.side, source: warn.lie ? 'planted' : 'true', told: warn.text, did: `Left ${a.name} in place: no trap, no lying low.`, result: `${a.name} killed in ${e.city}.`, favoured: by }
          : (() => { const m = intelOn(by, e.week, a.id); return m && { receiver: by, source: m.lie ? 'planted' : m.kind === 'source' ? 'leaked' : 'true', told: m.text, did: `Struck ${a.name} in ${e.city}.`, result: `${a.name} killed.`, favoured: by }; })() });
    } else if (e.how === 'executed') {
      // Was the execution set up by a framing lie from the other side's mole?
      const frame = game.inbox[a.side].filter((m) => m.lie && m.week <= e.week && m.facts?.accused === a.id).pop();
      moments.push({ week: e.week, side: a.turnedBy ? a.side : other(a.side), kind: a.turnedBy ? 'intel' : 'mistake', city: e.city, title: a.turnedBy ? `${SIDE_LABEL[a.side]} unmasks ${a.name}` : `${SIDE_LABEL[a.side]} executes a loyal agent`,
        detail: a.turnedBy ? `${a.name} was indeed working for ${SIDE_LABEL[a.turnedBy]}.` : `${a.name} was loyal all along.`,
        chain: frame && { receiver: a.side, source: 'planted', told: frame.text, did: `Executed ${a.name}.`, result: a.turnedBy ? `${a.name} really was a mole.` : `${a.name} was loyal. The frame worked.`, favoured: a.turnedBy ? a.side : other(a.side) } });
    }
  }
  // The pivotal week: the biggest swing in who was ahead.
  let pw = 1, mag = -1;
  for (let w = 1; w <= last; w++) {
    const a = standingAt(game, w), b = standingAt(game, w - 1);
    const d = Math.abs((a.control - a.karla) - (b.control - b.karla));
    if (d > mag) { mag = d; pw = w; }
  }
  // The pivotal exchange: information one side received, what it did with it, and what that cost.
  // Planted lies first, then leaks, then the chain in the biggest-swing week, then any chain.
  const chained = moments.filter((m) => m.chain);
  const pick = chained.find((m) => m.chain.source === 'planted') || chained.find((m) => m.chain.source === 'leaked') || chained.find((m) => m.week === pw) || chained[0];
  const here = moments.filter((m) => m.week === pw);
  const pivotal = pick
    ? { week: pick.week, city: pick.city, title: pick.title, ...pick.chain }
    : { week: pw, city: here[0]?.city || game.cities[1], title: here[0]?.title || 'The biggest swing', receiver: null };
  for (const m of moments) delete m.chain;
  return { moments: moments.sort((x, y) => x.week - y.week), pivotal };
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
      toldNextMorning: Object.fromEntries(SIDES.map((s) => [SIDE_LABEL[s], game.inbox[s].filter((m) => m.week === w + 1 && m.kind !== 'briefing').map((m) => `${m.from ? name(m.from) : 'Station'}${m.lie ? ' (a LIE planted by the other side through their mole)' : m.kind === 'source' ? ' (LEAKED by a mole inside the other side)' : ''}: ${m.text}`)])),
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
      properties: {
        week: { type: 'integer' }, city: { type: 'string' }, title: { type: 'string' },
        receiver: { type: 'string', enum: ['control', 'karla'] },
        source: { type: 'string', enum: ['planted', 'leaked', 'true'] },
        told: { type: 'string' }, did: { type: 'string' }, result: { type: 'string' },
        favoured: { type: 'string', enum: ['control', 'karla'] },
      },
      required: ['week', 'city', 'title', 'receiver', 'source', 'told', 'did', 'result', 'favoured'],
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
    summary: `${lead} ${recruits} turned, ${mistakes} avoidable loss${mistakes === 1 ? '' : 'es'}.`,
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
