// Rules engine, v2. Pure state + rules: no DOM, no LLM. The game object is plain JSON so it can be
// saved, passed between hot-seat turns, or replayed. Every random draw goes through the seeded RNG,
// whose state lives on the game, so seed + placements + orders always replay identically.
//
// v2 in one paragraph: every agent's position is public; roles and loyalty are hidden. Each side
// gives up to five orders a week. Most orders gather information; strikes must be prepared
// (except by Scalphunters) and are countered by traps. Preparing, trapping and approaching are
// "loud" (likely to be reported by enemies in the same city); lying low is "quiet" (not reported).
// Talent-spotters turn an enemy agent after three approaches. Turned agents leak every order they
// receive, tell lies chosen by the side that turned them, and quietly sabotage. Every dead enemy is
// a point; every enemy still alive and turned at the end is a point.
import { makeRng } from './rng.js';
import { generateWorld, RULES, SIDES, other, ARCHETYPES, SIDE_LABEL } from './world.js';

// ---------- helpers ----------
const withRng = (game, fn) => {
  const rng = makeRng(0);
  rng.setState(game.rngState);
  const out = fn(rng);
  game.rngState = rng.state();
  return out;
};
const roll = (game, p) => withRng(game, (r) => r() < p);
const alive = (game, side) => Object.values(game.agents).filter((a) => a.side === side && a.alive);
const inCity = (game, side, city) => alive(game, side).filter((a) => a.city === city);
const loyal = (a) => a.turnedBy === null;
const role = (k) => ARCHETYPES[k].label;
export const fullName = (a) => `${a.first} ${a.name}`;

function send(game, side, msg) {
  game.msgSeq = (game.msgSeq || 0) + 1;
  game.inbox[side].push({ id: `m${game.msgSeq}`, week: game.phase === 'setup' ? 1 : game.week + 1, ...msg });
}
// Intel: roles a side has been told about (by its Lamplighters). Loyalty is never tracked for the
// player: suspicion is something they have to notice in the traffic themselves.
function claim(game, side, agentId, archetype, source) {
  const i = (game.intel[side][agentId] ||= { roles: [] });
  i.roles.push({ archetype, source, week: game.week + 1 });
}
// A mole follows its owner's orders only if the side that turned it says so (a standing instruction).
const obeys = (game, a) => loyal(a) || game.stance?.[a.id] === 'obey';
function eliminate(game, agent, how, bySide) {
  agent.alive = false;
  agent.prep = null;
  agent.eliminated = { week: game.week, how, by: bySide, city: agent.city };
  game.traps = game.traps.filter((t) => t.setterId !== agent.id);
}

// ---------- setup ----------
export function newGame(seed, { sleepers = false } = {}) {
  const rng = makeRng(seed);
  const { cities, agents } = generateWorld(rng);
  const game = {
    version: 2, seed, rngState: rng.state(), week: 1, phase: 'setup', cities, agents,
    placed: { control: false, karla: false },
    pending: { control: null, karla: null },
    approaches: {},   // targetId -> { side, count }
    traps: [],        // { side, city, setterId, activeFrom, dud }
    inbox: { control: [], karla: [] },
    intel: { control: {}, karla: {} },
    orderLog: [], journal: { control: [], karla: [] },
    outcome: null, msgSeq: 0,
  };
  if (sleepers) {
    withRng(game, (r) => {
      for (const side of SIDES) {
        if (r() < 0.5) {
          const v = r.pick(alive(game, side));
          v.turnedBy = other(side);
          v.sleeper = true;
        }
      }
    });
  }
  return game;
}

export function validatePlacement(game, side, placement) {
  const errors = [];
  const counts = {};
  for (const a of alive(game, side)) {
    const city = placement[a.id];
    if (!city) errors.push(`${a.name} has no city.`);
    else if (!game.cities.includes(city)) errors.push(`${city} is not on the board.`);
    else counts[city] = (counts[city] || 0) + 1;
  }
  for (const [city, n] of Object.entries(counts)) {
    if (n > RULES.maxPerCityAtSetup) errors.push(`${city} has ${n} agents (max ${RULES.maxPerCityAtSetup}).`);
  }
  return errors;
}

export function placeAgents(game, side, placement) {
  if (game.phase !== 'setup') throw new Error('Not in setup.');
  const errors = validatePlacement(game, side, placement);
  if (errors.length) throw new Error(errors.join(' '));
  for (const a of alive(game, side)) { a.city = placement[a.id]; a.history = [{ week: 0, city: a.city }]; }
  game.placed[side] = true;
  if (game.placed.control && game.placed.karla) startPlay(game);
}

function startPlay(game) {
  for (const side of SIDES) {
    send(game, side, {
      kind: 'briefing', from: null,
      text: side === 'control'
        ? 'The networks are in place. Twelve weeks. Find out what they are, find out who is still ours, and take theirs off the board.'
        : 'The networks are placed, Comrade. Twelve weeks. Identify the British joes, turn what can be turned, remove the rest.',
    });
    for (const a of alive(game, other(side)).filter((x) => x.turnedBy === side)) {
      send(game, side, {
        kind: 'source', from: a.id, city: a.city,
        text: `${fullName(a)}, their ${role(a.archetype)} in ${a.city}, has worked for us for years. Everything they are ordered to do, we will know. Tell us what lies they should report home.`,
      });
    }
  }
  game.phase = 'orders';
  game.week = 1;
}

// ---------- orders ----------
// { agentId, type, city?, targetId?, plan?: {kind:'strike'|'trap', city}, lie?: {kind:'hide'|'frame'|'alarm', targetId?} }
export const ORDER_TYPES = ['move', 'surveil', 'lielow', 'prepare', 'strike', 'trap', 'approach', 'vet', 'brief', 'lie'];

// What an agent can do right now, for UIs and bots. Each entry lists valid targets.
export function legalOrders(game, side, agentId) {
  const a = game.agents[agentId];
  if (!a || !a.alive) return [];
  if (a.side !== side) return a.turnedBy === side ? [{ type: 'lie' }] : [];
  const here = (s) => inCity(game, s, a.city).filter((x) => x.id !== a.id);
  const enemies = here(other(side));
  const out = [{ type: 'lielow' }, { type: 'move', cities: game.cities.filter((c) => c !== a.city) }];
  if (a.archetype === 'lamplighter') out.unshift({ type: 'surveil' });
  if (a.archetype !== 'talentspotter') {
    if (enemies.length) out.push({ type: 'prepare', targets: enemies.map((e) => e.id) });
    const strikeable = a.archetype === 'scalphunter' ? enemies : enemies.filter((e) => a.prep && a.prep.targetId === e.id && a.prep.week < game.week);
    if (strikeable.length) out.push({ type: 'strike', targets: strikeable.map((e) => e.id) });
    out.push({ type: 'trap' });
  } else {
    const pitchable = enemies.filter((e) => e.turnedBy !== side);
    if (pitchable.length) out.push({ type: 'approach', targets: pitchable.map((e) => e.id) });
  }
  if (a.archetype === 'ferret') {
    const mine = here(side);
    if (mine.length) out.push({ type: 'vet', targets: mine.map((x) => x.id) });
  }
  out.push({ type: 'brief' });
  return out;
}

export function validateOrders(game, side, orders) {
  const errors = [];
  if (orders.length > RULES.ordersPerWeek) errors.push(`Only ${RULES.ordersPerWeek} orders a week.`);
  const seen = new Set();
  for (const o of orders) {
    const a = game.agents[o.agentId];
    if (!a || !a.alive) { errors.push('Unknown or lost agent.'); continue; }
    if (seen.has(a.id)) errors.push(`${a.name} already has an order this week.`);
    seen.add(a.id);
    const legal = legalOrders(game, side, a.id).find((l) => l.type === o.type);
    if (!legal) { errors.push(`${a.name} can't ${o.type} now.`); continue; }
    if (legal.targets && !legal.targets.includes(o.targetId)) errors.push(`${a.name}: invalid target.`);
    if (legal.cities && !legal.cities.includes(o.city)) errors.push(`${a.name}: invalid city.`);
    if (o.type === 'brief' && !(o.plan && ['strike', 'trap'].includes(o.plan.kind) && game.cities.includes(o.plan.city))) errors.push(`${a.name}: brief needs a plan.`);
    if (o.type === 'lie') {
      if (!o.lie || !['hide', 'frame', 'alarm'].includes(o.lie.kind)) errors.push(`${a.name}: choose a lie.`);
      if (o.lie?.kind === 'frame') {
        const t = game.agents[o.lie.targetId];
        if (!t || !t.alive || t.side !== a.side || t.id === a.id) errors.push(`${a.name}: choose someone to frame.`);
      }
    }
  }
  return errors;
}

export function submitOrders(game, side, orders) {
  if (game.phase !== 'orders') throw new Error('Not accepting orders.');
  const errors = validateOrders(game, side, orders);
  if (errors.length) throw new Error(errors.join(' '));
  game.pending[side] = orders.map((o) => ({ ...o, side }));
  return !!(game.pending.control && game.pending.karla);
}

// Free action during the orders phase: kill one of your own agents (a suspected mole). The other
// side gets the point whether or not they were turned; you learn the truth only at the debrief.
export function executeAgent(game, side, agentId) {
  const a = game.agents[agentId];
  if (game.phase !== 'orders' || !a || !a.alive || a.side !== side) throw new Error('Cannot execute.');
  eliminate(game, a, 'executed', other(side));
  if (game.pending[side]) game.pending[side] = game.pending[side].filter((o) => o.agentId !== agentId);
  game.msgSeq++;
  game.inbox[side].push({ id: `m${game.msgSeq}`, week: game.week, kind: 'event', tone: 'loss', from: null, city: a.city, text: `${fullName(a)} has been dealt with in ${a.city}. Whatever they were, they are finished.` });
  checkEnd(game);
}

// Free standing instruction to an enemy agent you have turned: carry out their own side's orders
// (to keep their cover) or quietly make them fail (the default).
export function setStance(game, side, agentId, stance) {
  const a = game.agents[agentId];
  if (!a || !a.alive || a.side === side || a.turnedBy !== side || !['obey', 'sabotage'].includes(stance)) throw new Error('Cannot instruct.');
  (game.stance ||= {})[agentId] = stance;
}

export function surrender(game, side) {
  if (game.phase === 'over') return;
  game.surrendered = side;
  finish(game, `${SIDE_LABEL[side]} surrendered`);
}

export function addJournal(game, side, text) { if (text) game.journal[side].push({ week: game.week, text }); }

export function describeOrder(o, game) {
  const n = (id) => (id ? game.agents[id]?.name : '');
  switch (o.type) {
    case 'move': return `go to ${o.city}`;
    case 'surveil': return 'surveil the city';
    case 'lielow': return 'lie low';
    case 'prepare': return `prepare a strike on ${n(o.targetId)}`;
    case 'strike': return `strike ${n(o.targetId)}`;
    case 'trap': return 'set a trap';
    case 'approach': return `approach ${n(o.targetId)}`;
    case 'vet': return `vet ${n(o.targetId)}`;
    case 'brief': return `be ready for our ${o.plan.kind} in ${o.plan.city}`;
    case 'lie': return o.lie.kind === 'frame' ? `frame ${n(o.lie.targetId)}` : o.lie.kind === 'alarm' ? 'raise a false alarm' : 'report all quiet';
    default: return o.type;
  }
}

// ---------- resolution ----------
export function resolveWeek(game) {
  if (!game.pending.control || !game.pending.karla) throw new Error('Both sides must submit orders.');
  const w = game.week;
  const all = [...game.pending.control, ...game.pending.karla].filter((o) => game.agents[o.agentId].alive);
  game.orderLog.push(...all.map((o) => ({ week: w, ...o })));
  const of = (type) => all.filter((o) => o.type === type && game.agents[o.agentId].alive);
  const orderOf = {};
  for (const o of all) if (o.type !== 'lie') orderOf[o.agentId] = o;
  const lieFor = {};
  for (const o of of('lie')) lieFor[o.agentId] = o.lie;

  // 0. Leaks: every order given to a turned agent reaches the side that turned them.
  for (const o of all) {
    const a = game.agents[o.agentId];
    if (o.type !== 'lie' && a.turnedBy && a.turnedBy !== o.side) {
      send(game, a.turnedBy, {
        kind: 'source', from: a.id, city: a.city,
        text: o.type === 'brief'
          ? `${SIDE_LABEL[o.side]} has briefed me: there will be a ${o.plan.kind} in ${o.plan.city}.`
          : `My orders from ${SIDE_LABEL[o.side]} this week: ${describeOrder(o, game)}. ${['strike', 'trap', 'approach', 'vet'].includes(o.type) ? (game.stance?.[a.id] === 'obey' ? 'As you instructed, I am carrying them out. Tell me if you want them to fail.' : 'As you instructed, I will see they come to nothing. Tell me if you would rather I carry them out.') : ''}`.trim(),
        facts: { order: o.type, plan: o.plan || null, targetId: o.targetId || null, city: o.city || null },
      });
    }
  }

  // 1. Moves. Leaving a city drops any prepared strike and abandons traps there.
  for (const o of of('move')) {
    const a = game.agents[o.agentId];
    a.city = o.city; a.prep = null;
    game.traps = game.traps.filter((t) => t.setterId !== a.id);
  }
  for (const a of Object.values(game.agents)) {
    if (!a.alive) continue;
    a.history.push({ week: w, city: a.city });
    if (a.prep && (!game.agents[a.prep.targetId].alive || game.agents[a.prep.targetId].city !== a.city)) a.prep = null;
  }
  const loud = new Set(all.filter((o) => ['prepare', 'trap'].includes(o.type)).map((o) => o.agentId));
  const attacks = []; // { city, attacker, target, result } for witnesses
  const quiet = new Set(of('lielow').map((o) => o.agentId));

  // 2. Traps. A Ferret's trap works tonight; anyone else's from next week. A turned setter's trap is a dud.
  for (const o of of('trap')) {
    const a = game.agents[o.agentId];
    game.traps = game.traps.filter((t) => t.setterId !== a.id);
    game.traps.push({ side: o.side, city: a.city, setterId: a.id, activeFrom: a.archetype === 'ferret' ? w : w + 1, dud: !obeys(game, a) });
  }

  // 3. Strikes, in random order.
  for (const o of withRng(game, (r) => r.shuffle(of('strike')))) {
    const s = game.agents[o.agentId], t = game.agents[o.targetId];
    if (!s.alive) continue;
    if (!t.alive || s.city !== t.city || quiet.has(t.id)) {
      // Moved, already dead, or lying low: an agent who has gone to ground can't be found.
      send(game, o.side, { kind: 'report', from: s.id, city: s.city, text: `${t.name} was not where we expected. Nothing done.` });
      continue;
    }
    s.prep = null;
    if (!obeys(game, s)) {
      send(game, o.side, { kind: 'report', from: s.id, city: s.city, text: `${t.name} slipped away from me. I'll keep looking.` });
      send(game, s.turnedBy, { kind: 'source', from: s.id, city: s.city, text: `I was sent to kill ${t.name}. I let it lapse, as instructed.` });
      continue;
    }
    const trap = game.traps.find((x) => x.side === t.side && x.city === s.city && x.activeFrom <= w && !x.dud);
    if (trap) {
      eliminate(game, s, 'trapped', t.side);
      game.traps = game.traps.filter((x) => x !== trap);
      send(game, o.side, { kind: 'event', tone: 'loss', from: null, city: s.city, text: `${fullName(s)} went for ${t.name} in ${s.city} and walked into a trap. We have lost them.` });
      send(game, t.side, { kind: 'event', tone: 'win', from: trap.setterId, city: s.city, text: `The trap in ${s.city} worked. ${fullName(s)} came for ${t.name} and is in our hands.` });
      attacks.push({ city: s.city, attacker: s, target: t, result: 'trapped' });
      continue;
    }
    eliminate(game, t, 'killed', o.side);
    send(game, t.side, { kind: 'event', tone: 'loss', from: null, city: s.city, text: `${fullName(t)} was found dead in ${s.city}.` });
    send(game, o.side, { kind: 'event', tone: 'win', from: s.id, city: s.city, text: `${t.name} is dead in ${s.city}.` });
    attacks.push({ city: s.city, attacker: s, target: t, result: 'killed' });
  }

  // 4. Preparations.
  for (const o of of('prepare')) {
    const a = game.agents[o.agentId], t = game.agents[o.targetId];
    if (t.alive && t.city === a.city) a.prep = { targetId: t.id, week: w };
  }

  // 5. Approaches. Two approaches turn the target. Approaches are never reported: the only way to
  //    catch a mole is to notice it in the traffic. A turned Talent-spotter's pitches quietly go nowhere.
  for (const o of withRng(game, (r) => r.shuffle(of('approach')))) {
    const ts = game.agents[o.agentId], t = game.agents[o.targetId];
    if (!t.alive || t.city !== ts.city || !obeys(game, ts)) continue;
    // A loyal Ferret on the target's side keeps its people out of reach, silently.
    if (inCity(game, t.side, t.city).some((f) => f.archetype === 'ferret' && loyal(f) && f.id !== t.id)) {
      send(game, o.side, { kind: 'report', from: ts.id, city: ts.city, text: `I couldn't get near ${t.name}. Someone on their side is keeping their people close.` });
      continue;
    }
    if (t.turnedBy === o.side) continue;
    const prev = game.approaches[t.id];
    const rec = prev && prev.side === o.side ? prev : (game.approaches[t.id] = { side: o.side, count: 0 });
    rec.count++;
    if (rec.count >= RULES.approachesToTurn) {
      t.turnedBy = o.side;
      t.turnedWeek = w;
      delete game.approaches[t.id];
      send(game, o.side, { kind: 'event', tone: 'win', from: ts.id, city: ts.city, text: `${fullName(t)} is ours. They're a ${role(t.archetype)}. Every order ${SIDE_LABEL[t.side]} gives them, we'll hear, and they'll report home whatever we choose.`, facts: { turned: t.id } });
      claim(game, o.side, t.id, t.archetype, `${t.name} (our new source)`);
    } else {
      send(game, o.side, { kind: 'report', from: ts.id, city: ts.city, text: `Another evening with ${t.name}. ${rec.count} of ${RULES.approachesToTurn}: they're listening.`, facts: { approach: t.id, count: rec.count } });
    }
  }

  // 6. Vetting. A loyal Ferret tells the truth; a turned Ferret vouches for everyone.
  for (const o of of('vet')) {
    const f = game.agents[o.agentId], v = game.agents[o.targetId];
    if (!v.alive) continue;
    const verdict = obeys(game, f) ? (loyal(v) ? 'loyal' : 'turned') : 'loyal';
    send(game, o.side, { kind: 'report', from: f.id, city: f.city, text: verdict === 'turned' ? `I've been through ${v.name}'s life. They're working for ${SIDE_LABEL[other(o.side)]}.` : `I've been through ${v.name}'s life. Clean, as far as I can tell.`, facts: { vet: v.id, verdict } });
  }

  // 7. What every agent saw this week becomes a report home.
  for (const side of SIDES) {
    const enemy = other(side);
    for (const a of alive(game, side)) {
      if (!loyal(a)) { moleReport(game, side, a, lieFor[a.id] || { kind: 'hide' }); continue; }
      const notes = [];
      const facts = { roles: [], activities: [] };
      const surveilling = orderOf[a.id]?.type === 'surveil'; // Lamplighters only
      const isLL = a.archetype === 'lamplighter';
      const visible = inCity(game, enemy, a.city).filter((e) => !quiet.has(e.id)); // lying low = invisible
      if (surveilling) for (const e of visible) { claim(game, side, e.id, e.archetype, `${a.name} (Lamplighter)`); facts.roles.push({ id: e.id, archetype: e.archetype }); }
      if (facts.roles.length) notes.push(facts.roles.map((r) => `${game.agents[r.id].name} is a ${role(r.archetype)}.`).join(' '));
      // Preparations and traps are loud: Lamplighters always notice, anyone else may.
      for (const e of visible.filter((x) => loud.has(x.id))) {
        if (!(isLL || roll(game, RULES.noticeChance))) continue;
        const eo = orderOf[e.id];
        if (eo.type === 'prepare') { notes.push(`${e.name} has been studying ${game.agents[eo.targetId].name}'s routine.`); facts.activities.push({ id: e.id, kind: 'prepare', targetId: eo.targetId }); }
        if (eo.type === 'trap') { notes.push(`${e.name}'s people are setting something up in ${a.city}.`); facts.activities.push({ id: e.id, kind: 'trap' }); }
      }
      // Attacks by the other side in this city: who went for whom.
      for (const at of attacks.filter((x) => x.city === a.city && x.attacker.side === enemy && x.target.id !== a.id)) {
        if (!(isLL || roll(game, RULES.noticeChance))) continue;
        notes.push(at.result === 'killed' ? `It was ${at.attacker.name} who killed ${at.target.name}.` : `${at.attacker.name} was the one who went for ${at.target.name}.`);
        facts.activities.push({ id: at.attacker.id, kind: 'strike', targetId: at.target.id });
      }
      // Ferrets notice enemy surveillance in their city.
      if (a.archetype === 'ferret') {
        for (const o of all.filter((x) => x.side === enemy && x.type === 'surveil' && game.agents[x.agentId].alive && game.agents[x.agentId].city === a.city)) {
          const e = game.agents[o.agentId];
          notes.push(`${e.name} has been watching us here.`); facts.activities.push({ id: e.id, kind: 'surveil' });
        }
      }
      if (notes.length || surveilling) send(game, side, { kind: 'report', from: a.id, city: a.city, text: notes.join(' ') || `Nothing worth reporting in ${a.city}.`, facts });
    }
  }

  game.pending = { control: null, karla: null };
  game.week = w + 1;
  checkEnd(game);
}

// A turned agent's report home, shaped by the lie the turning side chose.
function moleReport(game, side, m, lie) {
  const turner = other(side);
  const facts = { roles: [], activities: [] };
  let text = null;
  if (lie.kind === 'frame') {
    const t = game.agents[lie.targetId];
    if (t && t.alive) { text = `I don't like what I'm seeing from ${t.name}. Meetings I can't account for. I think they've been turned.`; facts.accused = t.id; }
  } else if (lie.kind === 'alarm') {
    const mine = inCity(game, side, m.city).filter((x) => x.id !== m.id);
    const them = inCity(game, turner, m.city);
    if (mine.length && them.length) {
      const [victim, hunter] = withRng(game, (r) => [r.pick(mine), r.pick(them)]);
      text = `${hunter.name} has been studying ${victim.name}'s routine.`;
      facts.activities.push({ id: hunter.id, kind: 'prepare', targetId: victim.id });
    }
  }
  // 'hide', or a lie that couldn't apply: a calm report that conceals what's going on.
  if (!text && roll(game, 0.5)) text = `${m.city} is calm this week. Nothing to report.`;
  if (text) send(game, side, { kind: 'report', from: m.id, city: m.city, text, facts, lie: true });
}

// ---------- end ----------
// You win by having the most agents still alive and still yours at the end.
function score(game, side) {
  const mine = Object.values(game.agents).filter((a) => a.side === side);
  const lost = mine.filter((a) => !a.alive).length;
  const turned = mine.filter((a) => a.alive && a.turnedBy).length;
  return { standing: mine.length - lost - turned, lost, turned, total: mine.length - lost - turned };
}
function finish(game, reason) {
  game.phase = 'over';
  const s = { control: score(game, 'control'), karla: score(game, 'karla') };
  let winner = s.control.standing > s.karla.standing ? 'control' : s.karla.standing > s.control.standing ? 'karla' : null;
  if (game.surrendered) winner = other(game.surrendered);
  game.outcome = { reason, score: s, winner };
}
function checkEnd(game) {
  if (game.phase === 'over') return;
  const out = SIDES.find((s) => alive(game, s).length === 0);
  if (out) finish(game, `${SIDE_LABEL[out]}'s networks were wiped out`);
  else if (game.week > RULES.weeks) { game.week = RULES.weeks; finish(game, 'Twelve weeks have passed'); }
}

// ---------- views ----------
// Everything one side may know. Positions are public; roles and loyalty are not.
export function viewFor(game, side) {
  const enemy = other(side);
  const strip = (a) => ({ id: a.id, side: a.side, name: a.name, first: a.first, cover: a.cover, look: a.look, city: a.city, alive: a.alive });
  const own = Object.values(game.agents).filter((a) => a.side === side).map((a) => ({ ...strip(a), archetype: a.archetype, prep: a.prep, eliminated: a.eliminated }));
  const enemies = Object.values(game.agents).filter((a) => a.side === enemy).map((a) => {
    const v = { ...strip(a), eliminated: a.eliminated ? { week: a.eliminated.week, city: a.eliminated.city } : null };
    if (a.turnedBy === side) { v.asset = true; v.archetype = a.archetype; v.stance = game.stance?.[a.id] || 'sabotage'; }
    return v;
  });
  return {
    side, enemy, week: game.week, phase: game.phase, cities: game.cities, rules: RULES,
    own, enemies, intel: game.intel[side], inbox: game.inbox[side],
    traps: game.traps.filter((t) => t.side === side).map((t) => ({ city: t.city, setterId: t.setterId, active: t.activeFrom <= game.week })),
    approachProgress: Object.fromEntries(Object.entries(game.approaches).filter(([, r]) => r.side === side).map(([id, r]) => [id, r.count])),
    submitted: !!game.pending[side],
    // What a side can see: how many of each side are still alive (not who is loyal).
    score: { ours: alive(game, side).length, theirs: alive(game, enemy).length },
    outcome: game.outcome,
  };
}

export function revealAll(game) {
  if (game.phase !== 'over') throw new Error('Game still running.');
  return { agents: Object.values(game.agents), orderLog: game.orderLog, journal: game.journal, outcome: game.outcome };
}
