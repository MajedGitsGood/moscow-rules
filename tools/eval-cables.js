// Cable-reading eval: real-world phrasings → the order a reasonable agent would carry out.
//   node tools/eval-cables.js          offline keyword reader only (free)
//   node tools/eval-cables.js --live   also asks Claude through the running server (Haiku, ~20 calls)
// Add any cable from logs/cables.jsonl that was misread, with the order you meant.
import { INTERPRETER } from '../js/prompts.js';
import { keywordInterpret } from '../js/interpret.js';

const CITIES = ['London', 'Lisbon', 'Paris', 'Vienna', 'Istanbul', 'Moscow'];
const ENEMIES = [{ id: 'k1', name: 'Novak' }, { id: 'k2', name: 'Strasky' }, { id: 'k3', name: 'Petrov' }];
const A = (archetype, city) => ({ name: 'Agent', first: 'Test', archetype, city });

// expect: acceptable orders (first is the ideal). city/target checked when given. Agent's own role matters.
const CASES = [
  // From playtest 1
  { agent: A('lamplighter', 'Istanbul'), cable: 'Report on persona in the city', expect: ['watch'] },
  { agent: A('talentspotter', 'Moscow'), cable: 'Anyone worth talking to?', expect: ['watch', 'recruit'] },
  { agent: A('scalphunter', 'London'), cable: "Who's in your city?", expect: ['watch'] },
  // Questions
  { agent: A('ferret', 'Lisbon'), cable: 'Anyone about?', expect: ['watch'] },
  { agent: A('lamplighter', 'Vienna'), cable: "What's the picture there?", expect: ['watch'] },
  // Moves, plain and coded
  { agent: A('scalphunter', 'London'), cable: 'Paris. Usual arrangement.', expect: ['move'], city: 'Paris' },
  { agent: A('ferret', 'Lisbon'), cable: 'Take the night train to Vienna and keep your head down.', expect: ['move'], city: 'Vienna' },
  { agent: A('talentspotter', 'Paris'), cable: 'Get yourself to Istanbul, there may be someone to talk to there.', expect: ['move'], city: 'Istanbul' },
  // Strikes
  { agent: A('scalphunter', 'Istanbul'), cable: "Make sure Novak doesn't see Christmas.", expect: ['strike'], target: 'Novak' },
  { agent: A('scalphunter', 'Lisbon'), cable: 'Strasky has been asking questions about our Ferret. Deal with it.', expect: ['strike'], target: 'Strasky' },
  { agent: A('scalphunter', 'Vienna'), cable: 'Clean house. Whoever they have in Vienna.', expect: ['strike'], target: 'any' },
  // Expose / recruit
  { agent: A('lamplighter', 'Lisbon'), cable: "I think Petrov is their security man. Blow him.", expect: ['expose'], target: 'Petrov' },
  { agent: A('talentspotter', 'Istanbul'), cable: 'Have a quiet word with Novak. See if he has a price.', expect: ['recruit'], target: 'Novak' },
  // Two things at once: the first possible thing
  { agent: A('scalphunter', 'London'), cable: 'Go to Paris and take care of whoever is there.', expect: ['move'], city: 'Paris' },
  // Stay put
  { agent: A('ferret', 'Lisbon'), cable: 'Sit tight. Do nothing to draw attention.', expect: ['lielow'] },
  // Genuinely unclear
  { agent: A('lamplighter', 'Paris'), cable: 'Hope the weather is better than here.', expect: ['unclear'] },
  { agent: A('scalphunter', 'Vienna'), cable: 'Stay in Vienna but also go to Lisbon.', expect: ['unclear', 'move', 'lielow'] },
];

const live = process.argv.includes('--live');
const PORT = process.env.PORT || 8643;

async function askClaude(c) {
  const user = JSON.stringify({ agent: { name: 'Test Agent', archetype: c.agent.archetype, city: c.agent.city, serves: 'the Circus (British)' }, cities: CITIES, knownEnemyAgents: ENEMIES.map((e) => e.name), cable: c.cable });
  const schema = { type: 'object', properties: { order: { type: 'string', enum: ['move', 'watch', 'strike', 'expose', 'recruit', 'lielow'] }, city: { type: ['string', 'null'] }, target: { type: ['string', 'null'] }, clarity: { type: 'number' }, reply: { type: 'string' } }, required: ['order', 'city', 'target', 'clarity', 'reply'], additionalProperties: false };
  const r = await fetch(`http://localhost:${PORT}/api/claude`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session': 'eval', 'X-Owner-Token': process.env.MR_OWNER_TOKEN || '' }, body: JSON.stringify({ kind: 'interpret', system: INTERPRETER, user, schema, max_tokens: 400 }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  const o = JSON.parse(j.text);
  return { order: o.clarity < 0.5 ? 'unclear' : o.order, city: o.city, target: o.target, reply: o.reply };
}
function keyword(c) {
  const o = keywordInterpret({ agent: c.agent, text: c.cable, cities: CITIES, enemies: ENEMIES });
  const order = o.unclear ? 'unclear' : o.type;
  const target = o.targetId === 'any' ? 'any' : ENEMIES.find((e) => e.id === o.targetId)?.name;
  return { order, city: o.city, target };
}
function grade(c, r) {
  if (!c.expect.includes(r.order)) return false;
  if (r.order === c.expect[0] && c.city && r.city !== c.city) return false;
  if (r.order === c.expect[0] && c.target && (r.target || '').toLowerCase() !== c.target.toLowerCase()) return false;
  return true;
}

const score = { keywords: 0, claude: 0 };
for (const c of CASES) {
  const k = keyword(c);
  const kOk = grade(c, k); score.keywords += kOk;
  let line = `${kOk ? 'ok ' : 'BAD'} kw:${k.order.padEnd(8)}`;
  if (live) {
    try {
      const r = await askClaude(c);
      const ok = grade(c, r); score.claude += ok;
      line += ` ${ok ? 'ok ' : 'BAD'} claude:${r.order}${r.city ? ' ' + r.city : ''}${r.target ? ' ' + r.target : ''}`;
      if (!ok) line += `  reply: "${r.reply}"`;
    } catch (e) { line += ` ERR claude: ${e.message}`; }
  }
  console.log(`${line}  | ${c.agent.archetype} in ${c.agent.city}: "${c.cable}" (want ${c.expect[0]})`);
}
console.log(`\nkeywords: ${score.keywords}/${CASES.length}` + (live ? `   claude: ${score.claude}/${CASES.length}` : '   (run with --live to test Claude)'));
