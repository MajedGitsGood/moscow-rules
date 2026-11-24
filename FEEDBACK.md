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
