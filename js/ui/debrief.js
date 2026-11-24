// The debrief: the story of the game, not a log of it. One chart of who was ahead each week, with
// the key moments (recruitments, intel that mattered, mistakes) pinned to their weeks; the pivotal
// battleground with what each side knew there; and both rosters, standing first.
import { SIDES, SIDE_LABEL, ARCHETYPES } from '../world.js';
import { mapBase, cityXY, MAP_SIZE } from './map.js';
import { portrait, portraitBody } from './portraits.js';
import { ROLE_ICON, ORDER_ICON, UI_ICON, sized } from './icons.js';
import { standingAt, lastWeek } from '../analysis.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const role = (k) => ARCHETYPES[k].label;
const KIND = {
  recruitment: { icon: ORDER_ICON.approach, label: 'Recruitment' },
  intel: { icon: ORDER_ICON.surveil, label: 'Intelligence' },
  mistake: { icon: ORDER_ICON.execute, label: 'Mistake' },
  'turning-point': { icon: UI_ICON.flag, label: 'Turning point' },
  strike: { icon: ORDER_ICON.strike, label: 'Strike' },
};

function storyChart(game, story, last) {
  const W = 1000, H = 280, padL = 92, padR = 24, top = 40, bottom = 60;
  const weeks = Array.from({ length: last + 1 }, (_, i) => i);
  const lead = weeks.map((w) => { const s = standingAt(game, w); return s.control - s.karla; });
  const maxAbs = Math.max(2, ...lead.map(Math.abs));
  const x = (w) => padL + (w / last) * (W - padL - padR);
  const mid = top + (H - top - bottom) / 2;
  const y = (v) => mid - (v / maxAbs) * ((H - top - bottom) / 2 - 6);
  const pts = weeks.map((w) => `${x(w).toFixed(1)},${y(lead[w]).toFixed(1)}`).join(' ');
  const area = (sign) => `M${x(0)},${mid} ${weeks.map((w) => `L${x(w).toFixed(1)},${(sign * lead[w] > 0 ? y(lead[w]) : mid).toFixed(1)}`).join(' ')} L${x(last)},${mid}Z`;
  const pw = story?.pivotal?.week;
  const colW = (W - padL - padR) / last;
  const pins = (story?.moments || []).map((m, i) => ({ ...m, n: i + 1 }));
  const byWeek = {};
  for (const p of pins) (byWeek[`${p.week}-${p.side === 'karla'}`] ||= []).push(p);
  const pinSvg = pins.map((p) => {
    const group = byWeek[`${p.week}-${p.side === 'karla'}`];
    const k = group.indexOf(p);
    const yy = p.side === 'karla' ? H - bottom + 16 : top - 18;
    const xx = x(p.week) + (k - (group.length - 1) / 2) * 20;
    return `<g class="pin ${p.side} ${p.kind}" data-pin="${p.n}" transform="translate(${xx.toFixed(1)},${yy})"><title>Week ${p.week}: ${esc(p.title)}</title><circle r="9"/><text y="4" text-anchor="middle">${p.n}</text></g>`;
  }).join('');
  return `<svg class="story" viewBox="0 0 ${W} ${H}" role="img" aria-label="Who was ahead each week, with the key moments">
    ${pw ? `<rect x="${x(pw) - colW / 2}" y="${top}" width="${colW}" height="${H - top - bottom}" class="pivot-band"/>` : ''}
    <rect x="${padL}" y="${top}" width="${W - padL - padR}" height="${H - top - bottom}" class="st-frame"/>
    <line x1="${padL}" x2="${W - padR}" y1="${mid}" y2="${mid}" class="st-zero"/>
    <path d="${area(1)}" class="st-area control"/><path d="${area(-1)}" class="st-area karla"/>
    <polyline points="${pts}" class="st-line"/>
    ${weeks.map((w) => `<circle cx="${x(w)}" cy="${y(lead[w])}" r="3.5" class="st-dot"/>`).join('')}
    <text x="${padL - 10}" y="${top + 14}" text-anchor="end" class="st-lab control">Control</text><text x="${padL - 10}" y="${top + 28}" text-anchor="end" class="st-sub">ahead</text>
    <text x="${padL - 10}" y="${H - bottom - 18}" text-anchor="end" class="st-lab karla">Karla</text><text x="${padL - 10}" y="${H - bottom - 4}" text-anchor="end" class="st-sub">ahead</text>
    ${weeks.filter((w) => w > 0).map((w) => `<text x="${x(w)}" y="${H - 4}" text-anchor="middle" class="st-wk ${w === pw ? 'pv' : ''}">${w === pw ? '★ ' : ''}wk ${w}</text>`).join('')}
    ${pinSvg}
  </svg>`;
}

function moments(story) {
  if (!story) return `<p class="db-wait">The analysts are going through the files<span class="dots"></span></p>`;
  return `<ol class="moments">${story.moments.map((m, i) => `<li class="moment ${m.side} ${m.kind}" data-pin="${i + 1}">
    <span class="mo-n">${i + 1}</span>
    <div><div class="mo-meta">${KIND[m.kind]?.icon || ''}<span>${KIND[m.kind]?.label || esc(m.kind)}</span> · week ${m.week}${m.city ? ` · ${esc(m.city)}` : ''} · <em>${m.side === 'both' ? 'both sides' : `in ${SIDE_LABEL[m.side]}'s favour`}</em></div>
    <b>${esc(m.title)}</b><p>${esc(m.detail)}</p></div></li>`).join('')}</ol>`;
}

// The pivotal battleground: that week's map around the city, with the true picture in the spotlight.
function battleground(game, story) {
  if (!story?.pivotal) return '';
  const { week: w, city } = story.pivotal;
  const posAt = (a) => { let c = a.history[0]?.city; for (const h of a.history) if (h.week <= w) c = h.city; return c; };
  const here = Object.values(game.agents).filter((a) => posAt(a) === city && (!a.eliminated || a.eliminated.week >= w));
  const [cx, cy] = cityXY(city);
  const toks = SIDES.map((side) => {
    const list = here.filter((a) => a.side === side);
    return list.map((a, i) => {
      const left = side === 'control';
      const n = list.length, spread = Math.min(30, 130 / Math.max(n, 1));
      const ang = ((left ? 180 : 0) + (i - (n - 1) / 2) * spread * (left ? -1 : 1)) * Math.PI / 180;
      const tx = cx + Math.cos(ang) * 46, ty = cy + Math.sin(ang) * 46 + 4;
      const died = a.eliminated?.week === w, mole = a.turnedBy && a.turnedWeek && a.turnedWeek <= w;
      return `<g class="bg-tok ${side} ${died ? 'died' : ''} ${mole ? 'mole' : ''}" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)})"><title>${esc(`${a.first} ${a.name}, ${SIDE_LABEL[side]}'s ${role(a.archetype)}${mole ? `, working for ${SIDE_LABEL[a.turnedBy]}` : ''}${died ? ', died this week' : ''}`)}</title>
        <circle r="15" class="ring"/><svg x="-13" y="-13" width="26" height="26" viewBox="0 0 64 64" clip-path="url(#tok)">${portraitBody(a, died ? 'dead' : null)}</svg>
        <g class="badge" transform="translate(10,10)"><circle r="7"/>${sized(ROLE_ICON[a.archetype], 10)}</g>
        ${mole ? `<g class="mole-tag" transform="translate(-11,-11)"><circle r="6.5"/><text y="3" text-anchor="middle">M</text></g>` : ''}</g>`;
    }).join('');
  }).join('');
  const zoom = 2.1, vw = MAP_SIZE.W / zoom, vh = MAP_SIZE.H / zoom;
  const vx = Math.max(0, Math.min(MAP_SIZE.W - vw, cx - vw / 2)), vy = Math.max(0, Math.min(MAP_SIZE.H - vh, cy - vh / 2));
  const list = (items) => items?.length ? `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="nothing">Nothing.</p>';
  return `<section class="db2-card bg">
    <h2>The pivotal battleground · ${esc(city)}, week ${w}</h2>
    <div class="bg-grid">
      <svg class="bg-map" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid slice">${mapBase(game.cities)}
        <circle cx="${cx}" cy="${cy}" r="70" class="spot"/><circle cx="${cx}" cy="${cy}" r="18" class="bg-city"/>
        <text x="${cx}" y="${cy - 26}" text-anchor="middle" class="bg-name">${esc(city.toUpperCase())}</text>${toks}</svg>
      <div class="bg-side">
        <p class="why">${esc(story.pivotal.why)}</p>
        <div class="knew control"><h3>What Control knew</h3>${list(story.pivotal.controlKnew)}</div>
        <div class="knew karla"><h3>What Karla knew</h3>${list(story.pivotal.karlaKnew)}</div>
      </div>
    </div>
  </section>`;
}

function rosters(game) {
  const fate = (a) => {
    const how = { killed: 'Killed', trapped: 'Caught in a trap', executed: 'Executed by their own side' };
    if (a.alive) return a.turnedBy ? `Alive, but working for ${SIDE_LABEL[a.turnedBy]} since week ${a.turnedWeek}` : 'Standing';
    const d = `${how[a.eliminated.how] || a.eliminated.how} in ${a.eliminated.city}, week ${a.eliminated.week}`;
    return a.turnedBy ? `${d}. Had worked for ${SIDE_LABEL[a.turnedBy]} since week ${a.turnedWeek}.` : d;
  };
  const rank = (a) => (a.alive && !a.turnedBy ? 0 : a.alive ? 1 : 2);
  const list = (side) => Object.values(game.agents).filter((a) => a.side === side)
    .sort((a, b) => rank(a) - rank(b) || (b.eliminated?.week || 0) - (a.eliminated?.week || 0))
    .map((a) => `<div class="db-agent r${rank(a)}">${portrait(a, { size: 40, mood: a.alive ? null : 'dead' })}<div><b>${esc(a.first)} ${esc(a.name)}</b><span class="role">${ROLE_ICON[a.archetype]}${role(a.archetype)}</span><small>${esc(fate(a))}</small></div></div>`).join('');
  return `<section class="db2-card"><div class="db-cols">${SIDES.map((s) => `<div><h3 class="${s}">${SIDE_LABEL[s]}'s people</h3>${list(s)}</div>`).join('')}</div></section>`;
}

export function debriefHTML(game, story) {
  const o = game.outcome, last = lastWeek(game);
  return `<div class="debrief2">
    <header class="db2-head">
      <div><div class="stamp">CASE CLOSED</div><h1>${o.winner ? `${SIDE_LABEL[o.winner]} wins` : 'Stalemate'}</h1>
        <p class="hl">${story ? esc(story.headline) : esc(o.reason)}</p>${story ? `<p class="sum">${esc(story.summary)}</p>` : ''}</div>
      <div class="db-score">${SIDES.map((s) => `<div class="${s}"><span>${o.score[s].standing}</span><b>${SIDE_LABEL[s]}</b><small>standing · ${o.score[s].lost} lost · ${o.score[s].turned} turned</small></div>`).join('<i>vs</i>')}</div>
    </header>
    <section class="db2-card"><h2>How it unfolded</h2>${storyChart(game, story, last)}${moments(story)}</section>
    ${battleground(game, story)}
    ${rosters(game)}
    ${story?.via === 'rules' ? '<p class="db-note">Analysis by the rules engine (Claude was unavailable).</p>' : ''}
    <button class="btn gold" data-act="again">Another operation</button>
  </div>`;
}
