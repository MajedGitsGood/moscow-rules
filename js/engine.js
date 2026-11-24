// Rules engine. Pure state + rules: no DOM, no LLM. The game object is plain JSON so it can be
// saved, passed between hot-seat turns, or replayed. Every random draw goes through the seeded RNG,
// whose state is stored on the game, so seed + placements + orders always replay identically.
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
const alive = (game, side) => Object.values(game.agents).filter((a) => a.side === side && a.alive);
const inCity = (game, side, city) => alive(game, side).filter((a) => a.city === city);
const loyal = (a) => a.turnedBy === null;
const archLabel = (k) => ARCHETYPES[k].label;
const fullName = (a) => `${a.first} ${a.name}`;

function send(game, side, msg) {
  game.msgSeq = (game.msgSeq || 0) + 1;
  game.inbox[side].push({ id: `m${game.msgSeq}`, week: game.week + 1, ...msg });
}

function sight(game, side, agent, { city, claim, source, fate }) {
  const s = (game.sightings[side][agent.id] ||= { id: agent.id, name: agent.name, claims: [], lastCity: null, lastWeek: null, fate: null });
  // Stamp with the week the news arrives (the morning after resolution), matching the inbox.
  const week = game.resolving ? game.week + 1 : game.week;
  if (city) { s.lastCity = city; s.lastWeek = week; }
  if (claim) s.claims.push({ archetype: claim, source, week });
  if (fate) s.fate = fate;
}

function eliminate(game, agent, how, bySide) {
  agent.alive = false;
  agent.eliminated = { week: game.week, how, by: bySide, city: agent.city };
  game.credits[bySide].push({ agentId: agent.id, how, week: game.week });
}

// ---------- setup ----------
export function newGame(seed, { sleepers = true } = {}) {
  const rng = makeRng(seed);
  const { cities, agents } = generateWorld(rng);
  const game = {
    version: 1,
    seed,
    rngState: rng.state(),
    week: 1,
    phase: 'setup',
    cities,
    agents,
    placed: { control: false, karla: false },
    pending: { control: null, karla: null },
    recruitsUsed: { control: 0, karla: 0 },
    inbox: { control: [], karla: [] },
    sightings: { control: {}, karla: {} },
    leaks: [],
    orderLog: [],
    credits: { control: [], karla: [] },
    journal: { control: [], karla: [] },
    outcome: null,
  };
  // Sleepers: each side may start with one of its agents already working for the other side.
  if (sleepers) {
    withRng(game, (r) => {
      for (const side of SIDES) {
        if (r() < RULES.sleeperChance) {
          const victim = r.pick(alive(game, side));
          victim.turnedBy = other(side);
          victim.sleeper = true;
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
  for (const a of alive(game, side)) {
    a.city = placement[a.id];
    a.history = [{ week: 0, city: a.city }];
  }
  game.placed[side] = true;
  if (game.placed.control && game.placed.karla) startPlay(game);
}

function startPlay(game) {
  game.phase = 'orders';
  game.week = 1;
  for (const side of SIDES) {
    game.inbox[side].push({
      id: `m0-${side}`, week: 1, kind: 'briefing', from: 'Station',
      text: side === 'control'
        ? 'Your networks are in place. Twelve weeks. Find out who they are, find out who is still ours, and take them off the board.'
        : 'The networks are placed, Comrade. Twelve weeks. Identify the British joes, turn what can be turned, remove the rest.',
    });
    // The side that turned a sleeper knows about it from the start.
    for (const a of alive(game, other(side))) {
      if (a.turnedBy === side) {
        sight(game, side, a, { city: a.city, claim: a.archetype, source: 'our own asset' });
        game.inbox[side].push({
          id: `m0s-${side}-${a.id}`, week: 1, kind: 'asset', from: 'Station', agentId: a.id,
          text: `We have a long-standing source inside the opposition: ${fullName(a)}, their ${archLabel(a.archetype)}, placed in ${a.city}. Every cable they receive will be copied to us. Use them carefully.`,
          facts: { agentId: a.id, city: a.city, archetype: a.archetype },
        });
      }
    }
  }
}

// ---------- orders ----------
// order = { agentId, type: 'move'|'watch'|'strike'|'expose'|'recruit'|'lielow'|'feed', city?, targetId? ('any' allowed),
//           text (the original cable), reply? (agent acknowledgement), unclear? }
export const ORDER_TYPES = ['move', 'watch', 'strike', 'expose', 'recruit', 'lielow', 'feed'];

export function canIssue(game, side) {
  const used = game.recruitsUsed[side];
  return {
    cables: RULES.cablesPerWeek,
    watches: RULES.watchesPerWeek,
    recruitsThisWeek: used >= RULES.recruitsPerGame ? 0 : RULES.recruitsPerWeek,
    recruitsLeft: RULES.recruitsPerGame - used,
  };
}

export function validateOrders(game, side, orders) {
  const errors = [];
  if (orders.length > RULES.cablesPerWeek) errors.push(`Only ${RULES.cablesPerWeek} cables a week.`);
  const seen = new Set();
  let watches = 0, recruits = 0;
  for (const o of orders) {
    const a = game.agents[o.agentId];
    if (!a || !a.alive) { errors.push(`Unknown or lost agent.`); continue; }
    if (seen.has(a.id)) errors.push(`${a.name} already has a cable this week.`);
    seen.add(a.id);
    if (!ORDER_TYPES.includes(o.type)) { errors.push(`Unknown order "${o.type}".`); continue; }
    if (o.type === 'feed') {
      if (a.side === side || a.turnedBy !== side) errors.push(`${a.name} is not one of our turned assets.`);
      continue;
    }
    if (a.side !== side) { errors.push(`${a.name} is not our agent.`); continue; }
    if (o.type === 'move' && !game.cities.includes(o.city)) errors.push(`${a.name}: unknown city.`);
    if (o.type === 'watch') watches++;
    if (o.type === 'strike' && a.archetype !== 'scalphunter') errors.push(`${a.name} is not a Scalphunter.`);
    if (o.type === 'expose' && a.archetype !== 'lamplighter') errors.push(`${a.name} is not a Lamplighter.`);
    if (o.type === 'recruit') {
      recruits++;
      if (a.archetype !== 'talentspotter') errors.push(`${a.name} is not a Talent-spotter.`);
    }
  }
  if (watches > RULES.watchesPerWeek) errors.push(`Only ${RULES.watchesPerWeek} Watch orders a week.`);
  const lim = canIssue(game, side);
  if (recruits > lim.recruitsThisWeek) errors.push(lim.recruitsLeft <= 0 ? 'No Recruit attempts left this game.' : `Only ${RULES.recruitsPerWeek} Recruit a week.`);
  return errors;
}

export function submitOrders(game, side, orders) {
  if (game.phase !== 'orders') throw new Error('Not accepting orders.');
  const errors = validateOrders(game, side, orders);
  if (errors.length) throw new Error(errors.join(' '));
  game.pending[side] = orders.map((o) => ({ ...o, side }));
  return game.pending.control && game.pending.karla;
}

export function addJournal(game, side, text) {
  if (text) game.journal[side].push({ week: game.week, text });
}

// ---------- resolution ----------
export function resolveWeek(game) {
  if (!game.pending.control || !game.pending.karla) throw new Error('Both sides must submit orders.');
  const w = game.week;
  game.resolving = true;
  const all = [...game.pending.control, ...game.pending.karla];
  game.orderLog.push(...all.map((o) => ({ week: w, ...o })));
  const ordersOf = (type) => all.filter((o) => o.type === type && game.agents[o.agentId].alive);

  // 0. Leaks: a cable to a turned agent is copied, word for word, to the side that turned them.
  for (const o of all) {
    const a = game.agents[o.agentId];
    if (o.type === 'feed') continue;
    if (a.turnedBy && a.turnedBy !== o.side) {
      game.leaks.push({ week: w, author: o.side, reader: a.turnedBy, agentId: a.id, text: o.text || '' });
      send(game, a.turnedBy, {
        kind: 'leak', from: fullName(a), agentId: a.id,
        text: o.text || '(no text)',
        facts: { agentId: a.id, order: o.type, city: o.city || null, targetId: o.targetId || null },
      });
    }
  }

  // Acknowledgements and clarifications from agents (written by the interpreter).
  for (const o of all) {
    if (o.type === 'feed') continue;
    const a = game.agents[o.agentId];
    if (o.unclear) {
      send(game, o.side, { kind: 'clarify', from: fullName(a), agentId: a.id, text: o.reply || `Control, your cable was unclear. I am holding in ${a.city} until I understand what you want.` });
    }
  }

  // 1. Moves (honest even for turned agents: they want to stay trusted).
  for (const o of ordersOf('move')) {
    const a = game.agents[o.agentId];
    if (o.city && o.city !== a.city) a.city = o.city;
  }
  for (const a of Object.values(game.agents)) if (a.alive) a.history.push({ week: w, city: a.city });

  // 2. Watches. Lamplighters see archetypes, others see names. A loyal enemy Ferret in the city
  //    notices the watcher, so its side learns who is looking.
  for (const o of ordersOf('watch')) {
    const a = game.agents[o.agentId];
    const enemySide = other(o.side);
    const present = inCity(game, enemySide, a.city);
    if (!loyal(a)) { falseReport(game, o.side, a, present); continue; }
    const isLL = a.archetype === 'lamplighter';
    for (const x of present) {
      sight(game, o.side, x, isLL ? { city: a.city, claim: x.archetype, source: `${a.name} (Lamplighter)` } : { city: a.city });
    }
    send(game, o.side, {
      kind: 'report', from: fullName(a), agentId: a.id,
      text: watchText(a, present, isLL),
      facts: { city: a.city, seen: present.map((x) => ({ id: x.id, name: x.name, archetype: isLL ? x.archetype : null })) },
    });
    const ferret = present.find((x) => x.archetype === 'ferret' && loyal(x));
    if (ferret) spotted(game, enemySide, ferret, a);
  }

  // 2b. Expose (Lamplighter only): burn a Ferret. Accusing the wrong person exposes the Lamplighter.
  for (const o of ordersOf('expose')) {
    const l = game.agents[o.agentId];
    const enemySide = other(o.side);
    const ferrets = inCity(game, enemySide, l.city).filter((x) => x.archetype === 'ferret');
    let target = null;
    if (o.targetId && o.targetId !== 'any') {
      const t = game.agents[o.targetId];
      if (t && t.alive && t.side === enemySide && t.city === l.city) target = t;
    } else target = ferrets[0] || null;
    if (!loyal(l)) {
      send(game, o.side, { kind: 'report', from: fullName(l), agentId: l.id, text: `I could not confirm a Ferret in ${l.city}. Nothing done.`, facts: { expose: 'failed' } });
      send(game, l.turnedBy, { kind: 'asset', from: 'Station', agentId: l.id, text: `Our asset ${fullName(l)} was told to expose one of our people in ${l.city} and did nothing.`, facts: { agentId: l.id } });
      continue;
    }
    if (target && target.archetype === 'ferret') {
      eliminate(game, target, 'burned', o.side);
      sight(game, o.side, target, { city: l.city, claim: 'ferret', source: `${l.name} (Lamplighter)`, fate: 'eliminated' });
      send(game, o.side, { kind: 'kill', from: fullName(l), agentId: target.id, text: `Their Ferret ${target.name} is blown and on a plane home. ${l.city} is open.`, facts: { agentId: target.id, how: 'burned', city: l.city } });
      send(game, enemySide, { kind: 'loss', from: 'Station', agentId: target.id, text: `${l.city} has gone dark. Our Ferret ${fullName(target)} was exposed by enemy surveillance and expelled.`, facts: { agentId: target.id, how: 'burned', city: l.city } });
    } else {
      send(game, o.side, { kind: 'report', from: fullName(l), agentId: l.id, text: target ? `${target.name} is not their Ferret. I showed my hand for nothing.` : `No Ferret to expose in ${l.city}.`, facts: { expose: 'failed', targetId: target?.id || null } });
      if (target) {
        sight(game, enemySide, l, { city: l.city, claim: 'lamplighter', source: `${target.name}, who was accused` });
        send(game, enemySide, { kind: 'approach', from: fullName(target), agentId: l.id, text: `${fullName(l)} tried to have me exposed as a Ferret in ${l.city}. A Lamplighter, clearly. They got the wrong person.`, facts: { agentId: l.id, city: l.city, archetype: 'lamplighter' } });
      }
    }
  }

  // 3. Strikes, in random order (simultaneous in fiction).
  const strikes = withRng(game, (r) => r.shuffle(ordersOf('strike')));
  for (const o of strikes) {
    const s = game.agents[o.agentId];
    if (!s.alive) continue;
    const enemySide = other(o.side);
    if (!loyal(s)) {
      // Sabotage: the strike never happens.
      send(game, o.side, { kind: 'report', from: fullName(s), agentId: s.id, text: `Target could not be located in ${s.city}. Standing down.`, facts: { city: s.city, strike: 'no-target' } });
      send(game, s.turnedBy, { kind: 'asset', from: 'Station', agentId: s.id, text: `Our asset ${fullName(s)} was ordered to strike in ${s.city} and quietly let it lapse.`, facts: { agentId: s.id, city: s.city } });
      continue;
    }
    const guard = inCity(game, enemySide, s.city).find((x) => x.archetype === 'ferret' && loyal(x));
    if (guard) {
      eliminate(game, s, 'caught', enemySide);
      sight(game, enemySide, s, { city: s.city, claim: 'scalphunter', source: `${guard.name} (Ferret)`, fate: 'eliminated' });
      send(game, o.side, { kind: 'loss', from: 'Station', agentId: s.id, text: `${fullName(s)} walked into a trap in ${s.city}. The opposition had a Ferret waiting. We have lost them.`, facts: { agentId: s.id, how: 'caught', city: s.city } });
      send(game, enemySide, { kind: 'kill', from: fullName(guard), agentId: s.id, text: `A Scalphunter came for us in ${s.city}. ${fullName(s)} is in our hands.`, facts: { agentId: s.id, how: 'caught', city: s.city, archetype: 'scalphunter' } });
      continue;
    }
    const pool = inCity(game, enemySide, s.city);
    let target = null;
    if (o.targetId && o.targetId !== 'any') {
      const t = game.agents[o.targetId];
      if (t && t.alive && t.side === enemySide && t.city === s.city) target = t;
    } else {
      target = pool.length ? withRng(game, (r) => r.pick(pool)) : null;
    }
    if (!target) {
      send(game, o.side, { kind: 'report', from: fullName(s), agentId: s.id, text: `No target in ${s.city}. Standing down.`, facts: { city: s.city, strike: 'no-target' } });
      continue;
    }
    if (target.archetype === 'scalphunter') {
      eliminate(game, target, 'killed', o.side);
      eliminate(game, s, 'killed', enemySide);
      for (const side of SIDES) {
        const mine = side === o.side ? s : target, theirs = side === o.side ? target : s;
        sight(game, side, theirs, { city: s.city, claim: 'scalphunter', source: 'the shoot-out', fate: 'eliminated' });
        send(game, side, { kind: 'loss', from: 'Station', agentId: mine.id, text: `Shots in ${s.city}. Two professionals found each other: ${fullName(mine)} is dead, and so is their Scalphunter ${fullName(theirs)}.`, facts: { agentId: mine.id, how: 'killed', city: s.city, alsoKilled: theirs.id } });
      }
      continue;
    }
    eliminate(game, target, 'killed', o.side);
    sight(game, o.side, target, { city: s.city, fate: 'eliminated' });
    send(game, o.side, { kind: 'kill', from: fullName(s), agentId: target.id, text: `${target.name} is no longer a problem in ${s.city}.`, facts: { agentId: target.id, how: 'killed', city: s.city } });
    send(game, enemySide, { kind: 'loss', from: 'Station', agentId: target.id, text: `${fullName(target)} was found dead in ${s.city}. We do not know who did it.`, facts: { agentId: target.id, how: 'killed', city: s.city } });
  }

  // 4. Recruits.
  for (const o of ordersOf('recruit')) {
    const r = game.agents[o.agentId];
    if (!r.alive) continue;
    game.recruitsUsed[o.side]++;
    const enemySide = other(o.side);
    const pool = inCity(game, enemySide, r.city).filter((x) => x.turnedBy !== o.side);
    let target = null;
    if (o.targetId && o.targetId !== 'any') {
      const t = game.agents[o.targetId];
      if (t && t.alive && t.side === enemySide && t.city === r.city && t.turnedBy !== o.side) target = t;
    } else if (pool.length) target = withRng(game, (rr) => rr.pick(pool));
    if (!target) {
      send(game, o.side, { kind: 'report', from: fullName(r), agentId: r.id, text: `Nobody suitable to approach in ${r.city}.`, facts: { city: r.city, recruit: 'no-target' } });
      continue;
    }
    const approached = (why) => {
      sight(game, enemySide, r, { city: r.city, claim: 'talentspotter', source: `${target.name}, who was approached` });
      send(game, enemySide, { kind: 'approach', from: fullName(target), agentId: r.id, text: `Someone tried to buy me in ${r.city}: ${fullName(r)}. ${why}`, facts: { agentId: r.id, city: r.city, archetype: 'talentspotter', target: target.id } });
    };
    if (!loyal(r)) {
      send(game, o.side, { kind: 'report', from: fullName(r), agentId: r.id, text: `${target.name} turned me down flat. I may have been made.`, facts: { recruit: 'failed', targetId: target.id } });
      approached('I sent them packing.');
      continue;
    }
    const guard = inCity(game, enemySide, r.city).find((x) => x.archetype === 'ferret' && loyal(x));
    const success = !guard && withRng(game, (rr) => rr() < RULES.recruitChance);
    sight(game, o.side, target, { city: r.city });
    if (success) {
      target.turnedBy = o.side;
      sight(game, o.side, target, { city: r.city, claim: target.archetype, source: `${target.name} (our new asset)` });
      send(game, o.side, { kind: 'asset', from: fullName(r), agentId: target.id, text: `${fullName(target)} has agreed to work for us. They are a ${archLabel(target.archetype)}. Every cable they get from now on, we get too.`, facts: { agentId: target.id, archetype: target.archetype, city: r.city, recruit: 'success' } });
    } else {
      send(game, o.side, { kind: 'report', from: fullName(r), agentId: r.id, text: guard ? `${target.name} went straight to their security people. A Ferret is working ${r.city}.` : `${target.name} said no. They will report the approach.`, facts: { recruit: 'failed', targetId: target.id, ferret: !!guard } });
      approached(guard ? 'I reported it to our Ferret at once.' : 'I said no.');
    }
  }

  // 5. Feeds: a side dictates what its turned enemy asset tells its original owner.
  for (const o of ordersOf('feed')) {
    const a = game.agents[o.agentId];
    send(game, a.side, { kind: 'report', from: fullName(a), agentId: a.id, text: o.message || o.text || '', facts: { fed: true } });
  }

  // 6. Advance.
  game.resolving = false;
  game.pending = { control: null, karla: null };
  game.week = w + 1;
  checkEnd(game);
}

function watchText(a, seen, isLL) {
  const city = a.city;
  if (!seen.length) return `${city} is quiet. I see no opposition here.`;
  return isLL
    ? `Opposition in ${city}: ${seen.map((x) => `${x.name} (${archLabel(x.archetype)})`).join(', ')}.`
    : `${seen.length} of theirs in ${city}: ${seen.map((x) => x.name).join(', ')}. I can't tell you what they do.`;
}

// A Ferret notices someone watching its city.
function spotted(game, side, ferret, watcher) {
  const claim = watcher.archetype === 'lamplighter' ? 'lamplighter' : null;
  sight(game, side, watcher, { city: watcher.city, claim, source: claim ? `${ferret.name} (Ferret)` : undefined });
  send(game, side, {
    kind: 'spotted', from: fullName(ferret), agentId: watcher.id,
    text: `We are being watched in ${watcher.city}. ${fullName(watcher)} has been asking questions${claim ? ', and it is professional surveillance work: a Lamplighter' : ''}.`,
    facts: { agentId: watcher.id, city: watcher.city, archetype: claim },
  });
}

// A turned agent's Watch: a plausible lie. Hide Ferrets (lure a strike into a trap) and dress
// Scalphunters up as Talent-spotters (lure Lamplighters to their death).
function falseReport(game, side, a, present) {
  const shown = present.filter((x) => x.archetype !== 'ferret');
  const isLL = a.archetype === 'lamplighter';
  const fake = (x) => (x.archetype === 'scalphunter' ? 'talentspotter' : x.archetype);
  for (const x of shown) sight(game, side, x, isLL ? { city: a.city, claim: fake(x), source: `${a.name} (Lamplighter)` } : { city: a.city });
  const seen = shown.map((x) => ({ ...x, archetype: fake(x) }));
  send(game, side, {
    kind: 'report', from: fullName(a), agentId: a.id,
    text: watchText(a, seen, isLL),
    facts: { city: a.city, seen: seen.map((x) => ({ id: x.id, name: x.name, archetype: isLL ? x.archetype : null })) },
  });
  send(game, a.turnedBy, { kind: 'asset', from: 'Station', agentId: a.id, text: `Our asset ${fullName(a)} watched ${a.city} for the British and told them a story of our choosing.`, facts: { agentId: a.id, city: a.city } });
}

// ---------- end ----------
function checkEnd(game) {
  const out = SIDES.find((s) => alive(game, s).length === 0);
  if (game.week > RULES.weeks || out) {
    game.phase = 'over';
    game.week = Math.min(game.week, RULES.weeks + 1);
    const score = {};
    for (const side of SIDES) {
      const turned = alive(game, other(side)).filter((a) => a.turnedBy === side);
      score[side] = { eliminations: game.credits[side].length, turned: turned.length, total: game.credits[side].length + turned.length };
    }
    const d = score.control.total - score.karla.total;
    game.outcome = {
      reason: out ? `${SIDE_LABEL[out]}'s networks were wiped out` : 'Twelve weeks have passed',
      score,
      winner: d > 0 ? 'control' : d < 0 ? 'karla' : null,
    };
  }
}

// ---------- views ----------
// Everything one side is allowed to know. Controllers (human UI, Claude, bots) only see this.
export function viewFor(game, side) {
  const enemy = other(side);
  const own = Object.values(game.agents).filter((a) => a.side === side).map((a) => ({
    id: a.id, name: a.name, first: a.first, archetype: a.archetype, city: a.city, alive: a.alive,
    eliminated: a.eliminated, history: a.history,
  }));
  const assets = Object.values(game.agents)
    .filter((a) => a.side === enemy && a.alive && a.turnedBy === side)
    .map((a) => ({ id: a.id, name: a.name, first: a.first, archetype: a.archetype, city: a.city }));
  return {
    side, enemy, week: game.week, phase: game.phase, cities: game.cities, rules: RULES,
    own, assets,
    sightings: game.sightings[side],
    inbox: game.inbox[side],
    limits: canIssue(game, side),
    submitted: !!game.pending[side],
    tally: {
      ourEliminations: game.credits[side].length,
      ourLosses: own.filter((a) => !a.alive).length,
    },
    outcome: game.outcome,
  };
}

// Full truth for the debrief screen (only once the game is over).
export function revealAll(game) {
  if (game.phase !== 'over') throw new Error('Game still running.');
  return {
    agents: Object.values(game.agents),
    leaks: game.leaks,
    orderLog: game.orderLog,
    journal: game.journal,
    outcome: game.outcome,
  };
}
