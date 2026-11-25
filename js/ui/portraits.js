// Procedural noir portraits: every agent gets a deterministic bust (hat, hair, coat, glasses,
// moustache, chiaroscuro lighting) from their look seed. Pure SVG strings, cached by agent id.
import { makeRng } from '../rng.js';

const SKIN = ['#efd2b4', '#e2b896', '#cf9f7a', '#ad7b58', '#875a3f', '#f3dcc6'];
const HAIR = ['#1b1714', '#33251b', '#5a3d26', '#8a6a48', '#b9a382', '#bcb8b0'];
const COAT = ['#8a7856', '#2a2b30', '#4f5157', '#25304a', '#553d2c', '#6d6a5e', '#3b2f2a'];
const BG = { control: ['#24476e', '#0d1826'], karla: ['#6e2420', '#1a0b0a'] };
const cache = new Map();

export function portrait(agent, { size = 64, mood = null } = {}) {
  return `<svg class="portrait" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${portraitBody(agent, mood)}</svg>`;
}

// The portrait's inner markup, for embedding inside another SVG.
export function portraitBody(agent, mood = null) {
  const key = `${agent.id}:${agent.look.seed}:${mood}`;
  if (cache.has(key)) return cache.get(key);
  const r = makeRng(agent.look.seed);
  const female = agent.look.female;
  const skin = r.pick(SKIN), hair = r.pick(HAIR), coat = r.pick(COAT);
  const [bg1, bg2] = BG[agent.side];
  const uid = `p${agent.id}${agent.look.seed % 9973}`;
  const hats = agent.side === 'karla'
    ? (female ? ['none', 'scarf', 'beret', 'none'] : ['ushanka', 'fedora', 'none', 'trilby', 'flatcap'])
    : (female ? ['none', 'beret', 'scarf', 'pillbox'] : ['fedora', 'trilby', 'none', 'bowler', 'flatcap']);
  const hat = r.pick(hats);
  const glasses = r() < 0.32 ? r.pick(['round', 'square']) : null;
  const tache = !female && r() < 0.3;
  const beard = !female && !tache && r() < 0.12;
  const collarUp = r() < 0.45;
  const scarfNeck = r() < 0.25;
  const headW = female ? 9.2 : 10;

  const parts = [];
  parts.push(`<defs><radialGradient id="${uid}bg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></radialGradient>
    <linearGradient id="${uid}sh" x1="0" x2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity=".38"/></linearGradient></defs>`);
  parts.push(`<rect width="64" height="64" fill="url(#${uid}bg)"/>`);
  // Hair behind the head (long hair).
  if (female && (hat === 'none' || hat === 'beret' || hat === 'pillbox')) parts.push(`<path d="M21 26c0-9 5-14 11-14s11 5 11 14v14c-3 2-19 2-22 0z" fill="${hair}"/>`);
  // Shoulders and coat.
  parts.push(`<path d="M6 64c1.5-12 10-18 26-18s24.5 6 26 18z" fill="${coat}"/>`);
  parts.push(`<path d="M27 46l5 9 5-9z" fill="#e9e4da"/><path d="M31 49h2l1 9-2 3-2-3z" fill="${r.pick(['#5a1d1d', '#1d2a44', '#2a2a2a', '#4a3b1d'])}"/>`);
  parts.push(collarUp
    ? `<path d="M18 50l7-8 5 6-5 12zM46 50l-7-8-5 6 5 12z" fill="${coat}" stroke="#000" stroke-opacity=".25"/>`
    : `<path d="M20 52l7-6 4 12-6 6zM44 52l-7-6-4 12 6 6z" fill="${coat}" stroke="#000" stroke-opacity=".25"/>`);
  if (scarfNeck) parts.push(`<path d="M24 45c4 3 12 3 16 0l1 4c-5 3-13 3-18 0z" fill="${r.pick(['#8c2f2a', '#c9b48a', '#3c4a5e'])}"/>`);
  // Neck and head.
  parts.push(`<rect x="28.5" y="36" width="7" height="10" fill="${skin}"/><rect x="28.5" y="36" width="7" height="10" fill="#000" opacity=".18"/>`);
  parts.push(`<ellipse cx="32" cy="27" rx="${headW}" ry="12" fill="${skin}"/>`);
  // Hair on top (short styles).
  if (hat === 'none' && !female) parts.push(r() < 0.5
    ? `<path d="M22 24c0-8 4.5-11.5 10-11.5S42 16 42 24c-2-4-5-6-10-6s-8 2-10 6z" fill="${hair}"/>`
    : `<path d="M22 25c-.5-8 4-12.5 10-12.5 7 0 10.5 4.5 10 12.5-1-3-3-5-6-6-4 2-9 2-14 6z" fill="${hair}"/>`);
  if (female && hat !== 'scarf') parts.push(`<path d="M22.5 25c0-8 4-12 9.5-12s9.5 4 9.5 12c-3-5-7-6.5-12-5.5-3 .5-5 2.5-7 5.5z" fill="${hair}"/>`);
  // Face.
  const ey = 27;
  if (beard) parts.push(`<path d="M23 30c1 7 4.5 9 9 9s8-2 9-9c-2 3-5 4-9 4s-7-1-9-4z" fill="${hair}"/>`);
  parts.push(`<path d="M26.5 ${ey}h3.2M34.3 ${ey}h3.2" stroke="#1a1410" stroke-width="1.6" stroke-linecap="round"/>`);
  parts.push(`<path d="M26 ${ey - 3.2}l3.8-.6M38 ${ey - 3.2}l-3.8-.6" stroke="${hair}" stroke-width="1.4" stroke-linecap="round"/>`);
  parts.push(`<path d="M32 ${ey + 1}l-1.2 4.5h2" stroke="#000" stroke-opacity=".3" stroke-width="1" fill="none"/>`);
  parts.push(`<path d="M29 ${ey + 8.5}c2 .8 4 .8 6 0" stroke="#6a3b2e" stroke-width="1.2" fill="none" stroke-linecap="round"/>`);
  if (tache) parts.push(`<path d="M28 ${ey + 6.8}c2-1.5 6-1.5 8 0-1.5.8-6.5.8-8 0z" fill="${hair}"/>`);
  if (female) parts.push(`<path d="M29.5 ${ey + 8.4}c1.7.9 3.3.9 5 0" stroke="#9b2f2f" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
  if (glasses === 'round') parts.push(`<g fill="none" stroke="#111" stroke-width="1.1"><circle cx="28.1" cy="${ey}" r="3"/><circle cx="35.9" cy="${ey}" r="3"/><path d="M31.1 ${ey}h1.8"/></g>`);
  if (glasses === 'square') parts.push(`<g fill="#000" fill-opacity=".12" stroke="#111" stroke-width="1.1"><rect x="24.6" y="${ey - 2.6}" width="6.4" height="5" rx="1"/><rect x="33" y="${ey - 2.6}" width="6.4" height="5" rx="1"/><path d="M31 ${ey}h2" fill="none"/></g>`);
  // Chiaroscuro: shadow the right side of the face.
  parts.push(`<ellipse cx="32" cy="27" rx="${headW}" ry="12" fill="url(#${uid}sh)"/>`);
  // Hats.
  const hc = r.pick(['#1f1c19', '#3a3229', '#4a4740', '#2b2f38', '#5b4a35']);
  if (hat === 'fedora') parts.push(`<path d="M14 21c4 2.5 32 2.5 36 0-3 3-32 3-36 0z" fill="${hc}"/><path d="M14.5 20.5c6 2.5 29 2.5 35 0l-2.5 1.8c-8 1.6-22 1.6-30 0z" fill="${hc}"/><path d="M21 20.5c0-6 3-10 11-10s11 4 11 10c-5 1-17 1-22 0z" fill="${hc}"/><path d="M24 12.5c3 1.6 13 1.6 16 0" stroke="#000" stroke-opacity=".4"/><path d="M21.2 18.6c6 1.2 15.6 1.2 21.6 0v1.7c-6 1.1-15.6 1.1-21.6 0z" fill="#000" opacity=".55"/><ellipse cx="32" cy="24" rx="11" ry="3.5" fill="#000" opacity=".28"/>`);
  if (hat === 'trilby') parts.push(`<path d="M17 21.5c5 2 25 2 30 0-1 2.5-29 2.5-30 0z" fill="${hc}"/><path d="M22 21c0-5 3-8.5 10-8.5S42 16 42 21c-5 1-15 1-20 0z" fill="${hc}"/><path d="M22.2 19.6c5 1 14.6 1 19.6 0v1.3c-5 .9-14.6.9-19.6 0z" fill="${r.pick(['#7a2a25', '#2d3d57', '#000'])}"/><ellipse cx="32" cy="23.5" rx="10.5" ry="3" fill="#000" opacity=".22"/>`);
  if (hat === 'bowler') parts.push(`<path d="M17.5 21.5c5 2 24 2 29 0" stroke="${hc}" stroke-width="3" stroke-linecap="round"/><path d="M22 21c0-6.5 4-10 10-10s10 3.5 10 10c-5 1-15 1-20 0z" fill="${hc}"/>`);
  if (hat === 'flatcap') parts.push(`<path d="M21 21c0-6 4.5-8.5 11-8.5 7 0 11.5 3 12 8.5 3 .4 5 1 5.5 2-7 1.2-21 .8-28.5-.5z" fill="${r.pick(['#5d5346', '#4c4a46', '#6a5a43'])}"/><ellipse cx="34" cy="23.5" rx="11" ry="2.6" fill="#000" opacity=".25"/>`);
  if (hat === 'ushanka') parts.push(`<path d="M19 23c0-9 5.5-13 13-13s13 4 13 13c-6-1.6-20-1.6-26 0z" fill="#3a3027"/><path d="M19 22c-3 1-3.5 9-1 13 2 .5 4 0 5-1-.5-4-1-8 0-11zM45 22c3 1 3.5 9 1 13-2 .5-4 0-5-1 .5-4 1-8 0-11z" fill="#4a3d31"/><path d="M20.5 19.5c6-2 17-2 23 0v3.5c-6-1.6-17-1.6-23 0z" fill="#5b4b3c"/><circle cx="32" cy="16" r="1.6" fill="#b3322a"/>`);
  if (hat === 'beret') parts.push(`<path d="M20 20c0-4.5 5-8 13-8 8 0 12.5 3 12.5 6.5 0 2-2.5 3-6 3.2-6 .4-14 .2-19.5-1.7z" fill="${r.pick(['#1e1e22', '#6d1f1f', '#2a3550'])}"/><path d="M32.5 12l.6-2.4" stroke="#111" stroke-width="1.4"/>`);
  if (hat === 'pillbox') parts.push(`<rect x="24" y="12" width="16" height="6" rx="2" fill="${r.pick(['#6d1f1f', '#1e1e22', '#c9b48a'])}"/>`);
  if (hat === 'scarf') parts.push(`<path d="M20 30c-1-11 4.5-17 12-17s13 6 12 17c-1.5-5-3-7-4-8-3-1.5-13-1.5-16 0-1 1-2.5 3-4 8z" fill="${r.pick(['#8c2f2a', '#c9b48a', '#3c4a5e', '#4e5a3a'])}"/><path d="M22 34c2 4 6 6 10 6s8-2 10-6l1 4c-3 4-8 5-11 5s-8-1-11-5z" fill="#000" opacity=".2"/>`);
  if (mood === 'dead') parts.push(`<rect width="64" height="64" fill="#000" opacity=".55"/><path d="M8 8l48 48" stroke="#b3322a" stroke-width="3"/>`);
  const out = parts.join('');
  cache.set(key, out);
  return out;
}

// The two spymasters, as silhouettes for the title and handoff screens.
// The two spymasters on the title screen: side profiles facing each other across the page.
// Control (Smiley) looks right: spectacles, collar and tie. Karla looks left: a cigarette in his mouth
// with smoke rising, and a gold lighter in his breast pocket (the hidden switch into Smiley mode).
const PROFILE = 'M96 30C74 30 58 44 58 64c0 16 6 30 16 40l-2 12c-16 4-28 10-36 20-10 14-16 36-18 60L12 260h180l-6-64c-2-28-10-48-22-60-10-10-24-16-38-20l-8-6c4-4 7-8 8-12l2-5 3-2-1-4 8-6-6-7c0-10-2-20-6-28-6-10-16-16-30-16z';
export const SPYMASTER = {
  control: `<svg viewBox="0 0 200 260" class="spymaster" aria-hidden="true">
    <defs><radialGradient id="cLamp" cx="55%" cy="38%" r="60%"><stop offset="0" stop-color="#4a8bd1" stop-opacity=".75"/><stop offset=".45" stop-color="#2f5f93" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="260" fill="url(#cLamp)"/>
    <path d="${PROFILE}" fill="#07090c" stroke="#8fb6e6" stroke-opacity=".75" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M118 111l5 13 7-9" fill="none" stroke="#8fb6e6" stroke-opacity=".6" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M120 116l7 1-1 6c2 12 6 24 11 34l-6 8c-6-12-9-26-10-42z" fill="#07090c" stroke="#8fb6e6" stroke-opacity=".75" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M78 116c18 14 32 34 44 62" fill="none" stroke="#8fb6e6" stroke-opacity=".35" stroke-width="1.3"/>
    <circle cx="122" cy="69" r="6.5" fill="none" stroke="#e8c77a" stroke-opacity=".85" stroke-width="1.7"/>
    <path d="M115.5 68.5L90 66" stroke="#e8c77a" stroke-opacity=".7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  karla: `<svg viewBox="0 0 200 260" class="spymaster" aria-hidden="true">
    <defs><radialGradient id="kLamp" cx="45%" cy="38%" r="60%"><stop offset="0" stop-color="#cf4234" stop-opacity=".75"/><stop offset=".45" stop-color="#6e1f1a" stop-opacity=".4"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="260" fill="url(#kLamp)"/>
    <g transform="matrix(-1 0 0 1 200 0)">
      <path d="${PROFILE}" fill="#0b0707" stroke="#ee8c82" stroke-opacity=".75" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M118 111l5 12 7-8" fill="none" stroke="#ee8c82" stroke-opacity=".55" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M78 116c18 14 32 34 44 62" fill="none" stroke="#ee8c82" stroke-opacity=".35" stroke-width="1.3"/>
      <path d="M112 64c4-2 9-2 12 0" stroke="#e86a4f" stroke-opacity=".45" stroke-width="1.5" fill="none"/>
      <path d="M128 147h22" stroke="#ee8c82" stroke-opacity=".45" stroke-width="1.3"/>
    </g>
    <path d="M70 91.5L50 95" stroke="#d9d2c4" stroke-opacity=".8" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="49" cy="95.2" r="2.2" fill="#f07a4a"/>
    <g class="smoke" fill="none" stroke="#c9c4bb" stroke-linecap="round">
      <path d="M48 92c-4-8 6-12 0-22s4-14 0-24"/><path d="M48 92c5-9-5-13 1-23s-4-15 1-25"/>
    </g>
    <g class="lighter-g" data-act="smiley"><title>A gold lighter</title><rect x="50" y="122" width="30" height="34" fill="transparent"/>
      <rect x="58" y="133" width="10" height="15" rx="1.5" fill="#e8c77a"/><rect x="58" y="129" width="10" height="4.5" rx="1" fill="#c9a24e"/>
      <path d="M60.5 138.5h5M60.5 142h3.5" stroke="#8a6d33" stroke-width=".8"/>
      <path class="lighter-flame" d="M63 120c2.6 2.6 2.8 5.2 0 8-2.8-2.8-2.6-5.4 0-8z" fill="#f4b04c"/></g>
    <path d="M50 147h22" stroke="#ee8c82" stroke-opacity=".55" stroke-width="1.4"/>
  </svg>`,
};
