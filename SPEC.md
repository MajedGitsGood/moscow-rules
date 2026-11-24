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
- Scalphunter: strikes without preparing, so there's no warning.
- Lamplighter: the only one who can surveil (reveals every role in the city); always notices
  preparations, traps and attacks.
- Ferret: traps work the same night; silently blocks approaches on its side's agents in its city;
  notices surveillance; vets your own agents.
- Talent-spotter: turns an enemy after two approaches, never reported; cannot kill or trap.

## Orders (five a week, one per agent)
Move, Surveil, Lie low, Prepare (a strike on someone in the same city), Strike, Set trap, Approach,
Vet, Brief (tell an agent about a plan: only matters if they are a mole), and for enemy agents you
have turned, choose their lie. Executing one of your own agents is free.

## Resolution
Leaks (orders to turned agents reach the turner), moves, traps, strikes, preparations, approaches,
vetting, then reports. A strike kills unless the target's side has a ready trap in the city (the
attacker dies) or the target is lying low (nothing happens). Preparations, traps and attacks are
noticed by enemies in the city (Lamplighters always, others half the time); a witness names the actor
but never the role. Roles are learned only from Lamplighters. No sleepers. Lying low is quiet:
invisible to reports and strikes. Turned agents leak, lie (all quiet, false alarm, frame a
colleague, other moles included), and follow a standing instruction from the side that turned
them: carry out their own side's orders, or quietly let strikes, traps, approaches and vetting fail.
The player is never shown suspicion tags.

## Scoring
Every enemy agent who dies is a point, however they die (including executions). Every enemy agent
still alive and turned by you at the end is a point. Twelve weeks, or until one side has no agents.
Human players can surrender.
