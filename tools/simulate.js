// Bot-vs-bot balance runs + engine checks.  node tools/simulate.js [--games 500] [--seed 1]
import { newGame, placeAgents, submitOrders, resolveWeek, viewFor } from '../js/engine.js';
import { heuristicPlacement, heuristicOrders } from '../js/controllers/heuristic.js';
import { SIDES } from '../js/world.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg('games', 500), BASE = arg('seed', 1);

export function playBotGame(seed) {
  const g = newGame(seed);
  for (const side of SIDES) placeAgents(g, side, heuristicPlacement(viewFor(g, side), seed + side.length));
  while (g.phase === 'orders') {
    for (const side of SIDES) submitOrders(g, side, heuristicOrders(viewFor(g, side), seed + side.length));
    resolveWeek(g);
  }
  return g;
}

// Determinism: identical seed → identical game.
const a = JSON.stringify(playBotGame(42)), b = JSON.stringify(playBotGame(42));
if (a !== b) { console.error('FAIL determinism'); process.exit(1); }
console.log('determinism: ok');

const stats = { winner: { control: 0, karla: 0, draw: 0 }, endWeek: {}, how: {}, killedArch: {}, leaks: 0, wipeouts: 0, elim: 0, turned: 0 };
for (let i = 0; i < N; i++) {
  const g = playBotGame(BASE + i);
  const o = g.outcome;
  stats.winner[o.winner || 'draw']++;
  const ew = Math.min(g.week - 1, 12);
  stats.endWeek[ew] = (stats.endWeek[ew] || 0) + 1;
  if (o.reason.includes('wiped')) stats.wipeouts++;
  for (const ag of Object.values(g.agents)) {
    if (ag.eliminated) {
      stats.how[ag.eliminated.how] = (stats.how[ag.eliminated.how] || 0) + 1;
      stats.killedArch[ag.archetype] = (stats.killedArch[ag.archetype] || 0) + 1;
    }
  }
  stats.leaks += g.leaks.length;
  stats.elim += o.score.control.eliminations + o.score.karla.eliminations;
  stats.turned += o.score.control.turned + o.score.karla.turned;
}
console.log(`games: ${N}`);
console.log('winner:', stats.winner);
console.log('ended at week:', stats.endWeek, `wipeouts: ${stats.wipeouts}`);
console.log('eliminations/game:', (stats.elim / N).toFixed(2), ' turned-at-end/game:', (stats.turned / N).toFixed(2), ' leaks/game:', (stats.leaks / N).toFixed(2));
console.log('by how:', stats.how);
console.log('by archetype lost:', stats.killedArch);
