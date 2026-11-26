// The night, replayed on the map each morning before the reports: tokens slide from where they were
// to where they are, and the week's events mark their cities (a dark pulse for a death, a flash for
// a trap, a faint glow where something was noticed). It only uses what this side can see: public
// positions and its own inbox, so the replay never leaks through the fog of war.
import { cityXY } from './map.js';

const NS = 'http://www.w3.org/2000/svg';
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// What each of this morning's messages looks like on the map.
export function nightEvents(inbox, week) {
  const out = [], seen = new Set();
  const add = (kind, city, delay) => { const k = `${kind}:${city}`; if (!seen.has(k)) { seen.add(k); out.push({ kind, city, delay }); } };
  for (const m of inbox.filter((x) => x.week === week && x.city)) {
    if (m.kind === 'event') {
      if (/trap/i.test(m.text)) { add('trap', m.city, 900); add('death', m.city, 1300); }
      else if (/dead|lost them|dealt with|finished/i.test(m.text)) add('death', m.city, 1100);
      else add('notice', m.city, 700);
    } else if (!/^Nothing worth reporting/.test(m.text || '')) add('notice', m.city, 500 + (out.length % 4) * 120);
  }
  return out;
}

export function playMorning(root, { prev, inbox, week }) {
  if (reduced()) return 0;
  const overlay = root.querySelector('#overlay');
  if (!overlay) return 0;
  // Tokens slide in from last week's city.
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
  // The night's events.
  const fx = document.createElementNS(NS, 'g');
  fx.setAttribute('class', 'night-fx');
  for (const e of nightEvents(inbox, week)) {
    const [x, y] = cityXY(e.city);
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', e.kind === 'notice' ? 30 : 26);
    c.setAttribute('class', `fx fx-${e.kind}`);
    c.style.animationDelay = `${e.delay}ms`;
    fx.appendChild(c);
  }
  overlay.insertBefore(fx, overlay.firstChild);
  setTimeout(() => fx.remove(), 3600);
  return 1;
}
