// The game's vocabulary. Internally (rules, prompts, Claude's own writing) the game speaks le Carré:
// Control and Karla, Scalphunters and Lamplighters, joes and the Circus. On screen it speaks plain
// language by default, and le Carré only in Smiley mode (the hidden gold lighter on the title screen).
// Everything rendered passes through lexHTML(), so engine messages, Claude's reports and the debrief
// are translated too, not just the labels.
//
// When this vocabulary changes, also update the shareable highlight page and thread
// (docs/the-berlin-draw.html, docs/the-berlin-draw-thread.md) and republish the page. See CLAUDE.md.

const KEY = 'mr-lexicon';
let mode = (() => { try { return localStorage.getItem(KEY) === 'smiley' ? 'smiley' : 'plain'; } catch { return 'plain'; } })();
export const lexMode = () => mode;
export function setLexMode(m) { mode = m === 'smiley' ? 'smiley' : 'plain'; try { localStorage.setItem(KEY, mode); } catch {} }

export const GAME_NAME = { plain: 'Spymaster', smiley: 'Moscow Rules' };
export const gameName = () => GAME_NAME[mode];

// The plain vocabulary, as [le Carré term, plain term]. Order matters: longer phrases first.
// Each is matched on word boundaries; a capitalised source keeps its capital in the result.
export const TERMS = [
  ['MOSCOW RULES', 'SPYMASTER'], ['Moscow Rules', 'Spymaster'],
  ['Moscow Centre', 'the KGB'], ['the Circus', 'MI6'], ['The Circus', 'MI6'], ['Circus', 'MI6'],
  ["Centre's", "the KGB's"], ['Centre', 'the KGB'],
  ['CONTROL', 'MI6'], ['Control', 'MI6'], ['KARLA', 'KGB'], ['Karla', 'the KGB'],
  ['Scalphunters', 'Assassins'], ['Scalphunter', 'Assassin'], ['scalphunters', 'Assassins'], ['scalphunter', 'Assassin'],
  ['Lamplighters', 'Watchers'], ['Lamplighter', 'Watcher'], ['lamplighters', 'Watchers'], ['lamplighter', 'Watcher'],
  ['Ferrets', 'Counterspies'], ['Ferret', 'Counterspy'], ['ferrets', 'Counterspies'], ['ferret', 'Counterspy'],
  ['Talent-spotters', 'Recruiters'], ['Talent-spotter', 'Recruiter'], ['talent-spotters', 'Recruiters'], ['talent-spotter', 'Recruiter'],
  ['joes', 'agents'], ['joe', 'agent'], ['the Cousins', 'the CIA'], ['Cousins', 'CIA'],
  ['pavement artists', 'surveillance teams'], ['lamplighting', 'surveillance'], ['lamplit', 'watched'], ['lamplight', 'watch'],
  ['burrowers', 'researchers'], ['babysitters', 'bodyguards'],
  ['Station reports', 'HQ reports'], ['Field Manual', 'How to play'], ['Traffic', 'Reports'], ['traffic', 'reports'],
];
const RULES = TERMS.map(([from, to]) => [new RegExp(`(^|[^A-Za-z-])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z-])`, 'g'), to]);

// Translate a piece of plain text (no markup).
export function lex(text) {
  if (mode === 'smiley' || !text) return text;
  let s = String(text);
  // A name standing alone (a label or a heading) takes no article: "KGB", not "the KGB".
  const alone = s.trim();
  if (alone === 'Karla' || alone === 'Moscow Centre') return s.replace(alone, 'KGB');
  for (const [re, to] of RULES) s = s.replace(re, (m, pre) => pre + to);
  // Tidy the grammar the swaps can leave behind.
  return s.replace(/\bthe the KGB/gi, 'the KGB').replace(/(^|[.!?]\s+)the KGB/g, (m, pre) => `${pre}The KGB`);
}

// Translate rendered HTML: text between tags, and the readable attributes (tooltips, labels,
// placeholders). Tags, classes and data attributes are left alone.
export function lexHTML(html) {
  if (mode === 'smiley' || !html) return html;
  return String(html).split(/(<[^>]*>)/).map((part) => {
    if (!part.startsWith('<')) return lex(part);
    return part.replace(/\b(title|aria-label|placeholder|alt)="([^"]*)"/g, (m, attr, val) => `${attr}="${lex(val)}"`);
  }).join('');
}

// Labels the global swap can't handle safely (a word that also means something else on screen).
export const label = (smiley, plain) => (mode === 'smiley' ? smiley : plain);

// Single letters on the side crests.
export const crest = (side) => (mode === 'smiley' ? (side === 'control' ? 'C' : 'K') : side === 'control' ? 'M' : 'K');
