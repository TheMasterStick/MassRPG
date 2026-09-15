# Unity migration status

This file tracks source-system disposition so the browser version stays useful as a mechanical reference while the Unity/C# implementation becomes canonical.

**Production editor baseline:** Unity 6.3 LTS `6000.3.24f1` (`4e7b9b5b6244`). `ProjectSettings/ProjectVersion.txt` is pinned to this revision. Package/render-pipeline manifests still wait for the first real Unity project open so they are generated deliberately rather than guessed.

| Browser source | Unity destination | Status | Notes |
| --- | --- | --- | --- |
| `src/systems/CombatMath.ts` | `MassRPG.Core/Combat` | Parity ported + tests | Pure formulas are engine-independent. |
| `src/entities/Player.ts` | `MassRPG.Core/Characters/PlayerState.cs` | Initial state ported | Simulation state is separated from Unity presentation; movement/combat/production state now lives server-side. |
| `src/data/skills.ts` | Core/Data skill definitions | Initial port complete | 1-99 parity retained; MassRPG ceiling is 300. XP above 99 remains balanceable. |
| `src/data/items.ts`, `equipmentProgression.ts` | `MassRPG.Data/Items` | Broad migration catalog active | Stable browser IDs are retained. Metal tiers, broader weapon families, armour, tools, food, farming/Herblore, crafting/fletching content, equipment requirements and weapon timing are represented. Final live values remain publishable data. |
| `src/systems/Inventory.ts` | `MassRPG.Core/Inventory` | Core rules ported + tests | Main Hand / Off Hand are now the canonical hand semantics. Normal one-handed weapons may occupy either hand; shields use Off Hand; two-handed weapons occupy Main Hand and force Off Hand empty. Dual rings, requirements and combat gear-lock rules remain represented. |
| `src/systems/Combat.ts` | Core + Server | Authoritative foundation active | Player auto-attacks plus creature aggro/chase/leash/attack resolution are server-owned. Range/LOS, cooldowns, elevation accuracy, side-preserving crowd movement and authoritative damage contribution tracking are represented. Dual-wield equipment bonuses already resolve through equipped data; explicit alternating/off-hand swing cadence is intentionally not hard-coded until its combat balance is chosen. |
| `src/systems/Gathering.ts` | Core + Server | Authoritative foundation active | Resource definitions, personal/shared depletion ledgers, deterministic node keys and gathering authority are present. |
| `src/systems/Production.ts`, `src/data/recipes.ts` | Data + Core state + Server | Broad authoritative migration active | Smelting, smithing equipment, cooking, fletching, leather/gem/jewellery crafting, Herblore and plank production are represented. Cooking burn/failure outputs and reduced failure XP are server-owned and data driven. Dragonite preserves the settled 2 ore + 2 coal rule. |
| `src/systems/Construction.ts` | Core + Data + Server | Persistent modular foundation active | Shared-world plots, future-Large reservation, access rules/blocklists, shape-neutral Small→Medium→Large upgrades, modular tile/edge pieces, three-storey support checks, player-built production stations, configurable prepaid upkeep lifecycle and reusable blueprint data are present. Full blueprint placement/trading and final live upkeep rates remain. |
| `src/systems/Pathfinding.ts` | `MassRPG.Core/World` | Canonical foundation ported + tests | Eight directions, exact 1x1 grid, no diagonal corner squeezing, explicit elevation transitions, local pathfinding and LOS. |
| `src/world/World.ts`, `WorldGen.ts` | Authored world storage/streaming | Replacement foundation active | 180k authored world pages, sparse page store, page streaming/import and versionable documents are present; procedural geography is not being ported as canonical truth. |
| `src/world/Editor*` | `MassRPG.EditorCore` / `MassRPG.Editor` | Hand-paintable production UI started | `MassRPG -> World Editor` is now a real Unity editor window over canonical page data. Exact terrain, discrete elevation, Water/Deep Water, movement/LOS/no-build flags, brush strokes, coordinate jump, page streaming, dirty-page save and recovery autosave are wired. Ramp/barrier core exists; road/object/spawn/region/POI and macro-world UI remain. |
| `src/core/Renderer.ts`, sprite code | `MassRPG.Client` | Do not port | Replaced by true low-poly 3D Unity presentation. Legacy character sprite source folders are retired from this branch. |
| browser DOM UI | `MassRPG.Client` UI | Rebuild | Preserve interaction behavior, not DOM implementation. |

## Authority boundary

`MassRPG.Core.Authority` defines requests/decisions and `MassRPG.Server.Authority.LocalGameAuthority` is the in-process authoritative host used before networking. Inventory, equipment, movement, gathering, production and combat-target requests already cross this boundary. Combat advancement, creature AI and production completion are server-owned; the client does not choose attack cadence, hit chance, damage, recipe timing or outputs.

## Equipment / dual wield

The two physical hand slots are now **Main Hand** and **Off Hand**. The old internal `Weapon`/`Shield` enum names remain numeric migration aliases so existing C# behavior does not break while the UI/codebase moves to the clearer names.

Normal one-handed weapon definitions opt into both hand slots by default. A shield occupies Off Hand, so shield + off-hand weapon are naturally mutually exclusive. Equipping a two-handed weapon displaces anything in Off Hand; equipping an off-hand item while a two-handed weapon is equipped displaces the two-handed weapon. The Unity character rig now exposes distinct main/off-hand attachment sockets so dual wield is also representable visually when the canonical 3D bases are imported.

The current auto-attack resolver still uses the main-hand weapon for cadence/range while all equipped combat bonuses are aggregated. This is deliberately a foundation, not a final dual-wield combat-balance rule. Independent/alternating hand swings can be added without changing inventory or save data once their intended DPS tradeoff is decided.

## World/editor foundation

The world is represented as authored data rather than millions of GameObjects. Logical tiles are exact 1x1 cells, terrain plane and building storey are separate, and storage pages are separate from semantic regions. POIs, roads and overlapping world-area layers are independent authored data. Published data has manifest/version/rollback foundations.

The Unity editor now has a real **MassRPG -> World Editor** window. It hand-paints canonical tile data rather than Unity Terrain. Current tactile tools include ground IDs, exact +1/-1 elevation, Water/Deep Water, Movement Blocked, Ranged LOS Blocked and No Build. Brushes are stroke-based and undo as one operation. Saved pages are split by plane/storey under `Assets/MassRPG/WorldData/Pages`; visible saved pages stream back into the sparse editor store on demand. Dirty pages also write periodic crash-recovery copies under `Library/MassRPG/WorldEditorRecovery`.

Normal unequal-elevation boundaries remain non-traversable unless an explicit transition exists. Editor-core ramp operations only connect cardinal neighbours whose logical elevation differs by exactly one and are fully undoable. Barrier authoring keeps movement blocking separate from ranged line-of-sight blocking, allowing fence/hedge-style movement-only blockers and wall-style movement+LOS blockers. These edge operations still need their tactile canvas controls wired.

The editor is therefore genuinely usable for exact tile painting now, but the 180k world still needs a macro overview/LOD authoring layer before whole-continent shaping is comfortable. Roads, objects/doodads, resources, creature regions, semantic region polygons, POIs, deterministic biome-dressing overrides, stamps/search/minimap and Play From Here remain in the editor roadmap rather than being falsely counted as complete.

## Creature/resource sleeping state

Resources store only exceptional depletion state. Personal and shared nodes are separate authority modes. Deterministic biome nodes can therefore exist without permanent database rows while untouched.

Ordinary creature spawn regions likewise maintain compact logical population + timestamp state. Sleeping a region removes ordinary runtime actors without resetting population. Returning quickly preserves depletion; elapsed time gradually matures respawns. Ordinary actors may rematerialize with new identities. Named/persistent creatures remain an explicit separate case.

Materialized population creatures register with the soft-occupancy index and carry an internal runtime mapping back to their spawn region. When authoritative player combat kills one, the authority routes that death into the population record, removes occupancy/runtime actor, decrements population and starts the gradual respawn timer.

Creature combat movement uses a side-preserving planner on top of soft creature occupancy. Aggressive creatures acquire nearby players, chase within their home leash and attack on server-owned cooldowns. Neutral creatures do not initiate but can retaliate; passive creatures never attack. Mobs approaching from one side prefer that side's attack arc instead of tactically circling to the opposite side merely because nearby creature tiles are occupied.

## Combat contribution foundation

Authoritative player damage emits contribution events into an optional server ledger. The ledger records total damage, per-character damage, first engager and timing without deciding final rewards. A separate configurable eligibility policy can impose minimum damage and/or minimum contribution fraction. This intentionally avoids baking arbitrary anti-power-leveling percentages into combat before group/XP/loot balancing is finalized.

## Player construction foundation

Persistent player plots keep current claimed tiles separate from an immutable maximum future reservation. New plot placement checks the entire reserved envelope, so another plot cannot later prevent an existing Small plot from growing toward Medium/Large. Upgrade footprints are accepted as data and must remain a superset of existing land inside that reservation, so final tier dimensions/shape policy can be changed without rewriting plot persistence.

Modular construction distinguishes tile pieces from cardinal-edge pieces and surface/structure/fixture/roof occupancy. Physical wall edges canonicalize both neighbouring-tile representations so the same wall cannot be placed twice. The baseline support model permits three usable storeys (0/1/2), requires supported upper floors, requires upper fixtures/walls to stand on floors, requires roofs to have wall support and prevents stairs from implying a fourth usable level. This is intentionally a sensible-support rule set rather than structural physics.

Player-built furnace/anvil/loom/tannery/cooking-range definitions expose the same station IDs used by authoritative production, so housing is already capable of hosting working skilling stations at the rules layer.

Upkeep is policy driven: gold-per-day rates are supplied by configuration rather than hard-coded balance. Plots can prepay multiple days, then move Active → Delinquent → Abandoned after a configurable grace period. The service only marks abandonment; destructive reclamation remains a separate explicit server action. A 30-day grace period can therefore be tested without freezing it as final balance.

`BuildingBlueprint` stores reusable relative piece arrangements independently from world ownership. This is the persistence foundation for save/reuse and eventual blueprint trading; atomic whole-blueprint placement/preview is still pending.

## Automated test coverage authored so far

Editor test assemblies cover XP/skills, combat math, inventory/equipment including two one-handed weapons in both hands and 2H/off-hand exclusion, requirements and gear locks, local authority validation, diagonal movement/corner blocking, exact ramps/barriers, ranged LOS rules, world page serialization/import, semantic areas/POIs, editor sessions, published-data versions, resource depletion/gathering, creature footprints/occupancy, combat targeting, authoritative player auto-attacks, aggressive/neutral/passive creature combat behavior, leash/cooldowns, sleeping creature populations, combat-death-to-respawn integration, approach-direction crowding, configurable combat contribution eligibility, broad migrated item/recipe coverage, cooking failure behavior, timed production/smelting, modular construction edge occupancy/support/stations, plot upgrades, upkeep lifecycle and blueprint coordinate resolution.

These tests are committed but still need their first actual Unity Test Runner pass after the project is opened in `6000.3.24f1`.

## Next implementation batch

1. Finish the editor's immediate map-authoring loop: wire ramp/barrier edge painting, rectangle/line/fill tools and a macro overview/LOD mode appropriate for shaping the full 180k world.
2. Wire roads, objects/doodads, resources, creature/spawn regions, semantic polygons and POIs into the tactile editor rather than leaving them as data-only foundations.
3. Add deterministic biome-dressing density/exclusion overrides, search/stamps/copy-paste, minimap/world overview, recovery restore and Play From Here.
4. Build party-aware reward settlement on top of contribution facts: XP eligibility, first-engager context and one shared party loot pool, while keeping anti-power-level thresholds configurable.
5. Add atomic building-blueprint preview/placement and explicit abandoned-plot reclamation policy.
6. Continue the Unity client shell: click-selection/request adapters, equipment visual binding, streamed chunk views and first production-quality terrain/character scene.
7. On the first home-PC open, let Unity generate/resolve real package metadata, import the canonical 3D character bases, then run the full compile/Test Runner pass and fix every compile/parity failure before visual production proceeds.
