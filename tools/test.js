// v2 rule checks.   node tools/test.js
import { newGame, submitOrders, resolveWeek, viewFor, executeAgent, surrender, legalOrders, setStance, validateOrders } from '../js/engine.js';
import { factsCheck } from '../js/voices.js';
import { tradecraft } from '../js/analysis.js';
import { loyaltyRecord } from '../js/controllers/claude.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.error('FAIL', msg); } else console.log('ok  ', msg); };

// Known layout: everyone at home, then named agents into test cities 'A'/'B'. `where` maps
// 'role' or 'role:index' to a city letter for each side.
function setup(where = {}) {
  const g = newGame(7, { sleepers: false });
  const map = { A: g.cities[1], B: g.cities[2] };
  const get = (side, arch, i = 0) => Object.values(g.agents).filter((x) => x.side === side && x.archetype === arch)[i];
  for (const a of Object.values(g.agents)) { a.city = a.side === 'control' ? 'London' : 'Moscow'; a.history = []; }
  for (const side of ['control', 'karla']) for (const [k, c] of Object.entries(where[side] || {})) { const [arch, i] = k.split(':'); get(side, arch, Number(i || 0)).city = map[c]; }
  g.placed = { control: true, karla: true }; g.phase = 'orders';
  return { g, get, A: map.A };
}
const week = (g, control = [], karla = []) => { submitOrders(g, 'control', control); submitOrders(g, 'karla', karla); resolveWeek(g); };
const inbox = (g, side) => viewFor(g, side).inbox.map((m) => m.text).join(' | ');

{ const { g, get } = setup({ control: { scalphunter: 'A' }, karla: { lamplighter: 'A' } });
  const sh = get('control', 'scalphunter'), ll = get('karla', 'lamplighter');
  week(g, [{ agentId: sh.id, type: 'strike', targetId: ll.id }]);
  ok(!ll.alive && sh.alive, 'Scalphunter strikes without preparing');
  ok(!viewFor(g, 'control').intel[ll.id], 'a kill reveals nothing about the dead agent\'s role');
}
{ const { g, get } = setup({ control: { lamplighter: 'A' }, karla: { scalphunter: 'A', ferret: 'A' } });
  const sh = get('karla', 'scalphunter'), ll = get('control', 'lamplighter'), fe = get('karla', 'ferret');
  for (const a of Object.values(g.agents)) a.history = [{ week: 0, city: a.city }];
  sh.turnedBy = 'control';
  week(g, [], [{ agentId: sh.id, type: 'strike', targetId: ll.id }, { agentId: fe.id, type: 'vet', targetId: sh.id }]);
  const rec = loyaltyRecord(g, 'karla', sh) || [];
  ok(ll.alive && rec.some((x) => /slipped away/.test(x)) && rec.some((x) => /vetted by .*TURNED/.test(x)), "Karla's loyalty record shows a mole's failed strike and the vet verdict");
  ok(!loyaltyRecord(g, 'karla', fe), 'a loyal agent with nothing against them has no record');
}
{ const { g, get } = setup();
  const own = get('control', 'lamplighter'), en = get('karla', 'ferret'), city = g.cities[1], extra = `${own.first} ${own.name} ${city} Lamplighter`;
  const src = `${en.name} has been surveilling us.`, ok1 = `${own.first} ${own.name}, our Lamplighter in ${city}, reports that ${en.name} has been conducting surveillance on our people there.`;
  const pass = (t) => factsCheck(g, `${src} ${extra}`, t) && factsCheck(g, `${src} ${extra}`, `${t} ${extra}`, { preserve: true });
  ok(pass(ok1), "a faithful voice rewrite naming its own sender and role passes");
  ok(!pass(`${own.name} reports nothing of note.`), 'a rewrite that drops the reported agent is refused');
}
{ const { g } = setup();
  const fresh = tradecraft(g, 'control');
  ok(fresh.parts.kept === 25 && fresh.parts.damage === 0 && fresh.parts.security === 25 && fresh.score === 50, 'tradecraft: a fresh network keeps 25, does 0 damage, loses no security');
  const k = Object.values(g.agents).find((a) => a.side === 'karla'); k.alive = false;
  const c = Object.values(g.agents).find((a) => a.side === 'control'); c.turnedBy = 'karla';
  const t = tradecraft(g, 'control');
  ok(t.parts.damage > 0 && t.parts.kept < 25 && t.parts.security < 25 && t.score === Object.values(t.parts).reduce((x, y) => x + y, 0), 'tradecraft: kills add damage; an undetected mole costs kept and security');
}
{ const { g } = setup();
  const ks = Object.values(g.agents).filter((a) => a.side === 'karla');
  ks.slice(1).forEach((a) => { a.alive = false; a.eliminated = { week: 1, how: 'killed', by: 'control', city: a.city }; });
  ks[0].turnedBy = 'control';
  week(g);
  ok(g.phase === 'over' && g.outcome.winner === 'control' && /working for/.test(g.outcome.reason), 'a side whose only survivors are moles has lost: the game ends');
}
{ const { g, get } = setup({ control: { lamplighter: 'A' }, karla: { talentspotter: 'A' } });
  const ll = get('control', 'lamplighter'), ts = get('karla', 'talentspotter');
  ok(!legalOrders(g, 'control', ll.id).some((l) => l.type === 'strike'), 'non-Scalphunter cannot strike unprepared');
  week(g, [{ agentId: ll.id, type: 'prepare', targetId: ts.id }]);
  ok(legalOrders(g, 'control', ll.id).find((l) => l.type === 'strike')?.targets.includes(ts.id), 'after a week of preparation the strike is available');
  week(g, [{ agentId: ll.id, type: 'strike', targetId: ts.id }]);
  ok(!ts.alive, 'prepared strike kills');
}
{ const { g, get } = setup({ control: { scalphunter: 'A' }, karla: { ferret: 'A', lamplighter: 'A' } });
  const sh = get('control', 'scalphunter'), fe = get('karla', 'ferret'), ll = get('karla', 'lamplighter');
  week(g, [{ agentId: sh.id, type: 'strike', targetId: ll.id }], [{ agentId: fe.id, type: 'trap' }]);
  ok(!sh.alive && ll.alive, "a Ferret's trap works the same night");
}
{ const { g, get } = setup({ control: { scalphunter: 'A' }, karla: { lamplighter: 'A', talentspotter: 'A' } });
  const sh = get('control', 'scalphunter'), ll = get('karla', 'lamplighter'), ts = get('karla', 'talentspotter');
  week(g, [{ agentId: sh.id, type: 'strike', targetId: ts.id }], [{ agentId: ll.id, type: 'trap' }]);
  ok(!ts.alive && sh.alive, "anyone else's trap isn't ready the first night");
}
{ const { g, get } = setup({ control: { scalphunter: 'A' }, karla: { talentspotter: 'A' } });
  const sh = get('control', 'scalphunter'), ts = get('karla', 'talentspotter');
  week(g, [{ agentId: sh.id, type: 'strike', targetId: ts.id }], [{ agentId: ts.id, type: 'lielow' }]);
  ok(ts.alive && sh.alive, 'an agent lying low cannot be found');
}
{ const { g, get } = setup({ control: { lamplighter: 'A' }, karla: { scalphunter: 'A', talentspotter: 'A' } });
  const ll = get('control', 'lamplighter'), sh = get('karla', 'scalphunter'), ts = get('karla', 'talentspotter');
  week(g, [{ agentId: ll.id, type: 'surveil' }], [{ agentId: ts.id, type: 'lielow' }]);
  const r = viewFor(g, 'control').intel;
  ok(r[sh.id]?.roles.at(-1).archetype === 'scalphunter' && !r[ts.id], 'Lamplighter surveillance reveals roles, except of agents lying low');
}
{ const { g, get } = setup({ control: { talentspotter: 'A' }, karla: { lamplighter: 'A' } });
  const ts = get('control', 'talentspotter'), ll = get('karla', 'lamplighter');
  week(g, [{ agentId: ts.id, type: 'approach', targetId: ll.id }]);
  ok(!ll.turnedBy && !/approach|pitch/i.test(inbox(g, 'karla')), 'an approach is never reported to the other side');
  week(g, [{ agentId: ts.id, type: 'approach', targetId: ll.id }]);
  ok(!ll.turnedBy, 'two approaches are not yet enough');
  week(g, [{ agentId: ts.id, type: 'approach', targetId: ll.id }]);
  ok(ll.turnedBy === 'control', 'three approaches turn an agent');
  ok(viewFor(g, 'control').enemies.find((e) => e.id === ll.id).asset, 'the turning side sees its new asset');
  week(g, [{ agentId: ll.id, type: 'lie', lie: { kind: 'hide' } }], [{ agentId: ll.id, type: 'move', city: 'Moscow' }]);
  ok(inbox(g, 'control').includes("Last week's orders from Karla: go to Moscow"), 'every order to a turned agent leaks');
}
{ const { g, get } = setup({ control: { scalphunter: 'A', ferret: 'A' }, karla: { lamplighter: 'A', scalphunter: 'A' } });
  const fe = get('control', 'ferret');
  ok(!legalOrders(g, 'control', fe.id).some((l) => l.type === 'surveil'), 'only Lamplighters can surveil');
  const ksh = get('karla', 'scalphunter'), ll = get('karla', 'lamplighter');
  week(g, [], [{ agentId: ksh.id, type: 'strike', targetId: get('control', 'scalphunter').id }, { agentId: ll.id, type: 'lielow' }]);
  // Witnesses on the victim's side may name the attacker (Ferret: 50% chance), never the role.
  ok(!viewFor(g, 'control').intel[ksh.id], 'witnessing an attack never reveals the attacker\'s role');
}
{ const { g, get } = setup({ control: { scalphunter: 'A' }, karla: { lamplighter: 'A' } });
  const sh = get('control', 'scalphunter'), ll = get('karla', 'lamplighter');
  sh.turnedBy = 'karla';
  week(g, [{ agentId: sh.id, type: 'strike', targetId: ll.id }]);
  ok(ll.alive, "a turned agent's strike quietly fails");
}
{ const { g, get } = setup({ control: { ferret: 'A', lamplighter: 'A', scalphunter: 'A' } });
  const fe = get('control', 'ferret'), ll = get('control', 'lamplighter'), sh = get('control', 'scalphunter');
  ll.turnedBy = 'karla';
  week(g, [{ agentId: fe.id, type: 'vet', targetId: ll.id }], [{ agentId: ll.id, type: 'lie', lie: { kind: 'frame', targetId: sh.id } }]);
  const t = inbox(g, 'control');
  ok(t.includes(`They're working for Karla`), 'a loyal Ferret exposes a mole when vetting');
  ok(inbox(g, 'control').includes(`from ${sh.name}`) || inbox(g, 'control').includes(sh.name), "a mole's frame lie accuses a colleague in its report");
  ok(!('suspicions' in (viewFor(g, 'control').intel[sh.id] || {})), 'no suspicion tags are kept for the player');
}
{ const { g, get } = setup({ control: { scalphunter: 'A' }, karla: { lamplighter: 'A' } });
  const sh = get('control', 'scalphunter'), ll = get('karla', 'lamplighter');
  sh.turnedBy = 'karla';
  setStance(g, 'karla', sh.id, 'obey');
  week(g, [{ agentId: sh.id, type: 'strike', targetId: ll.id }]);
  ok(!ll.alive, 'a mole told to obey carries out its orders, even against the side that turned it');
  ok(inbox(g, 'karla').includes('As you instructed, I carried them out'), 'the mole tells its handlers what it is doing with its orders');
}
{ const { g, get } = setup({ control: { ferret: 'A', lamplighter: 'A', lamplighter: 'A' } });
  const ll0 = get('control', 'lamplighter', 0), ll1 = get('control', 'lamplighter', 1);
  ll0.city = ll1.city = g.cities[1]; ll0.turnedBy = 'karla'; ll1.turnedBy = 'karla';
  week(g, [], [{ agentId: ll0.id, type: 'lie', lie: { kind: 'frame', targetId: ll1.id } }]);
  ok(inbox(g, 'control').includes(`I don't like what I'm seeing from ${ll1.name}`), 'a mole can frame another mole');
}
{ // Feed: a fake order reads exactly like a real one when a mole passes it on.
  const run = (fed) => {
    const { g, get } = setup({ control: { lamplighter: 'A' }, karla: { scalphunter: 'A' } });
    const ll = get('control', 'lamplighter'), z = get('karla', 'scalphunter');
    ll.turnedBy = 'karla';
    week(g, [fed ? { agentId: ll.id, type: 'feed', fake: { type: 'prepare', targetId: z.id } } : { agentId: ll.id, type: 'prepare', targetId: z.id }]);
    return { text: g.inbox.karla.filter((m) => m.kind === 'source').map((m) => m.text).join(' | '), prepared: !!ll.prep };
  };
  const real = run(false), fake = run(true);
  ok(fake.text.includes('prepare a strike on') && fake.text === real.text, 'a fed order leaks word for word like a real one');
  ok(real.prepared && !fake.prepared, 'the fed agent does nothing');
  const { g, get } = setup({ control: { lamplighter: 'A' }, karla: { scalphunter: 'A' } });
  const five = Object.values(g.agents).filter((a) => a.side === 'control').slice(0, 5).map((a) => ({ agentId: a.id, type: 'lielow' }));
  const ll = get('control', 'lamplighter');
  ok(validateOrders(g, 'control', [...five.filter((o) => o.agentId !== ll.id), { agentId: ll.id, type: 'feed', fake: { type: 'surveil' } }]).length === 0, 'a Feed is one of the five orders');
  ok(validateOrders(g, 'control', [{ agentId: ll.id, type: 'feed', fake: { type: 'strike', targetId: get('karla', 'scalphunter').id } }]).length > 0, "a fake order must be one they could really be given");
}
{ // A mole reports what its city-mates are ordered, and what they are.
  const { g, get } = setup({ control: { ferret: 'A', scalphunter: 'A', lamplighter: 'B' } });
  const fe = get('control', 'ferret'), sh = get('control', 'scalphunter'), ll = get('control', 'lamplighter');
  fe.turnedBy = 'karla';
  week(g, [{ agentId: sh.id, type: 'lielow' }, { agentId: ll.id, type: 'surveil' }]);
  const t = inbox(g, 'karla');
  ok(t.includes(`${sh.name}, their Scalphunter, was ordered to lie low`) && !t.includes(ll.name), "a mole reports its city-mates' orders, and only theirs");
  ok(validateOrders(g, 'karla', [{ agentId: get('karla', 'scalphunter').id, type: 'strike', targetId: ll.id }]).length > 0, 'no one can be ordered to strike an agent in another city');
  ok(viewFor(g, 'karla').intel[sh.id]?.roles.at(-1).archetype === 'scalphunter', "the mole's handlers learn its city-mates' roles");
}
{ const { g, get } = setup({ control: { lamplighter: 'A' }, karla: { talentspotter: 'A', 'talentspotter:1': 'A' } });
  const ll = get('control', 'lamplighter'), t0 = get('karla', 'talentspotter', 0), t1 = get('karla', 'talentspotter', 1);
  week(g, [{ agentId: ll.id, type: 'surveil' }], [{ agentId: t0.id, type: 'approach', targetId: ll.id }, { agentId: t1.id, type: 'approach', targetId: ll.id }]);
  ok(!ll.turnedBy && g.approaches[ll.id]?.count === 2, 'two Talent-spotters pitching the same agent in one week both count');
  week(g, [], [{ agentId: t0.id, type: 'approach', targetId: ll.id }]);
  ok(ll.turnedBy === 'karla', 'doubled up, a third approach the next week turns them');
}
{ const { g, get } = setup();
  const loyalOne = get('control', 'ferret');
  executeAgent(g, 'control', loyalOne.id);
  ok(!loyalOne.alive && viewFor(g, 'control').score.ours === 9, 'an executed agent no longer stands for you');
}
{ const { g, get } = setup();
  ok(Object.values(g.agents).filter((a) => a.side === 'control').length === 10, 'each side has ten agents');
  get('control', 'ferret').turnedBy = 'karla';
  for (let i = 0; i < 12; i++) week(g);
  ok(g.phase === 'over' && g.outcome.score.control.standing === 9 && g.outcome.score.control.turned === 1 && g.outcome.winner === 'karla', 'a mole alive at the end does not stand for its own side');
  ok(g.outcome.score.karla.standing === 11 && g.outcome.score.karla.recruited === 1, 'a mole alive at the end counts for the side it works for');
}
{ const { g } = setup();
  surrender(g, 'control');
  ok(g.phase === 'over' && g.outcome.winner === 'karla', 'surrendering hands the game to the other side');
}
// ---- footprints and one-night traps ----
const reports = (g, side, id) => g.inbox[side].filter((m) => m.week === g.week);
const signsOn = (g, side, id) => reports(g, side).flatMap((m) => m.facts?.signs || []).filter((x) => x.id === id);
const truthsOn = (g, side, id) => reports(g, side).flatMap((m) => m.facts?.activities || []).filter((x) => x.id === id);
{ const { g, get } = setup({ control: { scalphunter: 'A' }, karla: { ferret: 'A' } });
  const sh = get('control', 'scalphunter'), fe = get('karla', 'ferret');
  week(g, [{ agentId: sh.id, type: 'strike', targetId: fe.id }], [{ agentId: fe.id, type: 'trap', when: 'tonight' }]);
  ok(!sh.alive, "a Ferret's trap for tonight catches the same night");
  ok(!g.traps.length, 'a trap is spent after its one night');
}
{ const { g, get } = setup({ control: { scalphunter: 'A' }, karla: { lamplighter: 'A', talentspotter: 'A' } });
  const sh0 = get('control', 'scalphunter'), ll = get('karla', 'lamplighter'), ts = get('karla', 'talentspotter');
  week(g, [], [{ agentId: ll.id, type: 'trap', when: 'next' }]);
  ok(signsOn(g, 'control', ll.id).length > 0, 'setting a trap for next week is always noticed');
  week(g, [{ agentId: sh0.id, type: 'strike', targetId: ts.id }]);
  ok(!sh0.alive && ts.alive, 'a next-week trap catches on the following night');
  const { g: g2, get: get2 } = setup({ control: { scalphunter: 'A' }, karla: { lamplighter: 'A', talentspotter: 'A' } });
  const s2 = get2('control', 'scalphunter'), l2 = get2('karla', 'lamplighter'), t2 = get2('karla', 'talentspotter');
  week(g2, [], [{ agentId: l2.id, type: 'trap' }]);
  week(g2);
  week(g2, [{ agentId: s2.id, type: 'strike', targetId: t2.id }]);
  ok(!t2.alive && s2.alive, 'an unrenewed trap has expired after its night');
  ok(!legalOrders(g2, 'karla', l2.id).find((l) => l.type === 'trap').when.includes('tonight'), 'only Ferrets can trap tonight');
}
{ const { g, get } = setup({ control: { lamplighter: 'A' }, karla: { ferret: 'A' } });
  const ll = get('control', 'lamplighter'), fe = get('karla', 'ferret');
  week(g, [], [{ agentId: fe.id, type: 'prepare', targetId: ll.id }]);
  ok(inbox(g, 'control').includes(`${fe.name} is preparing to strike ${ll.name}`), 'a Lamplighter sees a preparation for what it is');
}
{ let leak = false, perAgent = true;
  for (let i = 0; i < 40; i++) {
    const { g, get } = setup({ control: { lamplighter: 'A', ferret: 'A', scalphunter: 'A' }, karla: { talentspotter: 'A', ferret: 'A' } });
    g.rngState = 1000 + i * 7919;
    const ts = get('karla', 'talentspotter'), kf = get('karla', 'ferret');
    week(g, [], [{ agentId: ts.id, type: 'approach', targetId: get('control', 'scalphunter').id }, { agentId: kf.id, type: 'lielow' }]);
    if (signsOn(g, 'control', ts.id).some((x) => !['routine', 'courier', 'asking'].includes(x.sign)) || truthsOn(g, 'control', ts.id).length) leak = true;
    if (signsOn(g, 'control', kf.id).length || truthsOn(g, 'control', kf.id).length) leak = true;
    const senders = reports(g, 'control').filter((m) => m.kind === 'report').map((m) => m.from);
    if (new Set(senders).size !== senders.length) perAgent = false;
  }
  ok(!leak, 'approaches look like doing nothing, even to a Lamplighter, and lying low leaves no footprint');
  ok(perAgent, 'each agent sends at most one report a week');
}
{ // An instant Scalphunter strike and a prepared strike look the same on the night.
  const run = (prepared) => {
    const { g, get } = setup({ control: { scalphunter: 'A', ferret: 'A' }, karla: { scalphunter: 'A', lamplighter: 'A' } });
    const ksh = get('karla', 'scalphunter'), cf = get('control', 'ferret');
    if (prepared) week(g, [{ agentId: cf.id, type: 'lielow' }], [{ agentId: ksh.id, type: 'prepare', targetId: get('control', 'scalphunter').id }]);
    else week(g, [{ agentId: cf.id, type: 'lielow' }]);
    g.rngState = 4242;
    week(g, [], [{ agentId: ksh.id, type: 'strike', targetId: get('control', 'scalphunter').id }]);
    return reports(g, 'control').map((m) => m.text).join(' | ');
  };
  ok(run(false) && run(false) === run(true), 'an instant strike and a prepared one produce the same messages');
}
{ // Fact check on Claude-written report text.
  const g = newGame(3, { sleepers: false });
  g.cities = ['London', 'Lisbon', 'Istanbul', 'Paris', 'Vienna', 'Moscow'];
  const k = Object.values(g.agents).find((x) => x.side === 'karla');
  const src = `${k.name} is a Scalphunter. ${k.name} has been studying Hale's routine. Istanbul`;
  ok(!factsCheck(g, 'Nothing worth reporting in Istanbul.', 'London is quiet as far as I can tell.'), 'rewrite naming a city its source never mentioned is rejected');
  ok(factsCheck(g, src, `In Istanbul, ${k.name} (a Scalphunter) keeps watching Hale's routine.`, { preserve: true }), 'faithful rewrite passes');
  ok(!factsCheck(g, src, `In Istanbul, ${k.name} looks like a Lamplighter to me.`, { preserve: true }), 'rewrite changing a role is rejected');
  ok(!factsCheck(g, `${k.name} has been asking about Hale.`, `${k.name} is preparing to hit Hale.`), 'rewrite turning a footprint into a verdict is rejected');
  ok(factsCheck(g, `${k.name} has taken a room overlooking the Riesenrad.`, `${k.name} has a room above the Riesenrad now.`), 'faithful footprint rewrite passes');
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
