// v2 rule checks.   node tools/test.js
import { newGame, submitOrders, resolveWeek, viewFor, executeAgent, surrender, legalOrders } from '../js/engine.js';
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
  ok(!ll.turnedBy && !inbox(g, 'karla').includes(ts.name), 'an approach is never reported to the other side');
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
  ok(viewFor(g, 'control').intel[sh.id]?.suspicions.some((s) => s.kind === 'accused'), "a mole's frame lie casts suspicion on a loyal colleague");
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
  ok(!loyalOne.alive && viewFor(g, 'karla').score.us === 1, 'executing your own agent gives the other side a point');
}
{ const { g, get } = setup();
  get('control', 'ferret').turnedBy = 'karla';
  for (let i = 0; i < 12; i++) week(g);
  ok(g.phase === 'over' && g.outcome.score.karla.total === 1 && g.outcome.winner === 'karla', 'a mole alive at the end scores for the side that turned it');
}
{ const { g } = setup();
  surrender(g, 'control');
  ok(g.phase === 'over' && g.outcome.winner === 'karla', 'surrendering hands the game to the other side');
}
{ // Fact check on Claude-written report text.
  const g = newGame(3, { sleepers: false });
  g.cities = ['London', 'Lisbon', 'Istanbul', 'Paris', 'Vienna', 'Moscow'];
  const k = Object.values(g.agents).find((x) => x.side === 'karla');
  const src = `${k.name} is a Scalphunter. ${k.name} has been studying Hale's routine. Istanbul`;
  ok(!factsCheck(g, 'Nothing worth reporting in Istanbul.', 'London is quiet as far as I can tell.'), 'rewrite naming a city its source never mentioned is rejected');
  ok(factsCheck(g, src, `In Istanbul, ${k.name} (a Scalphunter) keeps watching Hale's routine.`, { preserve: true }), 'faithful rewrite passes');
  ok(!factsCheck(g, src, `In Istanbul, ${k.name} looks like a Lamplighter to me.`, { preserve: true }), 'rewrite changing a role is rejected');
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
