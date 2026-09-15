# Unity migration status

This file tracks source-system disposition so the browser version stays useful as a mechanical reference while the Unity/C# implementation becomes canonical.

| Browser source | Unity destination | Status | Notes |
| --- | --- | --- | --- |
| `src/systems/CombatMath.ts` | `MassRPG.Core/Combat` | Parity ported + tests | Pure formulas are engine-independent. |
| `src/entities/Player.ts` | `MassRPG.Core/Characters/PlayerState.cs` | Initial state ported | Simulation state is separated from Unity presentation; movement/combat/production state now lives server-side. |
| `src/data/skills.ts` | Core/Data skill definitions | Initial port complete | 1-99 parity retained; MassRPG ceiling is 300. XP above 99 remains balanceable. |
| `src/data/items.ts` | `MassRPG.Data/Items` | Schema + migration seed catalog | Stable `ContentId` is canonical; bulk content migration remains. |
| `src/systems/Inventory.ts` | `MassRPG.Core/Inventory` | Core rules ported + tests | Settled slots, dual rings, 2H/shield exclusion, requirements and combat gear-lock rules are represented. |
| `src/systems/Combat.ts` | Core + Server | Authoritative foundation active | Click target, authoritative approach planning, range/LOS, attack cadence, hit/damage resolution, moving-target replanning and retaliation state are present. Creature-side attack resolution/loot/XP remain. |
| `src/systems/Gathering.ts` | Core + Server | Authoritative foundation active | Resource definitions, personal/shared depletion ledgers, deterministic node keys and gathering authority are present. |
| `src/systems/Production.ts` / `src/data/recipes.ts` | Data + Core state + Server | Authoritative foundation active | Published recipe IDs, timed production state, station validation, material consumption, outputs, XP and authority requests are present. Seed smelting recipes include the settled 2 Dragonite ore + 2 coal rule. Cooking burn/failure outputs and broader recipe migration remain. |
| `src/systems/Construction.ts` | Core/Server | Pending | Replace direct legacy behavior with persistent plot/building system. |
| `src/systems/Pathfinding.ts` | `MassRPG.Core/World` | Canonical foundation ported + tests | Eight directions, exact 1x1 grid, no diagonal corner squeezing, explicit elevation transitions, local pathfinding and LOS. |
| `src/world/World.ts`, `WorldGen.ts` | Authored world storage/streaming | Replacement foundation active | 180k authored world pages, sparse page store and versionable documents are present; procedural geography is not being ported as canonical truth. |
| `src/world/Editor*` | `MassRPG.EditorCore` / `MassRPG.Editor` | Production-bound foundation active | Editor modes, brushes, edit sessions, semantic regions/POIs/roads and page editing exist without depending on normal Unity inspectors. |
| `src/core/Renderer.ts`, sprite code | `MassRPG.Client` | Do not port | Replaced by true low-poly 3D Unity presentation. Legacy character sprite source folders are retired from this branch. |
| browser DOM UI | `MassRPG.Client` UI | Rebuild | Preserve interaction behavior, not DOM implementation. |

## Authority boundary

`MassRPG.Core.Authority` defines requests/decisions and `MassRPG.Server.Authority.LocalGameAuthority` is the in-process authoritative host used before networking. Inventory, equipment, movement, gathering, production and combat-target requests already cross this boundary. Combat advancement and production completion are server-owned; the client does not choose attack cadence, hit chance, damage, recipe timing or outputs.

## World/editor foundation

The world is represented as authored data rather than millions of GameObjects. Logical tiles are exact 1x1 cells, terrain plane and building storey are separate, and storage pages are separate from semantic regions. POIs, roads and overlapping world-area layers are independent authored data. Published data has manifest/version/rollback foundations.

## Creature/resource sleeping state

Resources store only exceptional depletion state. Personal and shared nodes are separate authority modes. Deterministic biome nodes can therefore exist without permanent database rows while untouched.

Ordinary creature spawn regions likewise maintain compact logical population + timestamp state. Sleeping a region removes ordinary runtime actors without resetting population. Returning quickly preserves depletion; elapsed time gradually matures respawns. Ordinary actors may rematerialize with new identities. Named/persistent creatures remain an explicit separate case.

Creature combat movement now has a side-preserving planner on top of soft creature occupancy. Mobs approaching from one side prefer that side's attack arc instead of tactically circling to the opposite side simply because nearby creature tiles are occupied. A filled one-tile approach therefore naturally creates queues/conga-lines.

## Automated test coverage authored so far

Editor test assemblies cover XP/skills, combat math, inventory/equipment, requirements and gear locks, local authority validation, diagonal movement/corner blocking, explicit ramps, ranged LOS rules, world page serialization, semantic areas/POIs, editor sessions, published-data versions, resource depletion/gathering, creature footprints/occupancy, combat targeting, authoritative auto-attack progression, sleeping creature populations, approach-direction crowding, and timed production/smelting.

These tests are committed but still need their first actual Unity Test Runner pass after the project is opened with the chosen Unity 6 revision.

## Next implementation batch

1. Add creature-side attack resolution/aggro/leash simulation on top of the new side-preserving movement planner.
2. Connect creature deaths to population respawn records, XP/contribution and eventual loot ownership.
3. Expand published item/recipe catalogs into cooking, fletching, crafting, Herblore and smithing equipment.
4. Begin the persistent player plot/construction authority model rather than direct-porting browser construction.
5. Continue the World Editor toward the full tactile authoring UI: palette/tool/brush workflow, overlays, search, minimap and Play From Here.
6. Once the exact Unity 6 revision is known, generate/commit real `ProjectSettings` and `Packages`, import the 3D character bases, and run the full compile/test pass.
