# CLAUDE.md: working conventions for this repo

Moscow Rules, a le Carré-inspired spy duel: Stratego on a map, AI-written reports (see SPEC.md). Vanilla HTML/CSS/JS with ES modules, no build step.
Run with `npm start` (port 8643; static files plus the `/api/claude` proxy). Secrets live in `.env` (gitignored; see `.env.example`).

## Architecture rules
- `js/engine.js` is the single source of truth and must stay pure: no DOM, no LLM, all randomness
  through the seeded RNG stored on the game. Change rules there, then run `npm test` and `npm run simulate`.
- Controllers (human UI, `controllers/claude.js`, `controllers/heuristic.js`) only ever see `viewFor(side)`.
  Never pass the full game to Claude.
- Both sides follow identical rules. Don't add Karla-only logic to the engine.
- Model routing lives in `server.js` (`MODELS`): Karla on Opus, report voices on Haiku.
- Claude never states facts: report rewrites go through `factsCheck` in `js/voices.js`.
- Keep mechanics minimal; playtest feedback lives in FEEDBACK.md.
- System prompts in `js/prompts.js` must stay byte-stable so they cache; put game data in the user message.
- Every Claude call has an offline fallback. Keep it that way.

## Keep the two logs current
- `CHANGELOG.md`: user-facing *what changed* (Keep a Changelog). New work goes under `[Unreleased]`.
- `DECISIONS.md`: the *why*, with rejected alternatives, newest first.
Run the `logbook` skill (or `/logbook`) when a meaningful unit of work lands. Before calling a change
done, run the `smoke-test` skill.
