# Player construction / housing foundation

MassRPG housing is persistent shared-world construction rather than an instanced portal-house system.

The first C# foundation deliberately separates **current ownership** from the **future Large-tier reservation**:

- a new plot starts at `Small` tier;
- its currently claimed logical tiles are the area the owner presently controls;
- its reserved tile envelope is fixed at placement time and represents the maximum area the plot may eventually occupy;
- neighboring plot placement validates against that full reserved envelope, preventing a later Medium/Large upgrade from being boxed in;
- exact Small/Medium/Large tile counts and upgrade-shape policy stay data/design configurable rather than being hard-coded into the foundation.

`IPlotPlacementMap` is the server-side validation hook for terrain and world restrictions. The eventual authored world implementation will reject water, cliffs/unsuitable slopes, protected POIs, no-build layers, major structures and other forbidden ground through that interface.

## Access

Plots are not generic hard blockers to everyone. Physical fences, gates, doors and building pieces govern ordinary movement. The explicit owner blocklist is stronger: a blocked character may not enter any currently claimed tile of that plot even when there is no fence or the gate is open. The restriction ends at the actual plot boundary and must not make adjacent public roads impassable.

Owners can create reusable named permission rulesets such as `Farmhand`, `Outer Gate`, or `Full Access`. Permissions include entering, gates, doors, containers, farming, building, demolishing and managing access. There is no arbitrary small cap on how many players can be assigned.

Normal player housing remains invulnerable to other players. Any future siege/guild-war/lawless destruction system must be an explicit exception rather than changing the baseline plot ownership model.
