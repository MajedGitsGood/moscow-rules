// Bot-vs-bot balance runs + determinism check.  node tools/simulate.js [--games 500] [--seed 1]
import { newGame, placeAgents, submitOrders, resolveWeek, viewFor } from '../js/engine.js';
import { heuristicPlacement, heuristicOrders } from '../js/controllers/heuristic.js';
import { SIDES } from '../js/world.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg('games', 500), BASE = arg('seed', 1);

export function playBotGame(seed) {
  const g = newGame(seed);
  for (const side of SIDES) placeAgents(g, side, heuristicPlacement(viewFor(g, side), seed + side.length));
  while (g.phase === 'orders') {
    for (const side of SIDES) submitOrders(g, side, heuristicOrders(g, viewFor(g, side), seed + side.length));
    resolveWeek(g);
  }
  return g;
}

const a = JSON.stringify(playBotGame(42)), b = JSON.stringify(playBotGame(42));
if (a !== b) { console.error('FAIL determinism'); process.exit(1); }
console.log('determinism: ok');

const st = { winner: { control: 0, karla: 0, draw: 0 }, how: {}, arch: {}, orders: {}, turned: 0, reports: 0, points: 0, endWeek: {}, traffic: {}, mornings: 0, signs: {} };
// What one morning's traffic is made of, for one side.
const kindOf = (m) => {
  if (m.kind !== 'report') return m.kind;
  if (m.lie) return 'mole-lie';
  if (m.facts?.roles?.length) return 'surveillance';
  if (m.facts?.activities?.length) return 'certain-sighting';
  if (m.facts?.signs?.length) return 'footprints';
  return 'other-report';
};
for (let i = 0; i < N; i++) {
  const g = playBotGame(BASE + i);
  st.winner[g.outcome.winner || 'draw']++;
  st.endWeek[g.week] = (st.endWeek[g.week] || 0) + 1;
  st.points += g.outcome.score.control.standing + g.outcome.score.karla.standing;
  st.turned += g.outcome.score.control.turned + g.outcome.score.karla.turned;
  for (const ag of Object.values(g.agents)) if (ag.eliminated) { st.how[ag.eliminated.how] = (st.how[ag.eliminated.how] || 0) + 1; st.arch[ag.archetype] = (st.arch[ag.archetype] || 0) + 1; }
  for (const o of g.orderLog) st.orders[o.type] = (st.orders[o.type] || 0) + 1;
  st.reports += g.inbox.control.length + g.inbox.karla.length;
  for (const side of SIDES) {
    st.mornings += g.week;
    for (const m of g.inbox[side]) {
      st.traffic[kindOf(m)] = (st.traffic[kindOf(m)] || 0) + 1;
      for (const x of m.facts?.signs || []) st.signs[x.sign] = (st.signs[x.sign] || 0) + 1;
    }
  }
}
const per = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +(v / N).toFixed(2)]));
console.log(`games: ${N}`);
console.log('winner:', st.winner, ' ended at week:', st.endWeek);
console.log('standing at end/game (both sides):', (st.points / N).toFixed(2), ' turned-at-end/game:', (st.turned / N).toFixed(2), ' messages/game (both sides):', (st.reports / N).toFixed(1));
console.log('deaths/game by how:', per(st.how));
console.log('deaths/game by role:', per(st.arch));
console.log('orders/game by type:', per(st.orders));
const perMorning = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +(v / st.mornings).toFixed(2)]));
const total = Object.values(st.traffic).reduce((a, b) => a + b, 0);
console.log(`messages per morning, one side: ${(total / st.mornings).toFixed(1)}`, perMorning(st.traffic));
console.log('footprints per morning by kind:', perMorning(st.signs));
