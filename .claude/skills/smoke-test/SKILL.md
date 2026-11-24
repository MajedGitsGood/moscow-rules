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
   - `localStorage.clear(); MR.startNew('bot')`, then click `#btn-place`. Expect `MR.app.screen === 'desk'`.
   - Fill `MR.app.drafts.control` (or leave empty), `MR.render()`, click `#btn-dispatch`, and repeat until
     `MR.app.screen === 'debrief'`.
   - `MR.startNew('hotseat')` and walk through placement → handoff → placement → handoff → desk.
5. Re-check the console and take a screenshot of the desk and the debrief.
6. With an API key set, play one week against Karla and watch the `[claude]` lines in the server log.

PASS means both scripts are green, a full game reaches the debrief, hot-seat handoffs work, and the console is clean.
