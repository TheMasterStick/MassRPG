# MassRPG pre-first-Unity-open status

This is the short operational handoff for the first local Unity 6.3 LTS (`6000.3.24f1`) session. The canonical branch is `chatgpt/unity-csharp-migration`.

## What is already migrated far enough to compile/test outside Unity

The engine-independent C# side now contains foundations for:

- permanent content IDs, 18 skills, XP/levels and combat level;
- inventory, Main Hand/Off Hand equipment, requirements, ranged ammunition and per-equipped-item durability;
- authored 180,000 x 180,000 logical world storage, pages, elevation, barriers, ramps, pathfinding and ranged LOS;
- interaction target/action ordering;
- authoritative movement/action boundary;
- resource nodes, gathering and depletion/respawn;
- production, cooking failures, farming and firemaking;
- creature definitions, population sleeping/materialization, aggro/chase/leash and combat;
- player combat, contribution tracking, combat XP, creature kill settlement, loot tables, protected ground loot and all four party loot modes;
- banking, shops and food consumption;
- PvE death/respawn and configurable durability loss;
- voluntary/forced/protected-zone PvP, skull state, player-vs-player weapon combat and separate skulled-vs-defender PvP death settlement;
- data-driven spells with reagents/cooldowns/range/LOS, creature damage, self-heal and PvP-gated player damage;
- NPC definitions/services and server-validated dialogue graphs;
- quest definitions, prerequisites, objectives, rewards and stable-ID quest persistence;
- parties;
- fast-travel activation, destination-map commit, costs, combat gating and arrival protection;
- shared-world housing plots, permissions/blocklists, three-storey modular construction, support rules, built production stations, atomic blueprints, upkeep and explicit reclamation;
- player, bank, respawn and fast-travel persistence snapshots;
- publication/version/rollback foundations.

GitHub Actions compiles `Core`, `Data` and `Server` as pure C# and runs the engine-independent NUnit subset on every relevant push. This has already found and driven fixes for real compile/test regressions during the migration. It is useful preflight coverage, but it is not a substitute for Unity's compiler, asmdef resolution or Test Runner.

## Unity-facing source already present

- logical-grid-to-local-world presentation bridge and floating-origin support;
- bounded oblique camera rig;
- interpolated actor view;
- authored terrain chunk mesh builder and nearby chunk streaming;
- presentation asset IDs/catalog/linking;
- initial equipment visual binding;
- Unity cursor raycast collector that converts presentation hits into logical interaction targets and delegates action ordering to Core rules;
- World Overview, exact 1x1 authoring, roads, areas, POIs, placements, creature spawn authoring, biome dressing, recovery and Play From Here foundations.

## First local Unity session -- do this before content production

1. Open `unity/` from the canonical branch in Unity `6000.3.24f1` and let Unity generate/resolve the real package metadata.
2. Fix every Unity/asmdef/API compiler error. Do not begin world or art production while the Console is red.
3. Run the complete EditMode Test Runner, including Unity-dependent tests that GitHub's pure-C# CI deliberately skips.
4. Enter Play From Here on a tiny authored patch and verify terrain chunk loading, ramps/cliffs, movement/pathfinding, camera, floating origin and interaction raycasts.
5. Verify one vertical gameplay chain: move -> target creature -> combat -> kill -> XP/loot -> pick up item -> bank/shop/production interaction.
6. Import the canonical character bases only after the project itself is stable enough to distinguish asset/rig issues from migration/compiler issues.

## Main work still after first open

The migration is no longer blocked mainly by missing RPG rules. The largest remaining areas are Unity integration and MMO infrastructure:

- connect logical interaction options to concrete authority requests and UI feedback;
- production creature/NPC/resource/object/ground-item views and pooling;
- terrain material/ground-ID binding, water and production-quality chunk visuals;
- inventory/equipment/bank/shop/production/farming/firemaking/quest/dialogue/spell/party/PvP UI;
- map/minimap, waypoint and route-planner presentation;
- full fast-travel map transition presentation;
- body-fitted skinned armour after canonical rigs exist;
- aggregate persistence integration for newer quest/durability/PvP state;
- database/account/character selection, network transport, headless server, interest management and deployment;
- actual Twin Lands world/content authoring and art production.

The browser version remains reference material. Do not revive its procedural geography or 2D renderer as canonical Unity architecture.
