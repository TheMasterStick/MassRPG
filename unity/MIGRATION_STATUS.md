# Unity migration status

This file tracks source-system disposition so the browser version stays useful as a mechanical reference while the Unity/C# implementation becomes canonical.

**Production editor baseline:** Unity 6.3 LTS `6000.3.24f1` (`4e7b9b5b6244`). `ProjectSettings/ProjectVersion.txt` is pinned to this revision. Package/render-pipeline manifests still wait for the first real Unity project open so they are generated deliberately rather than guessed.

| Browser source | Unity destination | Status | Notes |
| --- | --- | --- | --- |
| `src/systems/CombatMath.ts` | `MassRPG.Core/Combat` | Parity ported + tests | Pure formulas are engine-independent. |
| `src/entities/Player.ts` | `MassRPG.Core/Characters/PlayerState.cs` | Initial state ported | Simulation state is separated from Unity presentation; movement/combat/production state now lives server-side. |
| `src/data/skills.ts` | Core/Data skill definitions | Initial port complete | 1-99 parity retained; MassRPG ceiling is 300. XP above 99 remains balanceable. |
| `src/data/items.ts`, `equipmentProgression.ts` | `MassRPG.Data/Items` | Broad migration catalog active | Stable browser IDs are retained. Metal tiers, broader weapon families, armour, tools, food, farming/Herblore, crafting/fletching content, equipment requirements and weapon timing are represented. Final live values remain publishable data. |
| `src/systems/Inventory.ts` | `MassRPG.Core/Inventory` | Core rules ported + tests | Settled slots, dual rings, 2H/shield exclusion, requirements and combat gear-lock rules are represented. Legacy ammo slot is intentionally not restored; ammunition remains content/inventory data. |
| `src/systems/Combat.ts` | Core + Server | Authoritative foundation active | Player auto-attacks plus creature aggro/chase/leash/attack resolution are server-owned. Range/LOS, cooldowns, elevation accuracy, side-preserving crowd movement and authoritative damage contribution tracking are represented. Final party XP/shared-loot settlement remains. |
| `src/systems/Gathering.ts` | Core + Server | Authoritative foundation active | Resource definitions, personal/shared depletion ledgers, deterministic node keys and gathering authority are present. |
| `src/systems/Production.ts`, `src/data/recipes.ts` | Data + Core state + Server | Broad authoritative migration active | Smelting, smithing equipment, cooking, fletching, leather/gem/jewellery crafting, Herblore and plank production are represented. Cooking burn/failure outputs and reduced failure XP are server-owned and data driven. Dragonite preserves the settled 2 ore + 2 coal rule. |
| `src/systems/Construction.ts` | Core + Data + Server | Persistent modular foundation active | Shared-world plots, future-Large reservation, access rules/blocklists, shape-neutral Small→Medium→Large upgrades, modular tile/edge pieces, three-storey support checks, player-built production stations, configurable prepaid upkeep lifecycle and reusable blueprint data are present. Full blueprint placement/trading and final live upkeep rates remain. |
| `src/systems/Pathfinding.ts` | `MassRPG.Core/World` | Canonical foundation ported + tests | Eight directions, exact 1x1 grid, no diagonal corner squeezing, explicit elevation transitions, local pathfinding and LOS. |
| `src/world/World.ts`, `WorldGen.ts` | Authored world storage/streaming | Replacement foundation active | 180k authored world pages, sparse page store and versionable documents are present; procedural geography is not being ported as canonical truth. |
| `src/world/Editor*` | `MassRPG.EditorCore` / `MassRPG.Editor` | Production-bound foundation active | Editor modes, brushes, edit sessions, semantic regions/POIs/roads and page editing exist. Exact undoable ramp/barrier edge tools exist beneath the future tactile Unity UI. |
| `src/core/Renderer.ts`, sprite code | `MassRPG.Client` | Do not port | Replaced by true low-poly 3D Unity presentation. Legacy character sprite source folders are retired from this branch. |
| browser DOM UI | `MassRPG.Client` UI | Rebuild | Preserve interaction behavior, not DOM implementation. |

## Authority boundary

`MassRPG.Core.Authority` defines requests/decisions and `MassRPG.Server.Authority.LocalGameAuthority` is the in-process authoritative host used before networking. Inventory, equipment, movement, gathering, production and combat-target requests already cross this boundary. Combat advancement, creature AI and production completion are server-owned; the client does not choose attack cadence, hit chance, damage, recipe timing or outputs.

## World/editor foundation

The world is represented as authored data rather than millions of GameObjects. Logical tiles are exact 1x1 cells, terrain plane and building storey are separate, and storage pages are separate from semantic regions. POIs, roads and overlapping world-area layers are independent authored data. Published data has manifest/version/rollback foundations.

Normal unequal-elevation boundaries remain non-traversable unless an explicit transition exists. Editor-core ramp operations only connect cardinal neighbours whose logical elevation differs by exactly one and are fully undoable. Barrier authoring keeps movement blocking separate from ranged line-of-sight blocking, allowing fence/hedge-style movement-only blockers and wall-style movement+LOS blockers.

## Creature/resource sleeping state

Resources store only exceptional depletion state. Personal and shared nodes are separate authority modes. Deterministic biome nodes can therefore exist without permanent database rows while untouched.

Ordinary creature spawn regions likewise maintain compact logical population + timestamp state. Sleeping a region removes ordinary runtime actors without resetting population. Returning quickly preserves depletion; elapsed time gradually matures respawns. Ordinary actors may rematerialize with new identities. Named/persistent creatures remain an explicit separate case.

Materialized population creatures register with the soft-occupancy index and carry an internal runtime mapping back to their spawn region. When authoritative player combat kills one, the authority routes that death into the population record, removes occupancy/runtime actor, decrements population and starts the gradual respawn timer.

Creature combat movement uses a side-preserving planner on top of soft creature occupancy. Aggressive creatures acquire nearby players, chase within their home leash and attack on server-owned cooldowns. Neutral creatures do not initiate but can retaliate; passive creatures never attack. Mobs approaching from one side prefer that side's attack arc instead of tactically circling to the opposite side merely because nearby creature tiles are occupied.

## Combat contribution foundation

Authoritative player damage emits contribution events into an optional server ledger. The ledger records total damage, per-character damage, first engager and timing without deciding final rewards. A separate configurable eligibility policy can impose minimum damage and/or minimum contribution fraction. This intentionally avoids baking arbitrary anti-power-leveling percentages into combat before group/XP/loot balancing is finalized.

## Player construction foundation

Persistent player plots keep current claimed tiles separate from an immutable maximum future reservation. New plot placement checks the entire reserved envelope, so another plot cannot later prevent an existing Small plot from growing toward Medium/Large. Upgrade footprints are accepted as data and must remain a superset of existing land inside that reservation, so final tier dimensions/shape policy can be changed without rewriting plot persistence.

Modular construction now distinguishes tile pieces from cardinal-edge pieces and surface/structure/fixture/roof occupancy. Physical wall edges canonicalize both neighbouring-tile representations so the same wall cannot be placed twice. The baseline support model permits three usable storeys (0/1/2), requires supported upper floors, requires upper fixtures/walls to stand on floors, requires roofs to have wall support and prevents stairs from implying a fourth usable level. This is intentionally a sensible-support rule set rather than structural physics.

Player-built furnace/anvil/loom/tannery/cooking-range definitions expose the same station IDs used by authoritative production, so housing is already capable of hosting working skilling stations at the rules layer.

Upkeep is policy driven: gold-per-day rates are supplied by configuration rather than hard-coded balance. Plots can prepay multiple days, then move Active → Delinquent → Abandoned after a configurable grace period. The service only marks abandonment; destructive reclamation remains a separate explicit server action. A 30-day grace period can therefore be tested without freezing it as final balance.

`BuildingBlueprint` stores reusable relative piece arrangements independently from world ownership. This is the persistence foundation for save/reuse and eventual blueprint trading; atomic whole-blueprint placement/preview is still pending.

## Automated test coverage authored so far

Editor test assemblies cover XP/skills, combat math, inventory/equipment, requirements and gear locks, local authority validation, diagonal movement/corner blocking, exact ramps/barriers, ranged LOS rules, world page serialization, semantic areas/POIs, editor sessions, published-data versions, resource depletion/gathering, creature footprints/occupancy, combat targeting, authoritative player auto-attacks, aggressive/neutral/passive creature combat behavior, leash/cooldowns, sleeping creature populations, combat-death-to-respawn integration, approach-direction crowding, configurable combat contribution eligibility, broad migrated item/recipe coverage, cooking failure behavior, timed production/smelting, modular construction edge occupancy/support/stations, plot upgrades, upkeep lifecycle and blueprint coordinate resolution.

These tests are committed but still need their first actual Unity Test Runner pass after the project is opened in `6000.3.24f1`.

## Next implementation batch

1. Build party-aware reward settlement on top of contribution facts: XP eligibility, first-engager context and one shared party loot pool, while keeping anti-power-level thresholds configurable.
2. Add atomic building-blueprint preview/placement and then modular demolition/refund policy; keep blueprint trading as a later economy layer.
3. Continue construction persistence with explicit reclaim/removal handling for abandoned plots and a configurable plot-tier upgrade-cost policy without inventing final Small/Medium/Large dimensions.
4. Continue the World Editor toward the full tactile authoring UI: palette/tool/brush workflow, overlays, deterministic biome-dressing overrides, autosave/recovery, search, minimap and Play From Here.
5. Begin the Unity client shell against the now-pinned 6.3 LTS revision: logical-grid presentation bridge, bounded oblique camera, click-selection/request adapters and streamed chunk views.
6. On the first home-PC open, let Unity generate/resolve real package metadata, import the canonical 3D character bases, then run the full compile/Test Runner pass and fix every compile/parity failure before visual production proceeds.
