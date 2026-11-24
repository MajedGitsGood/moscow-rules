// The debrief: what really happened, week by week. A momentum chart (who was ahead, and where it
// swung), a replay map showing true roles, loyalties and moves each week, and a strip of both
// sides' orders, Karla's included. Built from the finished game's full record.
import { SIDES, SIDE_LABEL, ARCHETYPES } from '../world.js';
import { mapBase, cityXY, MAP_SIZE } from './map.js';
import { portrait, portraitBody } from './portraits.js';
import { ROLE_ICON, ORDER_ICON, UI_ICON, sized } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const other = (s) => (s === 'control' ? 'karla' : 'control');
const role = (k) => ARCHETYPES[k].label;

// Points each side had at the end of week w (deaths and turnings so far).
function pointsAt(game, w) {
  const pts = { control: 0, karla: 0 };
  for (const a of Object.values(game.agents)) {
    const enemy = other(a.side);
    if (a.eliminated && a.eliminated.week <= w) pts[enemy]++;
    else if (a.turnedBy && a.turnedWeek && a.turnedWeek <= w) pts[a.turnedBy]++;
  }
  return pts;
}

function weekEvents(game, w) {
  const ev = [];
  for (const a of Object.values(game.agents)) {
    if (a.eliminated?.week === w) ev.push({ kind: a.eliminated.how, agent: a, by: a.eliminated.by, city: a.eliminated.city });
    if (a.turnedWeek === w) ev.push({ kind: 'turned', agent: a, by: a.turnedBy, city: a.history.find((h) => h.week === w)?.city });
  }
  return ev;
}

const EVENT_TEXT = {
  killed: (e) => `${e.agent.name} (${SIDE_LABEL[e.agent.side]}'s ${role(e.agent.archetype)}) killed in ${e.city}`,
  trapped: (e) => `${e.agent.name} (${SIDE_LABEL[e.agent.side]}'s ${role(e.agent.archetype)}) caught in a trap in ${e.city}`,
  executed: (e) => `${e.agent.name} executed by ${SIDE_LABEL[e.agent.side]}${e.agent.turnedBy ? ', rightly: a mole' : ', wrongly: loyal'}`,
  turned: (e) => `${e.agent.name} (${SIDE_LABEL[e.agent.side]}'s ${role(e.agent.archetype)}) turned by ${SIDE_LABEL[e.by]}`,
};
const EVENT_ICON = { killed: UI_ICON.skull, trapped: ORDER_ICON.trap, executed: ORDER_ICON.execute, turned: ORDER_ICON.approach };

function momentumChart(game, last) {
  const W = 900, H = 230, padL = 92, padR = 20, top = 34, bottom = 34;
  const weeks = Array.from({ length: last + 1 }, (_, i) => i);
  const leads = weeks.map((w) => { const p = pointsAt(game, w); return p.control - p.karla; });
  const maxAbs = Math.max(2, ...leads.map(Math.abs));
  const x = (w) => padL + (w / last) * (W - padL - padR);
  const mid = top + (H - top - bottom) / 2;
  const y = (v) => mid - (v / maxAbs) * ((H - top - bottom) / 2);
  const line = weeks.map((w) => `${x(w).toFixed(1)},${y(leads[w]).toFixed(1)}`).join(' ');
  // Biggest single-week swing.
  let swing = 1, sMag = 0;
  for (let w = 1; w <= last; w++) { const d = Math.abs(leads[w] - leads[w - 1]); if (d > sMag) { sMag = d; swing = w; } }
  const marks = [];
  for (let w = 1; w <= last; w++) {
    const evs = weekEvents(game, w);
    evs.forEach((e, i) => {
      const scorer = e.kind === 'turned' ? e.by : other(e.agent.side);
      const yy = scorer === 'control' ? top - 14 - i * 0 : H - bottom + 14;
      marks.push(`<g class="mk ${scorer}" transform="translate(${(x(w) + (i - (evs.length - 1) / 2) * 15).toFixed(1)},${yy})"><title>Week ${w}: ${esc(EVENT_TEXT[e.kind](e))}</title><circle r="7"/>${sized(EVENT_ICON[e.kind], 10)}</g>`);
    });
  }
  const area = (sign) => `M${x(0)},${mid} ${weeks.map((w) => `L${x(w).toFixed(1)},${(sign * leads[w] > 0 ? y(leads[w]) : mid).toFixed(1)}`).join(' ')} L${x(last)},${mid}Z`;
  return `<svg class="momentum" viewBox="0 0 ${W} ${H}" role="img" aria-label="Who was ahead each week">
    <rect x="${padL}" y="${top}" width="${W - padL - padR}" height="${H - top - bottom}" class="mo-bg"/>
    ${weeks.map((w) => `<line x1="${x(w)}" x2="${x(w)}" y1="${top}" y2="${H - bottom}" class="mo-grid ${w === swing ? 'swing' : ''}" data-week="${w}"/>`).join('')}
    <line x1="${padL}" x2="${W - padR}" y1="${mid}" y2="${mid}" class="mo-zero"/>
    <path d="${area(1)}" class="mo-area control"/><path d="${area(-1)}" class="mo-area karla"/>
    <polyline points="${line}" class="mo-line"/>
    ${weeks.map((w) => `<circle cx="${x(w)}" cy="${y(leads[w])}" r="3.5" class="mo-dot"/>`).join('')}
    <text x="${padL - 8}" y="${top + 12}" text-anchor="end" class="mo-lab control">Control</text>
    <text x="${padL - 8}" y="${H - bottom - 4}" text-anchor="end" class="mo-lab karla">Karla</text>
    ${weeks.filter((w) => w > 0).map((w) => `<text x="${x(w)}" y="${H - 6}" text-anchor="middle" class="mo-wk" data-week="${w}">wk ${w}</text>`).join('')}
    ${sMag ? `<g class="mo-swing" transform="translate(${x(swing)},${y(leads[swing])})"><circle r="9"/><text x="12" y="-12">The game turned here</text></g>` : ''}
    ${marks.join('')}
    ${weeks.filter((w) => w > 0).map((w) => `<rect x="${x(w) - (W - padL - padR) / last / 2}" y="${top}" width="${(W - padL - padR) / last}" height="${H - top - bottom}" class="mo-hit" data-act="db-week" data-week="${w}"><title>Week ${w}</title></rect>`).join('')}
  </svg>`;
}

// The replay map for one week: true roles, true loyalties, the moves that week.
function replayMap(game, w) {
  const posAt = (a) => { let c = a.history[0]?.city; for (const h of a.history) if (h.week <= w) c = h.city; return c; };
  const aliveAt = (a) => !a.eliminated || a.eliminated.week > w;
  const turnedAt = (a) => a.turnedBy && a.turnedWeek && a.turnedWeek <= w;
  const out = [];
  for (const o of game.orderLog.filter((x) => x.week === w && x.type === 'move')) {
    const a = game.agents[o.agentId];
    const from = (() => { let c = a.history[0]?.city; for (const h of a.history) if (h.week < w) c = h.city; return c; })();
    if (!from || from === o.city) continue;
    const [x1, y1] = cityXY(from), [x2, y2] = cityXY(o.city);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.25;
    out.push(`<path class="rp-arc ${a.side}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/>`);
  }
  for (const c of game.cities) {
    const [cx, cy] = cityXY(c);
    out.push(`<g transform="translate(${cx},${cy})"><circle r="16" class="rp-city"/><text y="-22" text-anchor="middle" class="rp-name">${c.toUpperCase()}</text></g>`);
    for (const side of SIDES) {
      const here = Object.values(game.agents).filter((a) => a.side === side && aliveAt(a) && posAt(a) === c);
      here.forEach((a, i) => {
        const left = side === 'control';
        const n = here.length, spread = Math.min(26, 120 / Math.max(n, 1));
        const ang = ((left ? 180 : 0) + (i - (n - 1) / 2) * spread * (left ? -1 : 1)) * Math.PI / 180;
        const tx = cx + Math.cos(ang) * 38, ty = cy + Math.sin(ang) * 38 + 4;
        const t = turnedAt(a);
        out.push(`<g class="rp-tok ${side} ${t ? 'turned' : ''}" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)})"><title>${esc(`${a.first} ${a.name}: ${SIDE_LABEL[side]}'s ${role(a.archetype)}${t ? `, working for ${SIDE_LABEL[a.turnedBy]}` : ''}`)}</title>
          <circle r="12.5" class="ring"/><svg x="-11" y="-11" width="22" height="22" viewBox="0 0 64 64" clip-path="url(#tok)">${portraitBody(a)}</svg>
          <g class="badge" transform="translate(8,8)"><circle r="6.5"/>${sized(ROLE_ICON[a.archetype], 9.5)}</g>
          ${t ? `<g class="mole" transform="translate(-9,-9)"><circle r="5.5"/><text y="3" text-anchor="middle">M</text></g>` : ''}</g>`);
      });
    }
  }
  // Kills and turnings this week, marked on the map.
  for (const e of weekEvents(game, w)) {
    if (!e.city) continue;
    const [ex, ey] = cityXY(e.city);
    out.push(`<g class="rp-burst ${e.kind}" transform="translate(${ex},${ey})"><circle r="26"/></g>`);
  }
  return out.join('');
}

function weekStrip(game, last, current) {
  const cols = [];
  for (let w = 1; w <= last; w++) {
    const orders = game.orderLog.filter((o) => o.week === w);
    const evs = weekEvents(game, w);
    const lane = (side) => orders.filter((o) => o.side === side && o.type !== 'lie').map((o) => {
      const a = game.agents[o.agentId];
      const t = o.targetId ? game.agents[o.targetId]?.name : o.city || (o.plan ? `${o.plan.kind} in ${o.plan.city}` : '');
      const mole = a.side !== side;
      return `<div class="ws-o ${o.type}" title="${esc(`${a.first} ${a.name}${mole ? ' (their agent, our mole)' : ''}: ${o.type}${t ? ' ' + t : ''}`)}">${ORDER_ICON[o.type] || ''}<span>${esc(a.name)}${t ? ` → ${esc(t)}` : ''}</span></div>`;
    }).join('');
    const lies = orders.filter((o) => o.type === 'lie').length;
    cols.push(`<button class="ws-col ${w === current ? 'on' : ''}" data-act="db-week" data-week="${w}">
      <div class="ws-wk">Week ${w}</div>
      <div class="ws-lane control">${lane('control') || '<i>—</i>'}</div>
      <div class="ws-events">${evs.map((e) => `<div class="ws-e ${e.kind} ${e.kind === 'turned' ? e.by : other(e.agent.side)}">${EVENT_ICON[e.kind]}<span>${esc(EVENT_TEXT[e.kind](e))}</span></div>`).join('') || '<i>No blood</i>'}</div>
      <div class="ws-lane karla">${lane('karla') || '<i>—</i>'}${lies ? `<div class="ws-o lie">${ORDER_ICON.lie}<span>${lies} lie${lies > 1 ? 's' : ''} through moles</span></div>` : ''}</div>
    </button>`);
  }
  return `<div class="ws">${cols.join('')}</div>`;
}

export function debriefHTML(game, week) {
  const o = game.outcome;
  const last = Math.max(1, ...game.orderLog.map((x) => x.week));
  const w = Math.min(Math.max(1, week || last), last);
  const fate = (a) => {
    const how = { killed: 'Killed', trapped: 'Caught in a trap', executed: 'Executed by their own side' };
    if (a.alive) return a.turnedBy ? `Alive, working for ${SIDE_LABEL[a.turnedBy]} since week ${a.turnedWeek}: a point for ${SIDE_LABEL[a.turnedBy]}` : 'Alive';
    const d = `${how[a.eliminated.how] || a.eliminated.how} in ${a.eliminated.city}, week ${a.eliminated.week}`;
    return a.turnedBy ? `${d}. Had worked for ${SIDE_LABEL[a.turnedBy]} since week ${a.turnedWeek}; counted as a kill.` : d;
  };
  const roster = (side) => Object.values(game.agents).filter((a) => a.side === side).map((a) => `<div class="db-agent ${a.alive ? '' : 'dead'} ${a.turnedBy ? 'turned' : ''}">
    ${portrait(a, { size: 44, mood: a.alive ? null : 'dead' })}<div><b>${esc(a.first)} ${esc(a.name)}</b><span class="role">${ROLE_ICON[a.archetype]}${role(a.archetype)}</span><small>${esc(fate(a))}</small></div></div>`).join('');
  return `<div class="debrief2">
    <header class="db2-head">
      <div><div class="stamp">CASE CLOSED</div><h1>${o.winner ? `${SIDE_LABEL[o.winner]} wins` : 'Stalemate'}</h1><p>${esc(o.reason)}.</p></div>
      <div class="db-score">${SIDES.map((s) => `<div class="${s}"><span>${o.score[s].total}</span><b>${SIDE_LABEL[s]}</b><small>${o.score[s].dead} dead · ${o.score[s].turned} turned</small></div>`).join('<i>vs</i>')}</div>
    </header>
    <section class="db2-card"><h2>Who was ahead</h2>${momentumChart(game, last)}</section>
    <section class="db2-card replay">
      <div class="rp-head"><h2>Behind the scenes · week ${w}</h2>
        <div class="rp-ctrl"><button class="icon-btn" data-act="db-week" data-week="${Math.max(1, w - 1)}" title="Previous week">‹</button><input type="range" min="1" max="${last}" value="${w}" id="db-slider" aria-label="Week"><button class="icon-btn" data-act="db-week" data-week="${Math.min(last, w + 1)}" title="Next week">›</button><button class="btn small" data-act="db-play">Play</button></div></div>
      <svg class="map replay-map" viewBox="0 0 ${MAP_SIZE.W} ${MAP_SIZE.H}" preserveAspectRatio="xMidYMid meet">${mapBase(game.cities)}<g>${replayMap(game, w)}</g></svg>
      <p class="rp-legend"><span class="lg control"></span>Control <span class="lg karla"></span>Karla <span class="lg mole">M</span>Mole, working for the other side · badges show true roles · arcs are that week's moves</p>
    </section>
    <section class="db2-card"><h2>Both sides' orders</h2>${weekStrip(game, last, w)}</section>
    <section class="db2-card"><div class="db-cols">${SIDES.map((s) => `<div><h3 class="${s}">${SIDE_LABEL[s]}'s people</h3>${roster(s)}</div>`).join('')}</div></section>
    <button class="btn gold" data-act="again">Another operation</button>
  </div>`;
}
