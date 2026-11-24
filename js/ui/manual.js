// The Field Manual: shown, not told. Roles, the strike-and-trap exchange, orders, and tradecraft.
import { ARCHETYPES, ARCHETYPE_KEYS, RULES } from '../world.js';
import { ROLE_ICON, ORDER_ICON, sized } from './icons.js';

const ORDERS = [
  ['move', 'Move', 'Any city by tomorrow'],
  ['surveil', 'Surveil', 'Lamplighters only: learn every role here'],
  ['lielow', 'Lie low', 'Vanish for a week'],
  ['prepare', 'Prepare', 'Study a target (loud)'],
  ['strike', 'Strike', 'Kill, unless trapped'],
  ['trap', 'Trap', 'Catch the next attacker (loud)'],
  ['approach', 'Approach', `${RULES.approachesToTurn} pitches turn them, unseen`],
  ['vet', 'Vet', 'Test one of ours'],
  ['brief', 'Brief', 'Feed a plan to a suspect'],
];

export function manualHTML() {
  const g = (x, y, icon, color) => `<g transform="translate(${x},${y})"><circle r="26" fill="#0a0f14" stroke="${color}" stroke-width="2.5"/><g color="#ecc978">${sized(icon, 28)}</g></g>`;
  return `<div class="manual">
  <div><div class="eyebrow">Field Manual · Circus internal</div><h2 style="margin-top:6px">Every agent is on the map. None of them are what they seem.</h2></div>
  <p class="lead">${RULES.weeks} weeks. ${RULES.ordersPerWeek} orders a week. Every enemy agent who dies is a point; every one you turn and keep alive is a point.</p>

  <div class="man-h">Your people</div>
  <div class="man-roles">${ARCHETYPE_KEYS.map((k) => `<div class="man-role">${ROLE_ICON[k]}<b>${ARCHETYPES[k].label}</b><span>${ARCHETYPES[k].power}</span></div>`).join('')}</div>

  <div class="man-h">The exchange</div>
  <div class="man-flow"><svg viewBox="0 0 760 150" role="img" aria-label="Prepare, they spot it and trap, you spot the trap and call it off">
    <path d="M90 60 H330 M370 60 H610" stroke="#c9a24e" stroke-width="2" stroke-dasharray="6 5"/>
    ${g(60, 60, ORDER_ICON.prepare, '#4a8bd1')}${g(350, 60, ORDER_ICON.trap, '#cf4234')}${g(640, 60, ORDER_ICON.strike, '#4a8bd1')}
    <text x="60" y="112" text-anchor="middle" font-size="14" font-weight="600">You prepare</text><text x="60" y="130" text-anchor="middle" font-size="12" fill="#9fa7ad">their people may notice</text>
    <text x="350" y="112" text-anchor="middle" font-size="14" font-weight="600">They set a trap</text><text x="350" y="130" text-anchor="middle" font-size="12" fill="#9fa7ad">your people may notice</text>
    <text x="640" y="112" text-anchor="middle" font-size="14" font-weight="600">Strike, or call it off</text><text x="640" y="130" text-anchor="middle" font-size="12" fill="#9fa7ad">into a trap, you lose them. Scalphunters skip step one.</text>
    <text x="205" y="48" text-anchor="middle" font-size="12" fill="#9fa7ad">week 1</text><text x="490" y="48" text-anchor="middle" font-size="12" fill="#9fa7ad">week 2</text>
  </svg></div>

  <div class="man-h">Orders</div>
  <div class="man-orders">${ORDERS.map(([k, n, d]) => `<div class="man-order">${ORDER_ICON[k]}<div><b>${n}</b>${d}</div></div>`).join('')}</div>

  <div class="man-h">Moles</div>
  <div class="man-orders">
    <div class="man-order">${ORDER_ICON.lie}<div><b>Their mole, your voice</b>Pick the lie they report home: all quiet, a false alarm, or framing a colleague (even another mole). Tell them whether to carry out their own side's orders or quietly let them fail.</div></div>
    <div class="man-order">${ORDER_ICON.vet}<div><b>Your mole, their ears</b>Every order you give a mole reaches the other side. A Ferret can vet them.</div></div>
    <div class="man-order">${ORDER_ICON.execute}<div><b>Execute</b>Free. The other side scores either way. You'll know if you were right at the debrief.</div></div>
  </div>

  <div class="man-h">Tradecraft</div>
  <div class="tips">
    <div><b>Canary trap</b>Brief two suspects with different plans. Whichever plan Karla reacts to names the mole.</div>
    <div><b>Sequencing</b>Surveil first. Strike only what you know, where no one is setting a trap.</div>
    <div><b>Go quiet</b>Someone studying your agent's routine? Lie low and the strike finds no one.</div>
    <div><b>Read the dead</b>When one of yours dies, a witness may name the killer. Trap that city, or send a Scalphunter.</div>
    <div><b>Moles are silent</b>No one reports an approach. Watch for reports that never match what happens.</div>
    <div><b>Feint</b>Brief a known mole about a strike in the wrong city. Watch Karla trap an empty street.</div>
  </div>
  </div>`;
}
