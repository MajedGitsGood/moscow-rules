// App shell for v2: screens, the war-room map, HUD panels, turn flow, hot-seat, persistence.
// The engine owns the rules; this file owns who is at the desk and what they may see.
import {
  newGame, placeAgents, validatePlacement, submitOrders, validateOrders, resolveWeek, viewFor, revealAll,
  addJournal, legalOrders, executeAgent, surrender, describeOrder, setStance, trapWhen, FEEDABLE,
} from './engine.js';
import { SIDES, other, SIDE_LABEL, ARCHETYPES, ARCHETYPE_KEYS, RULES, HOME, LANDMARK } from './world.js';
import { randomSeed } from './rng.js';
import { voiceMorning } from './voices.js';
import { claudeOrders, claudePlacement } from './controllers/claude.js';
import { heuristicOrders, heuristicPlacement } from './controllers/heuristic.js';
import { checkLLM, llmStatus } from './llm.js';
import { mapBase, mapOverlay, cityXY, tintCells, MAP_SIZE } from './ui/map.js';
import { portrait, SPYMASTER } from './ui/portraits.js';
import { ROLE_ICON, ORDER_ICON, UI_ICON, LANDMARK_ICON } from './ui/icons.js';
import { manualHTML } from './ui/manual.js';
import { debriefHTML } from './ui/debrief.js';
import { analyze } from './analysis.js';

const SAVE = 'mr-save-v2';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roleLabel = (k) => ARCHETYPES[k]?.label || 'Unknown';
const ORDER_LABEL = { move: 'Move', surveil: 'Surveil', lielow: 'Lie low', prepare: 'Prepare strike', strike: 'Strike', trap: 'Set trap', approach: 'Approach', vet: 'Vet', feed: 'Feed', lie: 'Choose lie' };
const ORDER_HINT = {
  move: 'Any city, arriving tomorrow. Everyone sees the move.',
  surveil: 'Report on this city. Lamplighters learn every role.',
  lielow: "Disappear for a week. Can't be found or reported on.",
  prepare: 'Study a target, so you can strike next week. Leaves footprints.',
  strike: 'Kill the target. Fails, fatally, if they have a trap here.',
  trap: 'Catches anyone who strikes here next week, one night only. Loud while it is set up.',
  trapTonight: 'Ferrets: catches anyone who strikes here tonight, one night only.',
  approach: 'One of two pitches needed to turn them. Unseen: looks like doing nothing.',
  vet: 'Find out if one of ours here is working for them.',
  feed: 'Give a fake order. They do nothing this week, but a mole (them, or one beside them) passes it on as real.',
  lie: 'Decide what this source tells their masters this week.',
};


let app = null;
// app = { game, mode, screen, active, queued:{side:[]}, notes:{side:{roles:{},trust:{}}}, sel:{city, agent}, pick, setup:{side:{id:city}}, panel }

// ---------- persistence ----------
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(app)); } catch {} };
const load = () => { try { return JSON.parse(localStorage.getItem(SAVE)); } catch { return null; } };
const clearSave = () => { try { localStorage.removeItem(SAVE); } catch {} };
const humanSides = () => (app.mode === 'hotseat' ? SIDES : ['control']);
const isHuman = (side) => humanSides().includes(side);

// ---------- flow ----------
function startNew(mode) {
  const game = newGame(randomSeed());
  app = {
    game, mode, screen: 'setup', active: 'control',
    queued: { control: [], karla: [] },
    notes: { control: { roles: {}, trust: {} }, karla: { roles: {}, trust: {} } },
    sel: { city: null, agent: null }, pick: null, setup: {}, traffic: true,
  };
  app.setup.control = {};
  app.setupSel = Object.values(game.agents).find((a) => a.side === 'control').id;
  save(); render();
}

async function confirmPlacement() {
  const side = app.active, g = app.game;
  placeAgents(g, side, app.setup[side]);
  const opp = other(side);
  if (!g.placed[opp]) {
    if (isHuman(opp)) { app.active = opp; app.setup[opp] = {}; app.setupSel = Object.values(g.agents).find((a) => a.side === opp).id; app.screen = 'handoff'; save(); render(); return; }
    busy('Moscow Centre is placing its networks');
    const v = viewFor(g, opp);
    const r = app.mode === 'claude' ? await claudePlacement(g, opp, v) : { placement: heuristicPlacement(v, g.seed) };
    placeAgents(g, opp, r.placement);
    if (r.journal) addJournal(g, opp, r.journal);
  }
  await morning();
}

async function morning() {
  busy('The morning traffic is coming in');
  for (const side of humanSides()) await voiceMorning(app.game, side);
  app.active = 'control';
  app.sel = { city: null, agent: null }; app.pick = null;
  app.screen = app.mode === 'hotseat' ? 'handoff' : 'play';
  app.fresh = true;
  save(); render();
}

async function endWeek() {
  const g = app.game, side = app.active;
  app.whyFor = null;
  const orders = app.queued[side];
  const errors = validateOrders(g, side, orders);
  if (errors.length) { toast(errors[0]); return; }
  submitOrders(g, side, orders);
  app.queued[side] = [];
  const opp = other(side);
  if (!g.pending[opp]) {
    if (isHuman(opp)) { app.active = opp; app.screen = 'handoff'; app.sel = { city: null, agent: null }; app.pick = null; save(); render(); return; }
    busy('Moscow Centre is reading the traffic');
    const v = viewFor(g, opp);
    const r = app.mode === 'claude' ? await claudeOrders(g, opp, v) : { orders: heuristicOrders(g, v, g.seed), executions: [] };
    for (const id of r.executions || []) { try { executeAgent(g, opp, id); } catch {} }
    for (const x of r.stances || []) { try { setStance(g, opp, x.id, x.stance); } catch {} }
    if (g.phase === 'over') { app.screen = 'debrief'; save(); render(); return; }
    submitOrders(g, opp, r.orders.filter((o) => g.agents[o.agentId].alive));
    if (r.journal) addJournal(g, opp, r.journal);
  }
  busy('The night passes');
  await new Promise((res) => setTimeout(res, 900));
  resolveWeek(g);
  if (g.phase === 'over') { app.screen = 'debrief'; save(); render(); return; }
  await morning();
}

// ---------- render ----------
let baseKey = null, baseSvg = '';
function render() {
  const root = $('#app');
  if (!app) { root.innerHTML = titleScreen(); return; }
  const screens = { setup: playScreen, play: playScreen, handoff: handoffScreen, busy: busyScreen, debrief: debriefScreen };
  root.innerHTML = (screens[app.screen] || playScreen)();
  if (app.screen === 'play') { tintCells(root, viewFor(app.game, app.active)); placeCityPanel(); placePop(); applyNavFocus(); $('#why-in')?.focus(); }
  if (app.screen === 'setup') tintCells(root, setupView());
}
function busy(text) { app.screen = 'busy'; app.busyText = text; render(); }

function base(g) {
  const key = g.cities.join();
  if (key !== baseKey) { baseKey = key; baseSvg = mapBase(g.cities); }
  return baseSvg;
}

// What we know of an agent's role. Ours and our sources: certain. Theirs: a Lamplighter's report is
// certain (only loyal Lamplighters ever report roles, so it is never a lie) and fills in by itself;
// otherwise the player's own guess, shown as a guess.
function roleInfo(side) {
  return (a) => {
    if (a.side === side || a.asset || (a.turnedBy === side && a.side !== side)) return { role: a.archetype, sure: true };
    const rep = app.game.intel[side]?.[a.id]?.roles?.at(-1);
    if (rep) return { role: rep.archetype, sure: true, source: rep };
    const guess = app.notes[side].roles[a.id];
    return { role: guess || null, sure: false };
  };
}
const roleOf = (side) => (a) => roleInfo(side)(a).role;
const roleTag = (ri, cls = '') => ri.role ? `<span class="rtag r-${ri.role} ${ri.sure ? 'sure' : 'guess'} ${cls}" title="${roleLabel(ri.role)}${ri.sure ? '' : ' (your guess)'}">${ROLE_ICON[ri.role]}</span>` : `<span class="rtag unknown ${cls}" title="Role unknown">${ROLE_ICON.unknown}</span>`;

// ----- title -----
function titleScreen() {
  const saved = load();
  const st = llmStatus();
  return `<div class="title">
    <div class="title-figs"><div class="fig control">${SPYMASTER.control}<span>Control</span></div><div class="fig karla">${SPYMASTER.karla}<span>Karla</span></div></div>
    <div class="title-text">
      <h1>MOSCOW RULES</h1>
      <p class="tagline">Know who they are. Know who is still yours.</p>
      <div class="modes">
        <button class="btn gold" data-act="new" data-mode="claude">Against Karla<small>${st.llm ? 'Claude plays Moscow Centre' : 'Offline: the bot plays'}</small></button>
        <button class="btn" data-act="new" data-mode="bot">Against the bot<small>No Claude needed</small></button>
        <button class="btn" data-act="new" data-mode="hotseat">Two players<small>Hot-seat, one device</small></button>
      </div>
      ${saved?.game?.version === 2 && saved.game.phase !== 'over' ? '<button class="btn ghost" data-act="continue">Continue the operation</button>' : ''}
      <div class="title-links"><button class="link" data-act="manual">Field Manual</button><button class="link" data-act="owner">Owner token</button></div>
    </div>
  </div>`;
}

// ----- handoff / busy -----
function handoffScreen() {
  const side = app.active, setup = app.game.phase === 'setup';
  return `<div class="handoff ${side}">${SPYMASTER[side]}
    <div><div class="eyebrow">${side === 'control' ? 'Circus' : 'Moscow Centre'} · eyes only</div>
    <h1>${SIDE_LABEL[side]}'s desk</h1>
    <p>${setup ? 'Place your networks.' : `Week ${app.game.week}. The traffic is waiting.`} Make sure the other player isn't looking.</p>
    <button class="btn gold" data-act="take">I am ${SIDE_LABEL[side]}</button></div></div>`;
}
function busyScreen() {
  return `<div class="busy"><div class="teleprinter"><span>${esc(app.busyText || '')}</span><i></i></div></div>`;
}

// ----- the play screen (setup and orders share the map) -----
function playScreen() {
  const g = app.game, side = app.active;
  const setup = app.screen === 'setup';
  const v = setup ? setupView() : viewFor(g, side);
  const moveTargets = app.pick?.type === 'move' ? new Set(g.cities.filter((c) => c !== g.agents[app.pick.agentId].city)) : (setup && app.dragging ? new Set(g.cities) : null);
  const fresh = app.fresh && !setup; app.fresh = false;
  return `<div class="stage ${fresh ? 'fresh' : ''} ${side} ${setup ? 'is-setup' : ''} ${app.pick ? 'picking' : ''} ${!setup && app.traffic ? 'traffic-open' : ''}">
    <svg class="map" viewBox="0 0 ${MAP_SIZE.W} ${MAP_SIZE.H}" preserveAspectRatio="xMidYMid meet">${base(g)}
      <g id="overlay">${mapOverlay({ view: v, selected: app.sel.city, orders: setup ? [] : app.queued[side], moveTargets, roleOf: roleInfo(side), trustOf: trustOf(side), numbers: null })}</g>
    </svg>
    ${hudTop(v, setup)}
    ${setup ? setupTray(v) : ''}
    ${!setup && app.traffic ? sidePanel(v) : ''}
    ${!setup && app.sel.city && app.pick?.type !== 'move' ? cityPanel(v) : ''}
    ${!setup && app.sel.agent ? orderPop(v) : ''}
    ${!setup ? queueStrip(v) + endTurn(v) : ''}
    ${app.pick?.type === 'move' ? `<div class="pick-hint">${pickHint()}<button class="btn small ghost" data-act="cancel-pick">Cancel</button></div>` : ''}
    <div id="toast" class="toast" hidden></div>
  </div>`;
}

// During setup the map shows our draft placement.
function setupView() {
  const g = app.game, side = app.active;
  const draft = app.setup[side] || {};
  const own = Object.values(g.agents).filter((a) => a.side === side).map((a) => ({ ...a, city: draft[a.id] || null }));
  return { side, cities: g.cities, own, enemies: [], traps: [], intel: {}, inbox: [] };
}

function hudTop(v, setup) {
  const side = app.active, g = app.game;
  const used = app.queued[side]?.length || 0;
  const pips = Array.from({ length: RULES.ordersPerWeek }, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('');
  const st = llmStatus();
  return `<header class="hud-top">
    <div class="plate who ${side}"><span class="crest">${side === 'control' ? 'C' : 'K'}</span><div><b>${SIDE_LABEL[side].toUpperCase()}</b><small>${side === 'control' ? 'The Circus, London' : 'Moscow Centre'}</small></div>
      ${setup ? '' : `<div class="tally"><span class="us" title="Our agents still alive">${v.score.ours}<small>ours</small></span><span class="them" title="Their agents still alive">${v.score.theirs}<small>theirs</small></span></div>`}</div>
    <div class="plate week">${setup ? '<b>PLACE YOUR NETWORKS</b><small>Pick an agent, then a city · three per city</small>' : `<b>WEEK ${Math.min(g.week, RULES.weeks)} <span>/ ${RULES.weeks}</span></b><div class="pips" title="Orders this week">${pips}<small>${RULES.ordersPerWeek - used} orders left</small></div>`}</div>
    <div class="plate tools">
      ${setup ? '' : `<button class="icon-btn ${app.traffic ? 'on' : ''}" data-act="traffic" title="Traffic">${UI_ICON.traffic}</button>`}
      <button class="icon-btn" data-act="manual" title="Field Manual">${UI_ICON.book}</button>
      ${isHuman(side) && !setup ? `<button class="icon-btn" data-act="surrender" title="Surrender">${UI_ICON.flag}</button>` : ''}
      <button class="icon-btn" data-act="quit" title="New game">${UI_ICON.menu}</button>
      <span class="llm ${st.llm ? 'on' : ''}" title="${esc(st.reason || 'Claude is on')}"></span>
    </div>
  </header>`;
}

// ----- setup -----
function setupTray(v) {
  const draft = app.setup[app.active] || {};
  const errs = validatePlacement(app.game, app.active, draft);
  const unplaced = v.own.filter((a) => !draft[a.id]);
  return `<div class="tray">
    <div class="tray-cards">${v.own.map((a) => `<div class="tcard ${draft[a.id] ? 'placed' : ''} ${app.setupSel === a.id ? 'sel' : ''}" data-drag="${a.id}">
        ${portrait(a, { size: 40 })}<div><b>${esc(a.name)}</b><span class="role">${ROLE_ICON[a.archetype]}${roleLabel(a.archetype)}</span><em>${draft[a.id] || '—'}</em></div></div>`).join('')}</div>
    <div class="tray-actions">
      <button class="btn" data-act="shuffle">${UI_ICON.shuffle} Shuffle</button>
      <button class="btn gold" data-act="place" ${errs.length ? 'disabled' : ''}>${unplaced.length ? `${unplaced.length} to place` : 'Deploy'}</button>
    </div>
  </div>`;
}

// ----- city panel: everyone in the selected city -----
function cityPanel(v) {
  const c = app.sel.city, side = v.side;
  const ours = v.own.filter((a) => a.alive && a.city === c);
  const theirs = v.enemies.filter((a) => a.alive && a.city === c);
  const trap = v.traps.find((t) => t.city === c);
  const row = (a) => {
    const mine = a.side === side;
    const ri = roleInfo(side)(a);
    const q = app.queued[side].find((o) => o.agentId === a.id);
    const target = app.pick?.targets?.includes(a.id);
    return `<button class="cp-row ${mine ? 'mine' : a.asset ? 'asset' : 'theirs'} ${app.sel.agent === a.id ? 'sel' : ''} ${target ? 'targetable' : ''}" data-act="${target ? 'target' : 'pick-agent'}" data-agent="${a.id}">
      ${portrait(a, { size: 38 })}<span class="cp-id"><b>${esc(a.first)} ${esc(a.name)}</b><small class="${ri.role ? `r-${ri.role}` : ''}">${ri.role ? `${roleLabel(ri.role)}${ri.sure ? '' : '?'}` : 'Unknown'}${a.asset ? ' · our source' : ''}${mine && trustOf(side)(a) !== 'trusted' ? ` <em class="tchip t-${trustOf(side)(a)}">${TRUST[trustOf(side)(a)].label}</em>` : ''}</small></span>
      ${roleTag(ri, 'cp-role')}
      ${q ? `<span class="cp-q" title="${esc(describeOrder(q, app.game))}">${ORDER_ICON[q.type]}</span>` : ''}</button>`;
  };
  return `<aside class="panel city-panel">
    <div class="cp-head"><div class="cp-landmark">${LANDMARK_ICON[LANDMARK[c]]}</div><div><h2>${c}</h2><small>${HOME[c] ? (HOME[c] === 'control' ? 'Home of the Circus' : 'Home of Moscow Centre') : 'Open city'}${trap ? ` · our trap catches ${trap.active ? 'this week' : 'next week'}` : ''}</small></div>
      <button class="icon-btn" data-act="close-city">${UI_ICON.close}</button></div>
    <div class="cp-list">
      <h3 class="ours">Ours · ${ours.length}</h3>${ours.map(row).join('') || '<p class="empty">No one here.</p>'}
      <h3 class="theirs">Theirs · ${theirs.length}</h3>${theirs.map(row).join('') || '<p class="empty">No one here.</p>'}
    </div></aside>`;
}

// ----- the order popover: beside the agent's row in the city panel (or its token) -----
function chip(text, cls = '') { return `<span class="chip ${cls}">${text}</span>`; }
const ROLE_PICKS = ['unknown', ...ARCHETYPE_KEYS];

function orderPop(v) {
  const g = app.game, side = v.side, a = g.agents[app.sel.agent];
  if (!a || !a.alive || app.pick?.type === 'move') return '';
  const mine = a.side === side, asset = !mine && a.turnedBy === side;
  const stance = asset ? (g.stance?.[a.id] || 'sabotage') : null;
  const q = app.queued[side].find((o) => o.agentId === a.id);
  const chips = [];
  if (q) chips.push(chip(`${ORDER_ICON[q.type]}${esc(describeOrder(q, g))}`, 'queued'));
  if (mine && a.prep) chips.push(chip(`${ORDER_ICON.prepare}Ready to strike ${esc(g.agents[a.prep.targetId].name)}`));
  if (!mine && v.approachProgress[a.id]) chips.push(chip(`${ORDER_ICON.approach}Pitched ${v.approachProgress[a.id]}/${RULES.approachesToTurn}`, 'good'));
  if (asset) chips.push(chip('Our source', 'good'));
  const head = `<div class="pop-head">${portrait(a, { size: 40 })}<div class="pop-id"><b>${esc(a.first)} ${esc(a.name)}</b><small>${a.city}</small></div>
    <button class="icon-btn" data-act="close-agent" title="Close">${UI_ICON.close}</button></div>`;
  // An enemy agent: no orders, just your notes on who they are.
  if (!mine && !asset) {
    const ri = roleInfo(side)(a);
    const guess = app.notes[side].roles[a.id] || 'unknown';
    const body = ri.sure
      ? `<div class="pop-known r-${ri.role}">${roleTag(ri)}<div><b>${roleLabel(ri.role)}</b><small>${esc(ri.source.source)}, week ${ri.source.week}</small></div></div>`
      : `<div class="pop-label">Your guess</div>
      <div class="role-picks">${ROLE_PICKS.map((k) => `<button class="rp ${k !== 'unknown' ? `r-${k}` : ''} ${guess === k ? 'on' : ''}" data-act="setrole" data-agent="${a.id}" data-role="${k}" title="${k === 'unknown' ? 'No idea yet' : roleLabel(k)}">${ROLE_ICON[k]}</button>`).join('')}</div>`;
    return `<div class="pop theirs" id="pop">${head}${body}
      ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}</div>`;
  }
  const legal = legalOrders(g, side, a.id);
  const full = app.queued[side].length >= RULES.ordersPerWeek && !q;
  const btn = (l, when) => {
    const on = q?.type === l.type && (!when || trapWhen(q, g) === when);
    const label = when ? (when === 'tonight' ? 'Trap tonight' : 'Trap next week') : ORDER_LABEL[l.type];
    const hint = when === 'tonight' ? ORDER_HINT.trapTonight : ORDER_HINT[l.type];
    return `<button class="ob ${on ? 'on' : ''} ${app.pick?.type === l.type ? 'picking' : ''}" data-act="order" data-type="${l.type}" ${when ? `data-when="${when}"` : ''} ${full ? 'disabled' : ''} title="${esc(hint)}">${ORDER_ICON[l.type]}<span>${label}</span></button>`;
  };
  // A Ferret's trap comes in two timings; everyone else's is for next week.
  const btns = legal.flatMap((l) => (l.when ? l.when.map((w) => btn(l, w)) : [btn(l)])).join('');
  let sub = '';
  if (app.pick?.targets && app.pick.agentId === a.id) {
    sub = `<div class="pop-label">${ORDER_LABEL[app.pick.type]}: who?</div><div class="targets">${app.pick.targets.map((id) => {
      const t = g.agents[id]; const ri = roleInfo(side)({ ...t, asset: t.turnedBy === side && t.side !== side });
      return `<button class="tg" data-act="target" data-agent="${id}">${portrait(t, { size: 38 })}<span>${esc(t.name)}</span>${ri.role ? roleTag(ri, 'tg-role') : ''}</button>`;
    }).join('')}</div>`;
  }
  if (app.pick?.type === 'feed' && app.pick.agentId === a.id) {
    // Every fake order this agent could really be given: it has to read as genuine.
    const fakes = legal.filter((l) => FEEDABLE.includes(l.type)).flatMap((l) => l.targets ? l.targets.map((t) => ({ type: l.type, targetId: t }))
      : l.cities ? l.cities.map((c) => ({ type: l.type, city: c })) : l.when ? l.when.map((w) => ({ type: l.type, when: w })) : [{ type: l.type }]);
    sub = `<div class="pop-label">The order ${esc(a.name)} will be told, and won't carry out</div>
      <div class="inline feed-row"><select id="feed-fake">${fakes.map((f) => `<option value='${esc(JSON.stringify(f))}'>${esc(describeOrder({ ...f, agentId: a.id }, g))}</option>`).join('')}</select><button class="btn small gold" data-act="feed-ok">Feed</button></div>`;
  }
  if (app.pick?.type === 'lie' && app.pick.agentId === a.id) {
    const colleagues = v.enemies.filter((x) => x.alive && x.id !== a.id);
    sub = `<div class="pop-label">What do they tell ${SIDE_LABEL[a.side]}?</div><div class="inline">
      <button class="btn small" data-act="lie-ok" data-kind="hide">All quiet</button>
      <button class="btn small" data-act="lie-ok" data-kind="alarm">False alarm</button>
      <span>Frame <select id="lie-target">${colleagues.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><button class="btn small" data-act="lie-ok" data-kind="frame" ${colleagues.length ? '' : 'disabled'}>Frame</button></span></div>`;
  }
  if (app.pick?.type === 'execute' && app.pick.agentId === a.id) {
    sub = `<div class="inline danger">${SIDE_LABEL[other(side)]} scores either way; you'll learn the truth at the debrief. <button class="btn small red" data-act="execute-ok">Execute</button></div>`;
  }
  return `<div class="pop ${asset ? 'asset' : ''}" id="pop">${head}
    <div class="pop-role">${ROLE_ICON[a.archetype]}${asset ? `Their ${roleLabel(a.archetype)} · our source` : roleLabel(a.archetype)}
      ${q ? `<button class="link" data-act="unqueue">Cancel order</button>` : ''}${mine ? `<button class="link danger" data-act="execute" title="Execute">${ORDER_ICON.execute}</button>` : ''}</div>
    ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
    ${asset ? `<div class="pop-label">When ${SIDE_LABEL[a.side]} gives them orders</div><div class="stance"><button class="${stance !== 'obey' ? 'on' : ''}" data-act="stance" data-stance="sabotage" title="Their strikes, traps, approaches and vetting quietly fail">Let them fail</button><button class="${stance === 'obey' ? 'on' : ''}" data-act="stance" data-stance="obey" title="They carry out their orders, keeping their cover">Carry them out</button></div><div class="pop-label">Their report home this week</div>` : ''}
    <div class="obs">${btns}</div>${sub}
    ${mine ? trustPicker(a, side) : ''}</div>`;
}
// Keep the popover next to its token, inside the screen.
// Screen boxes, relative to the stage.
const stageBox = (el, stage) => { const r = el.getBoundingClientRect(); return { l: r.left - stage.left, t: r.top - stage.top, r: r.right - stage.left, b: r.bottom - stage.top }; };
const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
const usable = (stage) => ({ l: 12, t: 80, r: stage.width - (app.traffic ? 404 : 12), b: stage.height - 84 });

// The city panel opens over open sea where it can, never on top of its city or the city's agents.
// Every spot on the map is scored by how much land and how many other cities the panel would cover,
// plus how far it sits from its city; land comes from a grid sampled once against the map's own
// land shape (rebuilt when the map moves or resizes).
let landGrid = null;
function landMask(stage) {
  const land = document.querySelector('path.land');
  if (!land) return null;
  const svg = land.ownerSVGElement, m = svg.getScreenCTM(), cell = 16;
  const key = [stage.width, stage.height, m.a, m.e, m.f].map((v) => Math.round(v * 100)).join(',');
  if (landGrid?.key === key) return landGrid;
  const inv = m.inverse(), pt = svg.createSVGPoint(), cols = Math.ceil(stage.width / cell), rows = Math.ceil(stage.height / cell);
  const sum = new Float32Array((cols + 1) * (rows + 1)); // summed-area table of land cells
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    pt.x = stage.left + (i + 0.5) * cell; pt.y = stage.top + (j + 0.5) * cell;
    const v = land.isPointInFill(pt.matrixTransform(inv)) ? 1 : 0;
    sum[(j + 1) * (cols + 1) + i + 1] = v + sum[j * (cols + 1) + i + 1] + sum[(j + 1) * (cols + 1) + i] - sum[j * (cols + 1) + i];
  }
  const at = (i, j) => sum[Math.max(0, Math.min(rows, j)) * (cols + 1) + Math.max(0, Math.min(cols, i))];
  const fraction = (b) => {
    const i0 = Math.round(b.l / cell), i1 = Math.round(b.r / cell), j0 = Math.round(b.t / cell), j1 = Math.round(b.b / cell);
    const area = Math.max(1, (i1 - i0) * (j1 - j0));
    return (at(i1, j1) - at(i0, j1) - at(i1, j0) + at(i0, j0)) / area;
  };
  return (landGrid = { key, fraction });
}
function placeCityPanel() {
  const panel = $('.city-panel');
  if (!panel) return;
  if (window.innerWidth <= 820) { panel.style.left = panel.style.top = ''; return; } // phones: bottom sheet
  const stage = $('.stage').getBoundingClientRect();
  const cityEl = document.querySelector(`.city[data-city="${app.sel.city}"]`);
  const mask = landMask(stage);
  if (!cityEl || !mask) return;
  const pad = 10, c0 = stageBox(cityEl, stage), c = { l: c0.l - pad, t: c0.t - pad, r: c0.r + pad, b: c0.b + pad };
  const others = [...document.querySelectorAll('.city')].filter((e) => e !== cityEl).map((e) => stageBox(e, stage));
  const pw = panel.offsetWidth, ph = panel.offsetHeight, U = usable(stage), step = 16;
  const cx = (c.l + c.r) / 2, cy = (c.t + c.b) / 2;
  let best = null;
  for (let x = U.l; x <= U.r - pw; x += step) for (let y = U.t; y <= U.b - ph; y += step) {
    const box = { l: x, t: y, r: x + pw, b: y + ph };
    if (overlap(box, c) > 0) continue;
    // Covering any part of another city costs a lot; covering more of it costs more.
    const cities = others.reduce((n, o) => { const f = overlap(box, o) / ((o.r - o.l) * (o.b - o.t)); return n + (f > 0 ? 0.6 + f : 0); }, 0);
    // The gap between panel and city, so the panel stays close to what it describes.
    const dx = Math.max(0, box.l - c.r, c.l - box.r), dy = Math.max(0, box.t - c.b, c.t - box.b);
    const near = Math.hypot(dx, dy) / 300;
    const land = mask.fraction(box), score = land + cities * 1.5 + near * 1.2;
    if (!best || score < best.score) best = { score, x, y, land, cities, near };
  }
  // No clear sea near the city (a small window): dock over the right-hand column instead, so the
  // map itself stays uncovered.
  const docked = !best || best.cities > 0 || best.near > 0.5 || best.land > 0.6;
  panel.classList.toggle('docked', docked);
  if (docked) best = { x: stage.width - pw - 12, y: U.t };
  panel.style.left = `${best.x}px`; panel.style.top = `${best.y}px`;
}

function placePop() {
  const pop = $('#pop'); if (!pop) return;
  const tok = document.querySelector(`.cp-row[data-agent="${app.sel.agent}"]`) || document.querySelector(`.token[data-agent="${app.sel.agent}"]`);
  const stage = $('.stage').getBoundingClientRect();
  const r = tok ? tok.getBoundingClientRect() : { left: stage.width / 2, right: stage.width / 2, top: stage.height / 2, bottom: stage.height / 2 };
  const pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 14, top = 80;
  const docked = $('.city-panel.docked');
  const limitR = docked ? stage.width - 12 : stage.width - (app.traffic ? 404 : 12);
  // Open away from the city (tokens sit to its left or right), else above or below the token.
  const city = tok?.closest('.city')?.querySelector('.medal')?.getBoundingClientRect();
  const awayLeft = tok?.classList.contains('cp-row') ? false : (city ? r.left < city.left : false);
  const cx = (r.left + r.right) / 2;
  const options = [
    awayLeft ? [r.left - pw - gap, (r.top + r.bottom) / 2 - ph / 2] : [r.right + gap, (r.top + r.bottom) / 2 - ph / 2],
    [cx - pw / 2, r.top - ph - gap],
    [cx - pw / 2, r.bottom + gap],
    awayLeft ? [r.right + gap, (r.top + r.bottom) / 2 - ph / 2] : [r.left - pw - gap, (r.top + r.bottom) / 2 - ph / 2],
    ...[r.left - pw - gap, r.right + gap].flatMap((px) => [[px, r.top], [px, r.bottom - ph], [px, top], [px, stage.height - 96 - ph]]),
  ];
  const sel = document.querySelector(`.city[data-city="${app.sel.city || app.game.agents[app.sel.agent]?.city}"]`);
  const cityBox = sel && stageBox(sel, stage);
  const fits = ([px, py]) => px >= 12 && px + pw <= limitR && py >= top && py + ph <= stage.height - 12
    && !(cityBox && overlap({ l: px, t: py, r: px + pw, b: py + ph }, cityBox) > 0);
  // Prefer a spot that covers no city (and not the city panel); failing that, one that leaves this city clear.
  const cityBoxes = [...document.querySelectorAll('.city, .city-panel')].map((e) => stageBox(e, stage));
  const clear = (o) => fits(o) && !cityBoxes.some((b) => overlap({ l: o[0], t: o[1], r: o[0] + pw, b: o[1] + ph }, b) > 0);
  let [x, y] = options.find(clear) || options.find(fits) || options[0];
  x = Math.max(12, Math.min(x, limitR - pw)); y = Math.max(top, Math.min(y, stage.height - ph - 12));
  pop.style.left = `${x}px`; pop.style.top = `${y}px`;
}
function pickHint() {
  const p = app.pick, a = app.game.agents[p.agentId];
  return p.type === 'move' ? `Where does ${a.name} go? Click a city.` : '';
}

// ----- right panel: traffic and notebook -----
function sidePanel(v) {
  const tab = { notes: 'theirs' }[app.tab] || app.tab || 'traffic';
  const t = (k, label) => `<button class="${tab === k ? 'on' : ''} tab-${k}" data-act="tab" data-tab="${k}">${label}</button>`;
  return `<aside class="panel traffic">
    <div class="tabs">${t('traffic', `Traffic <small>wk ${v.week}</small>`)}${t('theirs', 'Theirs')}${t('ours', 'Ours')}</div>
    <div class="tp-body">${tab === 'theirs' ? theirsList(v) : tab === 'ours' ? oursList(v) : traffic(v)}</div></aside>`;
}
function traffic(v) {
  const now = v.inbox.filter((m) => m.week === v.week);
  const earlier = v.inbox.filter((m) => m.week < v.week).reverse();
  const msg = (m) => {
    const a = m.from ? app.game.agents[m.from] : null;
    const who = a ? `${a.first} ${a.name}` : 'Station';
    const tag = !a ? 'Station' : a.side === v.side ? roleLabel(a.archetype) : 'Source inside their network';
    return `<article class="msg ${m.kind} ${m.tone || ''}" data-act="goto" data-city="${m.city || ''}">
      <div class="msg-who">${a ? portrait(a, { size: 34 }) : `<span class="station">${UI_ICON.traffic}</span>`}<div><b>${esc(who)}</b><small>${esc(tag)}${m.city ? ` · ${m.city}` : ''}</small></div><em>wk ${m.week}</em></div>
      <p>${esc(m.voiced || m.text)}</p></article>`;
  };
  const group = (title, list, cls) => list.length ? `<h3 class="${cls}">${title}</h3>${list.map(msg).join('')}` : '';
  return `${group('What happened', now.filter((m) => m.kind === 'event' || m.kind === 'briefing'), 'h-event')}
    ${group('From our sources inside', now.filter((m) => m.kind === 'source'), 'h-source')}
    ${group('Reports from our people', now.filter((m) => m.kind === 'report'), 'h-report')}
    ${now.length ? '' : '<p class="empty">A quiet night. Nothing came in.</p>'}
    ${earlier.length ? `<details><summary>Earlier traffic</summary>${earlier.map(msg).join('')}</details>` : ''}`;
}
// Your own verdict on each of your agents. Shown on their tokens so you don't have to remember.
const TRUST = { trusted: { label: 'Trusted', mark: '' }, suspect: { label: 'Suspect', mark: '?' }, mole: { label: 'Mole', mark: 'M' } };
const trustOf = (side) => (a) => (a.side === side ? app.notes[side].trust[a.id] || 'trusted' : null);
const trustPicker = (a, side) => `<div class="trust3" role="group" aria-label="Your verdict on ${esc(a.name)}">${Object.entries(TRUST).map(([k, t]) =>
  `<button class="t-${k} ${trustOf(side)(a) === k ? 'on' : ''}" data-act="trust" data-agent="${a.id}" data-trust="${k}">${t.label}</button>`).join('')}</div>`;

function theirsList(v) {
  const side = v.side, notes = app.notes[side];
  const rows = v.enemies.slice().sort((a, b) => b.alive - a.alive).map((e) => {
    const ri = roleInfo(side)(e);
    const guess = notes.roles[e.id] || 'unknown';
    return `<div class="nb-row ${e.alive ? '' : 'dead'}"><button class="nb-who" data-act="select" data-agent="${e.id}">${portrait(e, { size: 30, mood: e.alive ? null : 'dead' })}<span><b>${esc(e.name)}</b><small>${e.alive ? e.city : 'dead'}${e.asset ? ' · our source' : ''}</small></span></button>
      <div class="role-picks small">${ri.sure ? `${roleTag(ri)}<span class="nb-known r-${ri.role}">${roleLabel(ri.role)}</span>` : ROLE_PICKS.map((k) => `<button class="rp ${k !== 'unknown' ? `r-${k}` : ''} ${guess === k ? 'on' : ''}" data-act="setrole" data-agent="${e.id}" data-role="${k}" title="${k === 'unknown' ? 'No idea yet' : roleLabel(k)}">${ROLE_ICON[k]}</button>`).join('')}</div></div>`;
  }).join('');
  return `<div class="nb">${rows}</div><p class="empty">Roles your Lamplighters report fill in by themselves. Your guesses show dashed.</p>`;
}
function oursList(v) {
  const side = v.side;
  const rows = v.own.slice().sort((a, b) => b.alive - a.alive).map((a) => `<div class="nb-row ${a.alive ? '' : 'dead'} trust-${trustOf(side)(a)}"><button class="nb-who" data-act="select" data-agent="${a.id}">${portrait(a, { size: 30, mood: a.alive ? null : 'dead' })}<span><b>${esc(a.name)}</b><small>${roleTag({ role: a.archetype, sure: true }, 'mini')}${a.alive ? a.city : esc(a.eliminated?.how || 'lost')}</small></span></button>
      ${a.alive ? trustPicker(a, side) : ''}</div>`).join('');
  return `<div class="nb">${rows}</div><p class="empty">Suspects and moles are marked on the map.</p>`;
}

// The week's orders, always visible: click one to revisit the agent, ✕ to cancel it.
function queueStrip(v) {
  const g = app.game, q = app.queued[v.side];
  const slot = (o, i) => {
    if (!o) return `<div class="qslot empty"><span>${i + 1}</span></div>`;
    const a = g.agents[o.agentId];
    const ask = app.whyFor === a.id ? `<div class="why-ask"><input id="why-in" maxlength="${WHY_MAX}" autocomplete="off" placeholder="Why? One line, optional" value="${esc(o.why || '')}"><small>Enter to keep · for the debrief</small></div>` : '';
    return `<div class="qslot ${app.sel.agent === a.id ? 'sel' : ''} ${o.why ? 'has-why' : ''}">${ask}<button class="qbody" data-act="why" data-agent="${a.id}" title="${esc(`${a.first} ${a.name}: ${describeOrder(o, g)}${o.why ? `\nWhy: ${o.why}` : ''}`)}">${portrait(a, { size: 30 })}<span class="qtxt"><b>${esc(a.name)}</b><small>${ORDER_ICON[o.type]}${esc(describeOrder(o, g))}</small>${o.why ? `<i class="qwhy">${esc(o.why)}</i>` : ''}</span></button><button class="qx" data-act="unqueue-id" data-agent="${a.id}" title="Cancel this order">${UI_ICON.close}</button></div>`;
  };
  const slots = Array.from({ length: RULES.ordersPerWeek }, (_, i) => slot(q[i], i)).join('');
  return `<div class="queue">${slots}</div>`;
}

function endTurn() {
  const n = app.queued[app.active].length;
  return `<button class="end-turn" data-act="end">${n ? `Send ${n} order${n > 1 ? 's' : ''}` : 'End week'}<small>${n ? 'and wait for the night' : 'no orders this week'}</small></button>`;
}

// ----- debrief -----
let analyzing = false;
function debriefScreen() {
  // The analyst runs once per game; the page shows the facts at once and the story when it's ready.
  // A story saved in the older shape (pivotal without an exchange) is redone.
  if (app.story && !('receiver' in (app.story.pivotal || {}))) app.story = null;
  if (!app.story && !analyzing) {
    analyzing = true;
    analyze(app.game).then((story) => { app.story = story; analyzing = false; save(); if (app.screen === 'debrief') render(); });
  }
  return debriefHTML(app.game, app.story);
}

// ---------- interaction ----------

const WHY_MAX = 90;
function queue(order) {
  const side = app.active;
  const prev = app.queued[side].find((o) => o.agentId === order.agentId);
  if (prev?.why) order.why = prev.why;
  app.queued[side] = app.queued[side].filter((o) => o.agentId !== order.agentId);
  app.queued[side].push(order);
  app.whyFor = order.agentId; // ask for the reason now, while it's fresh
  app.pick = null;
  app.sel = { city: app.game.agents[order.agentId].city, agent: null };
  save(); render();
}
function toast(text) {
  const t = $('#toast'); if (!t) return;
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2600);
}

function onAct(el, ev) {
  const act = el.dataset.act, g = app?.game, side = app?.active;
  switch (act) {
    case 'new': return startNew(el.dataset.mode);
    case 'continue': app = load(); if (app.screen === 'busy') { app.game.pending = { control: null, karla: null }; app.screen = app.game.phase === 'setup' ? 'setup' : 'play'; app.active = 'control'; } return render();
    case 'manual': return openModal(manualHTML());
    case 'owner': {
      openModal(`<h2>Owner token</h2><p>Skips the guest token budget on your own server.</p><input id="owner-in" type="password" autocomplete="off"><button class="btn gold" data-act="owner-ok">Save</button>`);
      return;
    }
    case 'owner-ok': { try { localStorage.setItem('mr-owner', $('#owner-in').value.trim()); } catch {} closeModal(); return checkLLM().then(render); }
    case 'quit': openModal(`<h2>Abandon this operation?</h2><p>The current game will be lost.</p><button class="btn red" data-act="quit-ok">Abandon</button> <button class="btn" data-act="close-modal">Keep playing</button>`); return;
    case 'quit-ok': clearSave(); app = null; closeModal(); return render();
    case 'surrender': openModal(`<h2>Raise the white flag?</h2><p>${SIDE_LABEL[other(side)]} wins immediately.</p><button class="btn red" data-act="surrender-ok">Surrender</button> <button class="btn" data-act="close-modal">Fight on</button>`); return;
    case 'surrender-ok': surrender(g, side); closeModal(); app.screen = 'debrief'; save(); return render();
    case 'close-modal': return closeModal();
    case 'take': app.screen = g.phase === 'setup' ? 'setup' : 'play'; app.fresh = true; save(); return render();
    case 'shuffle': app.setup[side] = heuristicPlacement({ own: Object.values(g.agents).filter((a) => a.side === side), cities: g.cities }, Math.floor(Math.random() * 1e6)); save(); return render();
    case 'place': return confirmPlacement();
    case 'traffic': app.traffic = !app.traffic; return render();
    case 'tab': app.tab = el.dataset.tab; app.traffic = true; return render();
    case 'stance': setStance(g, side, app.sel.agent, el.dataset.stance); save(); return render();
    case 'why': { const a = g.agents[el.dataset.agent]; app.whyFor = a.id; app.sel = { city: a.city, agent: null }; app.pick = null; return render(); }
    case 'pick-agent': { const a = g.agents[el.dataset.agent]; app.sel = { city: a.city, agent: app.sel.agent === a.id ? null : a.id }; app.pick = null; if (app.nav) { app.nav.orders = 0; app.nav.roles = 0; } return render(); }
    case 'select': { const a = g.agents[el.dataset.agent]; if (!a.alive) return; app.sel = { city: a.city, agent: a.id }; app.pick = null; return render(); }
    case 'setrole': { const r = el.dataset.role; if (r === 'unknown') delete app.notes[side].roles[el.dataset.agent]; else app.notes[side].roles[el.dataset.agent] = r; save(); return render(); }
    case 'city': {
      const c = el.dataset.city;
      if (app.screen === 'setup') return placeSel(c);
      if (app.pick?.type === 'move') { if (c !== g.agents[app.pick.agentId].city) queue({ agentId: app.pick.agentId, type: 'move', city: c }); return; }
      app.sel = { city: app.sel.city === c ? null : c, agent: null }; app.pick = null; return render();
    }
    case 'close-city': app.sel.city = null; app.sel.agent = null; app.pick = null; return render();
    case 'close-agent': app.sel.agent = null; app.pick = null; return render();
    case 'agent': {
      const a = g.agents[el.dataset.agent];
      if (app.screen === 'setup') return;
      if (a.side === side || (a.turnedBy === side)) { app.sel.agent = app.sel.agent === a.id ? null : a.id; app.sel.city = a.city; app.pick = null; }
      else { app.sel.city = a.city; }
      return render();
    }
    case 'token': {
      const a = g.agents[el.dataset.agent];
      if (app.screen === 'setup') { delete app.setup[side][a.id]; save(); return render(); }
      if (app.pick?.targets?.includes(a.id)) return queue({ agentId: app.pick.agentId, type: app.pick.type, targetId: a.id });
      app.sel = { city: a.city, agent: app.sel.agent === a.id ? null : a.id };
      app.pick = null; return render();
    }
    case 'target': return queue({ agentId: app.pick.agentId, type: app.pick.type, targetId: el.dataset.agent });
    case 'order': {
      const type = el.dataset.type, a = g.agents[app.sel.agent];
      const l = legalOrders(g, side, a.id).find((x) => x.type === type);
      if (app.nav) { app.nav.targets = 0; app.nav.city = a.city; }
      if (type === 'move') { app.pick = { type, agentId: a.id }; return render(); }
      if (l.targets) { app.pick = { type, agentId: a.id, targets: l.targets }; app.sel.city = a.city; return render(); }
      if (type === 'feed' || type === 'lie') { app.pick = { type, agentId: a.id }; return render(); }
      if (type === 'trap') return queue({ agentId: a.id, type, when: el.dataset.when || 'next' });
      return queue({ agentId: a.id, type });
    }
    case 'feed-ok': return queue({ agentId: app.pick.agentId, type: 'feed', fake: JSON.parse($('#feed-fake').value) });
    case 'lie-ok': {
      const kind = el.dataset.kind;
      return queue({ agentId: app.pick.agentId, type: 'lie', lie: kind === 'frame' ? { kind, targetId: $('#lie-target').value } : { kind } });
    }
    case 'unqueue-id': app.queued[side] = app.queued[side].filter((o) => o.agentId !== el.dataset.agent); save(); return render();
    case 'unqueue': app.queued[side] = app.queued[side].filter((o) => o.agentId !== app.sel.agent); save(); return render();
    case 'execute': app.pick = { type: 'execute', agentId: app.sel.agent }; return render();
    case 'execute-ok': {
      const id = app.pick.agentId;
      app.queued[side] = app.queued[side].filter((o) => o.agentId !== id);
      executeAgent(g, side, id); app.pick = null; app.sel.agent = null;
      if (g.phase === 'over') app.screen = 'debrief';
      save(); return render();
    }
    case 'cancel-pick': app.pick = null; return render();
    case 'trust': { ev.stopPropagation(); const t = app.notes[side].trust; if (el.dataset.trust === 'trusted') delete t[el.dataset.agent]; else t[el.dataset.agent] = el.dataset.trust; save(); return render(); }
    case 'guess': {
      ev.stopPropagation();
      const id = el.dataset.agent;
      openModal(`<h2>What is ${esc(g.agents[id].name)}?</h2><div class="guess-grid">${['unknown', ...ARCHETYPE_KEYS].map((k) => `<button class="guess-opt" data-act="guess-ok" data-agent="${id}" data-role="${k}">${ROLE_ICON[k]}<b>${k === 'unknown' ? 'No idea yet' : roleLabel(k)}</b></button>`).join('')}</div>`);
      return;
    }
    case 'guess-ok': { const r = el.dataset.role; if (r === 'unknown') delete app.notes[side].roles[el.dataset.agent]; else app.notes[side].roles[el.dataset.agent] = r; closeModal(); save(); return render(); }
    case 'accept': ev.stopPropagation(); app.notes[side].roles[el.dataset.agent] = el.dataset.role; save(); return render();
    case 'goto': if (el.dataset.city) { app.sel.city = el.dataset.city; app.sel.agent = null; render(); } return;
    case 'end': return endWeek();
    case 'again': clearSave(); app = null; return render();
    case 'reanalyze': if (!analyzing) { app.story = null; checkLLM().then(render); } return;

  }
}

document.addEventListener('pointerdown', () => { if (app?.nav?.on) { app.nav.on = false; document.querySelectorAll('.kfocus').forEach((x) => x.classList.remove('kfocus')); } }, true);
function orderRoomFor(id) {
  const q = app.queued[app.active];
  if (q.length >= RULES.ordersPerWeek && !q.some((o) => o.agentId === id)) { render(); toast(`All ${RULES.ordersPerWeek} orders are used. Cancel one in the order bar first.`); return false; }
  return true;
}
document.addEventListener('click', (ev) => {
  if (justDragged) return;
  // Clicking anywhere outside the "why" bubble closes it (what was typed is already kept).
  if (app?.whyFor && !ev.target.closest('.why-ask, [data-act="why"]')) {
    app.whyFor = null;
    if (!ev.target.closest('[data-act], .token, .city, .cell')) return render();
  }
  const el = ev.target.closest('[data-act]');
  if (el && !el.disabled) { onAct(el, ev); return; }
  const tok = ev.target.closest('.token');
  if (tok) { onAct({ dataset: { act: 'token', agent: tok.dataset.agent } }, ev); return; }
  const city = ev.target.closest('.city, .cell');
  if (city && app) onAct({ dataset: { act: 'city', city: city.dataset.city } }, ev);
});
// ----- arrow-key navigation -----
// A highlight moves through whatever is on screen: cities on the map, then the people in a city,
// then an agent's orders, then targets. Enter chooses, Escape steps back. The level follows the UI
// state, so mouse and keyboard can be mixed freely.
function navLevel() {
  if (app.screen !== 'play' || !$('#modal').hidden) return null;
  if (app.pick?.type === 'move') return 'map';
  if (app.pick?.targets) return 'targets';
  if ($('#pop .obs')) return 'orders';
  if ($('#pop .role-picks')) return 'roles';
  if (app.sel.city) return 'list';
  return 'map';
}
const NAV_SEL = { list: '.cp-row', orders: '#pop .ob:not(:disabled)', targets: '#pop .tg', roles: '#pop .rp' };
function applyNavFocus() {
  document.querySelectorAll('.kfocus').forEach((x) => x.classList.remove('kfocus'));
  if (!app?.nav?.on) return;
  const lvl = navLevel();
  if (lvl === 'map') { if (app.nav.city) document.querySelector(`.city[data-city="${app.nav.city}"]`)?.classList.add('kfocus'); return; }
  const items = [...document.querySelectorAll(NAV_SEL[lvl] || '')];
  if (!items.length) return;
  const i = Math.min(app.nav[lvl] || 0, items.length - 1);
  app.nav[lvl] = i;
  items[i].classList.add('kfocus');
  items[i].scrollIntoView?.({ block: 'nearest' });
}
// The nearest city in the direction of the arrow.
function cityInDirection(from, key) {
  const [x0, y0] = cityXY(from);
  const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  let best = null, bs = Infinity;
  for (const c of app.game.cities) {
    if (c === from) continue;
    const [x, y] = cityXY(c), dx = x - x0, dy = y - y0;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 0) continue;
    const across = Math.abs(dx * dir[1] - dy * dir[0]);
    const score = along + across * 2;
    if (score < bs) { bs = score; best = c; }
  }
  return best;
}
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (!$('#modal').hidden) return closeModal();
    if (app?.pick) { app.pick = null; return render(); }
    if (app?.sel?.agent) { app.sel.agent = null; return render(); }
    if (app?.sel?.city) { app.nav = { ...(app.nav || {}), on: true, city: app.sel.city }; app.sel.city = null; return render(); }
    return;
  }
  if (!app || ev.metaKey || ev.ctrlKey || ev.altKey || ev.target.matches?.('input, select, textarea')) return;
  const lvl = navLevel();
  if (!lvl) return;
  const k = ev.key;
  const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (!arrows.includes(k) && k !== 'Enter') return;
  ev.preventDefault();
  const nav = (app.nav ||= {});
  if (!nav.on) { // first key press just shows the highlight
    nav.on = true;
    nav.city ||= app.sel.city || Object.values(app.game.agents).find((a) => a.alive && a.side === app.active)?.city || app.game.cities[0];
    return applyNavFocus();
  }
  if (lvl === 'map') {
    if (k === 'Enter') { if (nav.city) { nav.list = 0; onAct({ dataset: { act: 'city', city: nav.city } }, ev); } return; }
    const next = cityInDirection(nav.city || app.game.cities[0], k);
    if (next) nav.city = next;
    return applyNavFocus();
  }
  const items = [...document.querySelectorAll(NAV_SEL[lvl])];
  if (!items.length) return;
  const i = nav[lvl] || 0;
  if (k === 'Enter') { items[i]?.click(); return; }
  if (lvl === 'list' && k === 'ArrowLeft') { nav.city = app.sel.city; app.sel = { city: null, agent: null }; return render(); }
  if (lvl === 'list' && k === 'ArrowRight') { items[i]?.click(); return; }
  const cols = lvl === 'orders' ? 4 : lvl === 'list' ? 1 : items.length;
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[k];
  nav[lvl] = Math.max(0, Math.min(items.length - 1, i + step));
  applyNavFocus();
});
// Click-to-place: put the selected agent in a city, then select the next one still unplaced.
function placeSel(c) {
  const g = app.game, side = app.active, draft = app.setup[side], id = app.setupSel;
  if (!id) return;
  const n = Object.entries(draft).filter(([k, v]) => v === c && k !== id).length;
  if (n >= RULES.maxPerCityAtSetup) { toast(`${c} already has ${RULES.maxPerCityAtSetup} agents.`); return; }
  draft[id] = c;
  const own = Object.values(g.agents).filter((a) => a.side === side);
  app.setupSel = own.find((a) => !draft[a.id])?.id || null;
  save(); render();
}
// Notebook notes save as you type, without re-rendering (so focus stays in the field).
// The optional one-line reason for an order, typed into the bubble above its slot.
document.addEventListener('input', (ev) => {
  if (ev.target.id !== 'why-in' || !app) return;
  const o = app.queued[app.active].find((x) => x.agentId === app.whyFor);
  if (o) { const w = ev.target.value.replace(/\s+/g, ' ').slice(0, WHY_MAX); if (w.trim()) o.why = w; else delete o.why; save(); }
});
document.addEventListener('keydown', (ev) => {
  if (ev.target.id !== 'why-in' || !['Enter', 'Escape'].includes(ev.key)) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  app.whyFor = null; render();
}, true);
window.addEventListener('resize', () => { if (app?.screen === 'play') { placeCityPanel(); placePop(); } });
// Debrief: a pin on the chart and its moment card light up together.
document.addEventListener('pointerover', (ev) => {
  const p = ev.target.closest?.('[data-pin]');
  document.querySelectorAll('.lit').forEach((x) => x.classList.remove('lit'));
  if (p) document.querySelectorAll(`[data-pin="${p.dataset.pin}"]`).forEach((x) => x.classList.add('lit'));
});
// Territory highlight follows the hovered city.
document.addEventListener('pointerover', (ev) => {
  const c = ev.target.closest?.('.city, .cell, .msg');
  document.querySelectorAll('.cell.hot').forEach((x) => x.classList.remove('hot'));
  const name = c?.dataset.city;
  if (name) document.querySelector(`.cell[data-city="${name}"]`)?.classList.add('hot');
});

// ----- setup: click a card then a city, or drag a card onto a city -----
let drag = null;
let justDragged = false;
document.addEventListener('pointerdown', (ev) => {
  if (app?.screen === 'play') {
    // Drag one of our tokens: onto a city to move, onto an enemy token for the obvious action.
    const tok = ev.target.closest('.token');
    const a = tok && app.game.agents[tok.dataset.agent];
    if (a && a.side === app.active && ev.button === 0) drag = { id: a.id, x: ev.clientX, y: ev.clientY, ghost: null, play: true };
    return;
  }
  const card = ev.target.closest('[data-drag]');
  if (!card || app?.screen !== 'setup') return;
  ev.preventDefault();
  drag = { id: card.dataset.drag, x: ev.clientX, y: ev.clientY, ghost: null };
});
function moveGhost(ev) { if (drag?.ghost) { drag.ghost.style.left = `${ev.clientX}px`; drag.ghost.style.top = `${ev.clientY}px`; } }
document.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (!drag.ghost && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 6) {
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'drag-ghost';
    drag.ghost.innerHTML = portrait(app.game.agents[drag.id], { size: 56 });
    document.body.appendChild(drag.ghost);
  }
  if (!drag.ghost) return;
  moveGhost(ev);
  document.querySelectorAll('.city.drop, .token.drop').forEach((x) => x.classList.remove('drop'));
  const enemy = drag.play && enemyUnder(ev);
  if (enemy) document.querySelector(`.token[data-agent="${enemy}"]`)?.classList.add('drop');
  else { const c = nearestCity(ev); if (c) document.querySelector(`.city[data-city="${c}"]`)?.classList.add('drop'); }
});
function enemyUnder(ev) {
  const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.token');
  const a = t && app.game.agents[t.dataset.agent];
  return a && a.side !== app.active ? a.id : null;
}
// What dragging an agent onto an enemy means: strike if possible, else approach, else prepare.
function dragAction(agentId, targetId) {
  const legal = legalOrders(app.game, app.active, agentId);
  for (const type of ['strike', 'approach', 'prepare']) {
    const l = legal.find((x) => x.type === type);
    if (l?.targets?.includes(targetId)) return type;
  }
  return null;
}
document.addEventListener('pointerup', (ev) => {
  if (!drag) return;
  if (drag.play) {
    const { id, ghost } = drag; drag = null;
    if (!ghost) return; // a plain click: the click handler deals with it
    ghost.remove(); justDragged = true; setTimeout(() => { justDragged = false; }, 0);
    const g = app.game, a = g.agents[id];
    const enemy = enemyUnder(ev);
    if (enemy) {
      const type = dragAction(id, enemy);
      if (!type) { render(); toast(`${a.name} can't act against ${g.agents[enemy].name} from here.`); return; }
      if (orderRoomFor(id)) { queue({ agentId: id, type, targetId: enemy }); toast(`${a.name}: ${describeOrder({ type, targetId: enemy }, g)}. ✕ in the order bar to undo.`); }
      return;
    }
    const c = nearestCity(ev);
    if (c && c !== a.city && orderRoomFor(id)) { queue({ agentId: id, type: 'move', city: c }); toast(`${a.name} will go to ${c}. ✕ in the order bar to undo.`); return; }
    render(); return;
  }
  const { id, ghost } = drag; drag = null;
  if (!ghost) { app.setupSel = app.setupSel === id ? null : id; render(); return; } // a click: select
  ghost.remove();
  const c = nearestCity(ev);
  if (c) { app.setupSel = id; placeSel(c); return; }
  render();
});
function nearestCity(ev) {
  const svg = $('.map'); if (!svg) return null;
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  let best = null, bd = 70;
  for (const c of app.game.cities) { const [x, y] = cityXY(c); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = c; } }
  return best;
}

// ---------- modal ----------
function openModal(html) { $('#modal-card').innerHTML = `<button class="icon-btn modal-x" data-act="close-modal">${UI_ICON.close}</button>${html}`; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

// ---------- boot ----------
window.MR = { get app() { return app; }, startNew, endWeek, render, confirmPlacement };
checkLLM().finally(() => {
  const saved = load();
  if (saved?.game?.version === 2 && saved.screen === 'debrief') app = saved;
  render();
});
