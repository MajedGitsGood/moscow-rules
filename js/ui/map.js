// The war-room map: Natural Earth coastlines, a territory around each city (Voronoi cells clipped
// to land, tinted by whoever holds the city), city medallions with landmarks, and agent tokens.
import { MAP } from '../mapdata.js';
import { LANDMARK, HOME } from '../world.js';
import { LANDMARK_ICON, ORDER_ICON, ROLE_ICON, sized } from './icons.js';
import { portraitBody } from './portraits.js';

const { width: W, height: H } = MAP;
export const cityXY = (c) => MAP.cityXY[c];

// Voronoi by half-plane clipping (Sutherland-Hodgman): fine for six points.
function cell(points, i) {
  let poly = [[0, 0], [W, 0], [W, H], [0, H]];
  const [px, py] = points[i];
  for (let j = 0; j < points.length; j++) {
    if (j === i) continue;
    const [qx, qy] = points[j];
    const mx = (px + qx) / 2, my = (py + qy) / 2, nx = qx - px, ny = qy - py;
    const inside = ([x, y]) => (x - mx) * nx + (y - my) * ny <= 0;
    const cut = ([ax, ay], [bx, by]) => {
      const da = (ax - mx) * nx + (ay - my) * ny, db = (bx - mx) * nx + (by - my) * ny;
      const t = da / (da - db);
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    };
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length];
      if (inside(a)) { out.push(a); if (!inside(b)) out.push(cut(a, b)); } else if (inside(b)) out.push(cut(a, b));
    }
    poly = out;
  }
  return 'M' + poly.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
}

// Static layer: drawn once per game (sea, land, territories, borders).
export function mapBase(cities) {
  const pts = cities.map(cityXY);
  const graticule = [];
  for (let x = -100; x < W + 100; x += 80) graticule.push(`<path d="M${x},0 Q${x + 40},${H / 2} ${x + 10},${H}"/>`);
  for (let y = 40; y < H; y += 80) graticule.push(`<path d="M0,${y} Q${W / 2},${y - 30} ${W},${y}"/>`);
  return `
  <defs>
    <filter id="paper" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="4" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 .32  0 0 0 0 .26  0 0 0 0 .17  0 0 0 -1.1 .62" result="grain"/>
      <feComposite in="grain" in2="SourceGraphic" operator="in" result="g2"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="g2"/></feMerge>
    </filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".55"/></filter>
    <radialGradient id="sea" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#1d3542"/><stop offset="1" stop-color="#0a141b"/></radialGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
    <clipPath id="land"><path d="${MAP.land}"/></clipPath>
    <clipPath id="tok" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>
    <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#e8c77a"/></marker>
  </defs>
  <g class="graticule">${graticule.join('')}</g>
  <path class="land" d="${MAP.land}" filter="url(#paper)"/>
  <g clip-path="url(#land)">${cities.map((c, i) => `<path class="cell" data-city="${c}" d="${cell(pts, i)}"/>`).join('')}</g>
  <path class="borders" d="${MAP.borders}"/>
  <path class="coast" d="${MAP.land}"/>
  <g class="cell-edges" clip-path="url(#land)">${cities.map((c, i) => `<path d="${cell(pts, i)}"/>`).join('')}</g>`;
}

// Dynamic layer: cities, tokens, queued moves. `state` comes from the UI.
//   view: viewFor(side); selected: city; orders: queued orders; moveTargets: Set of cities to
//   highlight; roleOf(agent): the role to badge on a token (known for ours, the player's guess for theirs)
export function mapOverlay({ view, selected, orders = [], moveTargets = null, roleOf, numbers = null }) {
  const out = [];
  // Queued moves as arcs.
  for (const o of orders.filter((x) => x.type === 'move')) {
    const a = [...view.own, ...view.enemies].find((x) => x.id === o.agentId);
    if (!a) continue;
    const [x1, y1] = cityXY(a.city), [x2, y2] = cityXY(o.city);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.25;
    out.push(`<path class="move-arc" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" marker-end="url(#arrow)"/>`);
  }
  for (const c of view.cities) {
    const [x, y] = cityXY(c);
    const ours = view.own.filter((a) => a.alive && a.city === c);
    const theirs = view.enemies.filter((a) => a.alive && a.city === c);
    const trap = view.traps.find((t) => t.city === c);
    const cls = ['city', selected === c ? 'selected' : '', moveTargets?.has(c) ? 'target' : '', HOME[c] ? `home-${HOME[c]}` : ''].join(' ');
    const tok = (a, i, n, sideCls) => {
      const left = sideCls === 'ours';
      const spread = Math.min(26, 110 / Math.max(n, 1));
      const ang = ((left ? 180 : 0) + (i - (n - 1) / 2) * spread * (left ? -1 : 1)) * Math.PI / 180;
      const tx = Math.cos(ang) * 40, ty = Math.sin(ang) * 40 + 4;
      const queued = orders.find((o) => o.agentId === a.id);
      const role = roleOf(a);
      return `<g class="token ${sideCls} ${a.asset ? 'asset' : ''} ${queued ? 'queued' : ''}" data-agent="${a.id}" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)})"><g class="tok-inner">
        <circle r="12.5" class="ring"/>
        <svg x="-11" y="-11" width="22" height="22" viewBox="0 0 64 64" clip-path="url(#tok)">${portraitBody(a, a.alive ? null : 'dead')}</svg>
        ${role ? `<g class="badge" transform="translate(8,8)"><circle r="6.5"/>${sized(ROLE_ICON[role], 9.5)}</g>` : ''}
        ${queued ? `<g class="qmark" transform="translate(-9,-9)"><circle r="6.5"/>${sized(ORDER_ICON[queued.type] || '', 9)}</g>` : ''}
        <title>${a.first} ${a.name}, ${a.cover}</title>
      </g></g>`;
    };
    out.push(`<g class="${cls}" data-city="${c}" transform="translate(${x},${y})" tabindex="0" role="button" aria-label="${c}: ${ours.length} of ours, ${theirs.length} of theirs">
      <circle class="halo" r="34"/>
      <g class="medal" filter="url(#shadow)">
        <circle r="21" class="medal-bg"/>
        <circle r="21" class="medal-ring"/>
        <svg x="-14" y="-15" width="28" height="28" viewBox="0 0 40 40" class="landmark">${LANDMARK_ICON[LANDMARK[c]].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>
      </g>
      <g class="plate" transform="translate(0,-33)"><rect x="${-c.length * 4.6 - 10}" y="-10" width="${c.length * 9.2 + 20}" height="18" rx="2"/><text y="3.5" text-anchor="middle">${c.toUpperCase()}</text>${numbers ? `<g class="keynum" transform="translate(${-c.length * 4.6 - 18},-1)"><circle r="8"/><text y="3.5" text-anchor="middle">${numbers[c]}</text></g>` : ''}</g>
      ${trap ? `<g class="trapmark ${trap.active ? 'armed' : ''}" transform="translate(-9,26)"><title>Our trap ${trap.active ? '(ready)' : '(ready next week)'}</title><circle r="8" cx="9" cy="0"/>${sized(ORDER_ICON.trap, 11, 3.5, -5.5)}</g>` : ''}
      ${ours.slice(0, 6).map((a, i) => tok(a, i, Math.min(ours.length, 6), 'ours')).join('')}
      ${theirs.slice(0, 6).map((a, i) => tok(a, i, Math.min(theirs.length, 6), 'theirs')).join('')}
    </g>`);
  }
  return out.join('');
}

// Who holds each city's territory: more agents present wins the tint.
export function tintCells(root, view) {
  for (const el of root.querySelectorAll('.cell')) {
    const c = el.dataset.city;
    const us = view.own.filter((a) => a.alive && a.city === c).length;
    const them = view.enemies.filter((a) => a.alive && a.city === c).length;
    el.dataset.hold = us > them ? 'us' : them > us ? 'them' : (us ? 'split' : 'none');
  }
}

export const MAP_SIZE = { W, H };
