# Moscow Rules: Control vs Karla

A Cold War spymaster duel in the spirit of le Carré, played like **Stratego with free-text orders**.
You are Control. Claude plays Karla (or a friend does, hot-seat). Place eight agents across six
cities, cable them in plain words, find out who they are and who is still yours, and take theirs off
the board. Every cable you send to an agent who has been turned is read, word for word, in the
other capital.

## Run it

```sh
npm install
export ANTHROPIC_API_KEY=...        # optional: without it the game runs fully offline
node server.js                      # http://localhost:8643
```

Modes: **Against Karla** (Claude, Opus 5.5), **Against the bot** (offline), **Two players** (hot-seat).

## How Claude is used

| Job | Model | Notes |
| --- | --- | --- |
| Karla's placement, cables and private journal | `claude-opus-5-5` | Sees only Karla's fog-of-war view |
| Reading your free-text cables into orders | `claude-haiku-5-5` | Keyword fallback offline |
| Agents' voices in the morning traffic | `claude-haiku-5-5` | Template text offline |

The rules engine (`js/engine.js`) decides everything that is true. Claude only reads, writes and
chooses. The browser never sees the API key: `server.js` proxies `/api/claude`, picks the model per
call, caps tokens, and gives each guest session a token budget (`MR_GUEST_BUDGET`, default 300k).
Set `MR_OWNER_TOKEN` and paste the same value into the game's "Owner token" to skip the budget.
When the budget runs out the game carries on offline.

## Files

- `js/engine.js`: rules, pure and deterministic (seeded RNG). `js/world.js`: cities, archetypes, rosters.
- `js/controllers/`: `claude.js` (Opus player), `heuristic.js` (offline bot).
- `js/cables.js`, `js/interpret.js`, `js/prompts.js`, `js/llm.js`: the cable pipeline and the Claude gateway.
- `js/main.js`, `js/ui/manual.js`, `style.css`: the desk.
- `tools/test.js` (rule checks), `tools/simulate.js` (bot-vs-bot balance runs).
- `SPEC.md` (design), `STRATEGY.md` (tradecraft), `DECISIONS.md`, `CHANGELOG.md`.

```sh
npm test          # rule checks
npm run simulate  # 500 bot games: win split, game length, how agents die
```

Unofficial homage to John le Carré's Circus novels; no affiliation. Agent names are original.
