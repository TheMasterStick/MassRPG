# MassRPG Unity/C# Migration

This branch is the committed migration of MassRPG from the browser/TypeScript prototype to Unity 6 and C#.

## Production engine baseline

MassRPG is pinned to **Unity 6.3 LTS `6000.3.24f1`**, revision `4e7b9b5b6244`, as the initial production editor version. `unity/ProjectSettings/ProjectVersion.txt` records that exact revision. Package/render-pipeline metadata should be resolved by the real Unity editor on the first home-PC open rather than guessed from the work PC.

## Legacy/reference rule

The existing TypeScript/browser implementation remains the mechanical reference during migration. Port behavior first where it is still canonical, verify parity, then deliberately replace legacy assumptions. The pre-migration branch/history preserves the old executable and all 2D source art.

The Unity migration branch is allowed to prune bulky character sprite-source folders that have no role in the true-3D pipeline. TypeScript gameplay/source files remain available for mechanical reference; old sprite rendering code is not being ported.

## Target architecture

- `MassRPG.Core` — engine-independent gameplay rules, IDs, grid math, combat math, state models, request contracts and shared validation. No `UnityEngine` dependency.
- `MassRPG.Data` — engine-independent content schemas and published-data contracts. Stable internal IDs are canonical; display names are not identifiers.
- `MassRPG.Client` — Unity presentation: input, camera, rendering, animation, UI, interpolation and local prediction where needed.
- `MassRPG.Server` — authoritative simulation and persistence logic. Early development runs this authority locally in-process; networking comes later.
- `MassRPG.EditorCore` / `MassRPG.Editor` — the MassRPG World/Data Editor, with engine-independent authoring rules under a Unity editor front end.

## Canonical world direction

The migration must not blindly reproduce retired browser geography assumptions.

- Hand-authored Twin Lands world, `180000 x 180000` logical tiles.
- `1 x 1` logical tile grid; tiles are data, not GameObjects.
- Surface plus underground planes; building storeys are separate from terrain elevation.
- Discrete logical elevations, explicit ramps/stairs/bridges/special traversal.
- 64x64 is the current render-chunk starting point and must remain benchmarkable rather than sacred.
- Static authored geography is distinct from dynamic authoritative server state.
- Whole-world rough geography first; capital region and surroundings are the first detailed production-quality area.
- Light biome dressing is deterministic and locally overrideable.

## Migration order

1. Establish assemblies and pure C# foundations.
2. Port pure browser rules that remain useful: combat math, IDs, inventory rules, skill/XP logic, item/equipment rules.
3. Define the authoritative request/decision boundary locally before real networking.
4. Replace browser world generation with authored world storage, chunk/page streaming and exact grid/elevation rules.
5. Port gathering, production, construction and combat behavior behind authority validation.
6. Build the Unity client shell: click movement, camera, characters/equipment, interaction stack and UI.
7. Build the full World/Data Editor before serious production authoring of the 180k world.
8. Add true client/server networking after the local-authority version is stable.

## Implemented foundation

- Permanent `ContentId` separates machine identity from visible names.
- Skill state and RuneScape-reference XP behavior are in pure C#, with the MassRPG ceiling set to 300.
- Player simulation state is engine-independent.
- Inventory and settled equipment slots are in Core; two-handed weapons exclude shields and rings target Ring1/Ring2. The retired ammo slot is not restored.
- `GameRequest -> IGameAuthority -> AuthorityDecision` establishes the local authoritative boundary.
- Combat style, melee training style and ranged-ammunition selection now cross that authority boundary; Unity presentation has a client request bridge instead of mutating `PlayerState` directly.
- Exact-grid movement/pathing, discrete elevation transitions and ranged line-of-sight are represented independently of Unity rendering.
- Authored 180k-world page storage, overlapping semantic areas, published-data versioning and editor-core brush/edit sessions are present.
- Personal/shared gathering depletion and sleeping creature-population timestamps are server-owned.
- Player and creature RuneScape-style combat foundations, aggro/leash behavior and contribution recording are server-owned.
- Broad browser item/recipe migration now covers the generic equipment ladder, tools, food, farming/Herblore inputs, smithing, cooking, fletching, crafting and Herblore production. Cooking failure is authoritative/data driven.
- Persistent player plots reserve future Large space, enforce access/blocklists, support shape-neutral tier upgrades, modular three-storey building pieces, working player-built production stations, configurable prepaid upkeep lifecycle and reusable blueprint data.
- Unity Editor tests cover parity and core rule behavior; they have not yet had their first real Unity Test Runner pass.

## Important migration distinctions

### Port rather than preserve blindly

The browser prototype contains useful mechanics alongside legacy assumptions. Procedural `WorldGen`, old elevation barrier behavior, sprite rendering and the old source-art pipeline are history/reference, not Unity requirements.

### Local authority first

Even in single-player development, the client requests actions and authoritative simulation approves/rejects them. The first implementation may run both sides on the same PC and in the same process. This is intentional preparation for the MMO server, not temporary client-owned gameplay truth.

### Data is not executable code

Items, creatures, resources, recipes, NPCs, shops, skills, regions and similar content need permanent internal IDs and should ultimately be publishable/versioned separately from a Unity executable where practical. Local editor/test data and live published data are separate states.

## First playable acceptance target

The initial convincing Unity build should prove:

- RuneScape-like click movement on the 1x1 grid, including diagonals without corner squeezing;
- click resource -> path -> gather;
- click enemy -> path into range -> auto-attack;
- visible modular equipment on the true-3D character rig;
- custom logical terrain with cliffs and explicit ramps;
- bounded oblique zoom camera;
- seamless nearby chunk loading/unloading;
- local authoritative request/decision flow;
- World Editor foundations that are production-bound rather than throwaway.

The migration is committed. A failed subsystem is revised; it is not a cancellation gate for Unity.
