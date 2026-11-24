# Decision Log

Why-this-not-that for this project, newest first. Companion to [CHANGELOG.md](CHANGELOG.md).

---

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
