// Static game data and world generation: cities, roles, rules, rosters.
export const SIDES = ['control', 'karla'];
export const other = (side) => (side === 'control' ? 'karla' : 'control');
export const SIDE_LABEL = { control: 'Control', karla: 'Karla' };

export const HOME = { London: 'control', Moscow: 'karla' };
// Spread-out pool so cities never crowd each other on the map.
const CONTESTED_POOL = ['Paris', 'Lisbon', 'Bern', 'Berlin', 'Vienna', 'Helsinki', 'Athens', 'Istanbul'];

export const LANDMARK = {
  London: 'clock', Moscow: 'onion', Paris: 'tower', Lisbon: 'tram', Bern: 'peak', Berlin: 'gate',
  Vienna: 'wheel', Helsinki: 'cathedral', Athens: 'columns', Istanbul: 'minaret',
};

export const ARCHETYPES = {
  scalphunter: { label: 'Scalphunter', short: 'SH', power: 'Strikes without preparing: no warning for the other side.' },
  lamplighter: { label: 'Lamplighter', short: 'LL', power: 'The only one who can surveil: learns every role in the city. Always notices preparations, traps and attacks.' },
  ferret: { label: 'Ferret', short: 'FE', power: 'Traps work the same night. Keeps your agents in its city safe from approaches. Notices surveillance. Vets your own agents.' },
  talentspotter: { label: 'Talent-spotter', short: 'TS', power: 'Turns an enemy agent after two approaches, unseen. Cannot kill or set traps.' },
};
export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

export const RULES = {
  weeks: 12,
  roster: { scalphunter: 2, lamplighter: 3, ferret: 3, talentspotter: 2 }, // 10 agents per side
  maxPerCityAtSetup: 3,
  ordersPerWeek: 5,
  approachesToTurn: 2,
  noticeChance: 0.5,      // chance a non-Lamplighter notices a preparation, trap or attack in its city
  contestedCities: 4,
};

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
const FEMALE = new Set(['Anna', 'Connie', 'Ilse', 'Ruth', 'Clara', 'Olga', 'Marta', 'Irina', 'Eva', 'Nadia', 'Vera']);
const COVERS = ['trade attaché', 'journalist', 'professor', 'chauffeur', 'banker', 'translator', 'photographer',
  'cultural attaché', 'chess coach', 'wine merchant', 'priest', 'nurse', 'engineer', 'art dealer', 'embassy clerk',
  'pianist', 'travel agent', 'film critic', 'airline steward', 'shipping clerk'];

export function generateWorld(rng) {
  const contested = rng.shuffle(CONTESTED_POOL).slice(0, RULES.contestedCities);
  const cities = ['London', ...contested, 'Moscow'];
  const covers = rng.shuffle(COVERS);
  const agents = {};
  let c = 0;
  for (const side of SIDES) {
    const surnames = rng.shuffle(NAMES[side]);
    const firsts = rng.shuffle(FIRST[side]);
    let i = 0;
    for (const arch of ARCHETYPE_KEYS) {
      for (let k = 0; k < RULES.roster[arch]; k++) {
        const id = `${side[0]}${i}`;
        const first = firsts[i % firsts.length];
        agents[id] = {
          id, side, name: surnames[i], first, archetype: arch,
          cover: covers[c++ % covers.length],
          look: { seed: rng.int(1e9), female: FEMALE.has(first) },
          city: null, alive: true, turnedBy: null, sleeper: false,
          prep: null, eliminated: null, history: [],
        };
        i++;
      }
    }
  }
  return { cities, agents };
}
