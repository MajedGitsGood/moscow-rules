# Playtest feedback

Running notes from playthroughs. Raw feedback first; it becomes work items once a round is triaged.

---

## Playtest 1 (2026-11-24, Majed, vs Karla with Claude on)

### Title / landing page
- Far too much text, and it explains too much.
- Control and Karla need a shadowy personification (silhouettes or portraits, not just names).

### Setup
- Placing agents should be drag and drop onto a map, not dropdown menus.
- The agent names are good, but hard to take in among all the text on that page.

### Roles
- Each role needs an icon. Only the places that explain a role should show the icon *with* the role's name.
- Add an illustration of who beats who, so the cycle can be taken in at a glance.

### Main screen
- The folders and information are good, but the visual focus should be a **map with city illustrations** (in the manner of Risk).
- Orders shouldn't go through a separate cable page. **Click an agent on the map** and write their cable in a popup, with an indicator of how many actions are left this week.

### Free-text cables
- Several free-text cables came back "unclear" straight away. **Log every cable and its interpretation** so we can see what players are trying to tell their agents. **Done 2026-11-24:** `logs/cables.jsonl`.
- Right now it feels like you either spell out exactly what you want or you're writing nonsense. The free-form mechanic needs rethinking.
- Observed in the screenshot (all three read by Claude, not the offline reader):
  - "Report on persona in the city" to a Lamplighter became Watch. Correct.
  - "Anyone worth talking to?" to a Talent-spotter came back unclear. A reasonable reading is: scout the city for someone to approach (Watch), or make an approach (Recruit).
  - "Who's in your city?" to a Scalphunter came back unclear. That is plainly a Watch. The interpreter seems to treat questions as "not an instruction", which is too strict. **Fixed 2026-11-24:** questions and coded phrasing now become orders; covered by `tools/eval-cables.js`.

### Morning traffic (week 2)
- Reading the traffic is the most fun part so far.
- It isn't clear **why** each message arrived, or whether last week's orders caused anything. A player can't tell a reply to their own cable from something that happened to them.
- Agents sometimes report without being asked, which is good, but then what is Watch for? (As designed: Watch is the only way to learn who is in a city and what they are. Unprompted messages are only about things that *happen to* your agents: a Ferret noticing a watcher, an approach, a loss, a kill, a source's report. The UI doesn't make that difference visible.)
- The message types look too alike. The effort should go into the puzzle of the information, not into working out mechanics, who sent something, or how it's categorised.
- **Bug found while tracing this:** the "unclear" replies invent facts. Toby Marsh is in **Moscow** but wrote "London is quiet as far as I can tell", and Guy Holloway wrote "London is quiet on my side". Neither of them watched anything. That is false intelligence, and the engine never produced it; it came from the interpreter's reply or the voice rewrite. Replies must only ever state facts the engine supplied. **Fixed 2026-11-24** (see DECISIONS.md).

### Morning traffic (week 3)
- **Very hard to follow how events unfolded.** "Shots in London… Guy Holloway is dead, and so is their Scalphunter Vera Tamas" didn't explain who acted, on whom, or why both died.
- Didn't know two Scalphunters could kill each other. The rule (a Scalphunter who strikes another Scalphunter: both die) is in the engine and SPEC but **missing from the Field Manual** and the who-beats-who table, so it reads as random.
- Event messages should tell the causal story in one line: who acted (when it can be known), against whom, where, and which rule decided it. For example: "Their Scalphunter Vera Tamas came for Guy Holloway in London. Scalphunter against Scalphunter: neither survived."
- Ilse Draycott's loss followed directly from week 2's counter-intelligence warning (Strasky watched Lisbon, then Exposed her). The game should help connect those dots, for example by linking a loss to the earlier warning.
- **Feature request: retire your own suspected moles.** You should be able to kill one of your own agents if you think they've been turned. It's a big risk, but if you're sure you need a way out of having a mole. It costs one of the week's cables, like any dispatch, and you only learn at the debrief whether they really were turned.
  - Open design questions:
    - **Scoring.** Suggested: killing a loyal agent counts as an elimination *for the other side* (the risk), and killing a turned agent takes away the other side's end-of-game credit for them (the payoff).
    - **Who carries it out.** Options: a "Station" order that doesn't go through the agent; one of your own Scalphunters in the same city; or a cable to the suspect themselves, which, if they're turned, leaks to Karla, so he learns you're onto them.
    - **What the other side learns.** Does Karla see that the agent is gone, or only notice the leaks stopping?
- **Dead end:** with every Scalphunter dead and all Recruit attempts used, there was no way left to move the game forward. Pieces only ever run out; nothing replenishes.

### Overall verdict (end of playtest 1)
- **Not fun as it stands.** A clearer UI would help, but the mechanics need revisiting.
- **Free-form text is effectively useless.** Whatever you write collapses to one of a handful of verbs, so it never felt as if the words mattered.
- **It feels like chess, not a spy role-play.** Abstract pieces in a rock-paper-scissors fight, rather than people, trust and information.
- Clara Vance's "Istanbul is quiet on my side, London" is the same invented-facts bug. That reply was written before the fix loaded (the current check rejects this exact text). Reload the page after updates; a reply already in a saved game stays as written.

### Addressed in v2 (2026-11-24)
Typing removed (click orders); map-first war room with landmarks, territories and portraits;
drag-and-drop setup; role icons; who-beats-who replaced by the visual "exchange" in the Field Manual;
grouped, attributed traffic (events, sources, reports); clear causes for every event; vet and
execute for moles; no dead ends from depleted pieces (anyone but Talent-spotters can strike;
recruitment has no per-game cap).

---

## Playtest 2 (2026-11-24, Majed, v2 vs Karla)

### Verdict
- More fun than v1. The game UX is "much better"; the selectors need work.

### Notes
- Confused by the end screen: it said Karla had a sleeper in my network from the start. I didn't know games could start with moles, and it isn't balanced across both sides, so remove it.
- The end screen said Karla had 0 turned, though someone on my side had definitely turned. (Likely cause: the mole died before the end. A dead mole scores as a kill, not a turn, and the screen didn't say so.)
- The selectors cover too much of the screen and are clunky; cut down the clicks it takes to give an order.
- Karla felt too passive. His moves were obvious, and I could be very aggressive with my Scalphunters. (Cause: his instructions said to trap only where Control was seen preparing, and Scalphunters never prepare. Kills also never told him who the killer was.)
- Three approaches to turn someone is too many: make it two. Approaches shouldn't be reported. Moles should only be caught by paying attention: learning roles and reading their reports.
- Roles should be harder to work out. Only Lamplighters should be able to surveil; other agents report only preparations, attacks and traps, with no role information. Dead agents shouldn't give up their roles either.
- Bring back the notebook to track agents, as a tab in the right-hand panel.

### Addressed (2026-11-24)
All of the above. Balance watch: in bot games, about two agents per side end up turned. Two unseen approaches are strong; Ferrets now quietly block approaches in their city.

### Follow-up notes (after playtest 2 changes)
- Kills should reveal nothing, moles included.
- Keep silent approaches: they push players to keep agents moving and get them vetted, which is how real espionage works. People get turned often, and trust is hard.
- Remove the suspicion tags; the player should have to notice suspicion for themselves.
- Moles should be able to frame other moles. When a mole is given orders, its handlers should decide how it responds, rather than it always failing.
- Try 10 agents a side: one more Lamplighter and one more Ferret each.
- Fewer clicks: arrow-key navigation? The scrollbar on the setup tray is annoying.

**Addressed (2026-11-24):** all of the above. Keys: arrows cycle agents, letters give orders,
number keys pick targets and cities, Backspace undoes, Enter ends the week, and the next idle agent
is selected automatically. Setup is click-then-city or keys 1–6, with no scrolling.

### Follow-up 2
- The hotkeys weren't helpful.
- Viewing a city only showed the one agent, not who else was there. Bring back the view of a city full of agents.

**Addressed (2026-11-24):** hotkey hints, number keys and auto-advance removed (Escape still closes).
Clicking a city opens a compact panel listing everyone there, ours and theirs; clicking a row opens
the order popover beside it.

### Follow-up 3
- The UI for cancelling an order is horrible: every one of the five queued orders should be undoable.
- Yes to arrow-key navigation of the map and city menus. No to standing orders. Yes to dragging tokens.
- The debrief strayed: it should be a visual, week-by-week view of what was really happening behind the scenes (Karla's moves included), showing where the momentum shifted. Cut the diary.

**Addressed (2026-11-24):**
- **Order bar:** across the bottom, one slot per order, each with ✕ to cancel and click to revisit.
- **Arrow keys:** move a highlight through cities, the people in a city, their orders, then targets. Enter chooses, Escape steps back.
- **Dragging:** drag a token onto a city to move it; drag it onto an enemy for the obvious action (strike, approach or prepare).
- **New debrief:** a momentum chart marking where the game turned, a week-by-week replay map showing true roles, moles and moves, and both sides' orders for each week.

### Follow-up 4: debrief
- Much better, but the structure is scattered: it reads as snapshots, not as one story. Use the LLM to
  synthesize the key points: where agents were recruited, whether particular information swayed the
  outcome, and the critical mistakes (attacking, or failing to defend, despite what was known). Show
  that on the week-by-week chart.
- The replay map shows only movements, which nobody needs. A map only makes sense for one pivotal
  week: the battleground, and what information each side had.
- Both sides' orders, week by week, are too much noise after half an hour of play.
- Keep the two rosters, ordered alive first, then killed.
- The score should be agents left alive and on your side, with lost and turned as substats.

**Addressed (2026-11-24):** Claude (Opus) writes the after-action analysis: headline, summary, 4–8
key moments pinned to the week-by-week chart, and the pivotal battleground (a zoomed map with true
roles and moles, plus what each side knew). A rules engine does the same if Claude is unavailable.
The replay and order strip are gone, and the rosters are ordered standing, then turned, then lost.
Scoring is now agents standing.

### Follow-up 5: debrief, after Claude's version
- Better, but text-heavy. Prefer minimalist layouts, more blank space, and colour or shapes instead
  of words ("in Karla's favour" doesn't need saying).
- The pivotal battleground listed what each side knew, without synthesis. It should show the
  pivotal exchange: information one side fed the other (or gave away) and what it led to.

**Addressed (2026-11-24):** colour-coded moments and pins with one-line details; the decisive
exchange (heard → acted → result, with planted/leaked/report marked); icon fates; "Ask the analyst"
to redo a rules-engine debrief.

### Follow-up 6: tells, traps and traffic
- Signs of preparation are too straightforward. Make behaviours sound alike (setting a trap,
  surveillance, preparing), so they are easier to miss or misread.
- Traps are called loud but an unsprung trap produces nothing.
- Agents commenting on each other is interesting; sometimes too much, sometimes too little. More
  ambient observation from agents just sitting in cities.
- Strikes shouldn't give much away: a Scalphunter's strike and a prepared one should look the same
  once they land; only the footprints before differ.
- Put the odds where players can see them.

**Addressed (2026-11-24):** shared footprints with published odds (Field Manual), Lamplighters see
the truth, one-night traps (Ferrets tonight or next week, others next week and loud), Scalphunters
may prepare, identical news for every strike, about 7 messages a morning.

## Playtest 3 (2026-11-24, second player, vs Karla: Claude for week 1 only)
- The game server went down after week 1; Karla silently fell back to the offline bot for weeks
  2-12 ("Proxy unreachable"), and the debrief came from the rules engine.
- Control killed 7 of Karla's 10 (one Scalphunter, Pell, killed five without warning); the bot never
  hunted him. Karla turned four Control agents, none detected. The only vetting Ferret was itself a
  mole by then and cleared everyone; moles framed three loyal agents.
- The debrief said Control won 4-2 on "own agents standing"; counting agents working for each side
  it was Karla 6-5, which matched what the players felt.

**Addressed (2026-11-24):** scoring counts turned agents for the side that turned them; the debrief
groups people by allegiance; a visible "Offline Karla" warning; Save case file.

### Follow-up 7: debrief (after playtest 3)
- **Score header:** too much redundant text. Drop the bottom grey line ("2 lost · 4 went over").
- **Moment numbers:** the numbered circles (1–7) read as week numbers to a first-time player. Show
  the week itself, larger, instead of a sequence number. The second player didn't see that the
  moments referred to specific weeks.
- **Decisive exchange map:** too crowded with icons. Every role badge, mole tag and side ring at
  once is overwhelming, a "clusterfuck of colour". Rethink what this visual should show.
- **People columns:**
  - Don't use "Brit" / "Russian" on the page (that was only shorthand in conversation).
  - Keep the colour showing which side someone started on, and the week they turned. Capitalise
    "Turned".
  - How each person met their end (icon, week, city) matters more than their role, and is too
    small. Make the fate the focus.
  - Role: icon only, no label (players know the icons by now), moved to the right, away from the
    name; the columns have plenty of empty space.

### Follow-up 8: title screen
- Replace the three mode buttons with toggles or sliders of set options:
  - opponent: Claude or the offline bot;
  - players: one or two.
- New option: number of agents per side (6, 8 or 10). Watching the second player, 10 agents felt
  like too many to keep track of, and too long and slow a game. To experiment with.
- The tagline ("Know who they are. Know who is still yours.") is weak. Find something cleverer,
  avoiding the typical AI two-sentence parallel phrasing.
- Remove the Owner token link from the title screen entirely.
- Move the Field Manual link to its own place at the bottom.
- Roster for 6 agents: 2 Scalphunters, 2 Lamplighters, 1 Ferret, 1 Talent-spotter.

### Follow-up 9: playing screen
- **The city panel overlapping Traffic is crappy and complicated.** Make the city a tab in the
  right-hand panel instead, called **Station** (not "city view").
  - Tab order: Traffic, Station, Ours, Theirs. Smaller tab text so all four fit.
  - Traffic shows by default. Clicking a traffic item opens the Station tab for that city;
    clicking a city on the map does too. You can always switch back to Traffic.
  - Drop "wk 1" next to Traffic: each traffic item already shows its week.
- **The order popover is unintuitive.** Group the orders so they're easier to digest, and so
  players learn what each role can do. Two options:
  - by intent: Attack (prepare, strike), Defend (trap next week / tonight), Evade (lie low, move),
    and Feed;
  - or common orders shared by everyone, plus a "special" group per role: Scalphunter "Instant
    strike", Ferret "Instant trap" (use those words), Lamplighter "Surveil", Talent-spotter
    "Approach".
- Trusted / Suspect / Mole in the popover is good.
- **Execute is ambiguous** (a lone icon). Show an Execute button only once an agent is marked Mole,
  right beside that mark.
- Playtest question: "I couldn't get near Molnar. Someone on their side is keeping their people
  close." The Ferret approach block is still in the rules (it was discussed, not removed).
