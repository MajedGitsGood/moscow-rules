---
name: smoke-test
description: >-
  Boot the game in the preview browser and verify it actually works: title renders, a game can be
  set up and played to the debrief, hot-seat handoffs work, and the console is error-free. Use after
  changing js/, index.html, style.css or server.js, before shipping, or when asked "does it still work".
---

# Smoke test

1. `npm test` and `node tools/simulate.js --games 100`. Both must pass with no errors.
2. Start the server: `preview_start` with `{name: "moscow-rules"}` (port 8643), or with
   `{url: "http://localhost:8643"}` if it is already running.
3. Load the page and check `read_console_messages` (`onlyErrors: true`): expect none.
4. Drive a game through `window.MR` with `javascript_tool`:
   - `localStorage.clear(); MR.startNew('bot')`, click `[data-act=shuffle]` then `[data-act=place]`. Expect
     `MR.app.screen === 'play'` and agent tokens on the map.
   - Click a token: a popover (`#pop`) opens beside it. Pick an order (`.ob[data-type=…]`); targeted orders
     show target portraits (`.tg`) in the popover; for a move, click a city medallion.
   - Fill `MR.app.queued.control` (e.g. from `heuristicOrders`), `MR.render()`, click `[data-act=end]`; repeat
     until `MR.app.screen === 'debrief'`. Wait on `MR.app.screen` rather than fixed sleeps.
   - `MR.startNew('hotseat')` and walk placement → handoff → placement → handoff → play.
5. Re-check the console and take a screenshot of the desk and the debrief.
6. To test the Claude path without spending tokens, stub `window.fetch` for `/api/status` and `/api/claude`
   (see git history of this skill's first v2 run). With a real key, one week against Karla shows `[claude]`
   lines in the server log.

PASS means both scripts are green, a full game reaches the debrief, hot-seat handoffs work, and the console is clean.
