// The in-game Field Manual: rules on top, then tradecraft (strategy, not rules).
import { ARCHETYPES, ARCHETYPE_KEYS, RULES } from '../world.js';

export function manualHTML() {
  return `<div class="manual">
  <h2>Field Manual</h2>
  <p class="small muted">Circus internal. Not to leave the building.</p>

  <h3>The object</h3>
  <p>Twelve weeks. Eliminate more of their agents than they eliminate of yours. The game ends early if one side loses everyone.
  Agents you have turned, and who are still alive at the end, count as eliminations for you.</p>

  <h3>Your people</h3>
  <table class="arch-table small">${ARCHETYPE_KEYS.map((k) => `<tr><td>${ARCHETYPES[k].label}</td><td>${ARCHETYPES[k].does}</td></tr>`).join('')}</table>
  <p><b>The cycle:</b> Scalphunter beats Lamplighter · Lamplighter beats Ferret · Ferret beats Scalphunter. Talent-spotters beat nobody.</p>

  <h3>Each week</h3>
  <ul>
    <li>Read the morning traffic. Your notebook and board fill in automatically from what you're told, true or not.</li>
    <li>Send up to ${RULES.cablesPerWeek} cables, each to one agent, written however you like. Each becomes one order: <b>Move</b>, <b>Watch</b>, <b>Strike</b>, <b>Expose</b>, <b>Recruit</b>, or <b>Lie low</b>. At most ${RULES.watchesPerWeek} Watches a week; ${RULES.recruitsPerGame} Recruit attempts a game, one a week.</li>
    <li>"Encode" shows how the agent understood you. A vague cable gets a puzzled reply, and the agent does nothing.</li>
    <li>That night, in order: moves, watches, exposes, strikes, recruits.</li>
  </ul>

  <h3>Turned agents</h3>
  <p>A Talent-spotter's pitch works half the time, unless a Ferret is in the city. A turned agent looks exactly as before and still obeys you. But:</p>
  <ul>
    <li>every cable you send them is read, word for word, in the other capital;</li>
    <li>their reports are lies (hidden Ferrets, Scalphunters passed off as Talent-spotters), or whatever the other side tells them to say;</li>
    <li>their strikes, exposes and pitches quietly fail, and a turned Ferret stops guarding.</li>
  </ul>
  <p>Some games begin with a sleeper already in place on one side or both. If you hold a source inside their network, you can cable it to dictate its next report home.</p>

  <h3>Tradecraft (advice, not rules)</h3>
  <ul>
    <li><b>Canary trap.</b> Tell two suspect agents two different stories. Whichever story the opposition acts on tells you who is talking.</li>
    <li><b>Chicken feed.</b> Once you know an agent is turned, don't waste them. Keep cabling them, with lies.</li>
    <li><b>Cross-check.</b> Have two agents Watch the same city. If the reports disagree, one of them isn't yours.</li>
    <li><b>Sequencing.</b> A city with a Ferret is a trap for Scalphunters. Send a Lamplighter to Watch, Expose the Ferret, then strike, ideally all in one week, since exposes resolve before strikes.</li>
    <li><b>Ferrets notice watchers.</b> Watching a guarded city tells them who is looking. Expect a Scalphunter to come for your Lamplighter.</li>
    <li><b>Bait.</b> A city that looks empty invites a blind strike. Make sure your Ferret is there when it comes.</li>
    <li><b>Brevity.</b> "Vienna. Usual arrangement." is safe if it leaks, and easy to misread if it doesn't. Name targets only when you must.</li>
    <li><b>Failed strikes are information.</b> If your Scalphunter keeps "finding no target" where a report said one would be, ask who sent that report, or ask whether the Scalphunter is still yours.</li>
  </ul>
  </div>`;
}
