# MassRPG Unity/C# Migration

This branch begins the committed migration of MassRPG from the browser/TypeScript prototype to Unity 6 and C#.

## Non-destructive rule

The existing TypeScript/browser game remains in place and is the executable mechanical reference during migration. Do not delete or rewrite it merely to make the Unity tree cleaner. Port behavior first, verify parity where that behavior is still canonical, then deliberately replace legacy assumptions.

## Target architecture

- `MassRPG.Core` — engine-independent gameplay rules, IDs, grid math, combat math, state models and shared validation. No `UnityEngine` dependency.
- `MassRPG.Data` — engine-independent content schemas and published-data contracts. Stable internal IDs are canonical; display names are not identifiers.
- `MassRPG.Client` — Unity presentation: input, camera, rendering, animation, UI, interpolation and local prediction where needed.
- `MassRPG.Server` — authoritative simulation and persistence logic. Early development can run this authority locally in-process; networking comes later.
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

## Important migration distinctions

### Port rather than preserve blindly

The browser prototype currently contains useful mechanics alongside legacy assumptions. Examples such as its procedural `WorldGen`, old elevation barrier behavior, sprite renderer and old source-art pipeline are references for behavior/history, not requirements for the Unity implementation.

### Local authority first

Even in single-player development, the client should request actions and the authoritative simulation should approve/reject them. The first implementation may run both sides on the same PC and in the same process. This is intentional preparation for the MMO server, not temporary client-owned gameplay truth.

### Data is not executable code

Items, creatures, resources, recipes, NPCs, shops, skills, regions and similar content need permanent internal IDs and should ultimately be publishable/versioned separately from a Unity executable where practical. Local editor/test data and live published data are separate states.

## First playable acceptance target

The initial convincing Unity build should prove:

- RuneScape-like click movement on the 1x1 grid, including diagonals without corner squeezing.
- click resource -> path -> gather;
- click enemy -> path into range -> auto-attack;
- visible modular equipment;
- custom logical terrain with cliffs and explicit ramps;
- bounded oblique zoom camera;
- seamless nearby chunk loading/unloading;
- local authoritative request/decision flow;
- World Editor foundations that are production-bound rather than throwaway.

The migration is committed. A failed subsystem is revised; it is not a cancellation gate for Unity.
