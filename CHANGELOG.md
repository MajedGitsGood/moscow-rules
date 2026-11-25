# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed (playtest 3 round)
- **Ferrets no longer block approaches.** They trap, notice surveillance and vet.
- **Title screen:** toggles for players (one or two), opponent (Karla or the offline bot) and agents
  per side (6, 8 or 10), then Begin. New tagline. Field Manual sits at the bottom; the Owner token
  link is gone (open the game once with `?owner=<token>` instead).
- **Agents per side:** 6 (2 Scalphunters, 2 Lamplighters, 1 Ferret, 1 Talent-spotter), 8 (two of
  each) or 10 (as before).
- **Station tab:** the city view is now a tab in the right panel: Traffic, Station, Ours, Theirs.
  Clicking a city, or a traffic item, opens its Station. The floating city panel is gone.
- **Orders, grouped:** the role's special first, in its colour (Instant strike, Instant trap and
  Vet, Surveil, Approach), then what everyone can do.
- **Execute** appears only beside an agent you've marked Mole.
- Notices (such as "will go to Rome. ✕ in the order bar to undo") now appear at the top of the
  screen, so they no longer cover the "why" box above the order bar.
- **Debrief:** the score shows just "own + turned"; moments are marked by their week; the decisive
  exchange shows only the people it names (everyone else is a dot); people columns lead with each
  fate (how, week, city), mark defectors "Turned wk N" in their original side's colour, and show
  the role as a coloured icon on the right.

### Changed (scoring)
- The winner is the side with the most agents **working for it** at the end: its own still loyal,
  plus enemy agents it has turned who are still alive. Turning an agent is a two-agent swing.
- The debrief shows the arithmetic ("2 own + 4 turned") and lists people by allegiance: the
  Russians you turned appear among your people, the Brits Karla turned among his, each marked
  with where they came from. Games saved under the old rule are re-scored when opened.

### Added
- If Karla's Claude call fails, a red "Offline Karla" plate shows in the HUD and a notice explains
  that the offline bot played the week; Claude is tried again each week.
- Save case file (debrief): downloads the finished game for later analysis.

### Changed (Feed, moles and approaches)
- Brief is now **Feed**: give an agent a fake order (any order they could really be given). They
  do nothing that week, but a mole who hears of it passes it on word for word like a real order,
  so the other side can't tell it apart. It costs one of the five orders.
- Moles are far more valuable: each week a mole also reports what every colleague in its city has
  been ordered, and what role they are. Fed orders to those colleagues leak the same way.
- Karla, and the offline bot, act on leaked orders: a named target runs or lies low, and they avoid
  striking where a trap is being set. Karla is told a leak may be bait.
- The debrief spots taken bait: a fed target who ran gives the mole away.
- Two approaches on the same agent must come in different weeks; a second pitch the same week
  doesn't count.

### Changed (notebook and reasons)
- The right-hand panel has three tabs: Traffic, Theirs and Ours. Free-text notes are gone.
- Mark each of your agents Trusted, Suspect or Mole in one click (in the Ours tab or their
  popover); suspects and moles carry a "?" or "M" on their map token and in the city panel.
- After giving an order, a one-line "why?" box opens above it. It's optional, and the debrief
  uses your reasons, and Karla's (he now gives one for every order), to tell the story.

### Fixed
- Karla's weekly orders now come from Claude. The order format Karla answers in was rejected by
  the API, so every week silently fell back to the offline bot (only his opening placement used
  Claude). The server window now prints any failed Claude call.

### Changed (panels)
- The city panel opens beside its city, over open sea where it can, and never covers the city
  itself or any other city. On smaller windows, where there's no clear sea nearby, it docks over
  the right-hand column instead. It's narrower too.
- An agent's order popover avoids covering any city or the city panel.
- The Notebook has two tabs, Theirs (first) and Ours.

### Changed (roles at a glance)
- A role your Lamplighter reports is filled in for you everywhere (map, city panel, notebook).
  These reports are always true, so there's nothing to confirm. You only mark your own guesses,
  which show as dashed badges.
- Role badges are bigger, sit on the outside of each token, and are colour-coded: orange
  Scalphunter, yellow Lamplighter, green Ferret, purple Talent-spotter.
- Cover jobs (journalist, banker…) are gone from the screen; they were flavour that cost attention.

### Changed (cities)
- Rome, Belgrade and Tangier replace Paris, Bern and Athens, each with its own landmark. Paris sat
  so close to London that the two cities' agents overlapped.
- Lisbon and Tangier, and Vienna and Belgrade, never appear in the same game, so no two cities'
  agents crowd each other.

### Changed (footprints)
- Every order leaves footprints, drawn from one shared pool: "asking about Ashby", "keeps turning up
  where Ashby goes", "a room overlooking the Riesenrad", "unfamiliar faces", "met someone off the
  night train", "keeps regular hours". A preparation, a vet and surveillance can all look alike, so
  a footprint is a clue, not a verdict. Approaches look like doing nothing.
- Lamplighters see preparations, traps and surveillance in their city for what they are.
- Traps catch on one night only. Ferrets can trap tonight or next week; anyone else's trap is set up
  over a loud week (always noticed) and catches the following night.
- Scalphunters may prepare first, so their strike doesn't come out of nowhere. Once a strike lands,
  a prepared strike and an instant one produce the same news.
- More traffic: about 7 messages a morning, mostly footprints, one report per agent at most.
- Mole cover stories blend in: "all quiet" becomes a harmless footprint, a false alarm becomes
  someone asking about a colleague.
- Claude's rewrites of reports can't turn a footprint into a verdict ("preparing", "trap").

### Added (footprints)
- Field Manual: a footprint table with the odds of noticing each order and what it can look like,
  told through one recurring example (Pell watching Halas in Vienna).
- The simulator reports traffic per morning by kind.

### Changed
- Winning is now about agents standing: the most agents still alive and still loyal at the end.
  Lost and turned are shown as substats. The HUD shows how many of each side are still alive.
- The debrief tells the story: Claude's analysis of the key moments (recruitments, intelligence that
  mattered, mistakes) pinned to the week-by-week chart. The rosters list who's standing first. The
  replay map and order strip are gone.
- The debrief's map section is now the decisive exchange: what one side heard (a planted lie, a
  leak through a mole, or an honest report), what it did because of it, and what that cost.
- The debrief is sparer: colour shows which side a moment favoured, numbered pins match the moments
  below, fates are icons and a mole chip, and every text Claude writes is a line or two.
- The debrief's moments run down columns, left to right, so they line up with the chart's weeks.
- A debrief written by the rules engine has an "Ask the analyst" link to try Claude again.


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
