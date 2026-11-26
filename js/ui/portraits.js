// Procedural noir portraits: every agent gets a deterministic bust from their look seed, with one
// distinguishing trait. Pure SVG strings, cached by agent id.
import { makeRng } from '../rng.js';
import { traitFor } from '../world.js';

const SKIN = ['#efd2b4', '#e2b896', '#cf9f7a', '#ad7b58', '#875a3f', '#f3dcc6'];
const HAIR = ['#1b1714', '#2a1f17', '#33251b', '#4a3322', '#5a3d26'];
const GREY = '#c4c0b8', SCARF = '#5a5650';
const COAT = ['#8a7856', '#2a2b30', '#4f5157', '#25304a', '#553d2c', '#6d6a5e', '#3b2f2a'];
const BG = { control: ['#24476e', '#0d1826'], karla: ['#6e2420', '#1a0b0a'] };
const cache = new Map();

export function portrait(agent, { size = 64, mood = null } = {}) {
  return `<svg class="portrait" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${portraitBody(agent, mood)}</svg>`;
}

// The portrait's inner markup, for embedding inside another SVG.
// Everyone is drawn from the same plain template (bareheaded, dark hair, coat and tie) plus exactly
// one ordinary trait (world.js TRAITS): spectacles, a moustache, a beard, a hat brim, grey hair, a
// headscarf or a bald crown. Drawn heavy enough to read on a 22px map token; spies aren't meant to be
// memorable, so nothing more.
export function portraitBody(agent, mood = null) {
  const trait = traitFor(agent.look);
  const key = `${agent.id}:${agent.look.seed}:${trait}:${mood}`;
  if (cache.has(key)) return cache.get(key);
  const r = makeRng(agent.look.seed);
  const female = agent.look.female;
  const skin = r.pick(SKIN), coat = r.pick(COAT);
  const hair = trait === 'grey' ? GREY : r.pick(HAIR);
  const [bg1, bg2] = BG[agent.side];
  const uid = `p${agent.id}${agent.look.seed % 9973}`;
  const collarUp = r() < 0.45;
  const tie = r.pick(['#5a1d1d', '#1d2a44', '#2a2a2a', '#4a3b1d']);
  const headW = female ? 9.2 : 10;
  const ink = '#14100d';

  const parts = [];
  parts.push(`<defs><radialGradient id="${uid}bg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></radialGradient>
    <linearGradient id="${uid}sh" x1="0" x2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity=".38"/></linearGradient></defs>`);
  parts.push(`<rect width="64" height="64" fill="url(#${uid}bg)"/>`);
  // Long hair behind the head.
  if (female && trait !== 'headscarf') parts.push(`<path d="M21 26c0-9 5-14 11-14s11 5 11 14v14c-3 2-19 2-22 0z" fill="${hair}"/>`);
  // Shoulders, shirt, tie, lapels.
  parts.push(`<path d="M6 64c1.5-12 10-18 26-18s24.5 6 26 18z" fill="${coat}"/>`);
  parts.push(`<path d="M27 46l5 9 5-9z" fill="#e9e4da"/><path d="M31 49h2l1 9-2 3-2-3z" fill="${tie}"/>`);
  parts.push(collarUp
    ? `<path d="M18 50l7-8 5 6-5 12zM46 50l-7-8-5 6 5 12z" fill="${coat}" stroke="#000" stroke-opacity=".25"/>`
    : `<path d="M20 52l7-6 4 12-6 6zM44 52l-7-6-4 12 6 6z" fill="${coat}" stroke="#000" stroke-opacity=".25"/>`);
  // Neck and head.
  parts.push(`<rect x="28.5" y="36" width="7" height="10" fill="${skin}"/><rect x="28.5" y="36" width="7" height="10" fill="#000" opacity=".18"/>`);
  parts.push(`<ellipse cx="32" cy="27" rx="${headW}" ry="12" fill="${skin}"/>`);
  // Hair on top.
  if (!female && trait === 'bald') parts.push(`<path d="M22.2 28c-.6-3 0-5 1.3-6.5l1.6 5.5zM41.8 28c.6-3 0-5-1.3-6.5l-1.6 5.5z" fill="${hair}"/><ellipse cx="29" cy="17.5" rx="4" ry="1.6" fill="#fff" opacity=".28"/>`);
  else if (!female && trait !== 'hat') parts.push(`<path d="M22 24c0-8 4.5-11.5 10-11.5S42 16 42 24c-2-4-5-6-10-6s-8 2-10 6z" fill="${hair}"/>`);
  if (female && trait !== 'headscarf') parts.push(`<path d="M22.5 25c0-8 4-12 9.5-12s9.5 4 9.5 12c-3-5-7-6.5-12-5.5-3 .5-5 2.5-7 5.5z" fill="${hair}"/>`);
  // Face.
  const ey = 27;
  if (trait === 'beard') parts.push(`<path d="M22.5 28c.5 8 4.5 11.5 9.5 11.5s9-3.5 9.5-11.5c-2 3.5-5 5-9.5 5s-7.5-1.5-9.5-5z" fill="${hair}"/>`);
  parts.push(`<path d="M26.5 ${ey}h3.2M34.3 ${ey}h3.2" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`);
  parts.push(`<path d="M26 ${ey - 3.2}l3.8-.6M38 ${ey - 3.2}l-3.8-.6" stroke="${hair}" stroke-width="1.5" stroke-linecap="round"/>`);
  parts.push(`<path d="M32 ${ey + 1}l-1.2 4.5h2" stroke="#000" stroke-opacity=".3" stroke-width="1" fill="none"/>`);
  if (trait !== 'beard') parts.push(`<path d="M29 ${ey + 8.5}c2 .8 4 .8 6 0" stroke="#6a3b2e" stroke-width="1.2" fill="none" stroke-linecap="round"/>`);
  if (trait === 'moustache') parts.push(`<path d="M26.8 ${ey + 7.4}c2.4-2.6 8-2.6 10.4 0-2.4 1.4-8 1.4-10.4 0z" fill="${hair}"/>`);
  if (female && trait !== 'beard') parts.push(`<path d="M29.5 ${ey + 8.4}c1.7.9 3.3.9 5 0" stroke="#9b2f2f" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
  if (trait === 'glasses') parts.push(`<g fill="#fff" fill-opacity=".08" stroke="${ink}" stroke-width="1.7"><circle cx="28" cy="${ey}" r="3.2"/><circle cx="36" cy="${ey}" r="3.2"/><path d="M31.2 ${ey}h1.6M24.8 ${ey}h-2.4M39.2 ${ey}h2.4" fill="none"/></g>`);
  // Chiaroscuro: shadow the right side of the face.
  parts.push(`<ellipse cx="32" cy="27" rx="${headW}" ry="12" fill="url(#${uid}sh)"/>`);
  // Headwear.
  if (trait === 'hat' && !female) parts.push(`<path d="M13 21.5c5 3 33 3 38 0-1.5 3.2-35 3.2-38 0z" fill="${ink}"/><path d="M21 21c0-6.5 3-10.5 11-10.5S43 14.5 43 21c-5 1.2-17 1.2-22 0z" fill="${ink}"/><path d="M21.2 18.8c6 1.2 15.6 1.2 21.6 0v1.8c-6 1.1-15.6 1.1-21.6 0z" fill="#000" opacity=".6"/><ellipse cx="32" cy="24.2" rx="11" ry="3.4" fill="#000" opacity=".3"/>`);
  if (trait === 'hat' && female) parts.push(`<path d="M19 20c0-5 5.5-8.5 13.5-8.5S46 14.5 46 18.5c0 2.2-2.6 3.3-6.4 3.5-6.4.4-14.6.2-20.6-2z" fill="${ink}"/><path d="M33 11.6l.6-2.6" stroke="${ink}" stroke-width="1.6"/>`);
  if (trait === 'headscarf') parts.push(`<path d="M20 31c-1.2-12 4.5-18 12-18s13.2 6 12 18c-1.5-5-3-7.5-4-8.5-3-1.5-13-1.5-16 0-1 1-2.5 3.5-4 8.5z" fill="${SCARF}"/><path d="M21.5 33c2 5 6 7.5 10.5 7.5s8.5-2.5 10.5-7.5l1 4.5c-3 4-8 5.5-11.5 5.5s-8.5-1.5-11.5-5.5z" fill="${SCARF}"/><path d="M21.5 33c2 5 6 7.5 10.5 7.5s8.5-2.5 10.5-7.5l1 4.5c-3 4-8 5.5-11.5 5.5s-8.5-1.5-11.5-5.5z" fill="#000" opacity=".25"/>`);
  if (mood === 'dead') parts.push(`<rect width="64" height="64" fill="#000" opacity=".55"/><path d="M8 8l48 48" stroke="#b3322a" stroke-width="3"/>`);
  const out = parts.join('');
  cache.set(key, out);
  return out;
}

// The two spymasters on the title screen, in as few lines as possible: one unbroken silhouette each
// (head, neck and body in a single outline, so the neck always meets the collar), bodies turned
// three-quarters to the player, heads in profile facing each other. Control (Smiley) looks right:
// gold spectacles, lapels and a full-length tie. Karla looks left: collar up, a cigarette with smoke
// rising, and a gold lighter poking out of his hip pocket (the hidden switch into Smiley mode).
// Both are drawn facing right; Karla's figure is mirrored.
const FIGURE = 'M96 28C74 28 58 42 58 62c0 14 5 26 14 35L71 110C52 116 30 126 20 148C11 170 10 214 8 260H192C191 218 189 178 181 156C173 136 155 124 132 118L110 113L109 106c5-1 11-4 15-8l2-5 3-2-1-4 7-6-6-7c0-11-2-22-7-30-6-10-14-16-28-16z';
const C = '#8fb6e6', K = '#ee8c82';
const outline = (col) => `fill="none" stroke="${col}" stroke-opacity=".75" stroke-width="1.6" stroke-linejoin="round"`;
export const SPYMASTER = {
  control: `<svg viewBox="0 0 200 260" class="spymaster" aria-hidden="true">
    <path d="${FIGURE}" fill="#07090c" stroke="${C}" stroke-opacity=".75" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M74 114l17 86 17-81" ${outline(C)} stroke-opacity=".4" stroke-width="1.3"/>
    <path d="M86.5 114h9l-1.8 8h-5.4zM88.3 122h5.4l2.3 70-4.5 7.5-4.5-7.5z" fill="#07090c" stroke="${C}" stroke-opacity=".85" stroke-width="1.3" stroke-linejoin="round"/>
    <circle cx="122" cy="67" r="6.5" fill="none" stroke="#e8c77a" stroke-opacity=".9" stroke-width="1.7"/>
    <path d="M115.5 66.5L90 64" stroke="#e8c77a" stroke-opacity=".7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  karla: `<svg viewBox="0 0 200 260" class="spymaster" aria-hidden="true">
    <g transform="matrix(-1 0 0 1 200 0)">
      <path d="${FIGURE}" fill="#0b0707" stroke="${K}" stroke-opacity=".75" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M74 100l-12 32 34-16M110 106l24 22-22-8" ${outline(K)} stroke-opacity=".55" stroke-width="1.3"/>
      <path d="M112 64c4-2 9-2 12 0" stroke="#e86a4f" stroke-opacity=".45" stroke-width="1.5" fill="none"/>
      <path d="M131 92.5L152 96" stroke="#d9d2c4" stroke-opacity=".85" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="153" cy="96.2" r="2.2" fill="#f07a4a"/>
      <g class="smoke" fill="none" stroke="#c9c4bb" stroke-linecap="round"><path d="M154 93c-4-8 6-12 0-22s4-14 0-24"/><path d="M154 93c5-9-5-13 1-23s-4-15 1-25"/></g>
      <g class="lighter-g" data-act="smiley"><title>A gold lighter</title><rect x="36" y="196" width="48" height="44" fill="transparent"/>
        <g transform="rotate(8 58 218)"><rect x="53" y="207" width="11" height="16" rx="1.5" fill="#e8c77a"/><rect x="53" y="203" width="11" height="4.8" rx="1" fill="#c9a24e"/></g>
        <path class="lighter-flame" d="M57 193c2.6 2.6 2.8 5.2 0 8-2.8-2.8-2.6-5.4 0-8z" fill="#f4b04c"/>
        <path d="M40 220l38-3 1 7-38 3z" fill="#0b0707" stroke="${K}" stroke-opacity=".6" stroke-width="1.3" stroke-linejoin="round"/></g>
    </g>
  </svg>`,
};
