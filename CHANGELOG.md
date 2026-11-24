# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- Winning is now about agents standing: the most agents still alive and still loyal at the end.
  Lost and turned are shown as substats. The HUD shows how many of each side are still alive.
- The debrief tells the story: Claude's analysis of the key moments (recruitments, intelligence that
  mattered, mistakes) pinned to the week-by-week chart, and the pivotal battleground with what each
  side knew there. The rosters list who's standing first. The replay map and order strip are gone.


### Added
- Order bar: the week's five orders across the bottom of the screen, each cancellable with ✕.
- Arrow-key navigation: move between cities, the people in a city, an agent's orders and targets;
  Enter chooses, Escape steps back.
- Drag a token onto a city to move it, or onto an enemy agent for the obvious action.
- A new debrief: who was ahead week by week (with the turning point marked), a replay map of each
  week showing true roles, moles and moves, and both sides' orders side by side.

### Removed
- Karla's diary from the debrief (he still keeps it privately, for his own continuity).


### Changed (playtest 2 follow-up)
- Ten agents a side: three Lamplighters, three Ferrets, two Scalphunters, two Talent-spotters.
- No suspicion tags anywhere: spotting moles is up to you.
- Moles you run can frame anyone on their side, other moles included, and take a standing
  instruction: carry out their own side's orders (to keep their cover) or quietly let them fail.
  Every leaked order says which they're doing.
- Clicking a city opens a compact panel with everyone there, ours and theirs; click a row to give
  orders (or mark a role) from a popover beside it.
- Setup: click an agent then a city, or drag; the tray is a compact grid with no scrolling, and the
  map stays clear of it.


### Changed (after playtest 2)
- No more sleepers: both sides start with clean networks.
- Two approaches turn an agent, and approaches are never reported. A loyal Ferret in the target's
  city quietly blocks them.
- Only Lamplighters can surveil. Everyone else reports only preparations, traps and attacks, and a
  witness to a killing can name the killer. Kills no longer reveal roles (no more interrogation).
- Karla plays to win: he hunts named killers, keeps standing traps, surveils every week and strikes
  on good odds. He also sees what each British agent has been witnessed doing.
- Orders are given from a compact popover beside the agent's token: two or three clicks per order.
  Clicking an enemy token lets you mark their role in one click.
- The debrief explains every fate, including moles who died (scored as kills, not turns).

### Added
- The Notebook is back, as a tab beside Traffic: role marks and notes for every agent, on both sides.
- If Karla's Claude call ever fails, his journal says the offline bot played that week.


### Changed: v2, a different game
- Orders are clicks, not typed cables. Click an agent on the map, pick one of their orders, pick a
  target or a city. Five orders a week.
- Everyone's position is public; roles and loyalty are hidden, like Stratego.
- New roles: Scalphunters interrogate, Lamplighters surveil, Ferrets trap and vet, Talent-spotters
  turn agents over three approaches (no per-game cap).
- Strikes must be prepared (except by Scalphunters) and are countered by traps; preparing, trapping
  and approaching can be seen by the other side; lying low hides an agent completely.
- Moles: your orders to a turned agent reach the other side; you choose the lies an enemy mole
  reports home; Brief feeds a plan to a suspect; Vet tests one; Execute removes one.
- Scoring: every dead enemy agent is a point, plus every enemy agent you turned who's still alive.
- Surrender button for human players.

### Added
- The war room: an illustrated map of Europe (Natural Earth) with territories tinted by who holds
  each city, landmark medallions, generated noir portraits for every agent, a strategy-game HUD,
  drag-and-drop setup, grouped and attributed morning traffic, a visual Field Manual, and a debrief
  with every agent's true role and loyalty.

### Removed
- Free-text cables, the cable interpreter, and its eval set.


### Fixed
- Agents read cables generously. Questions ("Who's in your city?"), coded phrasing ("Paris. Usual
  arrangement.") and cables asking for several things now become orders instead of "unclear". When a
  cable names another city, the agent goes there first.
- Agents no longer invent intelligence in their replies ("London is quiet" from an agent in Moscow who
  never looked). Text Claude writes for an agent is fact-checked against what the game actually
  produced; anything that adds a city, a person, a role or a description falls back to the plain report.

### Added
- Every cable Claude reads is logged to `logs/cables.jsonl` and printed in the server window, with
  the order it became. `node tools/eval-cables.js [--live]` checks 17 sample cables against both readers.
- `.env` support: put your API key in `.env` (copy `.env.example`) and run `npm start`.
- First playable build: setup on six cities, eight agents a side (Scalphunter, Lamplighter, Ferret,
  Talent-spotter) in a rock-paper-scissors cycle, free-text cables, Watch / Move / Strike / Expose /
  Recruit / Lie low, turned agents that leak, lie and sabotage, a 12-week end with an elimination count.
- Three modes: against Karla (Claude), against an offline bot, two-player hot-seat.
- Board with automatic last-seen positions, a notebook for roles and loyalty, a debrief that reveals
  every agent, every leaked cable and Karla's journal.
- Claude integration through a local proxy (`server.js`): Opus 5.5 for Karla, Haiku 5.5 for cable
  interpretation and agent voices, per-session token budgets, owner bypass, offline fallbacks throughout.
- Field Manual (in game) and `STRATEGY.md`; rule checks (`npm test`) and balance simulation (`npm run simulate`).
