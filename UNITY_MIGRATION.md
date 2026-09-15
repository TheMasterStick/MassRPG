# MassRPG Unity/C# Migration

This branch is the committed migration of MassRPG from the browser/TypeScript prototype to Unity 6 and C#.

## Legacy/reference rule

The existing TypeScript/browser implementation remains the mechanical reference during migration. Port behavior first where it is still canonical, verify parity, then deliberately replace legacy assumptions. The pre-migration branch/history preserves the old executable and all 2D source art.

The Unity migration branch is allowed to prune bulky character sprite-source folders that have no role in the true-3D pipeline. TypeScript gameplay/source files remain available for mechanical reference; old sprite rendering code is not being ported.

## Target architecture

- `MassRPG.Core` — engine-independent gameplay rules, IDs, grid math, combat math, state models, request contracts and shared validation. No `UnityEngine` dependency.
- `MassRPG.Data` — engine-independent content schemas and published-data contracts. Stable internal IDs are canonical; display names are not identifiers.
- `MassRPG.Client` — Unity presentation: input, camera, rendering, animation, UI, interpolation and local prediction where needed.
- `MassRPG.Server` — authoritative simulation and persistence logic. Early development runs this authority locally in-process; networking comes later.
- `MassRPG.Editor` — the full MassRPG World/Data Editor built inside Unity, with a Warcraft III-style tactile front end and deeper Galaxy-editor-style data tools.

## Canonical world direction

The migration must not blindly reproduce retired browser geography assumptions.

- Hand-authored Twin Lands world, `180000 x 180000` logical tiles.
- `1 x 1` logical tile grid; tiles are data, not GameObjects.
- Surface plus underground planes; building storeys are a separate concept from terrain elevation.
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

- Permanent `ContentId` value type separates internal identity from display names.
- Skill state and RuneScape-reference XP behavior are in pure C#, with the MassRPG ceiling set to 300.
- Player simulation state is engine-independent.
- Inventory and settled equipment-slot rules are in Core; two-handed weapons exclude shields and ring items can target Ring1/Ring2.
- `GameRequest -> IGameAuthority -> AuthorityDecision` establishes the local authoritative boundary.
- Inventory mutations are already validated through `LocalGameAuthority` as the first proof of that flow.
- Unity Editor tests cover parity and core rule behavior.

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
- visible modular equipment;
- custom logical terrain with cliffs and explicit ramps;
- bounded oblique zoom camera;
- seamless nearby chunk loading/unloading;
- local authoritative request/decision flow;
- World Editor foundations that are production-bound rather than throwaway.

The migration is committed. A failed subsystem is revised; it is not a cancellation gate for Unity.
