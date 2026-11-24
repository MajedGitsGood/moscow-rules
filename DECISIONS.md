# Decision Log

Why-this-not-that for this project, newest first. Companion to [CHANGELOG.md](CHANGELOG.md).

---

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
