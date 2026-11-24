// Offline bot. Plays from viewFor(side) only, the same information a human gets. Used for
// balance simulation, as an opponent with no LLM, and as the fallback when the token budget runs out.
// It is deliberately straightforward: believe the latest report, strike where no Ferret is known,
// keep Lamplighters scouting. It does not reason about turned agents, which humans and Claude can.
import { makeRng } from '../rng.js';
import { RULES } from '../world.js';

const latestClaim = (s) => (s.claims.length ? s.claims[s.claims.length - 1].archetype : null);

export function heuristicPlacement(view, seed = 1) {
  const rng = makeRng(seed);
  const agents = rng.shuffle(view.own.filter((a) => a.alive));
  const placement = {};
  const counts = {};
  // Spread across cities; each Ferret goes where at least one teammate will be.
  const cities = rng.shuffle(view.cities);
  let i = 0;
  for (const a of agents.filter((x) => x.archetype !== 'ferret')) {
    let c;
    do { c = cities[i++ % cities.length]; } while ((counts[c] || 0) >= RULES.maxPerCityAtSetup);
    placement[a.id] = c; counts[c] = (counts[c] || 0) + 1;
  }
  for (const f of agents.filter((x) => x.archetype === 'ferret')) {
    const options = cities.filter((c) => (counts[c] || 0) > 0 && (counts[c] || 0) < RULES.maxPerCityAtSetup);
    const c = options.length ? rng.pick(options) : cities.find((x) => (counts[x] || 0) < RULES.maxPerCityAtSetup);
    placement[f.id] = c; counts[c] = (counts[c] || 0) + 1;
  }
  return placement;
}

export function heuristicOrders(view, seed = 1) {
  const rng = makeRng(seed + view.week * 7919);
  const me = view.own.filter((a) => a.alive);
  const week = view.week;
  const sightings = Object.values(view.sightings).filter((s) => s.fate !== 'eliminated');
  const recent = sightings.filter((s) => s.lastWeek !== null && s.lastWeek >= week - 2);
  const guardedCities = new Set(recent.filter((s) => latestClaim(s) === 'ferret').map((s) => s.lastCity));
  const myCities = new Set(me.map((a) => a.city));
  // Cities a watch reported on recently.
  const watched = {};
  for (const m of view.inbox) {
    if (m.kind === 'report' && m.facts?.city && m.facts?.seen) watched[m.facts.city] = Math.max(watched[m.facts.city] || 0, m.week);
  }

  const orders = [];
  const used = new Set();
  let watches = 0;
  let recruits = view.limits.recruitsThisWeek;
  const add = (o) => { orders.push(o); used.add(o.agentId); };
  const free = (a) => !used.has(a.id) && orders.length < RULES.cablesPerWeek;

  // 0. Counter-surveillance: a Lamplighter spotted watching one of our Ferrets gets hunted,
  //    or failing that the Ferret slips away to another city.
  for (const m of view.inbox.filter((x) => x.week === week && x.kind === 'spotted' && x.facts?.archetype === 'lamplighter')) {
    const city = m.facts.city;
    const hunter = me.find((a) => a.archetype === 'scalphunter' && free(a) && a.city === city);
    if (hunter) { add({ agentId: hunter.id, type: 'strike', targetId: m.facts.agentId, text: `${hunter.name}: the Lamplighter watching our people. Deal with it.` }); continue; }
    const ferret = me.find((a) => a.archetype === 'ferret' && free(a) && a.city === city);
    if (ferret) {
      const dest = rng.pick(view.cities.filter((c) => c !== city));
      add({ agentId: ferret.id, type: 'move', city: dest, text: `${ferret.name}: you are blown in ${city}. Get to ${dest}.` });
    }
  }
  // 1. Strikes on known targets in unguarded cities.
  for (const s of me.filter((a) => a.archetype === 'scalphunter')) {
    if (!free(s) || guardedCities.has(s.city)) continue;
    const targets = recent.filter((t) => t.lastCity === s.city && latestClaim(t) !== 'ferret');
    const scouted = (watched[s.city] && watched[s.city] >= week - 1) || targets.some((t) => latestClaim(t));
    if (targets.length && scouted) {
      const t = targets.find((x) => ['lamplighter', 'talentspotter'].includes(latestClaim(x))) || targets[0];
      add({ agentId: s.id, type: 'strike', targetId: t.id, text: `${s.name}: remove ${t.name}. Tonight.` });
    }
  }
  // 2. Recruit a known enemy in the same city.
  for (const r of me.filter((a) => a.archetype === 'talentspotter')) {
    if (!free(r) || recruits <= 0 || guardedCities.has(r.city)) continue;
    const t = recent.find((x) => x.lastCity === r.city);
    if (t) { add({ agentId: r.id, type: 'recruit', targetId: t.id, text: `${r.name}: make a pitch to ${t.name}.` }); recruits--; }
  }
  // 3. Lamplighters expose a known Ferret, watch where we lack fresh information, or move toward suspected guards.
  for (const l of rng.shuffle(me.filter((a) => a.archetype === 'lamplighter'))) {
    if (!free(l)) continue;
    const ferret = recent.find((t) => t.lastCity === l.city && latestClaim(t) === 'ferret');
    if (ferret) { add({ agentId: l.id, type: 'expose', targetId: ferret.id, text: `${l.name}: blow ${ferret.name}'s cover.` }); continue; }
    if (watches >= RULES.watchesPerWeek) continue;
    const stale = !watched[l.city] || watched[l.city] < week - 1;
    if (stale) { add({ agentId: l.id, type: 'watch', text: `${l.name}: report on the opposition where you are.` }); watches++; }
    else {
      const target = [...guardedCities][0] || rng.pick(view.cities.filter((c) => c !== l.city));
      add({ agentId: l.id, type: 'move', city: target, text: `${l.name}: go to ${target}.` });
    }
  }
  // 4. Idle Scalphunters move toward known soft targets.
  for (const s of me.filter((a) => a.archetype === 'scalphunter')) {
    if (!free(s)) continue;
    const soft = recent.filter((t) => latestClaim(t) && latestClaim(t) !== 'ferret' && !guardedCities.has(t.lastCity) && t.lastCity !== s.city);
    if (soft.length) {
      const t = rng.pick(soft);
      add({ agentId: s.id, type: 'move', city: t.lastCity, text: `${s.name}: get to ${t.lastCity}.` });
    }
  }
  // 5. Any remaining watch slots: someone in an unscouted city looks around.
  for (const a of rng.shuffle(me)) {
    if (!free(a) || watches >= RULES.watchesPerWeek) continue;
    if (!watched[a.city] || watched[a.city] < week - 2) { add({ agentId: a.id, type: 'watch', text: `${a.name}: what do you see?` }); watches++; }
  }
  // 6. Spread out into cities we don't cover.
  const uncovered = view.cities.filter((c) => !myCities.has(c));
  for (const a of rng.shuffle(me)) {
    if (!free(a) || !uncovered.length || a.archetype === 'ferret') continue;
    const c = uncovered.shift();
    add({ agentId: a.id, type: 'move', city: c, text: `${a.name}: relocate to ${c}.` });
  }
  return orders;
}
