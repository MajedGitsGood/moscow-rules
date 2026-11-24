// Inline SVG icon set: roles, orders, city landmarks, HUD glyphs. All drawn with currentColor so
// CSS decides the colour. 24x24 viewBox unless noted.
const svg = (body, vb = '0 0 24 24', cls = '') => `<svg class="ico ${cls}" viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ROLE_ICON = {
  scalphunter: svg('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>'),
  lamplighter: svg('<path d="M2 12c3-5 6.5-7.5 10-7.5S19 7 22 12c-3 5-6.5 7.5-10 7.5S5 17 2 12z"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>'),
  ferret: svg('<path d="M3 16l3-8 3 5 3-7 3 7 3-5 3 8"/><path d="M2.5 19h19"/>'),
  talentspotter: svg('<path d="M15 3v10.5a5 5 0 1 1-10 0v-1.5"/><path d="M3.5 13.5 5 11l1.5 2.5"/><circle cx="15" cy="3.5" r="1.6" fill="currentColor" stroke="none"/>'),
  unknown: svg('<path d="M9.2 9a3 3 0 1 1 4.2 2.8c-.9.4-1.4 1.1-1.4 2v.7"/><circle cx="12" cy="18" r=".9" fill="currentColor" stroke="none"/>'),
};

export const ORDER_ICON = {
  move: svg('<path d="M4 12h14M13 6l6 6-6 6"/>'),
  surveil: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>'),
  lielow: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  prepare: svg('<circle cx="12" cy="12" r="7.5" stroke-dasharray="3 2.6"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>'),
  strike: svg('<path d="M14.5 3.5 20.5 9.5 9 21l-3-.5-.5-3z"/><path d="M4 20l3-3"/><path d="M12.5 5.5l6 6"/>'),
  trap: svg('<path d="M3 15c0-4 4-7 9-7s9 3 9 7"/><path d="M6 15l1.5-3 1.5 3 1.5-3 1.5 3 1.5-3 1.5 3 1.5-3 1.5 3"/><path d="M2 18h20"/>'),
  approach: svg('<path d="M3 12l4-4 4 2 3-2 7 4"/><path d="M7 15l3 3 2-1 2 2 2-1 3-3"/><path d="M11 10l-3 3"/>'),
  vet: svg('<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.1-7.5 9.5-4.3-1.4-7.5-5-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  brief: svg('<rect x="3" y="5.5" width="18" height="13" rx="1"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>'),
  lie: svg('<path d="M3 7c3-2 6-2 9 0 3-2 6-2 9 0v3c0 5-4 9-9 9s-9-4-9-9z"/><path d="M7.5 11.5c1-.8 2-.8 3 0M13.5 11.5c1-.8 2-.8 3 0"/><path d="M9.5 15.5c1.5 1 3.5 1 5 0"/>'),
  execute: svg('<circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/>'),
};

export const UI_ICON = {
  flag: svg('<path d="M5 21V4"/><path d="M5 4.5c4-2 7 2 14 0v9c-7 2-10-2-14 0" fill="currentColor" fill-opacity=".15"/>'),
  book: svg('<path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4z"/><path d="M20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z"/>'),
  traffic: svg('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M7 9h10M7 13h10M7 17h6"/>'),
  skull: svg('<path d="M5 11a7 7 0 1 1 14 0c0 2.2-1 3.7-2.5 4.6V19H7.5v-3.4C6 14.7 5 13.2 5 11z"/><circle cx="9.3" cy="11" r="1.6" fill="currentColor" stroke="none"/><circle cx="14.7" cy="11" r="1.6" fill="currentColor" stroke="none"/><path d="M10.5 19v-2M13.5 19v-2"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  shuffle: svg('<path d="M3 7h4c4 0 6 10 10 10h4M18 14l3 3-3 3M3 17h4c1.5 0 2.7-1.3 3.7-3M14 7h7M18 4l3 3-3 3"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
};

// City landmarks, drawn as small silhouettes for the map medallions (40x40 viewBox, filled).
const L = (d) => `<svg class="landmark" viewBox="0 0 40 40" aria-hidden="true"><g fill="currentColor">${d}</g></svg>`;
export const LANDMARK_ICON = {
  clock: L('<rect x="16" y="9" width="8" height="25"/><path d="M15 9l5-6 5 6z"/><circle cx="20" cy="15" r="2.6" fill="var(--medal)"/><rect x="11" y="27" width="18" height="7"/><rect x="8" y="34" width="24" height="2"/>'),
  onion: L('<path d="M20 4c-5 5-7 8-7 11 0 3 3 5 7 5s7-2 7-5c0-3-2-6-7-11z"/><rect x="19.3" y="1" width="1.4" height="4"/><rect x="14" y="20" width="12" height="14"/><path d="M8 24c-2.5 2.5-3.5 4-3.5 5.5h7c0-1.5-1-3-3.5-5.5zM32 24c-2.5 2.5-3.5 4-3.5 5.5h7c0-1.5-1-3-3.5-5.5z"/><rect x="5" y="29" width="6" height="5"/><rect x="29" y="29" width="6" height="5"/><rect x="3" y="34" width="34" height="2"/>'),
  tower: L('<path d="M20 2l2 10h-4z"/><path d="M17.5 12h5l2 9h-9z"/><path d="M15.5 21h9l5 13h-4.5c-1-4-3-6-5-6s-4 2-5 6h-4.5z"/><rect x="8" y="34" width="24" height="2"/>'),
  tram: L('<rect x="7" y="14" width="26" height="15" rx="2"/><rect x="10" y="17" width="5" height="5" fill="var(--medal)"/><rect x="17.5" y="17" width="5" height="5" fill="var(--medal)"/><rect x="25" y="17" width="5" height="5" fill="var(--medal)"/><path d="M20 14l-3-6h6z"/><path d="M14 8h12" stroke="currentColor" stroke-width="1.4"/><circle cx="13" cy="31" r="2.4"/><circle cx="27" cy="31" r="2.4"/><rect x="4" y="34" width="32" height="2"/>'),
  peak: L('<path d="M3 34l12-22 5 8 4-6 13 20z"/><path d="M15 12l3 5.5-3-1.5-2.5 2z" fill="var(--medal)"/><rect x="3" y="34" width="34" height="2"/>'),
  gate: L('<rect x="6" y="12" width="28" height="4"/><path d="M15 6h10l2 6H13z"/><rect x="7" y="16" width="3.5" height="18"/><rect x="13.2" y="16" width="3.5" height="18"/><rect x="23.3" y="16" width="3.5" height="18"/><rect x="29.5" y="16" width="3.5" height="18"/><rect x="4" y="34" width="32" height="2"/>'),
  wheel: L('<circle cx="20" cy="17" r="12" fill="none" stroke="currentColor" stroke-width="2"/><g stroke="currentColor" stroke-width="1.2"><path d="M20 5v24M8 17h24M11.5 8.5l17 17M28.5 8.5l-17 17"/></g><circle cx="20" cy="17" r="2.5"/><path d="M14 34l6-17 6 17z"/><rect x="6" y="34" width="28" height="2"/>'),
  cathedral: L('<path d="M20 3c-4 0-6 3-6 6v4h12V9c0-3-2-6-6-6z"/><rect x="19.3" y="0.5" width="1.4" height="3"/><rect x="12" y="13" width="16" height="21"/><path d="M6 22c0-2 1.5-3.5 3-3.5s3 1.5 3 3.5zM28 22c0-2 1.5-3.5 3-3.5s3 1.5 3 3.5z"/><rect x="6" y="22" width="6" height="12"/><rect x="28" y="22" width="6" height="12"/><rect x="14.5" y="16" width="11" height="2"/><rect x="3" y="34" width="34" height="2"/>'),
  columns: L('<path d="M5 12l15-7 15 7z"/><rect x="5" y="12" width="30" height="3"/><rect x="7.5" y="15" width="3" height="16"/><rect x="14" y="15" width="3" height="16"/><rect x="20.5" y="15" width="3" height="16"/><rect x="27" y="15" width="3" height="16"/><rect x="5" y="31" width="30" height="3"/><rect x="3" y="34" width="34" height="2"/>'),
  minaret: L('<path d="M20 9c-5 0-8 4-8 8h16c0-4-3-8-8-8z"/><rect x="10" y="17" width="20" height="17"/><rect x="5" y="7" width="3" height="27"/><path d="M6.5 1l2 6h-4z"/><rect x="32" y="7" width="3" height="27"/><path d="M33.5 1l2 6h-4z"/><rect x="19.3" y="5" width="1.4" height="4"/><rect x="2" y="34" width="36" height="2"/>'),
  colosseum: L('<path d="M4 13c0-4 7-7 16-7s16 3 16 7v21H4z"/><g fill="var(--medal)"><path d="M7 21v-4a1.5 1.5 0 0 1 3 0v4zM13 21v-4a1.5 1.5 0 0 1 3 0v4zM19 21v-4a1.5 1.5 0 0 1 3 0v4zM25 21v-4a1.5 1.5 0 0 1 3 0v4zM31 21v-4a1.5 1.5 0 0 1 3 0v4zM7 30v-4a1.5 1.5 0 0 1 3 0v4zM13 30v-4a1.5 1.5 0 0 1 3 0v4zM19 30v-4a1.5 1.5 0 0 1 3 0v4zM25 30v-4a1.5 1.5 0 0 1 3 0v4zM31 30v-4a1.5 1.5 0 0 1 3 0v4z"/></g><rect x="2" y="34" width="36" height="2"/>'),
  fortress: L('<rect x="4" y="20" width="32" height="14"/><path d="M4 17h4v3H4zM11 17h4v3h-4zM25 17h4v3h-4zM32 17h4v3h-4z"/><rect x="14" y="9" width="12" height="25"/><path d="M14 6h3v3h-3zM18.5 6h3v3h-3zM23 6h3v3h-3z"/><path d="M17.5 34v-6a2.5 2.5 0 0 1 5 0v6z" fill="var(--medal)"/><rect x="2" y="34" width="36" height="2"/>'),
  kasbah: L('<rect x="5" y="9" width="30" height="25"/><path d="M5 5h4v4H5zM12 5h4v4h-4zM24 5h4v4h-4zM31 5h4v4h-4z"/><path d="M14 34V21a6 6 0 1 1 12 0v13z" fill="var(--medal)"/><rect x="2" y="34" width="36" height="2"/>'),
};

// For embedding inside another SVG, where CSS sizes don't apply: give the icon explicit geometry.
export const sized = (icon, px, x = -px / 2, y = -px / 2) => icon.replace('<svg class="ico', `<svg x="${x}" y="${y}" width="${px}" height="${px}" class="ico`);
