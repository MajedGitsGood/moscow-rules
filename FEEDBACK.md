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
