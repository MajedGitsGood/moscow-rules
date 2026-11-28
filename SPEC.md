# Moscow Rules v2: design

Replaces the v1 design (free-text cables, rock-paper-scissors combat) after playtest 1 found it
"chess with a typing tax". See FEEDBACK.md and DECISIONS.md for why. The visual design board is
`docs/design-v2.html`.

## Fantasy
Outmanoeuvre Karla. Mostly intelligence work; rare, readable violence; deception through moles.

## Board
Six cities (London, Moscow, four drawn from a spread-out pool). Every agent's position is public.
Roles and loyalty are hidden. Moving to any city takes one week. Setup is secret, by drag and drop,
at most three per city.

## Roster
Ten agents a side (2 Scalphunters, 3 Lamplighters, 3 Ferrets, 2 Talent-spotters), no reinforcements.
- Scalphunter: may strike without preparing (no footprints beforehand), or prepare like anyone.
- Lamplighter: the only one who can surveil (reveals every role in the city); sees preparations,
  traps and surveillance in its city for what they are, and always witnesses attacks.
- Ferret: can trap the same night;
  notices surveillance; vets your own agents.
- Talent-spotter: turns an enemy after three approaches; two Talent-spotters pitching the same target
  in one week both count. Never reported; cannot kill or trap.

## Orders (five a week, one per agent)
Move, Surveil, Lie low, Prepare (a strike on someone in the same city, usable the next week only), Strike, Set trap, Approach,
Vet, Feed (give an agent a fake order: they do nothing, but a mole who hears of it passes it on exactly
like a real one), and for enemy agents you
have turned, choose their lie. Executing one of your own agents is free.

## Resolution
Leaks (orders to turned agents reach the turner), moves, traps, strikes, preparations, approaches,
vetting, then reports. A strike kills unless the target's side has a trap in the city that night (the
attacker dies) or the target is lying low (nothing happens). Traps catch on one night only: a
Ferret's tonight, anyone's next week after a loud week of setting up.

**Footprints.** Every order leaves a footprint that enemies in the same city may notice, drawn from
one shared pool (asking about someone, turning up where someone goes, a room overlooking a landmark,
unfamiliar faces, meeting someone off the night train, regular hours). Odds per order live in
`TELLS` (js/world.js) and are shown in the Field Manual. Approaches look like doing nothing; lying
low leaves nothing; a strike leaves no footprint, only witnesses (Lamplighters always, others half
the time), who name the actor but never the role, the same for every kind of striker. Each agent
sends at most one report a week, with up to three observations. Roles are learned only from Lamplighters. No sleepers. Lying low is quiet:
invisible to reports and strikes. Turned agents leak, lie (all quiet, false alarm, frame a
colleague, other moles included), and follow a standing instruction from the side that turned
them: carry out their own side's orders, or quietly let strikes, traps, approaches and vetting fail.
A mole also reports, each week, what each colleague in its city has been ordered and what role they are.
The player is never shown suspicion tags.

## Scoring
The side with the most agents working for it at the end wins: its own agents still alive and loyal,
plus enemy agents it turned who are still alive. Turning an agent is a two-agent swing; a death
(including an execution) is one. Twelve weeks, or until one side has no agents.
Human players can surrender.
