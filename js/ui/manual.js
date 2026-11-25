// The Field Manual: shown, not told. Roles, the strike-and-trap exchange, orders, and tradecraft.
import { ARCHETYPES, ARCHETYPE_KEYS, RULES, TELLS, FOOTPRINTS } from '../world.js';
import { ROLE_ICON, ORDER_ICON, sized } from './icons.js';

// The footprint table, as one running example: Pell (ours) watches Halas (theirs) in Vienna.
const EX = { e: 'Halas', ours: 'Ashby', theirs: 'Novak', place: 'the Riesenrad' };
const ICON_FOR = { trapNext: 'trap', prepare: 'prepare', trapTonight: 'trap', surveil: 'surveil', vet: 'vet', arrive: 'move', idle: 'lielow' };
const odds = (p) => (p >= 1 ? 'always' : `1 in ${Math.round(1 / p)}`);
function footprintTable() {
  const row = ([k, t]) => {
    const target = k === 'vet' ? EX.theirs : EX.ours;
    const total = Object.values(t.signs).reduce((a, b) => a + b, 0);
    const chips = Object.entries(t.signs).sort((a, b) => b[1] - a[1]).map(([sign, wgt]) => {
      const text = FOOTPRINTS[sign].replace('{e}', EX.e).replace('{t}', target).replace('{place}', EX.place);
      return `<li><span class="fp-bar"><i style="width:${Math.round((wgt / total) * 100)}%"></i></span><span>${text}</span></li>`;
    }).join('');
    const label = k === 'prepare' ? `Prepared a strike on ${EX.ours}` : k === 'vet' ? `Vetted ${EX.theirs}, a colleague` : k === 'idle' ? `Nothing, or approached ${EX.ours}` : t.label;
    return `<div class="fp-row ${['trapNext', 'prepare', 'trapTonight'].includes(k) ? 'hostile' : ''}">
      <div class="fp-what">${ORDER_ICON[ICON_FOR[k]]}<b>${label}</b></div>
      <div class="fp-odds"><span class="fp-meter"><i style="width:${Math.round(t.notice * 100)}%"></i></span><small>${odds(t.notice)}</small></div>
      <ul class="fp-signs">${chips}</ul></div>`;
  };
  return `<div class="fp-cast"><span class="ours">Pell</span> watches <span class="theirs">Halas</span> in Vienna. <span class="ours">Ashby</span> is ours, <span class="theirs">Novak</span> is theirs.</div>
    <div class="fp-head"><span>What Halas did</span><span>Pell notices</span><span>What Pell might report</span></div>
    ${Object.entries(TELLS).map(row).join('')}
    <div class="fp-row"><div class="fp-what">${ORDER_ICON.lielow}<b>Lay low</b></div><div class="fp-odds"><span class="fp-meter"></span><small>never</small></div><ul class="fp-signs"><li class="none">nothing</li></ul></div>
    <div class="fp-row"><div class="fp-what">${ORDER_ICON.strike}<b>Struck ${EX.ours}</b></div><div class="fp-odds"><span class="fp-meter"><i style="width:${RULES.noticeChance * 100}%"></i></span><small>${odds(RULES.noticeChance)}</small></div><ul class="fp-signs"><li class="plain">It was Halas who killed Ashby.</li><li class="none">the same for every striker, prepared or not</li></ul></div>
    <p class="fp-ll">${ROLE_ICON.lamplighter}If Pell is a Lamplighter, the first four rows read plainly: <em>Halas is preparing to strike Ashby.</em></p>`;
}

const ORDERS = [
  ['move', 'Move', 'Any city by tomorrow'],
  ['surveil', 'Surveil', 'Lamplighters only: learn every role here'],
  ['lielow', 'Lie low', 'Vanish for a week'],
  ['prepare', 'Prepare', 'Study a target, strike next week'],
  ['strike', 'Strike', 'Kill, unless trapped that night'],
  ['trap', 'Trap', 'One night. Ferrets: tonight. Others: next week (loud)'],
  ['approach', 'Approach', `${RULES.approachesToTurn} pitches turn them, unseen`],
  ['vet', 'Vet', 'Test one of ours'],
  ['feed', 'Feed', 'A fake order. Only a mole passes it on'],
];

export function manualHTML() {
  const g = (x, y, icon, color) => `<g transform="translate(${x},${y})"><circle r="26" fill="#0a0f14" stroke="${color}" stroke-width="2.5"/><g color="#ecc978">${sized(icon, 28)}</g></g>`;
  return `<div class="manual">
  <div><div class="eyebrow">Field Manual · Circus internal</div><h2 style="margin-top:6px">Every agent is on the map. None of them are what they seem.</h2></div>
  <p class="lead">${RULES.weeks} weeks. ${RULES.ordersPerWeek} orders a week. Most agents standing at the end (alive, and still yours) wins.</p>

  <div class="man-h">Your people</div>
  <div class="man-roles">${ARCHETYPE_KEYS.map((k) => `<div class="man-role">${ROLE_ICON[k]}<b>${ARCHETYPES[k].label}</b><span>${ARCHETYPES[k].power}</span></div>`).join('')}</div>

  <div class="man-h">The exchange</div>
  <div class="man-flow"><svg viewBox="0 0 760 150" role="img" aria-label="Prepare, they spot it and trap, you spot the trap and call it off">
    <path d="M90 60 H330 M370 60 H610" stroke="#c9a24e" stroke-width="2" stroke-dasharray="6 5"/>
    ${g(60, 60, ORDER_ICON.prepare, '#4a8bd1')}${g(350, 60, ORDER_ICON.trap, '#cf4234')}${g(640, 60, ORDER_ICON.strike, '#4a8bd1')}
    <text x="60" y="112" text-anchor="middle" font-size="14" font-weight="600">You prepare</text><text x="60" y="130" text-anchor="middle" font-size="12" fill="#9fa7ad">their people may notice</text>
    <text x="350" y="112" text-anchor="middle" font-size="14" font-weight="600">They set a trap</text><text x="350" y="130" text-anchor="middle" font-size="12" fill="#9fa7ad">loud: your people will notice</text>
    <text x="640" y="112" text-anchor="middle" font-size="14" font-weight="600">Strike, or call it off</text><text x="640" y="130" text-anchor="middle" font-size="12" fill="#9fa7ad">into a trap, you lose them. Scalphunters skip step one.</text>
    <text x="205" y="48" text-anchor="middle" font-size="12" fill="#9fa7ad">week 1</text><text x="490" y="48" text-anchor="middle" font-size="12" fill="#9fa7ad">week 2</text>
  </svg></div>

  <div class="man-h">Footprints</div>
  <div class="man-fp">${footprintTable()}</div>

  <div class="man-h">Orders</div>
  <div class="man-orders">${ORDERS.map(([k, n, d]) => `<div class="man-order">${ORDER_ICON[k]}<div><b>${n}</b>${d}</div></div>`).join('')}</div>

  <div class="man-h">Moles</div>
  <div class="man-orders">
    <div class="man-order">${ORDER_ICON.lie}<div><b>Their mole, your voice</b>Pick the lie they report home: all quiet, a false alarm, or framing a colleague (even another mole). Tell them whether to carry out their own side's orders or quietly let them fail.</div></div>
    <div class="man-order">${ORDER_ICON.vet}<div><b>Your mole, their ears</b>A mole passes on its own orders, and the orders and roles of everyone beside it. A Ferret can vet them.</div></div>
    <div class="man-order">${ORDER_ICON.execute}<div><b>Execute</b>Free. The other side scores either way. You'll know if you were right at the debrief.</div></div>
  </div>

  <div class="man-h">Tradecraft</div>
  <div class="tips">
    <div><b>Canary trap</b>Feed two suspects fake strikes on different targets. Whichever target runs names the mole.</div>
    <div><b>Sequencing</b>Surveil first. Strike only what you know, where no one is setting a trap.</div>
    <div><b>Go quiet</b>Someone asking about your agent? Lie low and any strike finds no one.</div>
    <div><b>Out of nowhere</b>A kill with no footprints the week before smells of a Scalphunter.</div>
    <div><b>Read twice</b>Asking about a colleague can be a vet. A room with a view can be a watcher.</div>
    <div><b>Read the dead</b>When one of yours dies, a witness may name the killer. Trap that city, or send a Scalphunter.</div>
    <div><b>Moles are silent</b>No one reports an approach. Watch for reports that never match what happens.</div>
    <div><b>Feint</b>Feed a known mole a fake trap or a fake strike. Karla guards the wrong street.</div>
  </div>
  </div>`;
}
