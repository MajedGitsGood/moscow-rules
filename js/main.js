// App shell for v2: screens, the war-room map, HUD panels, turn flow, hot-seat, persistence.
// The engine owns the rules; this file owns who is at the desk and what they may see.
import {
  newGame, placeAgents, validatePlacement, submitOrders, validateOrders, resolveWeek, viewFor, revealAll,
  addJournal, legalOrders, executeAgent, surrender, describeOrder,
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

const SAVE = 'mr-save-v2';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roleLabel = (k) => ARCHETYPES[k]?.label || 'Unknown';
const ORDER_LABEL = { move: 'Move', surveil: 'Surveil', lielow: 'Lie low', prepare: 'Prepare strike', strike: 'Strike', trap: 'Set trap', approach: 'Approach', vet: 'Vet', brief: 'Brief', lie: 'Choose lie' };
const ORDER_HINT = {
  move: 'Any city, arriving tomorrow. Everyone sees the move.',
  surveil: 'Report on this city. Lamplighters learn every role.',
  lielow: "Disappear for a week. Can't be found or reported on.",
  prepare: 'Study a target. Loud: their people may notice.',
  strike: 'Kill the target. Fails, fatally, if they have a trap here.',
  trap: 'Ready for anyone who strikes here. Loud.',
  approach: 'One of three pitches needed to turn them. Loud.',
  vet: 'Find out if one of ours here is working for them.',
  brief: 'Tell this agent a plan. Only matters if they are a mole.',
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
  save(); render();
}

async function confirmPlacement() {
  const side = app.active, g = app.game;
  placeAgents(g, side, app.setup[side]);
  const opp = other(side);
  if (!g.placed[opp]) {
    if (isHuman(opp)) { app.active = opp; app.setup[opp] = {}; app.screen = 'handoff'; save(); render(); return; }
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
  if (app.screen === 'play') tintCells(root, viewFor(app.game, app.active));
  if (app.screen === 'setup') tintCells(root, setupView());
}
function busy(text) { app.screen = 'busy'; app.busyText = text; render(); }

function base(g) {
  const key = g.cities.join();
  if (key !== baseKey) { baseKey = key; baseSvg = mapBase(g.cities); }
  return baseSvg;
}

// The role to show on a token: known for our own agents and sources; the player's guess for theirs.
function roleOf(side) {
  return (a) => {
    if (a.side === side || a.asset) return a.archetype;
    return app.notes[side].roles[a.id] || null;
  };
}

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
      <g id="overlay">${mapOverlay({ view: v, selected: app.sel.city, orders: setup ? [] : app.queued[side], moveTargets, roleOf: roleOf(side) })}</g>
    </svg>
    ${hudTop(v, setup)}
    ${setup ? setupTray(v) : ''}
    ${!setup && app.sel.city && app.pick?.type !== 'move' ? cityPanel(v) : ''}
    ${!setup && app.traffic ? trafficPanel(v) : ''}
    ${!setup && app.sel.agent && app.pick?.type !== 'move' ? actionDock(v) : ''}
    ${!setup ? endTurn(v) : ''}
    ${app.pick ? `<div class="pick-hint">${pickHint()}<button class="btn small ghost" data-act="cancel-pick">Cancel</button></div>` : ''}
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
      ${setup ? '' : `<div class="tally" title="Agents eliminated"><span class="us">${UI_ICON.skull}${v.score.us}</span><span class="them">${UI_ICON.skull}${v.score.them}</span></div>`}</div>
    <div class="plate week">${setup ? '<b>PLACE YOUR NETWORKS</b><small>Drag agents onto cities · three per city at most</small>' : `<b>WEEK ${Math.min(g.week, RULES.weeks)} <span>/ ${RULES.weeks}</span></b><div class="pips" title="Orders this week">${pips}<small>${RULES.ordersPerWeek - used} orders left</small></div>`}</div>
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
    <div class="tray-cards">${v.own.map((a) => `<div class="agent-card drag ${draft[a.id] ? 'placed' : ''}" data-drag="${a.id}">
        ${portrait(a, { size: 54 })}<div><b>${esc(a.name)}</b><small>${esc(a.cover)}</small><span class="role">${ROLE_ICON[a.archetype]}${roleLabel(a.archetype)}</span>${draft[a.id] ? `<em>${draft[a.id]}</em>` : ''}</div></div>`).join('')}</div>
    <div class="tray-actions">
      <button class="btn" data-act="shuffle">${UI_ICON.shuffle} Shuffle</button>
      <button class="btn gold" data-act="place" ${errs.length ? 'disabled' : ''}>${unplaced.length ? `${unplaced.length} to place` : 'Deploy'}</button>
    </div>
  </div>`;
}

// ----- city panel -----
function chip(text, cls = '') { return `<span class="chip ${cls}">${text}</span>`; }
function agentCard(v, a) {
  const side = v.side, mine = a.side === side;
  const q = app.queued[side].find((o) => o.agentId === a.id);
  const intel = v.intel[a.id];
  const chips = [];
  if (q) chips.push(chip(`${ORDER_ICON[q.type]}${esc(describeOrder(q, app.game))}`, 'queued'));
  if (mine && a.prep) chips.push(chip(`${ORDER_ICON.prepare}Prepared on ${esc(app.game.agents[a.prep.targetId].name)}`));
  if (!mine && v.approachProgress[a.id]) chips.push(chip(`${ORDER_ICON.approach}Pitched ${v.approachProgress[a.id]}/${RULES.approachesToTurn}`, 'good'));
  if (a.asset) chips.push(chip('Our source', 'good'));
  if (intel?.suspicions?.length) chips.push(chip(`${intel.suspicions.length} suspicion${intel.suspicions.length > 1 ? 's' : ''}`, 'warn'));
  let roleBit;
  if (mine || a.asset) roleBit = `<span class="role">${ROLE_ICON[a.archetype]}${roleLabel(a.archetype)}</span>`;
  else {
    const guess = app.notes[side].roles[a.id];
    const last = intel?.roles?.at(-1);
    roleBit = `<button class="role guess ${guess ? 'set' : ''}" data-act="guess" data-agent="${a.id}">${ROLE_ICON[guess || 'unknown']}${guess ? roleLabel(guess) : 'Role?'}</button>`;
    if (last && last.archetype !== guess) roleBit += `<button class="claim" data-act="accept" data-agent="${a.id}" data-role="${last.archetype}" title="Accept this report">${ROLE_ICON[last.archetype]}${esc(last.source)} says ${roleLabel(last.archetype)}</button>`;
  }
  const trust = mine ? app.notes[side].trust[a.id] || 'trusted' : null;
  const targetable = app.pick?.targets?.includes(a.id);
  return `<div class="agent-card ${mine ? 'mine' : 'theirs'} ${app.sel.agent === a.id ? 'sel' : ''} ${targetable ? 'targetable' : ''} ${trust === 'suspect' ? 'suspect' : ''}" data-act="${targetable ? 'target' : 'agent'}" data-agent="${a.id}">
    ${portrait(a, { size: 52 })}
    <div class="ac-body"><div class="ac-name"><b>${esc(a.first)} ${esc(a.name)}</b>${mine ? `<button class="trust ${trust}" data-act="trust" data-agent="${a.id}" title="Your loyalty mark">${trust === 'suspect' ? 'Suspect' : 'Trusted'}</button>` : ''}</div>
      <small>${esc(a.cover)}</small>${roleBit}<div class="chips">${chips.join('')}</div></div>
  </div>`;
}
function cityPanel(v) {
  const c = app.sel.city;
  const ours = v.own.filter((a) => a.alive && a.city === c), theirs = v.enemies.filter((a) => a.alive && a.city === c);
  const trap = v.traps.find((t) => t.city === c);
  return `<aside class="panel city-panel">
    <div class="cp-head"><div class="cp-landmark">${LANDMARK_ICON[LANDMARK[c]]}</div><div><h2>${c}</h2><small>${HOME[c] ? (HOME[c] === 'control' ? 'Home of the Circus' : 'Home of Moscow Centre') : 'Open city'}${trap ? ` · our trap ${trap.active ? 'is ready' : 'ready next week'}` : ''}</small></div>
      <button class="icon-btn" data-act="close-city">${UI_ICON.close}</button></div>
    <div class="cp-cols">
      <section><h3 class="ours">Ours · ${ours.length}</h3>${ours.map((a) => agentCard(v, a)).join('') || '<p class="empty">No one here.</p>'}</section>
      <section><h3 class="theirs">Theirs · ${theirs.length}</h3>${theirs.map((a) => agentCard(v, a)).join('') || '<p class="empty">No one here.</p>'}</section>
    </div>
  </aside>`;
}

// ----- action dock -----
function actionDock(v) {
  const g = app.game, side = v.side, a = g.agents[app.sel.agent];
  if (!a || !a.alive) return '';
  const mine = a.side === side;
  const legal = legalOrders(g, side, a.id);
  const q = app.queued[side].find((o) => o.agentId === a.id);
  const full = app.queued[side].length >= RULES.ordersPerWeek && !q;
  const buttons = legal.map((l) => `<button class="order ${q?.type === l.type ? 'on' : ''}" data-act="order" data-type="${l.type}" ${full ? 'disabled' : ''}>${ORDER_ICON[l.type]}<b>${ORDER_LABEL[l.type]}</b><small>${ORDER_HINT[l.type]}</small></button>`).join('');
  let sub = '';
  if (app.pick?.type === 'brief' && app.pick.agentId === a.id) {
    sub = `<div class="sub">Brief ${esc(a.name)}: our <select id="brief-kind"><option value="strike">strike</option><option value="trap">trap</option></select> in <select id="brief-city">${g.cities.map((c) => `<option>${c}</option>`).join('')}</select> <button class="btn small gold" data-act="brief-ok">Brief</button></div>`;
  }
  if (app.pick?.type === 'lie' && app.pick.agentId === a.id) {
    const colleagues = v.enemies.filter((x) => x.alive && !x.asset && x.id !== a.id);
    sub = `<div class="sub lies">
      <button class="btn small" data-act="lie-ok" data-kind="hide">All quiet<small>Report nothing</small></button>
      <button class="btn small" data-act="lie-ok" data-kind="alarm">False alarm<small>"Someone's preparing a strike"</small></button>
      <span class="frame">Frame <select id="lie-target">${colleagues.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><button class="btn small" data-act="lie-ok" data-kind="frame" ${colleagues.length ? '' : 'disabled'}>Frame</button></span></div>`;
  }
  if (app.pick?.type === 'execute' && app.pick.agentId === a.id) {
    sub = `<div class="sub danger">Execute ${esc(a.first)} ${esc(a.name)}? ${SIDE_LABEL[other(side)]} gets the point either way. You learn whether they were a mole only at the debrief. <button class="btn small red" data-act="execute-ok">Execute</button></div>`;
  }
  return `<div class="dock ${mine ? '' : 'asset'}">
    <div class="dock-who">${portrait(a, { size: 72 })}<div><b>${esc(a.first)} ${esc(a.name)}</b><span class="role">${ROLE_ICON[a.archetype]}${mine ? roleLabel(a.archetype) : `Their ${roleLabel(a.archetype)}, our source`}</span><small>${esc(a.cover)} · ${a.city}</small>
      ${q ? `<button class="link" data-act="unqueue">Cancel order</button>` : ''}
      ${mine ? `<button class="link danger" data-act="execute">${ORDER_ICON.execute}Execute</button>` : ''}</div>
      <button class="icon-btn close" data-act="close-agent">${UI_ICON.close}</button></div>
    <div class="dock-orders">${buttons}</div>${sub}
  </div>`;
}
function pickHint() {
  const p = app.pick, a = app.game.agents[p.agentId];
  if (p.type === 'move') return `Choose where ${a.name} goes`;
  if (p.targets) return `Choose who ${a.name} will ${ORDER_LABEL[p.type].toLowerCase()}`;
  return '';
}

// ----- traffic -----
const KIND = { event: 'Event', report: 'Report', source: 'Source', briefing: 'Briefing' };
function trafficPanel(v) {
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
  return `<aside class="panel traffic">
    <div class="tp-head"><h2>Morning traffic</h2><small>Week ${v.week}</small></div>
    <div class="tp-body">
      ${group('What happened', now.filter((m) => m.kind === 'event' || m.kind === 'briefing'), 'h-event')}
      ${group('From our sources inside', now.filter((m) => m.kind === 'source'), 'h-source')}
      ${group('Reports from our people', now.filter((m) => m.kind === 'report'), 'h-report')}
      ${now.length ? '' : '<p class="empty">A quiet night. Nothing came in.</p>'}
      ${earlier.length ? `<details><summary>Earlier traffic</summary>${earlier.map(msg).join('')}</details>` : ''}
    </div></aside>`;
}

function endTurn() {
  const n = app.queued[app.active].length;
  return `<button class="end-turn" data-act="end">${n ? `Send ${n} order${n > 1 ? 's' : ''}` : 'End week'}<small>${n ? 'and wait for the night' : 'no orders this week'}</small></button>`;
}

// ----- debrief -----
function debriefScreen() {
  const r = revealAll(app.game), o = r.outcome;
  const fate = (a) => a.alive ? (a.turnedBy ? `Alive, working for ${SIDE_LABEL[a.turnedBy]}` : 'Alive') : `${a.eliminated.how} in ${a.eliminated.city}, week ${a.eliminated.week}`;
  const roster = (side) => r.agents.filter((a) => a.side === side).map((a) => `<div class="db-agent ${a.alive ? '' : 'dead'} ${a.turnedBy ? 'turned' : ''}">
      ${portrait(a, { size: 56, mood: a.alive ? null : 'dead' })}<div><b>${esc(a.first)} ${esc(a.name)}</b><span class="role">${ROLE_ICON[a.archetype]}${roleLabel(a.archetype)}</span><small>${esc(fate(a))}${a.turnedBy ? (a.sleeper ? ' · a sleeper from the start' : ' · turned') : ''}</small></div></div>`).join('');
  const journal = (side) => r.journal[side].length ? `<section class="journal"><h3>${SIDE_LABEL[side]}'s private journal</h3>${r.journal[side].map((j) => `<p><b>Week ${j.week}.</b> ${esc(j.text)}</p>`).join('')}</section>` : '';
  return `<div class="debrief"><div class="db-sheet">
    <div class="stamp">CASE CLOSED</div>
    <h1>${o.winner ? `${SIDE_LABEL[o.winner]} wins` : 'Stalemate'}</h1><p class="db-reason">${esc(o.reason)}.</p>
    <div class="db-score">${SIDES.map((s) => `<div class="${s}"><span>${o.score[s].total}</span><b>${SIDE_LABEL[s]}</b><small>${o.score[s].dead} killed · ${o.score[s].turned} turned</small></div>`).join('<i>vs</i>')}</div>
    <div class="db-cols">${SIDES.map((s) => `<section><h3 class="${s}">${SIDE_LABEL[s]}'s people</h3>${roster(s)}</section>`).join('')}</div>
    ${journal('karla')}${journal('control')}
    <button class="btn gold" data-act="again">Another operation</button>
  </div></div>`;
}

// ---------- interaction ----------
function queue(order) {
  const side = app.active;
  app.queued[side] = app.queued[side].filter((o) => o.agentId !== order.agentId);
  app.queued[side].push(order);
  app.pick = null;
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
    case 'city': {
      const c = el.dataset.city;
      if (app.screen === 'setup') return;
      if (app.pick?.type === 'move') { if (c !== g.agents[app.pick.agentId].city) queue({ agentId: app.pick.agentId, type: 'move', city: c }); return; }
      app.sel.city = app.sel.city === c ? null : c; app.sel.agent = null; app.pick = null; return render();
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
      app.sel.city = a.city;
      app.sel.agent = (a.side === side || a.turnedBy === side) ? a.id : null;
      app.pick = null; return render();
    }
    case 'target': return queue({ agentId: app.pick.agentId, type: app.pick.type, targetId: el.dataset.agent });
    case 'order': {
      const type = el.dataset.type, a = g.agents[app.sel.agent];
      const l = legalOrders(g, side, a.id).find((x) => x.type === type);
      if (type === 'move') { app.pick = { type, agentId: a.id }; return render(); }
      if (l.targets) { app.pick = { type, agentId: a.id, targets: l.targets }; app.sel.city = a.city; return render(); }
      if (type === 'brief' || type === 'lie') { app.pick = { type, agentId: a.id }; return render(); }
      return queue({ agentId: a.id, type });
    }
    case 'brief-ok': return queue({ agentId: app.pick.agentId, type: 'brief', plan: { kind: $('#brief-kind').value, city: $('#brief-city').value } });
    case 'lie-ok': {
      const kind = el.dataset.kind;
      return queue({ agentId: app.pick.agentId, type: 'lie', lie: kind === 'frame' ? { kind, targetId: $('#lie-target').value } : { kind } });
    }
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
    case 'trust': { ev.stopPropagation(); const t = app.notes[side].trust; t[el.dataset.agent] = t[el.dataset.agent] === 'suspect' ? 'trusted' : 'suspect'; save(); return render(); }
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
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (el && !el.disabled) { onAct(el, ev); return; }
  const tok = ev.target.closest('.token');
  if (tok) { onAct({ dataset: { act: 'token', agent: tok.dataset.agent } }, ev); return; }
  const city = ev.target.closest('.city, .cell');
  if (city && app) onAct({ dataset: { act: 'city', city: city.dataset.city } }, ev);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (app?.pick) { app.pick = null; render(); } }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('.city')) { ev.preventDefault(); onAct({ dataset: { act: 'city', city: ev.target.dataset.city } }, ev); }
});
// Territory highlight follows the hovered city.
document.addEventListener('pointerover', (ev) => {
  const c = ev.target.closest?.('.city, .cell, .msg');
  document.querySelectorAll('.cell.hot').forEach((x) => x.classList.remove('hot'));
  const name = c?.dataset.city;
  if (name) document.querySelector(`.cell[data-city="${name}"]`)?.classList.add('hot');
});

// ----- drag and drop for setup -----
let drag = null;
document.addEventListener('pointerdown', (ev) => {
  const card = ev.target.closest('[data-drag]');
  if (!card || app?.screen !== 'setup') return;
  ev.preventDefault();
  const a = app.game.agents[card.dataset.drag];
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.innerHTML = portrait(a, { size: 56 });
  document.body.appendChild(ghost);
  drag = { id: a.id, ghost };
  moveGhost(ev);
  document.querySelector('.stage')?.classList.add('dragging');
});
function moveGhost(ev) { if (drag) { drag.ghost.style.left = `${ev.clientX}px`; drag.ghost.style.top = `${ev.clientY}px`; } }
document.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  moveGhost(ev);
  const c = nearestCity(ev);
  document.querySelectorAll('.city.drop').forEach((x) => x.classList.remove('drop'));
  if (c) document.querySelector(`.city[data-city="${c}"]`)?.classList.add('drop');
});
document.addEventListener('pointerup', (ev) => {
  if (!drag) return;
  const c = nearestCity(ev);
  drag.ghost.remove();
  const id = drag.id; drag = null;
  if (c) {
    const draft = app.setup[app.active];
    const n = Object.entries(draft).filter(([k, v]) => v === c && k !== id).length;
    if (n >= RULES.maxPerCityAtSetup) { render(); toast(`${c} already has ${RULES.maxPerCityAtSetup} agents.`); return; }
    draft[id] = c; save();
  }
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
