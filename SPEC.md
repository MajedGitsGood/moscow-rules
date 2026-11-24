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
Eight agents a side, two of each role, no reinforcements.
- Scalphunter: strikes without preparing; interrogates whoever it kills (their role, and one of
  your agents their side had turned).
- Lamplighter: surveillance reveals every role in the city; always notices preparations and traps.
- Ferret: traps work the same night; notices surveillance and approaches; vets your own agents.
- Talent-spotter: turns an enemy after three approaches; cannot kill or trap.

## Orders (five a week, one per agent)
Move, Surveil, Lie low, Prepare (a strike on someone in the same city), Strike, Set trap, Approach,
Vet, Brief (tell an agent about a plan: only matters if they are a mole), and for enemy agents you
have turned, choose their lie. Executing one of your own agents is free.

## Resolution
Leaks (orders to turned agents reach the turner), moves, traps, strikes, preparations, approaches,
vetting, then reports. A strike kills unless the target's side has a ready trap in the city (the
attacker dies) or the target is lying low (nothing happens). Preparing, trapping and approaching are
loud: enemies in the city are likely to report them (Lamplighters always). Lying low is quiet:
invisible to reports and strikes. Turned agents leak, lie (all quiet, false alarm, frame a
colleague), and quietly fail at strikes, traps and vetting.

## Scoring
Every enemy agent who dies is a point, however they die (including executions). Every enemy agent
still alive and turned by you at the end is a point. Twelve weeks, or until one side has no agents.
Human players can surrender.
