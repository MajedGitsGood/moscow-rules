// World generation and static game data: cities, archetypes, rosters.
export const SIDES = ['control', 'karla'];
export const other = (side) => (side === 'control' ? 'karla' : 'control');
export const SIDE_LABEL = { control: 'Control', karla: 'Karla' };

// x/y are positions on the 1000x620 SVG map (rough Europe projection).
export const CITY_DATA = {
  London:   { x: 250, y: 250, home: 'control' },
  Moscow:   { x: 900, y: 205, home: 'karla' },
  Berlin:   { x: 495, y: 245 },
  Vienna:   { x: 545, y: 340 },
  Prague:   { x: 515, y: 295 },
  Budapest: { x: 600, y: 360 },
  Bern:     { x: 410, y: 370 },
  Istanbul: { x: 760, y: 500 },
  Helsinki: { x: 680, y: 95 },
  Lisbon:   { x: 70,  y: 520 },
  Paris:    { x: 315, y: 320 },
  Athens:   { x: 650, y: 560 },
};
const CONTESTED_POOL = ['Berlin', 'Vienna', 'Prague', 'Budapest', 'Bern', 'Istanbul', 'Helsinki', 'Lisbon', 'Paris', 'Athens'];

export const ARCHETYPES = {
  scalphunter: {
    label: 'Scalphunter',
    short: 'SH',
    does: 'Strike: assassinate an enemy agent in the same city.',
    beats: ['lamplighter', 'talentspotter'],
    losesTo: 'ferret',
  },
  lamplighter: {
    label: 'Lamplighter',
    short: 'LL',
    does: 'Watch reveals archetypes. Expose: burn an enemy Ferret in the same city.',
    beats: ['ferret'],
    losesTo: 'scalphunter',
  },
  ferret: {
    label: 'Ferret',
    short: 'FE',
    does: 'Guards the city: enemy Strikes there fail and the Scalphunter is caught. Blocks Recruits. Notices anyone who Watches the city.',
    beats: ['scalphunter'],
    losesTo: 'lamplighter',
  },
  talentspotter: {
    label: 'Talent-spotter',
    short: 'TS',
    does: 'Recruit: try to turn an enemy agent in the same city.',
    beats: [],
    losesTo: 'everyone',
  },
};
export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

export const RULES = {
  weeks: 12,
  perArchetype: 2,          // 8 agents per side
  maxPerCityAtSetup: 3,
  cablesPerWeek: 3,
  watchesPerWeek: 2,
  recruitsPerWeek: 1,
  recruitsPerGame: 3,
  recruitChance: 0.5,
  sleeperChance: 0.5,       // chance each side starts with one agent already turned by the other
  contestedCities: 4,
};

// Field-agent names. Control runs a mixed bag of British and European joes; Karla's are drawn
// from across the Eastern bloc. Names are generic, not taken from the novels.
const NAMES = {
  control: ['Hale', 'Ashby', 'Wren', 'Corder', 'Pell', 'Marsh', 'Tilley', 'Brandt', 'Fenwick', 'Osgood',
    'Lacey', 'Draycott', 'Vance', 'Holloway', 'Kemble', 'Thorne', 'Rudd', 'Sefton', 'Quayle', 'Avery'],
  karla: ['Petrov', 'Kral', 'Novak', 'Zorin', 'Bakov', 'Lenski', 'Dvorak', 'Molnar', 'Vasko', 'Orlov',
    'Kadar', 'Ruzicka', 'Yelin', 'Strasky', 'Gorev', 'Halas', 'Mirek', 'Tamas', 'Sokol', 'Brodsky'],
};
const FIRST = {
  control: ['Peter', 'Anna', 'Jim', 'Connie', 'Toby', 'Sam', 'Ilse', 'Max', 'Ruth', 'Ben', 'Clara', 'Guy'],
  karla: ['Ivan', 'Olga', 'Lev', 'Marta', 'Pavel', 'Irina', 'Jiri', 'Eva', 'Tibor', 'Nadia', 'Oleg', 'Vera'],
};

export function generateWorld(rng) {
  const contested = rng.shuffle(CONTESTED_POOL).slice(0, RULES.contestedCities);
  const cities = ['London', ...contested, 'Moscow'];
  const agents = {};
  for (const side of SIDES) {
    const surnames = rng.shuffle(NAMES[side]);
    const firsts = rng.shuffle(FIRST[side]);
    let i = 0;
    for (const arch of ARCHETYPE_KEYS) {
      for (let k = 0; k < RULES.perArchetype; k++) {
        const id = `${side[0]}${i}`;
        agents[id] = {
          id,
          side,
          name: surnames[i],
          first: firsts[i % firsts.length],
          archetype: arch,
          city: null,
          alive: true,
          turnedBy: null,
          eliminated: null, // {week, how, by}
          history: [],
        };
        i++;
      }
    }
  }
  return { cities, agents };
}
