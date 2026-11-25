// Rules engine, v2. Pure state + rules: no DOM, no LLM. The game object is plain JSON so it can be
// saved, passed between hot-seat turns, or replayed. Every random draw goes through the seeded RNG,
// whose state lives on the game, so seed + placements + orders always replay identically.
//
// v2 in one paragraph: every agent's position is public; roles and loyalty are hidden. Each side
// gives up to five orders a week. Strikes must be prepared (except by Scalphunters, who may) and are
// countered by traps, which catch on one night only. Every order leaves footprints that enemies in
// the same city may notice; the same footprints come from different orders, so they are clues, not
// verdicts. Lamplighters see loud work for what it is. Talent-spotters turn an enemy agent after two
// unseen approaches; turned agents leak orders and report lies. Most agents working for you wins.
import { makeRng } from './rng.js';
import { generateWorld, RULES, ROSTERS, CONTESTED_FOR_SIZE, ORDERS_FOR_SIZE, SIDES, other, ARCHETYPES, SIDE_LABEL, FOOTPRINTS, TELLS, PLACE } from './world.js';

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
export function newGame(seed, { sleepers = false, size = 10 } = {}) {
  const rng = makeRng(seed);
  const roster = ROSTERS[size] || ROSTERS[10];
  const { cities, agents } = generateWorld(rng, roster, CONTESTED_FOR_SIZE[size] || RULES.contestedCities);
  const game = {
    version: 2, seed, size: Object.values(roster).reduce((a, b) => a + b, 0), roster, ordersPerWeek: ORDERS_FOR_SIZE[size] || RULES.ordersPerWeek, rngState: rng.state(), week: 1, phase: 'setup', cities, agents,
    placed: { control: false, karla: false },
    pending: { control: null, karla: null },
    approaches: {},   // targetId -> { side, count }
    traps: [],        // { side, city, setterId, night, dud }: a trap catches on one night only
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
// Orders a side may give each week: set by the roster size (older saves: the default).
export const ordersPerWeek = (game) => game.ordersPerWeek || RULES.ordersPerWeek;
// { agentId, type, city?, targetId?, plan?: {kind:'strike'|'trap', city}, lie?: {kind:'hide'|'frame'|'alarm', targetId?} }
export const ORDER_TYPES = ['move', 'surveil', 'lielow', 'prepare', 'strike', 'trap', 'approach', 'vet', 'feed', 'lie'];
// Feed: give an agent a fake order. They do nothing this week, but anyone leaking their orders (they
// themselves, or a mole beside them) passes it on as if it were real. { type:'feed', fake: {type, ...} }
export const FEEDABLE = ['move', 'surveil', 'prepare', 'strike', 'trap', 'approach', 'vet'];

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
    out.push({ type: 'trap', when: a.archetype === 'ferret' ? ['tonight', 'next'] : ['next'] });
  } else {
    const pitchable = enemies.filter((e) => e.turnedBy !== side);
    if (pitchable.length) out.push({ type: 'approach', targets: pitchable.map((e) => e.id) });
  }
  if (a.archetype === 'ferret') {
    const mine = here(side);
    if (mine.length) out.push({ type: 'vet', targets: mine.map((x) => x.id) });
  }
  out.push({ type: 'feed' });
  return out;
}

export function validateOrders(game, side, orders) {
  const errors = [];
  if (orders.length > ordersPerWeek(game)) errors.push(`Only ${ordersPerWeek(game)} orders a week.`);
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
    if (o.type === 'trap' && o.when && !legal.when.includes(o.when)) errors.push(`${a.name} can't trap ${o.when === 'tonight' ? 'tonight' : 'for next week'}.`);
    if (o.type === 'feed') {
      // The fake order must be one this agent could really be given, so it reads as genuine.
      const f = o.fake, fl = f && FEEDABLE.includes(f.type) && legalOrders(game, side, a.id).find((l) => l.type === f.type);
      const ok = fl && (!fl.targets || fl.targets.includes(f.targetId)) && (!fl.cities || fl.cities.includes(f.city)) && (!fl.when || !f.when || fl.when.includes(f.when));
      if (!ok) errors.push(`${a.name}: choose a fake order they could really be given.`);
    }
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

// A Ferret traps tonight unless told otherwise; anyone else's trap is ready next week.
export const trapWhen = (o, game) => o.when || (game.agents[o.agentId]?.archetype === 'ferret' ? 'tonight' : 'next');

export function describeOrder(o, game) {
  const n = (id) => (id ? game.agents[id]?.name : '');
  switch (o.type) {
    case 'move': return `go to ${o.city}`;
    case 'surveil': return 'surveil the city';
    case 'lielow': return 'lie low';
    case 'prepare': return `prepare a strike on ${n(o.targetId)}`;
    case 'strike': return `strike ${n(o.targetId)}`;
    case 'trap': return trapWhen(o, game) === 'tonight' ? 'set a trap for tonight' : 'set a trap for next week';
    case 'approach': return `approach ${n(o.targetId)}`;
    case 'vet': return `vet ${n(o.targetId)}`;
    case 'feed': return `be told to ${describeOrder({ ...o.fake, agentId: o.agentId }, game)} (fake)`;
    case 'brief': return `be ready for our ${o.plan.kind} in ${o.plan.city}`; // older saves
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

  // 0. Leaks. A fed order looks exactly like a real one from the outside: `shown` is what an agent
  //    appears to have been ordered. A turned agent passes on its own orders, word for word, and
  //    reports what each of its colleagues in the same city has been ordered, and what they are.
  const shown = (o) => (o.type === 'feed' ? { ...o.fake, agentId: o.agentId, side: o.side } : o);
  const stanceNote = (a, t) => (['strike', 'trap', 'approach', 'vet'].includes(t)
    ? (game.stance?.[a.id] === 'obey' ? ' As you instructed, I carried them out. Tell me if you want them to fail.' : ' As you instructed, I let them come to nothing. Tell me if you would rather I carry them out.')
    : '');
  for (const m of Object.values(game.agents).filter((x) => x.alive && x.turnedBy && x.turnedBy !== x.side)) {
    const own = all.find((o) => o.agentId === m.id && o.type !== 'lie');
    if (own) {
      const so = shown(own);
      // Read the next morning, after the night's moves: so it says when and where the order was given.
      send(game, m.turnedBy, { kind: 'source', from: m.id, city: m.city, text: `Last week's orders from ${SIDE_LABEL[own.side]}: ${describeOrder(so, game)}, in ${m.city}.${stanceNote(m, so.type)}`,
        facts: { order: so.type, targetId: so.targetId || null, city: so.city || null } });
    }
    const mates = all.filter((o) => o.side === m.side && o.agentId !== m.id && o.type !== 'lie' && game.agents[o.agentId].city === m.city);
    if (mates.length) {
      const lines = mates.map((o) => { const a = game.agents[o.agentId]; claim(game, m.turnedBy, a.id, a.archetype, `${m.name} (our source)`); return `${a.name}, their ${role(a.archetype)}, was ordered to ${describeOrder(shown(o), game)}.`; });
      send(game, m.turnedBy, { kind: 'source', from: m.id, city: m.city, text: `In ${m.city} last week: ${lines.join(' ')}`,
        facts: { mates: mates.map((o) => { const so = shown(o); return { id: o.agentId, order: so.type, targetId: so.targetId || null, city: so.city || null }; }) } });
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
  const arrived = new Set(of('move').map((o) => o.agentId));
  const attacks = []; // { city, attacker, target, result } for witnesses
  const quiet = new Set(of('lielow').map((o) => o.agentId));

  // 2. Traps catch on one night only: tonight (Ferrets) or next week (anyone, after a loud week of
  //    setting up). A turned setter's trap is a dud.
  for (const o of of('trap')) {
    const a = game.agents[o.agentId];
    const night = trapWhen(o, game) === 'tonight' ? w : w + 1;
    game.traps = game.traps.filter((t) => !(t.setterId === a.id && t.night === night));
    game.traps.push({ side: o.side, city: a.city, setterId: a.id, night, dud: !obeys(game, a) });
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
    const trap = game.traps.find((x) => x.side === t.side && x.city === s.city && x.night === w && !x.dud);
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
  const pitched = new Set(); // one approach per target per side per week: two pitches take two weeks
  for (const o of withRng(game, (r) => r.shuffle(of('approach')))) {
    const ts = game.agents[o.agentId], t = game.agents[o.targetId];
    if (!t.alive || t.city !== ts.city || !obeys(game, ts)) continue;
    if (pitched.has(`${o.side}:${t.id}`)) {
      send(game, o.side, { kind: 'report', from: ts.id, city: ts.city, text: `One of ours was already with ${t.name} this week. Two of us at once would have scared them off.` });
      continue;
    }
    pitched.add(`${o.side}:${t.id}`);
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

  // 7. What every agent saw this week becomes a report home: roles (from surveillance), the truth
  //    about loud work (Lamplighters), attacks witnessed, and footprints, at most a few per report.
  const tellOf = (e) => {
    const o = orderOf[e.id];
    if (o?.type === 'strike') return null; // the strike itself is the only trace: same for every striker
    if (o?.type === 'trap') return trapWhen(o, game) === 'tonight' ? 'trapTonight' : 'trapNext';
    if (['prepare', 'surveil', 'vet'].includes(o?.type)) return o.type;
    if (arrived.has(e.id)) return 'arrive';
    return 'idle'; // nothing, approaches (always unseen) and anything else
  };
  for (const side of SIDES) {
    const enemy = other(side);
    for (const a of alive(game, side)) {
      if (!loyal(a)) { moleReport(game, side, a, lieFor[a.id] || { kind: 'hide' }); continue; }
      const facts = { roles: [], activities: [], signs: [] };
      const surveilling = orderOf[a.id]?.type === 'surveil'; // Lamplighters only
      const isLL = a.archetype === 'lamplighter';
      const visible = inCity(game, enemy, a.city).filter((e) => !quiet.has(e.id)); // lying low = invisible
      const head = [], seen = []; // head: roles, truths and witnesses; seen: footprints (capped, shuffled)
      if (surveilling) for (const e of visible) { claim(game, side, e.id, e.archetype, `${a.name} (Lamplighter)`); facts.roles.push({ id: e.id, archetype: e.archetype }); }
      if (facts.roles.length) head.push(facts.roles.map((r) => `${game.agents[r.id].name} is a ${role(r.archetype)}.`).join(' '));
      for (const e of visible) {
        const tell = tellOf(e);
        if (!tell) continue;
        const eo = orderOf[e.id];
        // A Lamplighter sees loud work for what it is.
        if (isLL && ['prepare', 'trapNext', 'trapTonight', 'surveil'].includes(tell)) {
          if (tell === 'prepare') head.push(`${e.name} is preparing to strike ${game.agents[eo.targetId].name}.`);
          if (tell === 'trapNext') head.push(`${e.name} is setting a trap here, ready this coming week.`);
          if (tell === 'trapTonight') head.push(`${e.name} had a trap waiting here last night.`);
          if (tell === 'surveil') head.push(`${e.name} has been surveilling us.`);
          facts.activities.push({ id: e.id, kind: tell === 'prepare' ? 'prepare' : tell === 'surveil' ? 'surveil' : 'trap', targetId: eo.targetId || null });
          continue;
        }
        if (!roll(game, TELLS[tell].notice)) continue;
        const fp = footprint(game, tell, e, a, eo);
        if (fp) seen.push({ text: fp.text, sign: { id: e.id, sign: fp.sign, targetId: fp.targetId || null }, hostile: ['prepare', 'trapNext', 'trapTonight'].includes(tell) });
      }
      // Attacks by the other side in this city: who went for whom. Identical for every kind of striker.
      for (const at of attacks.filter((x) => x.city === a.city && x.attacker.side === enemy && x.target.id !== a.id)) {
        if (!(isLL || roll(game, RULES.noticeChance))) continue;
        head.push(at.result === 'killed' ? `It was ${at.attacker.name} who killed ${at.target.name}.` : `${at.attacker.name} was the one who went for ${at.target.name}.`);
        facts.activities.push({ id: at.attacker.id, kind: 'strike', targetId: at.target.id });
      }
      // Ferrets notice enemy surveillance in their city.
      if (a.archetype === 'ferret') {
        for (const o of all.filter((x) => x.side === enemy && x.type === 'surveil' && game.agents[x.agentId].alive && game.agents[x.agentId].city === a.city)) {
          const e = game.agents[o.agentId];
          head.push(`${e.name} has been watching us here.`); facts.activities.push({ id: e.id, kind: 'surveil' });
        }
      }
      // Keep the most telling footprints, then shuffle them so their order gives nothing away.
      const room = Math.max(0, RULES.notesPerReport - head.length);
      const kept = withRng(game, (r) => r.shuffle([...r.shuffle(seen.filter((x) => x.hostile)), ...r.shuffle(seen.filter((x) => !x.hostile))].slice(0, room)));
      for (const k of kept) facts.signs.push(k.sign);
      const notes = [...head, ...kept.map((k) => k.text)];
      if (notes.length || surveilling) send(game, side, { kind: 'report', from: a.id, city: a.city, text: notes.join(' ') || `Nothing worth reporting in ${a.city}.`, facts });
    }
  }

  game.traps = game.traps.filter((t) => t.night > w); // tonight's traps are spent
  game.pending = { control: null, karla: null };
  game.week = w + 1;
  checkEnd(game);
}

// Draw one footprint for what enemy e did, as observer a would report it.
function footprint(game, tell, e, a, eo) {
  const weights = Object.entries(TELLS[tell].signs);
  let sign = withRng(game, (r) => { let x = r() * weights.reduce((n, [, v]) => n + v, 0); for (const [k, v] of weights) { if ((x -= v) < 0) return k; } return weights[0][0]; });
  let t = null;
  if (sign === 'asking' || sign === 'shadowing') {
    if (tell === 'prepare') t = game.agents[eo.targetId];
    else if (tell === 'vet') t = game.agents[eo.targetId]; // their own colleague: looks like hunting
    else {
      const ours = inCity(game, a.side, a.city);
      const others = ours.filter((x) => x.id !== a.id);
      t = withRng(game, (r) => r.pick(others.length ? others : ours));
    }
    if (!t || !t.alive) sign = 'routine';
  }
  return { sign, targetId: t?.id, text: fillFootprint(sign, e.name, t?.name, a.city) };
}
const fillFootprint = (sign, e, t, city) => FOOTPRINTS[sign].replace('{e}', e).replace('{t}', t || '').replace('{place}', PLACE[city] || `the station in ${city}`);

// A turned agent's report home, shaped by the lie the turning side chose.
function moleReport(game, side, m, lie) {
  const turner = other(side);
  const facts = { roles: [], activities: [], signs: [] };
  let text = null;
  if (lie.kind === 'frame') {
    const t = game.agents[lie.targetId];
    if (t && t.alive) { text = `I don't like what I'm seeing from ${t.name}. Meetings I can't account for. I think they've been turned.`; facts.accused = t.id; }
  } else if (lie.kind === 'alarm') {
    const mine = inCity(game, side, m.city).filter((x) => x.id !== m.id);
    const them = inCity(game, turner, m.city);
    if (mine.length && them.length) {
      const [victim, hunter] = withRng(game, (r) => [r.pick(mine), r.pick(them)]);
      const sign = roll(game, 0.5) ? 'asking' : 'shadowing';
      text = fillFootprint(sign, hunter.name, victim.name, m.city);
      facts.signs.push({ id: hunter.id, sign, targetId: victim.id });
    }
  }
  // 'hide', or a lie that couldn't apply: a harmless footprint, sometimes, so the mole blends into the chatter.
  if (!text && roll(game, 0.4)) {
    const them = inCity(game, turner, m.city);
    if (them.length) {
      const [e, sign] = withRng(game, (r) => [r.pick(them), r() < 0.6 ? 'routine' : 'courier']);
      text = fillFootprint(sign, e.name, null, m.city);
      facts.signs.push({ id: e.id, sign });
    } else text = `Nothing worth reporting in ${m.city}.`;
  }
  if (text) send(game, side, { kind: 'report', from: m.id, city: m.city, text, facts, lie: true });
}

// ---------- end ----------
// You win by having the most agents working for you at the end: your own who are alive and still
// loyal, plus enemy agents you have turned who are still alive.
function score(game, side) {
  const all = Object.values(game.agents);
  const mine = all.filter((a) => a.side === side);
  const lost = mine.filter((a) => !a.alive).length;                         // killed or executed
  const turned = mine.filter((a) => a.alive && a.turnedBy).length;          // alive, but working for them
  const loyal = mine.length - lost - turned;                                // alive and still ours
  const recruited = all.filter((a) => a.side !== side && a.alive && a.turnedBy === side).length; // theirs, working for us
  return { standing: loyal + recruited, loyal, recruited, lost, turned, total: loyal + recruited };
}
// Re-score a finished game under the current rule (for games saved before a scoring change).
export function rescore(game) {
  if (!game.outcome) return;
  const s = { control: score(game, 'control'), karla: score(game, 'karla') };
  let winner = s.control.standing > s.karla.standing ? 'control' : s.karla.standing > s.control.standing ? 'karla' : null;
  if (game.surrendered) winner = other(game.surrendered);
  game.outcome = { ...game.outcome, score: s, winner };
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
    side, enemy, week: game.week, phase: game.phase, cities: game.cities, rules: RULES, ordersPerWeek: ordersPerWeek(game),
    own, enemies, intel: game.intel[side], inbox: game.inbox[side],
    traps: game.traps.filter((t) => t.side === side).map((t) => ({ city: t.city, setterId: t.setterId, night: t.night, active: t.night === game.week })),
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
