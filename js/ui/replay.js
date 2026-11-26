// The morning, played out on the map before the reports (mocked in docs/mocks/map-alive.html):
//   1. tokens slide from last week's city to this week's;
//   2. the desk lamp narrows and swings to each city where something happened overnight;
//   3. the night's main events type out as telegram slips on the corner of the sheet;
//   4. the slips slide into the Reports panel, which then appears with those reports marked as new.
// Nothing stays on the map. It only uses what this side can see (public positions and its own
// inbox), so it never leaks through the fog of war. Any re-render simply cuts it short.
import { cityXY, MAP_SIZE } from './map.js';
import { lex } from '../lexicon.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const LAMP_REST = [MAP_SIZE.W * 0.22, MAP_SIZE.H * 0.18, 850]; // cx, cy, r of the desk lamp at rest
const MAX_WIRES = 3;

// The night's telegrams: what happened first (deaths, traps, turnings), then certain sightings.
export function nightWires(inbox, week) {
  const now = inbox.filter((m) => m.week === week && m.city);
  const ranked = [...now.filter((m) => m.kind === 'event'), ...now.filter((m) => m.kind !== 'event' && m.facts?.activities?.length)];
  return ranked.slice(0, MAX_WIRES).map((m) => {
    const first = String(lex(m.voiced || m.text)).split(/(?<=[.!?])\s/)[0];
    return { id: m.id, city: m.city, text: first.toUpperCase() };
  });
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (x) => Math.max(0, Math.min(1, x));
const tween = (keys, t) => {
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [t0, a] = keys[i - 1], [t1, b] = keys[i], k = ease(clamp((t - t0) / (t1 - t0 || 1)));
    return a.map((v, j) => v + (b[j] - v) * k);
  }
  return keys.at(-1)[1];
};

export function playMorning(root, { prev, inbox, week }) {
  if (reduced()) return;
  const stage = root.querySelector('.stage'), overlay = root.querySelector('#overlay');
  if (!stage || !overlay) return;

  // 1. Tokens slide in from last week's city.
  for (const tok of overlay.querySelectorAll('.token')) {
    const from = prev?.[tok.dataset.agent], city = tok.closest('.city')?.dataset.city;
    if (!from || !city || from === city) continue;
    const [fx, fy] = cityXY(from), [cx, cy] = cityXY(city);
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(tok.getAttribute('transform') || '');
    const tx = m ? +m[1] : 0, ty = m ? +m[2] : 0;
    tok.classList.add('travelling');
    tok.parentNode.parentNode.appendChild(tok.parentNode); // draw the destination city on top while it lands
    tok.animate([
      { transform: `translate(${tx + fx - cx}px,${ty + fy - cy}px)`, opacity: 0.35 },
      { transform: `translate(${tx}px,${ty}px)`, opacity: 1 },
    ], { duration: 1100, delay: 150, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'backwards' });
  }

  const wires = nightWires(inbox, week);
  const panel = stage.querySelector('.panel');
  if (!wires.length) { if (panel) panel.style.animationDelay = '.5s'; return; }

  // The timeline, in seconds from now.
  const cities = [...new Set(wires.map((w) => w.city))];
  const lampKeys = [[0, LAMP_REST], [0.9, LAMP_REST]];
  let t = 0.9;
  for (const c of cities) { lampKeys.push([t += 0.7, [...cityXY(c), 230]], [t += 0.6, [...cityXY(c), 230]]); }
  lampKeys.push([t += 0.9, LAMP_REST]);
  const slipAt = (i) => t + 0.2 + i * 1.15;                       // each slip slides in, then types
  const typeFor = (w) => Math.min(1.4, 0.35 + w.text.length / 55);
  const flyAt = slipAt(wires.length - 1) + typeFor(wires.at(-1)) + 0.9;
  const FLY = 0.7, end = flyAt + FLY + 0.3;
  if (panel) panel.style.animationDelay = `${(flyAt + 0.35).toFixed(2)}s`; // the panel arrives as the slips do

  // The lamp (map.js mapLight) and the slips.
  const lamp = stage.querySelector('#desklamp'), dark = stage.querySelector('#deskdark');
  const box = document.createElement('div');
  box.className = 'wires';
  box.innerHTML = wires.map(() => '<div class="slip"></div>').join('');
  stage.appendChild(box);
  const slips = [...box.children];

  const start = performance.now();
  const frame = (now) => {
    if (!box.isConnected) return; // re-rendered: the morning was cut short
    const s = (now - start) / 1000;
    const [x, y, r] = tween(lampKeys, s);
    if (lamp && dark) {
      for (const g of [lamp, dark]) { g.setAttribute('cx', x.toFixed(1)); g.setAttribute('cy', y.toFixed(1)); }
      lamp.setAttribute('r', r.toFixed(1)); dark.setAttribute('r', (r * 1.25 + 60).toFixed(1));
    }
    const pr = panel?.getBoundingClientRect(), br = box.getBoundingClientRect();
    const reach = pr ? pr.left - br.left : innerWidth;
    slips.forEach((el, i) => {
      const w = wires[i], tin = slipAt(i), slide = ease(clamp((s - tin) / 0.35));
      const typed = Math.floor(clamp((s - tin - 0.3) / typeFor(w)) * w.text.length);
      const fly = ease(clamp((s - flyAt - (wires.length - 1 - i) * 0.12) / FLY));
      el.innerHTML = `<small>WEEK ${week} · ${w.city.toUpperCase()}</small>${w.text.slice(0, typed)}${s > tin && typed < w.text.length ? '<i class="caret"></i>' : ''}`;
      el.style.opacity = s < tin ? 0 : (1 - clamp((fly - 0.35) / 0.65)).toFixed(3);
      el.style.transform = `translateX(${(-115 * (1 - slide)).toFixed(1)}%) translateX(${(reach * fly).toFixed(1)}px) rotate(${((i % 2 ? 1.5 : -2) * (1 - fly)).toFixed(2)}deg) scale(${(1 - 0.3 * fly).toFixed(3)})`;
    });
    if (s < end) { requestAnimationFrame(frame); return; }
    box.remove();
    // The night's reports, just landed, are marked as new for a moment.
    for (const w of wires) stage.querySelector(`.msg[data-mid="${w.id}"]`)?.classList.add('landed');
  };
  requestAnimationFrame(frame);
}
