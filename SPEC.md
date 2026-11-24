# Moscow Rules — Control vs Karla (working title)

## Context
This is a second browser game, built the same way as *Hall of Mirrors*: vanilla HTML/CSS/JS, no build step, `serve.py`, CLAUDE.md + SPEC/DECISIONS/CHANGELOG, and GitHub Pages later. It's a Cold War spymaster duel inspired by Le Carré, **Control vs Karla**, played like **Stratego with free-text orders**:
- Each side secretly places archetype agents in cities.
- Each side scouts with a limited number of Watch reports.
- Agents strike according to a rock-paper-scissors hierarchy.
- Recruitment makes every report you receive suspect.

Decisions so far:
- **Free-text cables** are the only way to give orders.
- **Rules are symmetric.** Each side is played by a human or by Claude.
- **12 weeks, 30–45 minutes.**
- **Tactics go in a strategy guide**, not into the rules.
- **No head-office mole.**
- **Models:** Karla's decision-making runs on Opus; everything else runs on Haiku.

## Rules (all numbers are starting values, to be tuned by simulation)

**Board:** **London, Moscow + 4 cities** drawn each game (for example Berlin, Vienna, Istanbul, Helsinki), 6 in total. **No city is safe.** London and Moscow are ordinary cities, open to placement and attack, so you can raid the enemy capital if you dare. Moving takes one week.

**Roster:** each side has **8 agents**, 2 of each archetype. Every agent is a named character. The other side sees them only as unidentified "agents" until a Watch report reveals more.

| Archetype | Beats | Loses to | What it does |
|---|---|---|---|
| **Scalphunter** | Lamplighter, Talent-spotter | Ferret | The only agent that can **Strike** (assassinate an agent in its city) |
| **Lamplighter** | Ferret | Scalphunter | Its **Watch** reveals each enemy agent's archetype, and **burns** any enemy Ferret in that city |
| **Ferret** | Scalphunter | Lamplighter | Passively **guards** its city: any enemy Strike there fails and the Scalphunter is caught. It also blocks Recruit attempts |
| **Talent-spotter** | — | everyone | The only agent that can **Recruit** (try to turn an enemy agent) |

So Scalphunters beat Lamplighters, Lamplighters beat Ferrets, and Ferrets beat Scalphunters. That cycle is what forces repositioning. A city guarded by a Ferret is safe until a Lamplighter burns the Ferret. Your Lamplighters are exposed to enemy Scalphunters. And you won't know who guards a city until you Watch it.

**Setup (as in Stratego):** each side secretly places its 8 agents, at most 3 per city, in any city. In hot-seat play there's a "pass the device" screen between placements.

**Each week:**
- Each side sends **up to 3 cables**, in free text, to individual agents.
- **At most 2 of those orders can be Watches.** Recruit is limited to 1 attempt a week and 3 per game.
- Each cable is interpreted (Haiku) into one order:
  - **Move**
  - **Watch:** reports next morning. A Lamplighter's report gives archetypes; any other agent's report gives only how many enemy agents are there and their codenames.
  - **Strike** (Scalphunter only): kill a named agent, or "whoever is there" chosen at random.
  - **Recruit** (Talent-spotter only): 50% chance to turn a named agent.
  - **Lie low** (the default for a cable that can't be understood)
- An unclear cable gets an in-character "please clarify" reply, which costs you that order.

**Resolution order (simultaneous):** moves, then watches (Lamplighters burn Ferrets), then strikes (Ferret check; Scalphunter against Scalphunter means both die), then recruits.

**A turned agent:**
- stays on its original owner's board and still receives that owner's cables;
- **leaks every cable it receives, word for word**, to the side that turned it;
- **sends false Watch reports** (the engine invents them, or the side that turned it dictates the lie by cable);
- **sabotages** its orders: its strike or recruit fails and the target is warned, and if it's a Ferret it stops guarding.

When a Recruit attempt fails, the target's side learns who approached and where.

**End and win:** the game ends after **week 12**, or as soon as one side's roster is fully eliminated. **The side that eliminated more enemy agents wins.** Eliminations count agents killed, Scalphunters caught, Ferrets burned, and **turned agents (revealed and counted at the end)**.

**"Caught" and "burned" both mean eliminated.** The agent is removed from the board, its owner can no longer use it, and it counts as an elimination for the other side. Every way of losing an agent works the same:
- killed by a Strike;
- a Scalphunter caught by a Ferret;
- a Ferret burned by a Lamplighter;
- turned, though that only counts once revealed at the end.

The side that lost the agent gets a cable telling it so ("Vienna has gone dark: Petrov was taken"). That way losses are never a hidden surprise.

**No memorising positions; the effort goes into identity and loyalty.**
- **Board (automatic):** the map always shows where your own agents are. For each enemy agent ever spotted, it shows the last-seen city and week, filled in automatically from Watch reports, strikes and failed recruit attempts.
- **Notebook (yours to fill in):** one row per enemy agent, added automatically as soon as their codename appears in any report. You fill in a **role** field (Scalphunter / Lamplighter / Ferret / Talent-spotter / unknown) and a free-text note. When a report states an archetype, the notebook suggests it with its source ("per Lamplighter Hale, wk 4"), but **you decide whether to accept it**, because the source may have turned.
- **Your own roster** in the same notebook has a **trusted / suspect / turned** mark and a note per agent.
- The notebook is the one place you do the deduction. Nothing in it changes the rules.

**Debrief:** reveals every agent's true archetype, position history and loyalty, every leaked cable, and Karla's journal (when Claude played him).

## Strategy guide (`STRATEGY.md` + in-game "Field Manual")
These are ways to play, not extra rules:
- **Canary trap:** send two suspect agents different stories.
- **Chicken feed:** keep a known turned agent and feed it false plans.
- **Bluff with placement:** leave a city looking empty to lure a blind strike into a Ferret.
- **Cross-check:** Watch the same city with two agents and compare the reports.
- **Brevity:** short cables are hard to misuse if they leak, but easy for your own agent to misread.
- **Sequencing:** Lamplighter burns the Ferret first, then the Scalphunter goes in.

## Architecture (ES modules, no build)
New folder `~/Desktop/moscow-rules/` (placeholder name). It reuses the Bruce Lee conventions: `CLAUDE.md`, `SPEC.md`, `DECISIONS.md`, `CHANGELOG.md`, `.claude/launch.json`, and adapted `logbook` / `smoke-test` skills from `~/Desktop/Bruce Lee Game/.claude/skills/`.

- `js/rng.js`: seeded RNG.
- `js/world.js`: draws cities and generates two rosters (names, archetypes).
- `js/engine.js`: pure rules, with no UI or LLM code.
  - Main API: `placeAgents(side, placement)`, `submitOrders(side, orders[])`, `resolveWeek()` and `viewFor(side)` (the fog-of-war view one side sees).
  - Also handles the archetype cycle, turned-agent behaviour, elimination counts and the end conditions.
- `js/controllers/human.js`: drives the UI for a human player.
- `js/controllers/claude.js`: takes `viewFor(side)` and gets that side's placement, cables and a journal entry back (**Opus 5.5**, `claude-opus-5-5`).
- `js/controllers/heuristic.js`: offline bot, used for balance runs and as a fallback when the budget runs out.
- `js/cables.js`: the **interpreter** (cable text → `{agent, order, city, target, clarity}`, via structured output) and **agent voices** (morning reports written in character from engine facts or lies). Both run on **Haiku 5.5** (`claude-haiku-5-5`), plus a keyword fallback interpreter for play without an LLM.
- `js/llm.js`: one gateway to `/api/claude`. It routes each call type to a model (Karla's moves → Opus, everything else → Haiku), tracks a per-game token budget, and falls back to templates or the heuristic bot when the budget runs out.
- `js/ui/`: map (SVG, pins for your agents and fogged markers for theirs), placement screen, inbox, cable composer (character limit, archetype hints), notebook, hot-seat handoff, debrief. Visual style is a 1970s dossier: typewriter type, manila folders, teleprinter.
- `serve.py`: static server plus a `/api/claude` endpoint (Anthropic Python SDK). The key comes from the `ANTHROPIC_API_KEY` environment variable and never reaches the browser. It enforces a model allow-list, a max_tokens cap and a per-session budget; an owner token skips the budget. A Cloudflare Worker with the same request shape replaces it at deploy time.

## Build order
1. **Engine, world generation, heuristic bots**, plus `node tools/simulate.js`, which runs bot-vs-bot games to tune roster size, watch and recruit limits, the 50% recruit odds and cities per game. Targets: about 50/50 win rate, games that usually reach week 8–12, and no single archetype dominating.
2. **UI with hot-seat Human vs Human** (placement, cables via the keyword interpreter, map, notebook, debrief).
3. **LLM layer:** proxy, Haiku interpreter and voices, Opus Karla controller and journal.
4. **Strategy guide / Field Manual, tutorial, polish.**
5. **Deployment** with guest token limits; online two-player later.

## Verification
- A determinism test: the same seed, placements and orders always produce the same outcome.
- Unit checks for every pairing in the archetype cycle, for the Ferret guard, for the Lamplighter burn, and for turned-agent leaks, lies and sabotage.
- `node tools/simulate.js --games 500` reports balance stats and no errors.
- In the preview browser, play a hot-seat game, then a full game against Claude-Karla. Check that:
  - a cable sent to a turned agent shows up word for word in Karla's view and journal;
  - a blind strike into a Ferret-guarded city gets the Scalphunter caught;
  - the game ends correctly both at week 12 and when a roster is wiped out;
  - the budget fallback works;
  - the console stays clean.
