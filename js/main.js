// App shell: screens, turn flow, hot-seat handoffs, persistence. The engine owns the rules;
// this file owns who is at the desk and what they're allowed to see.
import { newGame, placeAgents, validatePlacement, submitOrders, validateOrders, resolveWeek, viewFor, revealAll, addJournal } from './engine.js';
import { SIDES, other, SIDE_LABEL, ARCHETYPES, ARCHETYPE_KEYS, CITY_DATA, RULES } from './world.js';
import { randomSeed } from './rng.js';
import { interpretCable, voiceMorning } from './cables.js';
import { describeOrder } from './interpret.js';
import { claudeOrders, claudePlacement } from './controllers/claude.js';
import { heuristicOrders, heuristicPlacement } from './controllers/heuristic.js';
import { checkLLM, llmStatus } from './llm.js';
import { manualHTML } from './ui/manual.js';

const SAVE = 'mr-save-v1';
const MAX_CABLE = 500;
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arch = (k) => ARCHETYPES[k].label;

let app = null; // { game, mode, screen, active, drafts, notes, busy, errors }

// ---------- persistence ----------
function save() { try { localStorage.setItem(SAVE, JSON.stringify(app)); } catch {} }
function load() { try { return JSON.parse(localStorage.getItem(SAVE)); } catch { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE); } catch {} }

const humanSides = () => (app.mode === 'hotseat' ? SIDES : ['control']);
const isHuman = (side) => humanSides().includes(side);

function emptyNotes() { return { control: { enemy: {}, own: {} }, karla: { enemy: {}, own: {} } }; }

// ---------- flow ----------
function startNew(mode) {
  const seed = randomSeed();
  app = { game: newGame(seed), mode, screen: 'placement', active: 'control', drafts: { control: [], karla: [] }, notes: emptyNotes(), errors: [] };
  save(); render();
}

async function finishPlacement(side, placement) {
  placeAgents(app.game, side, placement);
  const opp = other(side);
  if (!app.game.placed[opp]) {
    if (isHuman(opp)) { app.active = opp; app.screen = 'handoff'; }
    else {
      app.screen = 'busy'; app.busyText = 'Moscow Centre is placing its networks'; render();
      const view = viewFor(app.game, opp);
      const r = app.mode === 'claude' ? await claudePlacement(app.game, opp, view) : { placement: heuristicPlacement(view, app.game.seed) };
      placeAgents(app.game, opp, r.placement);
      if (r.journal) addJournal(app.game, opp, r.journal);
    }
  }
  if (app.game.phase === 'orders') {
    app.active = 'control';
    await morning();
    app.screen = app.mode === 'hotseat' ? 'handoff' : 'desk';
  }
  save(); render();
}

async function morning() {
  app.screen = 'busy'; app.busyText = 'The morning traffic is coming in'; render();
  for (const side of humanSides()) await voiceMorning(app.game, side);
}

async function dispatch() {
  const side = app.active;
  const g = app.game;
  const drafts = app.drafts[side].filter((d) => d.agentId && d.text.trim());
  // Interpret anything not yet encoded.
  for (const d of drafts) if (!d.order) d.order = await interpretCable(g, side, d.agentId, d.text.trim());
  const orders = drafts.map((d) => ({ agentId: d.agentId, text: d.text.trim(), ...stripVia(d.order) }));
  const errors = validateOrders(g, side, orders);
  if (errors.length) { app.errors = errors; render(); return; }
  submitOrders(g, side, orders);
  app.drafts[side] = [];
  app.errors = [];
  const opp = other(side);
  if (!g.pending[opp]) {
    if (isHuman(opp)) { app.active = opp; app.screen = 'handoff'; save(); render(); return; }
    app.screen = 'busy'; app.busyText = 'Moscow Centre is reading the traffic'; render();
    const view = viewFor(g, opp);
    const r = app.mode === 'claude' ? await claudeOrders(g, opp, view) : { orders: heuristicOrders(view, g.seed) };
    submitOrders(g, opp, r.orders);
    if (r.journal) addJournal(g, opp, r.journal);
  }
  app.screen = 'busy'; app.busyText = 'The night passes'; render();
  resolveWeek(g);
  if (g.phase === 'over') { app.screen = 'debrief'; save(); render(); return; }
  app.active = 'control';
  await morning();
  app.screen = app.mode === 'hotseat' ? 'handoff' : 'desk';
  save(); render();
}
const stripVia = ({ via, ...o }) => o;

// ---------- render ----------
function render() {
  const root = $('#app');
  if (!app) { root.innerHTML = titleScreen(); bindTitle(); return; }
  const screens = { placement: placementScreen, handoff: handoffScreen, desk: deskScreen, busy: busyScreen, debrief: debriefScreen };
  root.innerHTML = topbar() + (screens[app.screen] || deskScreen)();
  bindTop();
  ({ placement: bindPlacement, handoff: bindHandoff, desk: bindDesk, debrief: bindDebrief }[app.screen] || (() => {}))();
}

function topbar() {
  const g = app.game, side = app.active;
  const st = llmStatus();
  const showSide = app.screen !== 'handoff';
  const v = showSide && g.phase !== 'setup' ? viewFor(g, side) : null;
  return `<div class="topbar">
    <span class="brand">MOSCOW RULES</span>
    ${g.phase === 'setup' ? '<span>Setup</span>' : `<span>Week ${Math.min(g.week, RULES.weeks)} / ${RULES.weeks}</span>`}
    ${showSide ? `<span class="side-${side}">At the desk: ${SIDE_LABEL[side]}</span>` : ''}
    ${v ? `<span>Eliminated: ${v.tally.ourEliminations} · Lost: ${v.tally.ourLosses}</span>` : ''}
    <span class="spacer"></span>
    <span class="small" title="${esc(st.reason || '')}">${st.llm ? `Claude: on${st.owner ? ' (owner)' : ''}` : 'Claude: offline'}</span>
    <button id="btn-manual">Field Manual</button>
    <button id="btn-quit">New game</button>
  </div>`;
}
function bindTop() {
  $('#btn-manual')?.addEventListener('click', () => openModal(manualHTML()));
  $('#btn-quit')?.addEventListener('click', () => { if (confirm('Abandon this game and start a new one?')) { clearSave(); app = null; render(); } });
}

// ----- title -----
function titleScreen() {
  const saved = load();
  const st = llmStatus();
  return `<div class="center-wrap"><div class="sheet title-card">
    <div class="stamp">TOP SECRET · EYES ONLY</div>
    <h1 style="margin-top:18px">MOSCOW RULES</h1>
    <div class="sub">Control vs Karla · twelve weeks · eight agents a side</div>
    <p>Place your joes. Cable them in plain words. Find out who they are, find out who is still yours, and take theirs off the board.
    Every cable you send to an agent who has been turned is read, word for word, in the other capital.</p>
    <div class="modes">
      <div class="mode" data-mode="claude"><b>Against Karla</b>Claude plays Moscow Centre. ${st.llm ? '' : '<br><span class="muted small">Needs the local proxy; plays as the offline bot until then.</span>'}</div>
      <div class="mode" data-mode="bot"><b>Against the bot</b>An offline opponent. No Claude needed.</div>
      <div class="mode" data-mode="hotseat"><b>Two players</b>Hot-seat on one device. Pass it over between turns.</div>
    </div>
    ${saved?.game && saved.game.phase !== 'over' ? '<p><button class="primary" id="btn-continue">Continue saved game</button></p>' : ''}
    <p class="small muted"><button class="link" id="btn-manual-t">Read the Field Manual</button> · <button class="link" id="btn-owner">Owner token</button></p>
  </div></div>`;
}
function bindTitle() {
  document.querySelectorAll('.mode').forEach((el) => el.addEventListener('click', () => startNew(el.dataset.mode)));
  $('#btn-continue')?.addEventListener('click', () => {
    app = load();
    if (app.screen === 'busy') {
      // Interrupted mid-turn: replay this week's orders from the desk.
      app.game.pending = { control: null, karla: null };
      app.active = 'control';
      app.screen = app.game.phase === 'setup' ? 'placement' : (app.mode === 'hotseat' ? 'handoff' : 'desk');
      if (app.game.phase === 'setup') app.active = app.game.placed.control ? 'karla' : 'control';
    }
    render();
  });
  $('#btn-manual-t')?.addEventListener('click', () => openModal(manualHTML()));
  $('#btn-owner')?.addEventListener('click', () => {
    const cur = (() => { try { return localStorage.getItem('mr-owner') || ''; } catch { return ''; } })();
    const t = prompt('Owner token (skips the guest token budget on your own server):', cur);
    if (t !== null) { try { localStorage.setItem('mr-owner', t.trim()); } catch {} checkLLM().then(() => render()); }
  });
}

// ----- placement -----
function placementScreen() {
  const side = app.active;
  const v = viewFor(app.game, side);
  app.placementDraft ||= {};
  const draft = (app.placementDraft[side] ||= heuristicPlacement(v, Date.now() % 100000));
  const errs = validatePlacement(app.game, side, draft);
  return `<div class="center-wrap"><div class="sheet">
    <h2>${SIDE_LABEL[side]}: place your networks</h2>
    <p class="small">Put each agent in a city, at most ${RULES.maxPerCityAtSetup} per city. The other side can't see this. Ferrets guard the city they're in; Scalphunters can only strike where they stand.</p>
    ${v.assets.length ? `<p class="small"><span class="stamp">SOURCE</span> You already have a source inside the opposition: ${v.assets.map((a) => `${esc(a.first)} ${esc(a.name)} (their ${arch(a.archetype)}, in their network)`).join(', ')}.</p>` : ''}
    <div class="placement-grid">
      ${v.own.map((a) => `<label><span><b>${esc(a.first)} ${esc(a.name)}</b> <span class="muted small">${arch(a.archetype)}</span></span>
        <select data-agent="${a.id}">${v.cities.map((c) => `<option ${draft[a.id] === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>`).join('')}
    </div>
    ${errs.length ? `<div class="errors">${errs.map(esc).join('<br>')}</div>` : ''}
    <p style="margin-top:14px"><button id="btn-shuffle">Shuffle</button> <button class="primary" id="btn-place" ${errs.length ? 'disabled' : ''}>Confirm placement</button></p>
    <table class="arch-table small" style="margin-top:12px">${ARCHETYPE_KEYS.map((k) => `<tr><td>${arch(k)}</td><td>${esc(ARCHETYPES[k].does)}</td></tr>`).join('')}</table>
  </div></div>`;
}
function bindPlacement() {
  const side = app.active;
  document.querySelectorAll('[data-agent]').forEach((s) => s.addEventListener('change', () => { app.placementDraft[side][s.dataset.agent] = s.value; save(); render(); }));
  $('#btn-shuffle').addEventListener('click', () => { app.placementDraft[side] = heuristicPlacement(viewFor(app.game, side), Math.floor(Math.random() * 1e6)); render(); });
  $('#btn-place').addEventListener('click', async () => {
    const p = app.placementDraft[side];
    delete app.placementDraft[side];
    await finishPlacement(side, p);
  });
}

// ----- handoff -----
function handoffScreen() {
  const side = app.active;
  const setup = app.game.phase === 'setup';
  return `<div class="center-wrap"><div class="sheet handoff">
    <div class="stamp">${SIDE_LABEL[side].toUpperCase()} ONLY</div>
    <h1 style="margin-top:20px">Pass the device to ${SIDE_LABEL[side]}</h1>
    <p>${setup ? 'Time to place your networks.' : `Week ${app.game.week}. The morning traffic is waiting.`} Make sure the other player is not looking.</p>
    <p><button class="primary" id="btn-take">I am ${SIDE_LABEL[side]}</button></p>
  </div></div>`;
}
function bindHandoff() {
  $('#btn-take').addEventListener('click', () => { app.screen = app.game.phase === 'setup' ? 'placement' : 'desk'; save(); render(); });
}

function busyScreen() {
  return `<div class="center-wrap"><div class="sheet busy">${esc(app.busyText || 'Working')}<span class="dots"></span></div></div>`;
}

// ----- desk -----
function enemyNote(side, id) { return (app.notes[side].enemy[id] ||= { role: '', note: '' }); }
function ownNote(side, id) { return (app.notes[side].own[id] ||= { trust: 'trusted', note: '' }); }

function deskScreen() {
  const g = app.game, side = app.active, v = viewFor(g, side);
  if (!app.drafts[side].length) app.drafts[side] = Array.from({ length: RULES.cablesPerWeek }, () => ({ agentId: '', text: '', order: null }));
  return `<div class="desk">
    <section class="sheet full">${boardHTML(v)}</section>
    <section class="sheet">${inboxHTML(v)}</section>
    <section class="sheet">${composerHTML(v)}</section>
    <section class="sheet full">${notebookHTML(v)}</section>
  </div>`;
}

function boardHTML(v) {
  const side = v.side;
  const cities = [...v.cities].sort((a, b) => CITY_DATA[a].x - CITY_DATA[b].x);
  const sightings = Object.values(v.sightings).filter((s) => s.fate !== 'eliminated' && s.lastCity);
  const assetIds = new Set(v.assets.map((a) => a.id));
  const cell = (c) => {
    const mine = v.own.filter((a) => a.alive && a.city === c);
    const assets = v.assets.filter((a) => a.city === c);
    const seen = sightings.filter((s) => s.lastCity === c && !assetIds.has(s.id));
    const home = CITY_DATA[c].home;
    return `<div class="city"><h3>${c}${home ? `<span class="home">${home === 'control' ? 'Circus' : 'Centre'}</span>` : ''}</h3>
      <div class="label">Ours</div>
      <div class="chips">${mine.map((a) => { const n = ownNote(side, a.id); return `<div class="chip ${side} ${n.trust}" title="${esc(arch(a.archetype))}"><span>${esc(a.name)}</span><span class="tag">${ARCHETYPES[a.archetype].short}${n.trust !== 'trusted' ? ' · ' + n.trust : ''}</span></div>`; }).join('') || '<span class="muted small">none</span>'}</div>
      ${assets.length ? `<div class="label">Our sources</div><div class="chips">${assets.map((a) => `<div class="chip asset"><span>${esc(a.name)}</span><span class="tag">${ARCHETYPES[a.archetype].short}</span></div>`).join('')}</div>` : ''}
      ${seen.length ? `<div class="label">Theirs, last seen</div><div class="chips">${seen.map((s) => { const n = enemyNote(side, s.id); return `<div class="chip enemy"><span>${esc(s.name)}</span><span class="tag">${n.role ? ARCHETYPES[n.role].short : '?'} · wk ${s.lastWeek}</span></div>`; }).join('')}</div>` : ''}
    </div>`;
  };
  return `<div class="board">${cities.map(cell).join('')}</div>
    <div class="legend"><span>Solid: your agents (role code, and your trust mark).</span><span>Green: enemy agents you have turned.</span><span>Dashed: enemy agents, last city and week seen, with the role from your notebook.</span></div>`;
}

const KIND_LABEL = { report: 'Report', leak: 'Intercept', loss: 'Loss', kill: 'Success', spotted: 'Counter-intelligence', approach: 'Approach', asset: 'Source', clarify: 'Query', briefing: 'Briefing' };
function msgHTML(m) {
  const text = m.kind === 'leak' ? m.text : (m.voiced || m.text);
  return `<div class="msg ${m.kind}"><div class="meta"><span>${KIND_LABEL[m.kind] || m.kind}${m.kind === 'leak' ? ` · their cable to ${esc(m.from)}` : ` · ${esc(m.from)}`}</span><span>wk ${m.week}</span></div>
    <div class="body">${m.kind === 'leak' ? '“' + esc(text) + '”' : esc(text)}</div></div>`;
}
function inboxHTML(v) {
  const now = v.inbox.filter((m) => m.week === v.week).sort((a, b) => (a.kind === 'leak') - (b.kind === 'leak'));
  const earlier = v.inbox.filter((m) => m.week < v.week).reverse();
  const weeks = [...new Set(earlier.map((m) => m.week))];
  return `<h2>Morning traffic · week ${v.week}</h2>
    <div class="inbox">${now.map(msgHTML).join('') || '<p class="muted">Nothing came in overnight.</p>'}</div>
    ${weeks.length ? `<details class="earlier"><summary>Earlier traffic</summary>${weeks.map((w) => `<h3 class="small" style="margin-top:10px">Week ${w}</h3><div class="inbox">${earlier.filter((m) => m.week === w).map(msgHTML).join('')}</div>`).join('')}</details>` : ''}`;
}

function composerHTML(v) {
  const side = v.side, drafts = app.drafts[side];
  const recipients = [
    ...v.own.filter((a) => a.alive).map((a) => ({ id: a.id, label: `${a.first} ${a.name} · ${arch(a.archetype)} · ${a.city}` })),
    ...v.assets.map((a) => ({ id: a.id, label: `SOURCE ${a.first} ${a.name} · their ${arch(a.archetype)} · ${a.city} (dictate their next report)` })),
  ];
  const usedElsewhere = (i) => new Set(drafts.filter((_, j) => j !== i).map((d) => d.agentId).filter(Boolean));
  const allEncoded = drafts.filter((d) => d.agentId && d.text.trim()).every((d) => d.order);
  const any = drafts.some((d) => d.agentId && d.text.trim());
  return `<h2>Outgoing cables</h2>
    <div class="limits">Up to ${RULES.cablesPerWeek} cables · at most ${RULES.watchesPerWeek} Watches · Recruit attempts left: ${v.limits.recruitsLeft} (${v.limits.recruitsThisWeek} this week)</div>
    ${drafts.map((d, i) => `<div class="cable" data-i="${i}">
      <div class="row"><select data-field="agent"><option value="">Choose recipient…</option>${recipients.map((r) => `<option value="${r.id}" ${d.agentId === r.id ? 'selected' : ''} ${usedElsewhere(i).has(r.id) ? 'disabled' : ''}>${esc(r.label)}</option>`).join('')}</select></div>
      <textarea data-field="text" maxlength="${MAX_CABLE}" placeholder="Write the cable as you would send it.">${esc(d.text)}</textarea>
      <div class="row"><button data-act="encode" ${d.agentId && d.text.trim() ? '' : 'disabled'}>Encode</button><span class="count">${d.text.length}/${MAX_CABLE}</span></div>
      ${d.order ? `<div class="understood ${d.order.unclear ? 'bad' : ''}">As understood: <b>${esc(describeOrder(d.order, app.game))}</b>${d.order.via === 'keywords' ? ' <span class="muted small">(offline reading)</span>' : ''}</div>` : ''}
    </div>`).join('')}
    ${app.errors.length ? `<div class="errors">${app.errors.map(esc).join('<br>')}</div>` : ''}
    <p><button class="primary" id="btn-dispatch">${any && !allEncoded ? 'Encode all & dispatch' : 'Dispatch'}${any ? '' : ' (send nothing)'}</button></p>
    <p class="small muted">Remember who might be reading. A cable to a turned agent arrives in the other capital exactly as you wrote it.</p>`;
}

function notebookHTML(v) {
  const side = v.side;
  const rows = Object.values(v.sightings).sort((a, b) => (a.fate ? 1 : 0) - (b.fate ? 1 : 0) || a.name.localeCompare(b.name));
  const assetIds = new Set(v.assets.map((a) => a.id));
  const roleSel = (id, cur) => `<select data-enemy-role="${id}"><option value="">unknown</option>${ARCHETYPE_KEYS.map((k) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${arch(k)}</option>`).join('')}</select>`;
  const enemyRows = rows.map((s) => {
    const n = enemyNote(side, s.id);
    const last = s.claims[s.claims.length - 1];
    const sugg = last && last.archetype !== n.role ? `<div class="suggest">Reported ${arch(last.archetype)} (per ${esc(last.source)}, wk ${last.week}) <button data-accept="${s.id}" data-role="${last.archetype}">Accept</button></div>` : '';
    const conflict = new Set(s.claims.map((c) => c.archetype)).size > 1 ? `<div class="suggest" style="color:var(--stamp)">Conflicting reports: ${s.claims.map((c) => `${arch(c.archetype)} (${esc(c.source)}, wk ${c.week})`).join('; ')}</div>` : '';
    return `<tr class="${s.fate ? 'dead' : ''}"><td><b>${esc(s.name)}</b>${assetIds.has(s.id) ? ' <span class="small" style="color:var(--ok)">our source</span>' : ''}${s.fate ? ' <span class="small">eliminated</span>' : ''}</td>
      <td>${s.lastCity ? `${s.lastCity}, wk ${s.lastWeek}` : '—'}</td><td>${roleSel(s.id, n.role)}${sugg}${conflict}</td>
      <td><input data-enemy-note="${s.id}" value="${esc(n.note)}" placeholder="notes"></td></tr>`;
  }).join('');
  const ownRows = v.own.map((a) => {
    const n = ownNote(side, a.id);
    return `<tr class="${a.alive ? '' : 'dead'}"><td><b>${esc(a.name)}</b><div class="small muted">${arch(a.archetype)} · ${a.alive ? a.city : a.eliminated.how}</div></td>
      <td><select data-own-trust="${a.id}">${['trusted', 'suspect', 'turned'].map((t) => `<option ${n.trust === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><input data-own-note="${a.id}" value="${esc(n.note)}" placeholder="notes"></td></tr>`;
  }).join('');
  return `<h2>Notebook</h2><div class="notebook-cols">
    <div class="table-scroll"><h3 class="small">The opposition (${rows.length} identified)</h3>
      <table><tr><th>Name</th><th>Last seen</th><th>Role (your call)</th><th>Notes</th></tr>${enemyRows || '<tr><td colspan="4" class="muted">No one identified yet. Send someone to Watch.</td></tr>'}</table></div>
    <div class="table-scroll"><h3 class="small">Our people</h3><table><tr><th>Agent</th><th>Loyalty</th><th>Notes</th></tr>${ownRows}</table></div>
  </div>`;
}

function bindDesk() {
  const side = app.active;
  document.querySelectorAll('.cable').forEach((el) => {
    const i = Number(el.dataset.i), d = app.drafts[side][i];
    $('[data-field="agent"]', el).addEventListener('change', (e) => { d.agentId = e.target.value; d.order = null; save(); render(); });
    const ta = $('[data-field="text"]', el);
    ta.addEventListener('input', () => {
      d.text = ta.value; if (d.order) { d.order = null; $('.understood', el)?.remove(); }
      $('.count', el).textContent = `${d.text.length}/${MAX_CABLE}`;
      $('[data-act="encode"]', el).disabled = !(d.agentId && d.text.trim());
      save();
    });
    ta.addEventListener('change', () => render());
    $('[data-act="encode"]', el).addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Encoding…';
      d.order = await interpretCable(app.game, side, d.agentId, d.text.trim());
      save(); render();
    });
  });
  $('#btn-dispatch').addEventListener('click', async (e) => { e.target.disabled = true; e.target.textContent = 'Dispatching…'; await dispatch(); });
  document.querySelectorAll('[data-enemy-role]').forEach((s) => s.addEventListener('change', () => { enemyNote(side, s.dataset.enemyRole).role = s.value; save(); render(); }));
  document.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', () => { enemyNote(side, b.dataset.accept).role = b.dataset.role; save(); render(); }));
  document.querySelectorAll('[data-enemy-note]').forEach((i) => i.addEventListener('change', () => { enemyNote(side, i.dataset.enemyNote).note = i.value; save(); }));
  document.querySelectorAll('[data-own-trust]').forEach((s) => s.addEventListener('change', () => { ownNote(side, s.dataset.ownTrust).trust = s.value; save(); render(); }));
  document.querySelectorAll('[data-own-note]').forEach((i) => i.addEventListener('change', () => { ownNote(side, i.dataset.ownNote).note = i.value; save(); }));
}

// ----- debrief -----
function debriefScreen() {
  const r = revealAll(app.game);
  const o = r.outcome;
  const winner = o.winner ? `${SIDE_LABEL[o.winner]} wins` : 'A draw';
  const fate = (a) => (a.alive ? (a.turnedBy ? `alive, working for ${SIDE_LABEL[a.turnedBy]}${a.sleeper ? ' (a sleeper from the start)' : ''}` : 'alive') : `${a.eliminated.how} in ${a.eliminated.city}, wk ${a.eliminated.week}${a.turnedBy ? ` (had been turned by ${SIDE_LABEL[a.turnedBy]})` : ''}`);
  const agentRows = (side) => r.agents.filter((a) => a.side === side).map((a) => `<tr class="${a.alive ? '' : 'dead'}"><td><b>${esc(a.first)} ${esc(a.name)}</b></td><td>${arch(a.archetype)}</td><td>${a.history.map((h) => h.city).filter((c, i, arr) => c !== arr[i - 1]).join(' → ')}</td><td>${esc(fate(a))}</td></tr>`).join('');
  const journal = (side) => r.journal[side].length ? `<h3>${SIDE_LABEL[side]}'s journal</h3><div class="journal">${r.journal[side].map((j) => `<p><b>${j.week === 1 && r.journal[side][0] === j ? 'Setup / wk 1' : `Week ${j.week}`}.</b> ${esc(j.text)}</p>`).join('')}</div>` : '';
  return `<div class="center-wrap" style="max-width:1000px"><div class="sheet">
    <div class="stamp">CASE CLOSED</div>
    <h1 style="margin-top:14px">${winner}</h1>
    <p>${esc(o.reason)}.</p>
    <div class="score">${SIDES.map((s) => `<div><div class="n">${o.score[s].total}</div>${SIDE_LABEL[s]}<div class="small muted">${o.score[s].eliminations} eliminated + ${o.score[s].turned} turned</div></div>`).join('')}</div>
    ${SIDES.map((s) => `<h3>${SIDE_LABEL[s]}'s agents</h3><div class="table-scroll"><table><tr><th>Agent</th><th>Archetype</th><th>Movements</th><th>Fate</th></tr>${agentRows(s)}</table></div>`).join('')}
    <h3 style="margin-top:16px">Every cable that leaked (${r.leaks.length})</h3>
    ${r.leaks.length ? r.leaks.map((l) => `<div class="msg leak"><div class="meta"><span>${SIDE_LABEL[l.author]} → ${esc(app.game.agents[l.agentId].name)}, read by ${SIDE_LABEL[l.reader]}</span><span>wk ${l.week}</span></div><div class="body">“${esc(l.text)}”</div></div>`).join('') : '<p class="muted">Nothing leaked. Clean work.</p>'}
    ${journal('karla')}${journal('control')}
    <p style="margin-top:18px"><button class="primary" id="btn-again">Play again</button></p>
  </div></div>`;
}
function bindDebrief() { $('#btn-again').addEventListener('click', () => { clearSave(); app = null; render(); }); }

// ---------- modal ----------
function openModal(html) {
  $('#modal-card').innerHTML = `<button class="close" id="modal-close">Close</button>${html}`;
  $('#modal').classList.remove('hidden');
  $('#modal-close').addEventListener('click', closeModal);
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ---------- boot ----------
window.MR = { get app() { return app; }, startNew, dispatch, render };
checkLLM().finally(() => {
  const saved = load();
  if (saved?.game && saved.screen === 'debrief') app = saved;
  render();
});
