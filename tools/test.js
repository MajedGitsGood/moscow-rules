// v2 rule checks.   node tools/test.js
import { newGame, submitOrders, resolveWeek, viewFor, executeAgent, surrender, legalOrders, setStance } from '../js/engine.js';
import { factsCheck } from '../js/voices.js';

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
  ok(ll.turnedBy === 'control', 'two approaches turn an agent');
  ok(viewFor(g, 'control').enemies.find((e) => e.id === ll.id).asset, 'the turning side sees its new asset');
  week(g, [{ agentId: ll.id, type: 'lie', lie: { kind: 'hide' } }], [{ agentId: ll.id, type: 'move', city: 'Moscow' }]);
  ok(inbox(g, 'control').includes('My orders from Karla this week: go to Moscow'), 'every order to a turned agent leaks');
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
  ok(inbox(g, 'karla').includes('As you instructed, I am carrying them out'), 'the mole tells its handlers what it is doing with its orders');
}
{ const { g, get } = setup({ control: { ferret: 'A', lamplighter: 'A', lamplighter: 'A' } });
  const ll0 = get('control', 'lamplighter', 0), ll1 = get('control', 'lamplighter', 1);
  ll0.city = ll1.city = g.cities[1]; ll0.turnedBy = 'karla'; ll1.turnedBy = 'karla';
  week(g, [], [{ agentId: ll0.id, type: 'lie', lie: { kind: 'frame', targetId: ll1.id } }]);
  ok(inbox(g, 'control').includes(`I don't like what I'm seeing from ${ll1.name}`), 'a mole can frame another mole');
}
{ const { g, get } = setup({ control: { lamplighter: 'A' } });
  const ll = get('control', 'lamplighter');
  week(g, [{ agentId: ll.id, type: 'brief', plan: { kind: 'strike', city: g.cities[2] } }]);
  ok(!inbox(g, 'karla').includes('briefed'), 'briefing a loyal agent leaks nothing');
  ll.turnedBy = 'karla';
  week(g, [{ agentId: ll.id, type: 'brief', plan: { kind: 'strike', city: g.cities[2] } }]);
  ok(inbox(g, 'karla').includes(`there will be a strike in ${g.cities[2]}`), 'briefing a mole hands the plan to the other side');
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
