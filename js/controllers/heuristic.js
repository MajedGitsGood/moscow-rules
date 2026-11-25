// Offline bot for v2. Plays from viewFor(side) only. Used for balance runs, as an opponent with no
// LLM, and as Karla's fallback. Straightforward habits: scout with Lamplighters, react to warnings
// with traps or retreats, strike known soft targets, pitch with Talent-spotters, lie through moles.
import { makeRng } from '../rng.js';
import { RULES } from '../world.js';
import { legalOrders } from '../engine.js';

const lastRole = (intel, id) => { const r = intel[id]?.roles; return r && r.length ? r[r.length - 1].archetype : null; };

export function heuristicPlacement(view, seed = 1) {
  const rng = makeRng(seed);
  const agents = rng.shuffle(view.own.filter((a) => a.alive));
  const placement = {}, counts = {};
  const cities = rng.shuffle(view.cities);
  let i = 0;
  for (const a of agents) {
    let c;
    do { c = cities[i++ % cities.length]; } while ((counts[c] || 0) >= RULES.maxPerCityAtSetup);
    placement[a.id] = c; counts[c] = (counts[c] || 0) + 1;
  }
  return placement;
}

// `game` is only used for legalOrders (which needs the public board) and never for hidden facts:
// the bot's knowledge comes from `view`.
export function heuristicOrders(game, view, seed = 1) {
  const rng = makeRng(seed * 31 + view.week * 7919);
  const side = view.side;
  const me = view.own.filter((a) => a.alive);
  const orders = [], used = new Set();
  const add = (o) => { if (orders.length < RULES.ordersPerWeek && !used.has(o.agentId)) { orders.push(o); used.add(o.agentId); } };
  const legal = (a, type) => legalOrders(game, side, a.id).find((l) => l.type === type);
  const fresh = view.inbox.filter((m) => m.week === view.week);
  // Warnings: a Lamplighter's word is certain; a footprint near one of ours is taken seriously half the time.
  const mine = (id) => me.some((a) => a.id === id);
  const warnings = [
    ...fresh.flatMap((m) => m.facts?.activities || []).filter((x) => x.kind === 'prepare' && mine(x.targetId)),
    ...fresh.flatMap((m) => m.facts?.signs || []).filter((x) => ['asking', 'shadowing'].includes(x.sign) && mine(x.targetId) && rng() < 0.5),
  ].filter((x, i, all) => all.findIndex((y) => y.targetId === x.targetId) === i);
  const trapCities = new Set(fresh.filter((m) => (m.facts?.activities || []).some((x) => x.kind === 'trap')
    || (m.facts?.signs || []).some((x) => ['room', 'faces'].includes(x.sign))).map((m) => m.city));
  // Orders leaked by enemy agents working for us (their own, and their city-mates'): the bot
  // believes them; it can't tell a fed order from a real one either.
  const leaked = fresh.filter((m) => m.kind === 'source').flatMap((m) => [
    ...(m.facts?.order ? [{ order: m.facts.order, targetId: m.facts.targetId, city: m.city }] : []),
    ...(m.facts?.mates || []).map((x) => ({ ...x, city: m.city })),
  ]);
  for (const l of leaked) if (l.order === 'trap') trapCities.add(l.city);
  // The bot's own suspicion: anyone accused in recent reports or failed by a vet.
  const suspects = new Set(view.inbox.filter((m) => m.week >= view.week - 3).flatMap((m) => [m.facts?.accused, m.facts?.verdict === 'turned' ? m.facts.vet : null]).filter(Boolean));

  // 0. A leaked strike on one of ours: the target goes to ground.
  for (const p of leaked.filter((x) => ['strike', 'prepare'].includes(x.order))) {
    const t = me.find((a) => a.id === p.targetId);
    if (t) add(rng() < 0.5 ? { agentId: t.id, type: 'lielow' } : { agentId: t.id, type: 'move', city: rng.pick(view.cities.filter((c) => c !== t.city)) });
  }
  // 1. Someone is preparing to kill one of ours: trap the city, or get the target out.
  for (const wn of warnings) {
    const target = me.find((a) => a.id === wn.targetId);
    const trapper = me.find((a) => a.city === target.city && a.archetype !== 'talentspotter' && !used.has(a.id) && !suspects.has(a.id));
    if (trapper) add({ agentId: trapper.id, type: 'trap' });
    else add({ agentId: target.id, type: 'move', city: rng.pick(view.cities.filter((c) => c !== target.city)) });
  }
  // 1a. Revenge and defence: an enemy named as an attacker gets hunted; the city gets a trap.
  const attackers = fresh.flatMap((m) => (m.facts?.activities || []).filter((x) => x.kind === 'strike').map((x) => ({ ...x, city: m.city })));
  const lossCities = new Set(fresh.filter((m) => m.kind === 'event' && m.tone === 'loss').map((m) => m.city));
  for (const at of attackers) {
    const hunter = me.find((a) => a.archetype === 'scalphunter' && a.city === at.city && !used.has(a.id));
    if (hunter && legal(hunter, 'strike')?.targets.includes(at.id)) add({ agentId: hunter.id, type: 'strike', targetId: at.id });
  }
  for (const c of lossCities) {
    const trapper = me.find((a) => a.city === c && a.archetype !== 'talentspotter' && !used.has(a.id) && !view.traps.some((t) => t.city === c));
    if (trapper) add({ agentId: trapper.id, type: 'trap' });
  }
  // 1b. Ferrets often trap their city: usually tonight, sometimes for next week.
  for (const a of me.filter((x) => x.archetype === 'ferret')) {
    if (!view.traps.some((t) => t.city === a.city) && rng() < 0.5) add({ agentId: a.id, type: 'trap', when: rng() < 0.75 ? 'tonight' : 'next' });
  }
  // 2. Strike: a prepared or Scalphunter attacker, avoiding cities where a trap was reported.
  for (const a of rng.shuffle(me)) {
    const l = legal(a, 'strike');
    if (!l || trapCities.has(a.city) || suspects.has(a.id)) continue;
    const t = l.targets.find((id) => ['lamplighter', 'talentspotter'].includes(lastRole(view.intel, id)))
      || (a.archetype === 'scalphunter' && rng() < 0.12 ? rng.pick(l.targets) : null)
      || (a.prep ? a.prep.targetId : null);
    if (!t || !l.targets.includes(t)) continue;
    // A Scalphunter sometimes prepares first, so the strike doesn't come out of nowhere.
    if (a.archetype === 'scalphunter' && !a.prep && rng() < 0.25) add({ agentId: a.id, type: 'prepare', targetId: t });
    else add({ agentId: a.id, type: 'strike', targetId: t });
  }
  // 3. Moles we run: tell a lie.
  for (const e of view.enemies.filter((x) => x.asset && x.alive)) {
    const colleagues = view.enemies.filter((x) => x.alive && x.id !== e.id);
    const kind = rng.pick(['hide', 'alarm', colleagues.length ? 'frame' : 'hide']);
    add({ agentId: e.id, type: 'lie', lie: kind === 'frame' ? { kind, targetId: rng.pick(colleagues).id } : { kind } });
  }
  // 4. Talent-spotters keep working the same target.
  for (const a of me.filter((x) => x.archetype === 'talentspotter')) {
    const l = legal(a, 'approach');
    if (!l) continue;
    const taken = new Set(orders.filter((o) => o.type === 'approach').map((o) => o.targetId)); // one pitch per target a week
    const open = l.targets.filter((id) => !taken.has(id));
    if (!open.length) continue;
    const ongoing = open.find((id) => view.approachProgress[id]);
    add({ agentId: a.id, type: 'approach', targetId: ongoing || rng.pick(open) });
  }
  // 4b. Feed a suspect a fake preparation on someone beside them: if the target then runs, the suspect is a mole.
  const suspect = me.find((a) => suspects.has(a.id) && !used.has(a.id));
  const prep = suspect && legal(suspect, 'prepare');
  if (prep) add({ agentId: suspect.id, type: 'feed', fake: { type: 'prepare', targetId: rng.pick(prep.targets) } });
  // 5. Vet a suspect with a Ferret.
  for (const a of me.filter((x) => x.archetype === 'ferret')) {
    const l = legal(a, 'vet');
    const t = l && l.targets.find((id) => suspects.has(id));
    if (t) add({ agentId: a.id, type: 'vet', targetId: t });
  }
  // 6. Lamplighters surveil cities with enemies whose roles we don't know; otherwise move to one.
  const unknownIn = (c) => view.enemies.filter((e) => e.alive && e.city === c && !lastRole(view.intel, e.id)).length;
  for (const a of rng.shuffle(me.filter((x) => x.archetype === 'lamplighter'))) {
    if (unknownIn(a.city)) add({ agentId: a.id, type: 'surveil' });
    else {
      const best = [...view.cities].sort((x, y) => unknownIn(y) - unknownIn(x))[0];
      if (best !== a.city && unknownIn(best)) add({ agentId: a.id, type: 'move', city: best });
    }
  }
  // 7. Prepare a strike on a known target, sometimes.
  for (const a of rng.shuffle(me.filter((x) => x.archetype === 'lamplighter' || x.archetype === 'ferret'))) {
    const l = legal(a, 'prepare');
    const t = l && l.targets.find((id) => ['lamplighter', 'talentspotter', 'scalphunter'].includes(lastRole(view.intel, id)));
    if (t && !a.prep && rng() < 0.5) add({ agentId: a.id, type: 'prepare', targetId: t });
  }
  // 8. Scalphunters hunt where soft targets are known.
  for (const a of me.filter((x) => x.archetype === 'scalphunter')) {
    const soft = view.enemies.filter((e) => e.alive && !e.asset && ['lamplighter', 'talentspotter'].includes(lastRole(view.intel, e.id)) && e.city !== a.city);
    if (soft.length) add({ agentId: a.id, type: 'move', city: rng.pick(soft).city });
  }
  // 9. Remaining orders: reposition, sometimes go quiet.
  for (const a of rng.shuffle(me)) {
    if (orders.length >= RULES.ordersPerWeek) break;
    if (rng() < 0.3) add({ agentId: a.id, type: 'lielow' });
    else add({ agentId: a.id, type: 'move', city: rng.pick(view.cities.filter((c) => c !== a.city)) });
  }
  return orders;
}
