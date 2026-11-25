// Static game data and world generation: cities, roles, rules, rosters.
export const SIDES = ['control', 'karla'];
export const other = (side) => (side === 'control' ? 'karla' : 'control');
export const SIDE_LABEL = { control: 'Control', karla: 'Karla' };

export const HOME = { London: 'control', Moscow: 'karla' };
// Spread-out pool so cities never crowd each other on the map.
const CONTESTED_POOL = ['Lisbon', 'Tangier', 'Rome', 'Berlin', 'Vienna', 'Belgrade', 'Helsinki', 'Istanbul'];
// Neighbours too close on the map for both sets of agents to fit: never drawn in the same game.
const APART = [['Lisbon', 'Tangier'], ['Vienna', 'Belgrade']];

export const LANDMARK = {
  London: 'clock', Moscow: 'onion', Paris: 'tower', Lisbon: 'tram', Bern: 'peak', Berlin: 'gate',
  Vienna: 'wheel', Helsinki: 'cathedral', Athens: 'columns', Istanbul: 'minaret',
  Rome: 'colosseum', Belgrade: 'fortress', Tangier: 'kasbah',
};

// A named place in each city, for footprints ("has taken a room overlooking ...").
export const PLACE = {
  London: 'the clock tower', Moscow: "St Basil's", Paris: 'the Eiffel Tower', Lisbon: 'the tram depot', Bern: 'the Bundesplatz',
  Berlin: 'the Brandenburg Gate', Vienna: 'the Riesenrad', Helsinki: 'the cathedral', Athens: 'the Acropolis', Istanbul: 'the Blue Mosque',
  Rome: 'the Colosseum', Belgrade: 'the Kalemegdan fortress', Tangier: 'the kasbah gate',
};

// Footprints: what an agent's week looks like from across the street. The same sentences come from
// different orders, so a footprint is a clue, not a verdict. {e} the enemy seen, {t} a person, {place}.
export const FOOTPRINTS = {
  asking: '{e} has been asking about {t}.',
  shadowing: '{e} keeps turning up where {t} goes.',
  room: '{e} has taken a room overlooking {place}.',
  faces: 'Unfamiliar faces around {e} this week.',
  courier: '{e} met someone off the night train.',
  routine: '{e} keeps regular hours: café, embassy, home.',
};
// For each kind of week: the chance an enemy agent in the same city notices, and the odds of each
// footprint (weights out of 10). Lamplighters see prepare, trap and surveil for what they are.
// The Field Manual draws its table from this, so players see the same numbers the engine uses.
export const TELLS = {
  trapNext: { label: 'Set a trap for next week', notice: 1, signs: { room: 5, faces: 4, asking: 1 } },
  prepare: { label: 'Prepared a strike', notice: 0.5, signs: { asking: 4, shadowing: 4.5, room: 1.5 } },
  trapTonight: { label: 'Trapped tonight (Ferret)', notice: 0.5, signs: { room: 5, faces: 4, asking: 1 } },
  surveil: { label: 'Surveilled the city', notice: 1 / 3, signs: { room: 3.5, shadowing: 3, asking: 3.5 } },
  vet: { label: 'Vetted a colleague', notice: 1 / 3, signs: { asking: 6, courier: 4 } },
  arrive: { label: 'Arrived in the city', notice: 1 / 3, signs: { faces: 5, courier: 3, routine: 2 } },
  idle: { label: 'Nothing, or approached someone', notice: 0.25, signs: { routine: 6, courier: 3, asking: 1 } },
};

export const ARCHETYPES = {
  scalphunter: { label: 'Scalphunter', short: 'SH', power: 'Can strike without preparing first: no footprints beforehand.' },
  lamplighter: { label: 'Lamplighter', short: 'LL', power: 'The only one who can surveil: learns every role in the city. Sees preparations, traps and surveillance for what they are.' },
  ferret: { label: 'Ferret', short: 'FE', power: 'Can trap the same night. Keeps your agents in its city safe from approaches. Notices surveillance. Vets your own agents.' },
  talentspotter: { label: 'Talent-spotter', short: 'TS', power: 'Turns an enemy agent after two approaches, unseen. Cannot kill or set traps.' },
};
export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

export const RULES = {
  weeks: 12,
  roster: { scalphunter: 2, lamplighter: 3, ferret: 3, talentspotter: 2 }, // 10 agents per side
  maxPerCityAtSetup: 3,
  ordersPerWeek: 5,
  approachesToTurn: 2,
  noticeChance: 0.5,      // chance a non-Lamplighter witnesses an attack in its city (footprints: TELLS)
  notesPerReport: 3,      // an agent's weekly report carries at most this many observations
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
  const contested = [];
  for (const c of rng.shuffle(CONTESTED_POOL)) {
    if (contested.length < RULES.contestedCities && !APART.some((p) => p.includes(c) && p.some((o) => o !== c && contested.includes(o)))) contested.push(c);
  }
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
