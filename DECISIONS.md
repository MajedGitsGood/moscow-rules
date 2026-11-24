# Decision Log

Why-this-not-that for this project, newest first. Companion to [CHANGELOG.md](CHANGELOG.md).

---

## 2026-11-24: Roles are learned only by watching
**Decision:** Only Lamplighters surveil; other agents report only preparations, traps and attacks
(naming the actor, never the role); kills reveal nothing; approaches are never reported and take two;
Ferrets silently block approaches. No sleepers. Karla's prompt is aggressive and he is shown what
each British agent was witnessed doing.
**Why:** Playtest 2: roles were too easy to learn, sleepers felt unfair and confusing, Karla was
passive (his prompt only trapped against visible preparation, which Scalphunters never show, and kills
never named the killer). The user wants mole-hunting to come from attention, not from notifications.
**Rejected:** *Reporting approaches with a chance* (the user wants moles to be silent).
*Scalphunters needing preparation* (removes their identity; witnesses and traps answer them instead).
*Hard-coding Karla's tactics in the engine* (breaks symmetric rules; done in his prompt and the bot).
**Affects:** `js/engine.js`, `js/world.js`, `js/prompts.js`, `js/controllers/*`, tests.

## 2026-11-24: A popover beside the token instead of panels
**Decision:** Orders, targets and role marks live in a small popover anchored to the clicked token;
the city panel and order dock are gone; the right panel has Traffic and Notebook tabs.
**Why:** Playtest 2: the panels covered too much of the map and every order took too many clicks.
**Rejected:** *A radial menu* (hard to label eight orders legibly). *Keyboard shortcuts first* (still
worth adding later, but clicks were the complaint).

## 2026-11-24: v2: clicks instead of cables; information decides fights
**Decision:** Replace the v1 game. Orders are clicks; positions are public and roles hidden; the
roles become ways of knowing (interrogate, surveil, trap/vet, recruit); a strike succeeds unless a
trap is ready or the target is lying low; preparation and traps are "loud" so each side can read the
other; moles are steered through order choices (Brief, pick-the-lie) rather than text. Claude's job
is the reports and Karla's mind, not interpretation.
**Why:** Playtest 1: free text "was effectively useless" (it collapsed to five verbs and only
mattered on rare leaks), the game "felt like chess, not a spy role-play", and dead ends appeared when
pieces ran out. The reports were the fun part, so v2 is built around them. The user rejected codes
(typing to an AI is a chore), relationships ("not a relationship simulator") and reinforcements.
**Rejected:** *Codebooks for leaked cables* (complex, still typing). *A cover/heat meter* (replaced by
loud/quiet: one fact per order, no bookkeeping). *Ferret-only traps* (too scarce to fear).
*Rank-based combat* (less spy-like than information-based). *New agents mid-game* (user preference).
**Affects:** everything under `js/`, `style.css`, `index.html`, tests and simulation.

## 2026-11-24: Real coastlines, generated portraits, no image assets
**Decision:** The map is Natural Earth (public domain) projected once by `tools/build-map.js` into
`js/mapdata.js`; territories are Voronoi cells clipped to land, computed at runtime; portraits and
landmarks are procedural SVG.
**Why:** The user wanted a Risk/Bonaparte-style map and characterful agents. Generated SVG keeps the
repo asset-free and the game a static site, like Hall of Mirrors.
**Rejected:** *Hand-drawn coastlines* (look wrong). *d3 at runtime* (a dependency for a one-time projection). *Bitmap art* (needs sourcing and licensing).

## 2026-11-24: Read cables generously; "unclear" only when there is no reasonable reading
**Decision:** The interpreter now looks for the most plausible order given the agent's role and city.
Questions count as instructions, coded language is expected, and a cable asking for several things
becomes the first one that can happen (moving before acting there). Low clarity is reserved for
pleasantries, nonsense or contradictions. Every cable Claude reads is logged, and an eval set of real
phrasings (starting with playtest 1's misreads) guards the behaviour.
**Why:** Playtest 1: "Who's in your city?" and "Anyone worth talking to?" came back unclear, leaving
players feeling they had to spell orders out precisely or be ignored. The skill the game tests is what
you *reveal* in a cable, not how precisely you phrase commands.
**Rejected:** *Asking the player to confirm a menu of interpretations* (turns free text back into
menus). *Treating multi-part cables as unclear* (punishes natural writing). *Queuing the second half
of a multi-part cable for next week* (a hidden rule; may come later if players want it).

## 2026-11-24: Fact-check Claude's agent text in code, not just in the prompt
**Decision:** Every line Claude writes for an agent (the reply to a cable, the morning rewrite) passes
`factsCheck` in `js/cables.js`. It may not name a city, agent or role that its source doesn't name, or
describe a place as quiet/empty/clear unless the source does. Rewrites must keep every city, surname
and role. A failure silently uses the engine's own wording. Clarification replies are no longer re-voiced.
**Why:** Playtest 1 showed replies inventing intelligence ("London is quiet" from an agent in Moscow
who never watched anything). In a game about trusting information, false intel the engine didn't
produce breaks the puzzle. Prompt wording alone can't guarantee it doesn't happen.
**Rejected:** *Prompt-only fixes* (still probabilistic). *Dropping Claude's voices entirely* (the
traffic is the part the player enjoys most). *A second LLM call to verify* (cost and latency for a
check that string matching does reliably).

## 2026-11-24: Node proxy instead of Python `serve.py`
**Decision:** The dev server and Claude proxy are `server.js` (Node, `@anthropic-ai/sdk`), not a
`serve.py` like Hall of Mirrors.
**Why:** The current Anthropic Python SDK needs Python 3.10+, and this Mac ships 3.9. Node 24 is
installed, and a Cloudflare Worker (the planned deploy target for guest token limits) is also
JavaScript, so the proxy logic carries over.
**Rejected:** *An old 0.x Python SDK*, which may not support structured outputs or the fallback
parameter. *Calling Claude from the browser*, which would expose the key.
**Affects:** `server.js`, `.claude/launch.json`, `package.json`.

## 2026-11-24: Karla emits cable text and the intended order; humans' cables are interpreted
**Decision:** Claude-as-Karla returns each cable's text *and* its structured order, validated by the
engine. Human cables go through the Haiku interpreter.
**Why:** Opus already knows what it means, so a second interpretation pass would only add cost and a
chance of misreading the AI's own orders. Symmetry is kept where it matters: Karla's cable *text* is
what leaks to Control, exactly as Control's text leaks to Karla.
**Rejected:** *Routing Karla's cables through the interpreter* (doubles calls, adds noise).

## 2026-11-24: Expose is a separate Lamplighter order; Ferrets notice watchers
**Decision:** A Lamplighter's Watch reveals archetypes. Burning a Ferret takes a separate **Expose**
order against a named agent; a wrong accusation reveals the Lamplighter. Any loyal Ferret notices
whoever Watches its city.
**Why:** In the first balance runs (500 bot games) Watch also burned Ferrets automatically, and 80% of
all Ferrets died, making the Ferret a free kill. Splitting it gives the Ferret's side a week to react
(move the Ferret, or send a Scalphunter after the exposed Lamplighter), which is the repositioning
the design wants. After the change, losses spread evenly across archetypes and the win split stayed ~50/50.
**Rejected:** *Burn only on two consecutive watches* (a hidden timing rule players would have to
remember). *Limiting Lamplighter watches further* (didn't address the free-kill feel).

## 2026-11-24: Engine owns truth; Claude owns voices and Karla's choices
**Decision:** All hidden state and outcomes are decided by a deterministic engine. Claude interprets
cables, writes agents' voices, and plays a side through the same fog-of-war view a human gets.
**Why:** Keeps every game different but fair and solvable, allows human-vs-human and offline play,
and makes the leak mechanic literal (the other side reads your actual words).
**Rejected:** *LLM as game master* (can't be trusted to keep hidden state consistent). *Structured
menu orders* (rejected by the user as too much like moving Risk pieces).
