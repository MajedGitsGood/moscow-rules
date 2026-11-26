# Decision Log

Why-this-not-that for this project, newest first. Companion to [CHANGELOG.md](CHANGELOG.md).

---

## 2026-11-26: Tradecraft rating from the record; a fair verdict for both sides
**Decision:** Rate each side's play out of 100 as four parts of 25 (Kept, Damage, Intel, Security),
computed from the game record, and ask Claude for one thing each side did well and one it got wrong.
**Why:** The debrief is the Chess.com-style payoff: players want feedback on how to play better, and a
number to beat. Computing the rating keeps it consistent and checkable (Claude never states facts),
while Claude does what it's good at: the judgement in words. Only lapses felt like a scolding.
**Rejected:** *Claude scoring each side* (unrepeatable, and a number presented as fact). *Per-move
accuracy like chess engines* (no engine evaluation of positions to compare against). *Win/loss margin
as the score* (says nothing about how a losing side played).

## 2026-11-26: The morning as lamp, telegrams, then Reports
**Decision:** Replace the morning's pulses and flashes with a sequence: the desk lamp swings to each
city where something happened, the night's main events type out as telegram slips, and the slips
slide into the Reports panel, which appears once they land. Nothing persists on the map.
**Why:** It uses the lamp the user liked and keeps the continent clean; Reports stays the UI for play.
**Rejected:** *Pins and string* (mocked; didn't land). *Telegrams that stay on the map* (clutter;
Reports is the better place to read and act). *Grease-pencil marks* (earlier).

## 2026-11-26: The map as a printed chart under a desk lamp
**Decision:** Add the chart-maker's craft (coastal water lines, italic sea names, ticked border, scale
bar, margin stamp) and a single desk lamp with fold creases and a brief flicker every twenty seconds.
**Why:** Premium for this game means a crafted physical object in a 1970s office, not effects. All of
it is quiet single-colour linework or one warm light, so the map gains depth without new colour signals.
**Rejected:** *Grease-pencil overlays* (mocked: hatching, hand-drawn arrows, crosses; even with marks
fading after two weeks it was too much and made the continent look duller). *Relief texture and hot
spots* (reverted earlier: borrowed from Sigma Theory). Mocks live in a single page, `docs/mocks/map-alive.html`.

## 2026-11-26: No Offline bot choice; glyph toggles
**Decision:** Drop the opponent toggle (Claude vs Offline bot); one player always faces Claude, with
the bot as the automatic fallback. The remaining toggles use glyphs (people for players, a hat plus
numbers for agents) instead of words.
**Why:** No one chooses a weaker scripted opponent over Claude, the reason the game exists. "6 agents"
in only one box of three read oddly, and three rows of words was a lot of copy for a title screen.
**Rejected:** *A caption under each row* (more copy). *Words in every box* ("8 agents", "10 agents":
repetitive). *Keeping the bot as a hidden option* (the fallback covers the only real use).

## 2026-11-26: Defensive 6-agent rosters; three approaches, and Recruiters can double up
**Decision:** The 6-agent roster becomes 1 Assassin, 2 Watchers, 2 Counterspies, 1 Recruiter. Turning
takes three approaches; every approach counts, so two Recruiters on one target in the same week
both count. Blind strikes keep landing.
**Why:** Playtest 5 was over by week 8: two Assassins against one Counterspy meant free kills, and once
that Counterspy was turned no trap worked. Two approaches made recruiting too easy. Three slows small
games (one Recruiter needs three weeks), while doubling up gives larger games a real tactic.
In 300 simulated 6-agent games, deaths fall from 4.0 to 2.9 a game; wins stay even.
**Rejected:** *Blind strikes that can miss* (the user: striking blind is already a gamble against an
unseen trap). *Three approaches only in small games* (one rule for every size is easier to learn).
*Keeping the one-pitch-per-week limit* (it made a second Recruiter pointless on a shared target).

## 2026-11-26: Spymasters in three-quarter view
**Decision:** Draw both spymasters with bodies turned three-quarters to the player and heads in
profile facing each other; Smiley double-breasted with a full-length tie, Karla in a belted raincoat.
**Why:** A pure side view can't show a tie or lapels convincingly (the tie looked stuck on), and the
earlier head-on bodies looked flat. A three-quarter body shows the outfit and still lets them face off.
Smiley's expensive, badly fitting suits and the tie he polishes his spectacles on come from the books;
Karla stays deliberately anonymous.
Each is one unbroken outline (head, neck and body together) with as few inner lines as possible.
**Rejected:** *Pure profiles* (tie and lapels unreadable). *Square-on bodies* (flat, the first version).
*Separate head and body shapes* (the neck never met the collar cleanly). *Buttons, belts and coat
seams* (too busy). *A coloured glow behind each figure* (looked tacky).

## 2026-11-26: Muted relief with hot spots (reverted); moles-only means defeat
**Decision:** Shade the land as relief in a muted grey, keep side tints faint, and light only the
territories where something happened this week. End the game when a side has no loyal agent alive.
**Reverted (same day):** the relief and hot spots went back to the paper map. The colour contrast was
too much and the noise-made contours looked cheap; it borrowed Sigma Theory's answer instead of
finding our own. Moles-only defeat stays.
**Why:** The first living-map pass was too subtle. Sigma Theory's map works by contrast: texture,
and a few vivid highlights against a muted base. Lighting every held territory was tried and was
loud and flat; lighting where the week's action was tells the player where to look. A side run
entirely by the enemy can't act for itself, so playing on was busywork.
**Rejected:** *Saturated tints on every territory* (tried: loud, and it flattened the relief).
*Footprints as hot spots* (they arrive in nearly every city every week). *Copying Sigma's low-poly
facets* (too close to their look).

## 2026-11-26: One trait per face; the night replayed on the map
**Decision:** Draw every agent from one plain template plus exactly one trait, assigned across each
side from the look seeds (no game RNG, so seeded games are unchanged). Replay each night on the map
for about two seconds (moves, deaths, traps, things noticed) built only from public positions and the
side's own inbox; add lamplight, sea glints and a dusk/dawn dim.
**Why:** Playtests found agents hard to tell apart and the map static next to Sigma Theory. Several
random features per face made them busier but no more distinct; one trait, drawn to survive 22px, is
easier to remember without making spies memorable. The replay shows what happened before you read it.
**Rejected:** *A personal colour per agent* (too many colour signals already). *A hover dossier card*
(bloat). *A signature motif* (only makes sense in Smiley mode). *Full-screen characters delivering
reports* (slows every turn). *A repeating-gradient sea shimmer* (rendered as a flat, hard-edged wash).

## 2026-11-25: Plain language by default; le Carré as an Easter egg
**Decision:** Show the game as **Spymaster** in plain terms (MI6, KGB, Assassin, Watcher, Counterspy,
Recruiter, Reports). Karla's gold lighter on the title screen switches to **Moscow Rules** in le Carré's
own vocabulary. The engine, prompts and Claude's writing stay in le Carré terms; a display layer
(`js/lexicon.js`) translates all rendered text, so Claude-written reports and debriefs follow the mode.
**Why:** Players who aren't le Carré fans couldn't keep Lamplighter, Ferret or "morning traffic" straight.
Translating at display time keeps the prompts byte-stable and Claude's voice intact.
**Rejected:** *Renaming everything in the engine and prompts* (breaks Smiley mode and the prompt cache).
*A visible language toggle* (the user wanted it as a find for fans). *"Spy Master Simulator" in-game*
(kept for store listings). *"Control vs KGB"* (mixes a person and an agency).

## 2026-11-24: Ferrets lose the approach block; roster size is a choice; city view is a tab
**Decision:** Remove the Ferret's silent approach block. Offer 6, 8 or 10 agents a side. Replace the
floating city panel with a Station tab in the right panel. Group a popover's orders into the role's
special and the common orders.
**Why:** The block only stopped 13-15% of approaches but read as an invisible wall; ten agents was a
lot to track in a 30-45 minute game; the floating panel competed with Traffic for the same space;
an ungrouped grid of orders didn't teach what each role is for.
**Rejected:** *Grouping by intent (attack/defend/evade)* (the user's alternative: role specials
teach the roles better). *Replacing the block with Ferret approach detection* (not asked for yet).

## 2026-11-24: Score is agents working for you, turned agents included
**Decision:** Each side scores its own agents alive and loyal plus enemy agents it turned who are
alive. The debrief groups people by the side they ended up working for.
**Why:** In a playtest, Control killed seven of Karla's agents but lost four to undetected turning;
"own agents standing" called it a Control win (4-2), while the players' intuition, and le Carré's,
says Karla won (6-5). In 300 bot games the new rule halves draws (44 to 23) and keeps wins even.
**Rejected:** *Keeping own-loyal-only and rewording* (the rule itself contradicted what players
saw). *Turned agents worth one point to neither side* (the old rule; undervalues moles).

## 2026-11-24: Feed is a fake order; moles report their city-mates
**Decision:** Feed gives one of your agents a fake order (one they could legally be given). The
agent does nothing; any mole that hears of it (the agent, or a mole beside them) passes it on
exactly like a real order. It costs one of the five orders. Each week a mole reports its city-mates'
orders and roles to the side that turned it. Approaches: one per target per side per week.
**Why:** A "plan" message that only Feed could produce was recognisably bait (the user's point).
Hiding fakes inside the real order-leak channel makes them indistinguishable. Moles reporting
their neighbours makes a persistent mole the most dangerous thing on the board, as in le Carré,
and gives the victim something to deduce from ("they always know what happens in Vienna").
**Rejected:** *Plan messages naming a target* (only ever bait). *A free Feed each week* (more
orders per round slows the game). *Doubling a known mole* (more rules).

## 2026-11-24: One-line reasons for orders; verdicts on tokens
**Decision:** Each order can carry an optional reason (90 characters), asked for the moment the
order is queued; Karla gives one per order. Both feed the debrief analyst. Your verdict on your own
agents (trusted / suspect / mole) is shown on their tokens. Free-text notes were removed.
**Why:** The user barely used notes, but reasons recorded at decision time make the debrief able to
say what each side believed. Verdicts are only useful if you can see them where you act.
**Rejected:** *A required reason* (friction every order). *Asking at end of week* (the reason is
freshest at the click).

## 2026-11-24: The city panel finds open sea, or docks
**Decision:** Every spot on the map is scored by how much land and how many other cities the panel
would cover, plus its distance from the city; the clicked city is never covered. Land is sampled
once into a grid from the map's own land shape. If nothing clear sits near the city, the panel
docks over the right-hand column.
**Why:** The fixed top-left panel covered London. Hand-placed anchors per city break as the window
size changes; scoring adapts.
**Rejected:** *Per-city fixed anchors* (fragile across window sizes). *Allowing far-away spots* (a
panel over the Black Sea for London is disorienting).

## 2026-11-24: Reported roles apply themselves; colour per role; no covers on screen
**Decision:** A role reported by a Lamplighter (or a new source) is shown as known everywhere, with
its source; the player marks only guesses, drawn dashed. Each role has its own colour on a larger
badge placed on the token's outer side. Cover jobs are no longer shown or sent to Karla.
**Why:** Role reports only ever come from loyal Lamplighters, so they can't be lies: asking the
player to copy them into the notebook was busywork, and the finding was easy to miss. Small gold
icons on dark were hard to tell apart. Covers had no mechanical use.
**Rejected:** *Requiring the player to confirm reports* (nothing to doubt). *Bigger icons in one
colour* (shape alone still needs squinting).

## 2026-11-24: City pool: Rome, Belgrade, Tangier in; Paris, Bern, Athens out
**Decision:** The contested pool is Lisbon, Tangier, Rome, Berlin, Vienna, Belgrade, Helsinki and
Istanbul (still eight, four per game). Pairs too close on the map (Lisbon/Tangier, Vienna/Belgrade)
are never drawn together.
**Why:** Paris sits about 60px from London on our projection, so their token clusters always
collided, with Bern 80px further on. The new cities spread the board and carry Cold War weight
(Vatican back-channels, Tito's non-aligned crossroads, the old international zone).
**Rejected:** *Adding Stockholm too* (the user wanted the same number of cities). *Prague* (sits
between Berlin and Vienna). *Shrinking the token clusters* (the crowding was geographic).

## 2026-11-24: Footprints from a shared pool; one-night traps
**Decision:** Every order produces footprints from one shared pool of six sentences, with
per-order odds of being noticed and of each sentence (`TELLS` in world.js, shown to players in the
Field Manual). Lamplighters read preparations, traps and surveillance truthfully. Traps catch on one
night: Ferrets can trap tonight; a next-week trap (anyone) is always noticed while being set.
Scalphunters may prepare as a disguise; a strike itself leaves no footprint, so on the night every
strike looks the same and only the week before differs. One report per agent, up to three notes.
**Why:** Signs read as verdicts ("studying X's routine" = strike), standing traps were silent after
the first week, and traffic was uneven. Shared footprints make reading the morning a deduction;
innocent orders supply the ambient chatter.
**Rejected:** *Verdict-style signs made vaguer* (still only hostile acts leave signs). *Standing
traps with a weekly faint sign* (user preferred one-night traps). *Instant-only specialists* (a
strike from nowhere would always reveal a Scalphunter). *A bonus for the slow route* (more rules;
disguise is enough). *Capping the morning at ~3 reports* (the user wanted more chatter).
**Affects:** `js/world.js` (FOOTPRINTS, TELLS, PLACE), `js/engine.js` (reports, traps), bots, Karla's
summary and prompts, `js/analysis.js`, `js/voices.js`, `js/ui/manual.js`.

## 2026-11-24: The pivotal section is one information exchange
**Decision:** The debrief's map section shows one chain: what a side heard, what it did because of
it, and the result. Planted lies and mole leaks are preferred, so it answers "what did I feed Karla
that hurt him, or give away that helped him?" The analyst checks the receiver's orders to confirm
they really acted on it. The rules engine builds the same chain from warned-but-ignored strikes,
framed executions, leaks before a trap, and surveillance before a kill.
**Why:** Listing everything each side knew showed information, not consequence. The interesting
story in this game is information moving between sides and being acted on.
**Rejected:** *Both sides' known facts side by side* (the previous version: no synthesis). *Several
exchanges* (one is clearer; the moments list covers the rest).

## 2026-11-24: An analyst writes the debrief; score is agents standing
**Decision:** On reaching the debrief, Opus reads the full game record (true roles, moles, both
sides' orders, what each side was told) plus rule-detected moments (recruitments, strikes into
warned traps, warned-but-undefended victims, executions) and returns a headline, a summary, 4 to 8
moments and the pivotal battleground. Offline, the rule-detected moments are shown directly. The
score shown is agents standing (alive and loyal); the ranking is the same as before, but it now
names what you are playing for.
**Why:** Playtest feedback: the debrief read as snapshots, not a story. Synthesis is what an LLM is
good at, and it may use the truth freely, because the game is over.
**Rejected:** *A full replay map* (shows movement, not meaning). *Both sides' orders per week* (noise).
*Haiku for the analysis* (it's one call per game, and quality matters more than cost here).
**Affects:** `js/analysis.js`, `js/ui/debrief.js`, `js/prompts.js` (`DEBRIEF`), `server.js` (`debrief` → Opus), `js/engine.js` (score).

## 2026-11-24: Debrief as a replay, not a report
**Decision:** The debrief shows a momentum chart (points lead per week, biggest swing marked), a
replay map per week with true roles, loyalties and moves, and both sides' orders per week. Karla's
journal is no longer shown. The engine now records `turnedWeek` so turnings can be placed in time.
**Why:** The user wanted to see what was really going on behind the scenes and where the game
turned, visually. A list of fates and a diary didn't show that.
**Rejected:** *Animating the whole game automatically* (a Play button steps weeks instead, so it can
be paused). *Keeping the diary* (the user asked to cut it).

## 2026-11-24: Arrow keys move a highlight; drag tokens to give orders
**Decision:** Arrow keys move through what's on screen (cities by direction, then a city's people,
then orders, then targets); Enter chooses, Escape steps back. The level is derived from the UI
state, so mouse and keyboard mix. Dragging a token onto a city moves it; onto an enemy, it strikes,
approaches or prepares, whichever is possible. All queued orders sit in an order bar with ✕ to undo.
**Why:** The user found letter hotkeys unhelpful but wanted fewer clicks via spatial navigation.
**Rejected:** *Standing orders* (the user said no). *Letter hotkeys* (tried, removed).

## 2026-11-24: Standing instructions for moles; ten agents; keyboard-first
**Decision:** The side that turned an agent sets a standing instruction (obey or sabotage their own
side's orders) instead of moles always failing; leaked orders state which. Suspicion is never
tracked for the player. Ten agents a side (+1 Lamplighter, +1 Ferret). (A keyboard-first scheme with
auto-advance was tried and removed the same day: the user found it unhelpful, and auto-advance hid
the city view. The city panel came back in a compact form instead.)
**Why:** Playtest 2 follow-up. Always-failing moles were easy to spot and gave handlers no choice; a
mole that sometimes obeys makes trust genuinely hard, which the user called realistic. Suspicion
tags did the player's thinking for them. The extra Lamplighter and Ferret give more eyes and more
defence against silent recruitment, which runs at about five turned agents a game in bot play.
**Rejected:** *Asking the handler per order* (orders resolve the same night they're given, so the
handler would always be a week late; a standing instruction answers in advance). *A cap on
recruitment* (the user wants pervasive turning, countered by vetting and movement).
**Affects:** `js/engine.js` (`setStance`, `obeys`), `js/world.js`, `js/main.js`, Karla's prompt and schema.

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
