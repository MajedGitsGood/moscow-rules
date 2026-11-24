// Rule checks: the archetype cycle, Ferret guard, Expose, leaks, turned-agent sabotage, end states.
//   node tools/test.js
import { newGame, submitOrders, resolveWeek, viewFor } from '../js/engine.js';
import { keywordInterpret } from '../js/interpret.js';
import { factsCheck } from '../js/cables.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.error('FAIL', msg); } else console.log('ok  ', msg); };

// Build a game with a known layout: everyone at home, then move named archetypes into test
// cities 'A', 'B', 'C' (the first three contested cities). Bypasses the setup cap on purpose.
function setup(where = {}) {
  const g = newGame(7, { sleepers: false });
  const map = { A: g.cities[1], B: g.cities[2], C: g.cities[3] };
  const byArch = (side, arch, i = 0) => Object.values(g.agents).filter((x) => x.side === side && x.archetype === arch)[i];
  for (const a of Object.values(g.agents)) { a.city = a.side === 'control' ? 'London' : 'Moscow'; a.history = []; }
  for (const side of ['control', 'karla']) {
    for (const [key, c] of Object.entries(where[side] || {})) { const [arch, i] = key.split(':'); byArch(side, arch, Number(i || 0)).city = map[c]; }
  }
  g.placed = { control: true, karla: true }; g.phase = 'orders';
  return { g, cities: ['A', 'B', 'C'], byArch };
}
const week = (g, control, karla) => { submitOrders(g, 'control', control); submitOrders(g, 'karla', karla); resolveWeek(g); };

{ // Scalphunter kills a Lamplighter in an unguarded city.
  const { g, byArch } = setup({ control: { scalphunter: 'A' }, karla: { lamplighter: 'A' } });
  const sh = byArch('control', 'scalphunter'), ll = byArch('karla', 'lamplighter');
  week(g, [{ agentId: sh.id, type: 'strike', targetId: ll.id, text: 'x' }], []);
  ok(!g.agents[ll.id].alive && g.agents[sh.id].alive, 'Scalphunter beats Lamplighter');
}
{ // Ferret catches a Scalphunter.
  const { g, byArch } = setup({ control: { scalphunter: 'A' }, karla: { ferret: 'A', lamplighter: 'A' } });
  const sh = byArch('control', 'scalphunter'), ll = byArch('karla', 'lamplighter');
  week(g, [{ agentId: sh.id, type: 'strike', targetId: ll.id, text: 'x' }], []);
  ok(!g.agents[sh.id].alive && g.agents[ll.id].alive && g.credits.karla.length === 1, 'Ferret guard catches Scalphunter');
}
{ // Lamplighter exposes the Ferret, the same night a Scalphunter strikes: the strike succeeds.
  const { g, byArch } = setup({ control: { scalphunter: 'A', lamplighter: 'A' }, karla: { ferret: 'A', talentspotter: 'A' } });
  const sh = byArch('control', 'scalphunter'), ll = byArch('control', 'lamplighter'), fe = byArch('karla', 'ferret'), ts = byArch('karla', 'talentspotter');
  week(g, [{ agentId: ll.id, type: 'expose', targetId: fe.id, text: 'x' }, { agentId: sh.id, type: 'strike', targetId: ts.id, text: 'x' }], []);
  ok(!g.agents[fe.id].alive && !g.agents[ts.id].alive && g.agents[sh.id].alive, 'Lamplighter beats Ferret; expose resolves before strike');
}
{ // Wrong accusation exposes the Lamplighter instead.
  const { g, byArch } = setup({ control: { lamplighter: 'A' }, karla: { talentspotter: 'A' } });
  const ll = byArch('control', 'lamplighter'), ts = byArch('karla', 'talentspotter');
  week(g, [{ agentId: ll.id, type: 'expose', targetId: ts.id, text: 'x' }], []);
  const s = viewFor(g, 'karla').sightings[ll.id];
  ok(g.agents[ts.id].alive && s && s.claims.at(-1).archetype === 'lamplighter', 'failed expose reveals the Lamplighter');
}
{ // Ferret notices a watcher.
  const { g, byArch } = setup({ control: { talentspotter: 'A' }, karla: { ferret: 'A' } });
  const ts = byArch('control', 'talentspotter');
  week(g, [{ agentId: ts.id, type: 'watch', text: 'x' }], []);
  ok(viewFor(g, 'karla').inbox.some((m) => m.kind === 'spotted' && m.facts.agentId === ts.id), 'Ferret spots the watcher');
}
{ // Scalphunter vs Scalphunter: both die.
  const { g, byArch } = setup({ control: { scalphunter: 'A' }, karla: { scalphunter: 'A' } });
  const a = byArch('control', 'scalphunter'), b = byArch('karla', 'scalphunter');
  week(g, [{ agentId: a.id, type: 'strike', targetId: b.id, text: 'x' }], []);
  ok(!g.agents[a.id].alive && !g.agents[b.id].alive, 'Scalphunter vs Scalphunter: both die');
}
{ // Turned agent: leaks verbatim, lies (hides the Ferret), sabotages strikes.
  const { g, byArch } = setup({ control: { lamplighter: 'A', scalphunter: 'B' }, karla: { ferret: 'A', talentspotter: 'A', lamplighter: 'B' } });
  const ll = byArch('control', 'lamplighter'), sh = byArch('control', 'scalphunter'), kll = byArch('karla', 'lamplighter');
  g.agents[ll.id].turnedBy = 'karla'; g.agents[sh.id].turnedBy = 'karla';
  week(g, [{ agentId: ll.id, type: 'watch', text: 'Tell me everything about the city.' }, { agentId: sh.id, type: 'strike', targetId: kll.id, text: 'Remove their Lamplighter.' }], []);
  const kv = viewFor(g, 'karla'), cv = viewFor(g, 'control');
  ok(kv.inbox.filter((m) => m.kind === 'leak').map((m) => m.text).includes('Tell me everything about the city.'), 'cable to turned agent leaks word for word');
  const rep = cv.inbox.find((m) => m.kind === 'report' && m.agentId === ll.id);
  ok(rep && !rep.facts.seen.some((x) => x.archetype === 'ferret'), 'turned Lamplighter hides the Ferret');
  ok(g.agents[kll.id].alive, 'turned Scalphunter sabotages the strike');
}
{ // Feed: the turner dictates the turned agent's next report.
  const { g, byArch } = setup();
  const ll = byArch('control', 'lamplighter');
  g.agents[ll.id].turnedBy = 'karla';
  week(g, [], [{ agentId: ll.id, type: 'feed', message: 'Berlin is empty.', text: 'Berlin is empty.' }]);
  ok(viewFor(g, 'control').inbox.some((m) => m.agentId === ll.id && m.text === 'Berlin is empty.'), 'feed reaches the original owner as a report');
}
{ // Game ends at week 12 with a result.
  const { g } = setup();
  for (let i = 0; i < 12; i++) week(g, [], []);
  ok(g.phase === 'over' && g.outcome && g.outcome.winner === null, 'twelve empty weeks end in a draw');
}
{ // Keyword interpreter.
  const agent = { name: 'Hale', archetype: 'scalphunter', city: 'Berlin' };
  const enemies = [{ id: 'k1', name: 'Petrov' }];
  const r1 = keywordInterpret({ agent, text: 'Take the night train to Vienna.', cities: ['Berlin', 'Vienna'], enemies });
  const r2 = keywordInterpret({ agent, text: 'Deal with Petrov quietly.', cities: ['Berlin', 'Vienna'], enemies });
  const r3 = keywordInterpret({ agent: { ...agent, archetype: 'ferret' }, text: 'Kill Petrov.', cities: ['Berlin'], enemies });
  ok(r1.type === 'move' && r1.city === 'Vienna', 'keywords: move');
  ok(r2.type === 'strike' && r2.targetId === 'k1', 'keywords: strike with named target');
  ok(r3.type === 'lielow' && r3.unclear, 'keywords: wrong archetype refuses');
}
{ // Fact check on Claude-written agent text (the playtest 1 bug: replies inventing "London is quiet").
  const g = newGame(3, { sleepers: false });
  g.cities = ['London', 'Lisbon', 'Istanbul', 'Paris', 'Prague', 'Moscow'];
  const a = Object.values(g.agents).find((x) => x.side === 'control' && x.archetype === 'talentspotter');
  const k = Object.values(g.agents).find((x) => x.side === 'karla');
  a.city = 'Moscow';
  const self = `Moscow ${a.first} ${a.name} Talent-spotter`;
  ok(!factsCheck(g, `Anyone worth talking to? ${self}`, 'London is quiet as far as I can tell, sir. Give me a name.'), 'reply naming a city it was never sent to is rejected');
  ok(!factsCheck(g, `Who's in your city? ${self}`, 'Moscow is quiet on my side, but I need a clearer instruction.'), 'reply describing a city it never watched is rejected');
  ok(factsCheck(g, `Anyone worth talking to? ${self}`, 'Do you want me to find someone to approach here in Moscow, or make a pitch?'), 'a plain clarifying question passes');
  ok(!factsCheck(g, `Who's in your city? ${self}`, `I'll keep an eye on ${k.name}.`), 'reply naming an enemy agent the cable never mentioned is rejected');
  const src = `Opposition in Istanbul: ${k.name} (Scalphunter).`;
  ok(factsCheck(g, src, `Istanbul. ${k.name} is here, and he is a Scalphunter.`, { preserve: true }), 'voice rewrite keeping every fact passes');
  ok(!factsCheck(g, src, `Istanbul. ${k.name} is here, a Lamplighter by the look of it.`, { preserve: true }), 'voice rewrite changing the role is rejected');
  ok(!factsCheck(g, src, 'Istanbul has one of theirs, a Scalphunter.', { preserve: true }), 'voice rewrite dropping the name is rejected');
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
