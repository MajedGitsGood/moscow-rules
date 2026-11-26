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
    return `<g class="pin ${p.side} ${p.kind}" data-pin="${p.n}" transform="translate(${xx.toFixed(1)},${yy})"><title>Week ${p.week}: ${esc(p.title)}</title><circle r="6"/></g>`;
  }).join('');
  return `<svg class="story" viewBox="0 0 ${W} ${H}" role="img" aria-label="Who was ahead each week, with the key moments">
    ${pw ? `<rect x="${x(pw) - colW / 2}" y="${top}" width="${colW}" height="${H - top - bottom}" class="pivot-band"/>` : ''}
    <rect x="${padL}" y="${top}" width="${W - padL - padR}" height="${H - top - bottom}" class="st-frame"/>
    <line x1="${padL}" x2="${W - padR}" y1="${mid}" y2="${mid}" class="st-zero"/>
    <path d="${area(1)}" class="st-area control"/><path d="${area(-1)}" class="st-area karla"/>
    <polyline points="${pts}" class="st-line"/>
    ${weeks.map((w) => `<circle cx="${x(w)}" cy="${y(lead[w])}" r="3.5" class="st-dot"/>`).join('')}
    <text x="${padL - 12}" y="${top + 16}" text-anchor="end" class="st-lab control">Control</text>
    <text x="${padL - 12}" y="${H - bottom - 8}" text-anchor="end" class="st-lab karla">Karla</text>
    ${weeks.filter((w) => w > 0).map((w) => `<text x="${x(w)}" y="${H - 4}" text-anchor="middle" class="st-wk ${w === pw ? 'pv' : ''}">${w === pw ? '★ ' : ''}wk ${w}</text>`).join('')}
    ${pinSvg}
  </svg>`;
}

// Who a moment is about, in the order the analysts mention them (at most three).
function castOf(game, m) {
  const text = `${m.title} ${m.detail}`;
  return Object.values(game.agents)
    .map((a) => ({ a, at: text.search(new RegExp(`\\b${a.name}\\b`)) }))
    .filter((x) => x.at >= 0).sort((x, y) => x.at - y.at).slice(0, 3).map((x) => x.a);
}
// The moment as a picture: the people involved, each with their side's ring and role, joined by
// what happened between them. A death that week is marked on the face.
function cast(game, m) {
  const who = castOf(game, m);
  if (!who.length) return '';
  const face = (a) => {
    const died = a.eliminated?.week === m.week;
    const mole = a.turnedBy && a.turnedWeek && a.turnedWeek <= m.week;
    return `<span class="mo-a ${a.side} ${died ? 'died' : ''}" title="${esc(`${a.first} ${a.name}, ${role(a.archetype)}${mole ? `, working for ${SIDE_LABEL[a.turnedBy]}` : ''}${died ? ', died this week' : ''}`)}">
      ${portrait(a, { size: 40, mood: died ? 'dead' : null })}<i class="mo-r r-${a.archetype}">${ROLE_ICON[a.archetype]}</i>${mole ? '<i class="mo-m">M</i>' : ''}<small>${esc(a.name)}</small></span>`;
  };
  const act = `<span class="mo-x">${KIND[m.kind]?.icon || ''}</span>`;
  return `<div class="mo-cast">${face(who[0])}${who.length > 1 ? act + who.slice(1).map(face).join('') : ''}</div>`;
}

function moments(story, game) {
  if (!story) return `<p class="db-wait">The analysts are going through the files<span class="dots"></span></p>`;
  // Fill column by column, so the numbers run left to right like the weeks on the chart above.
  const rows = story.moments.length <= 4 ? 2 : 3;
  return `<ol class="moments" style="--rows:${rows}">${story.moments.map((m, i) => `<li class="moment ${m.side} ${m.kind}" data-pin="${i + 1}" title="${esc(KIND[m.kind]?.label || m.kind)}">
    <span class="mo-n"><small>wk</small>${m.week}</span>
    <div>${cast(game, m)}<b>${esc(m.title)}</b><span class="mo-when">${KIND[m.kind]?.icon || ''}${m.city ? esc(m.city) : ''}</span><p title="${esc(m.detail)}">${esc(m.detail)}</p></div></li>`).join('')}</ol>`;
}

// Below the moments: each side's lapse across the whole game, and how it should have played.
function lessons(story) {
  if (!story?.lessons) return '';
  return `<div class="lessons">${SIDES.map((s) => `<div class="lesson ${s}"><h3>Where ${SIDE_LABEL[s]} went wrong</h3><p>${esc(story.lessons[s])}</p></div>`).join('')}</div>`;
}

// The pivotal battleground: that week's map around the city, with the true picture in the spotlight.
function battleground(game, story) {
  if (!story?.pivotal) return '';
  const { week: w, city } = story.pivotal;
  const posAt = (a) => { let c = a.history[0]?.city; for (const h of a.history) if (h.week <= w) c = h.city; return c; };
  const here = Object.values(game.agents).filter((a) => posAt(a) === city && (!a.eliminated || a.eliminated.week >= w));
  const [cx, cy] = cityXY(city);
  const half = MAP_SIZE.W / 2.1 / 2, edge = cx - half < 0 || cx + half > MAP_SIZE.W;
  // Only the people the exchange is about get a token; everyone else in the city is a small dot.
  const said = [story.pivotal.title, story.pivotal.told, story.pivotal.did, story.pivotal.result].join(' ');
  const named = (a) => new RegExp(`\\b${a.name}\\b`).test(said);
  const toks = SIDES.map((side) => {
    const list = here.filter((a) => a.side === side).sort((x, y) => named(y) - named(x));
    return list.map((a, i) => {
      // Control to the left, Karla to the right; near the map's edge, above and below instead.
      const base = edge ? (side === 'control' ? 270 : 90) : (side === 'control' ? 180 : 0);
      const n = list.length, r = n > 3 ? 58 : 46, spread = (36 / r) * 180 / Math.PI;
      const ang = (base + (i - (n - 1) / 2) * spread) * Math.PI / 180;
      const tx = cx + Math.cos(ang) * r, ty = cy + Math.sin(ang) * r + 4;
      const died = a.eliminated?.week === w, mole = a.turnedBy && a.turnedWeek && a.turnedWeek <= w;
      const tip = `<title>${esc(`${a.first} ${a.name}, ${role(a.archetype)}${mole ? `, working for ${SIDE_LABEL[a.turnedBy]}` : ''}${died ? ', died this week' : ''}`)}</title>`;
      if (!named(a)) return `<g class="bg-dot ${side}" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)})">${tip}<circle r="5"/></g>`;
      return `<g class="bg-tok ${side} ${died ? 'died' : ''} ${mole ? 'mole' : ''}" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)})">${tip}
        <circle r="15" class="ring"/><svg x="-13" y="-13" width="26" height="26" viewBox="0 0 64 64" clip-path="url(#tok)">${portraitBody(a, died ? 'dead' : null)}</svg>
        <text y="27" text-anchor="middle" class="bg-label">${esc(a.name)}</text></g>`;
    }).join('');
  }).join('');
  const zoom = 2.1, vw = MAP_SIZE.W / zoom, vh = MAP_SIZE.H / zoom;
  const vx = Math.max(0, Math.min(MAP_SIZE.W - vw, cx - vw / 2)), vy = Math.max(0, Math.min(MAP_SIZE.H - vh, cy - vh / 2));
  const p = story.pivotal;
  const other = (x) => (x === 'control' ? 'karla' : 'control');
  const SRC = { planted: 'Planted', leaked: 'Leaked', true: 'Report' };
  const step = (cls, icon, label, text, extra = '') => `<li class="ch-step ${cls}"><span class="ch-dot">${icon}</span><div><small>${label}${extra}</small><p>${esc(text)}</p></div></li>`;
  const chain = p.receiver ? `<ol class="chain">
      ${step(`${p.source === 'true' ? p.receiver : other(p.receiver)} src-${p.source}`, UI_ICON.traffic, `${SIDE_LABEL[p.receiver]} heard`, p.told, ` <em class="src">${SRC[p.source] || ''}</em>`)}
      ${step(p.receiver, ORDER_ICON.feed, `${SIDE_LABEL[p.receiver]} acted`, p.did)}
      ${step(`${p.favoured} result`, UI_ICON.skull, 'Result', p.result)}
    </ol>` : '';
  return `<section class="db2-card bg">
    <h2>The decisive exchange <span class="h-sub">${esc(city)} · wk ${w}</span></h2>
    <div class="bg-grid">
      <svg class="bg-map" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid slice">${mapBase(game.cities)}
        <circle cx="${cx}" cy="${cy}" r="70" class="spot"/><circle cx="${cx}" cy="${cy}" r="18" class="bg-city"/>
        <text x="${edge ? cx + 26 : cx}" y="${edge ? cy + 4 : cy - 26}" text-anchor="${edge ? 'start' : 'middle'}" class="bg-name">${esc(city.toUpperCase())}</text>${toks}</svg>
      <div class="bg-side"><h3 class="ex-title ${p.favoured || ''}">${esc(p.title || '')}</h3>${chain}</div>
    </div>
  </section>`;
}

// Two columns by allegiance at the end: each side's own loyal agents, then the enemy agents it turned
// (marked with where they came from), then the dead.
function rosters(game) {
  const HOW = { killed: ['strike', 'Killed'], trapped: ['trap', 'Trapped'], executed: ['execute', 'Executed by own side'] };
  const camp = (a) => a.turnedBy || a.side;
  const fate = (a) => {
    const from = a.turnedBy ? `<span class="from-chip ${a.side}" title="Originally ${SIDE_LABEL[a.side]}'s">Turned wk ${a.turnedWeek}</span>` : '';
    if (a.alive) return from;
    const [ic, label] = HOW[a.eliminated.how] || ['strike', a.eliminated.how];
    return `<span class="death" title="${label}">${ORDER_ICON[ic]}<b>${label}</b> wk ${a.eliminated.week} · ${esc(a.eliminated.city)}</span>${from}`;
  };
  const rank = (a) => (a.alive && !a.turnedBy ? 0 : a.alive ? 1 : 2);
  const list = (side) => Object.values(game.agents).filter((a) => camp(a) === side)
    .sort((a, b) => rank(a) - rank(b) || (b.eliminated?.week || 0) - (a.eliminated?.week || 0))
    .map((a) => `<div class="db-agent r${rank(a)} ${a.turnedBy ? 'defector' : ''}">${portrait(a, { size: 40, mood: a.alive ? null : 'dead' })}<div class="db-who"><b>${esc(a.first)} ${esc(a.name)}</b><span class="db-fate">${fate(a)}</span></div><span class="db-role r-${a.archetype}" title="${role(a.archetype)}">${ROLE_ICON[a.archetype]}</span></div>`).join('');
  return `<section class="db2-card"><div class="db-cols">${SIDES.map((s) => `<div><h3 class="${s}">${SIDE_LABEL[s]}'s people</h3>${list(s)}</div>`).join('')}</div></section>`;
}

export function debriefHTML(game, story, { mood = 'even', reveal = false } = {}) {
  const o = game.outcome, last = lastWeek(game);
  return `<div class="debrief2 mood-${mood} ${reveal ? 'reveal' : ''}">
    <header class="db2-head">
      <div><div class="stamp">${{ win: 'CHECKMATE', lose: 'BLOWN' }[mood] || (o.winner ? 'FILE CLOSED' : 'STANDOFF')}</div><h1>${o.winner ? `${SIDE_LABEL[o.winner]} wins` : 'Stalemate'}</h1>
        <p class="hl">${story ? esc(story.headline) : esc(o.reason)}</p>${story ? `<p class="sum">${esc(story.summary)}</p>` : ''}</div>
      <div class="db-score">${SIDES.map((s) => { const x = o.score[s]; return `<div class="${s}"><span>${x.standing}</span><b>${SIDE_LABEL[s]}</b>
        <small class="sum-line">${x.loyal ?? x.standing} own${x.recruited ? ` + ${x.recruited} turned` : ''}</small></div>`; }).join('<i>vs</i>')}</div>
    </header>
    <section class="db2-card"><h2>How it unfolded</h2>${storyChart(game, story, last)}${moments(story, game)}${lessons(story)}</section>
    ${battleground(game, story)}
    ${rosters(game)}
    ${story?.via === 'rules' ? '<p class="db-note">Rules-engine analysis. <button class="link" data-act="reanalyze">Ask the analyst</button></p>' : ''}
    <div class="db-actions"><button class="btn" data-act="casefile">Save case file</button><button class="btn gold" data-act="again">Another operation</button></div>
  </div>`;
}
