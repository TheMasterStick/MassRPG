# Unity migration status

This file tracks source-system disposition so the browser version stays useful as a mechanical reference while the Unity/C# implementation becomes canonical.

| Browser source | Unity destination | Status | Notes |
| --- | --- | --- | --- |
| `src/systems/CombatMath.ts` | `MassRPG.Core/Combat` | Parity ported + tests | Pure formulas are engine-independent. |
| `src/entities/Player.ts` | `MassRPG.Core/Characters/PlayerState.cs` | Initial state ported | Simulation state is separated from Unity presentation; movement/combat/production state now lives server-side. |
| `src/data/skills.ts` | Core/Data skill definitions | Initial port complete | 1-99 parity retained; MassRPG ceiling is 300. XP above 99 remains balanceable. |
| `src/data/items.ts` | `MassRPG.Data/Items` | Schema + migration seed catalog | Stable `ContentId` is canonical; bulk content migration remains. |
| `src/systems/Inventory.ts` | `MassRPG.Core/Inventory` | Core rules ported + tests | Settled slots, dual rings, 2H/shield exclusion, requirements and combat gear-lock rules are represented. |
| `src/systems/Combat.ts` | Core + Server | Authoritative foundation active | Player auto-attacks plus creature aggro/chase/leash/attack resolution are server-owned. Range/LOS, cooldowns, elevation accuracy, side-preserving crowd movement and authoritative damage contribution tracking are represented. Final XP/loot distribution remains. |
| `src/systems/Gathering.ts` | Core + Server | Authoritative foundation active | Resource definitions, personal/shared depletion ledgers, deterministic node keys and gathering authority are present. |
| `src/systems/Production.ts` / `src/data/recipes.ts` | Data + Core state + Server | Authoritative foundation active | Published recipe IDs, timed production state, station validation, material consumption, outputs, XP and authority requests are present. Seed smelting recipes include the settled 2 Dragonite ore + 2 coal rule. Cooking burn/failure outputs and broader recipe migration remain. |
| `src/systems/Construction.ts` | Core + Server | Persistent plot foundation active | Shared-world plots now reserve future Large-tier space, expose configurable named access rules and enforce owner blocklists. Piece placement/support/upkeep/blueprints remain. |
| `src/systems/Pathfinding.ts` | `MassRPG.Core/World` | Canonical foundation ported + tests | Eight directions, exact 1x1 grid, no diagonal corner squeezing, explicit elevation transitions, local pathfinding and LOS. |
| `src/world/World.ts`, `WorldGen.ts` | Authored world storage/streaming | Replacement foundation active | 180k authored world pages, sparse page store and versionable documents are present; procedural geography is not being ported as canonical truth. |
| `src/world/Editor*` | `MassRPG.EditorCore` / `MassRPG.Editor` | Production-bound foundation active | Editor modes, brushes, edit sessions, semantic regions/POIs/roads and page editing exist. Exact undoable ramp/barrier edge tools now exist beneath the future UI. |
| `src/core/Renderer.ts`, sprite code | `MassRPG.Client` | Do not port | Replaced by true low-poly 3D Unity presentation. Legacy character sprite source folders are retired from this branch. |
| browser DOM UI | `MassRPG.Client` UI | Rebuild | Preserve interaction behavior, not DOM implementation. |

## Authority boundary

`MassRPG.Core.Authority` defines requests/decisions and `MassRPG.Server.Authority.LocalGameAuthority` is the in-process authoritative host used before networking. Inventory, equipment, movement, gathering, production and combat-target requests already cross this boundary. Combat advancement, creature AI and production completion are server-owned; the client does not choose attack cadence, hit chance, damage, recipe timing or outputs.

## World/editor foundation

The world is represented as authored data rather than millions of GameObjects. Logical tiles are exact 1x1 cells, terrain plane and building storey are separate, and storage pages are separate from semantic regions. POIs, roads and overlapping world-area layers are independent authored data. Published data has manifest/version/rollback foundations.

Normal unequal-elevation boundaries remain non-traversable unless an explicit transition exists. Editor-core ramp operations only connect cardinal neighbors whose logical elevation differs by exactly one and are fully undoable. Barrier authoring keeps movement blocking separate from ranged line-of-sight blocking, allowing fence/hedge-style movement-only blockers and wall-style movement+LOS blockers.

## Creature/resource sleeping state

Resources store only exceptional depletion state. Personal and shared nodes are separate authority modes. Deterministic biome nodes can therefore exist without permanent database rows while untouched.

Ordinary creature spawn regions likewise maintain compact logical population + timestamp state. Sleeping a region removes ordinary runtime actors without resetting population. Returning quickly preserves depletion; elapsed time gradually matures respawns. Ordinary actors may rematerialize with new identities. Named/persistent creatures remain an explicit separate case.

Materialized population creatures now register with the soft-occupancy index and carry an internal runtime mapping back to their spawn region. When authoritative player combat kills one, the authority routes that death into the population record, removes its occupancy/runtime actor, decrements population and starts the gradual respawn timer.

Creature combat movement uses a side-preserving planner on top of soft creature occupancy. Aggressive creatures acquire nearby players, chase within their home leash and attack on server-owned cooldowns. Neutral creatures do not initiate but can retaliate; passive creatures never attack. Mobs approaching from one side prefer that side's attack arc instead of tactically circling to the opposite side simply because nearby creature tiles are occupied. A filled one-tile approach therefore naturally creates queues/conga-lines.

## Combat contribution foundation

Authoritative player damage now emits contribution events into an optional server ledger. The ledger records total damage, per-character damage, first engager and timing without deciding final rewards. A separate configurable eligibility policy can impose minimum damage and/or minimum contribution fraction. This intentionally avoids baking arbitrary anti-power-leveling percentages into combat before group/XP/loot balancing is finalized.

## Player plot foundation

Persistent player plots keep current claimed tiles separate from an immutable maximum future reservation. New plot placement checks the entire reserved envelope, so another plot cannot later prevent an existing Small plot from growing toward Medium/Large. Exact tier sizes and final upgrade-shape policy remain data/configurable.

Plots support unlimited reusable named access rulesets. The owner blocklist overrides every permission and makes only the actual claimed plot tiles impassable to that character; nearby public ground remains public. Physical fences/gates/doors remain the normal world-space access mechanism for everyone else.

## Automated test coverage authored so far

Editor test assemblies cover XP/skills, combat math, inventory/equipment, requirements and gear locks, local authority validation, diagonal movement/corner blocking, exact ramps/barriers, ranged LOS rules, world page serialization, semantic areas/POIs, editor sessions, published-data versions, resource depletion/gathering, creature footprints/occupancy, combat targeting, authoritative player auto-attacks, aggressive/neutral/passive creature combat behavior, leash/cooldowns, sleeping creature populations, combat-death-to-respawn integration, approach-direction crowding, configurable combat contribution eligibility, timed production/smelting, and persistent plot reservation/access behavior.

These tests are committed but still need their first actual Unity Test Runner pass after the project is opened with the chosen Unity 6 revision.

## Next implementation batch

1. Build reward settlement on top of contribution facts: party-aware XP sharing, first-engager context and one shared loot pool, while keeping exact anti-power-level thresholds configurable.
2. Expand published item/recipe catalogs into cooking, fletching, crafting, Herblore and smithing equipment.
3. Extend construction with modular pieces, three-storey support validation, plot upgrades, upkeep/abandonment and reusable building blueprints.
4. Continue the World Editor toward the full tactile authoring UI: palette/tool/brush workflow, overlays, deterministic biome dressing overrides, autosave/recovery, search, minimap and Play From Here.
5. Once the exact Unity 6 revision is known, generate/commit real `ProjectSettings` and `Packages`, import the 3D character bases, and run the full compile/test pass.
