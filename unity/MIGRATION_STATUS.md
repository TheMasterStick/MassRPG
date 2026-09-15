# Unity migration status

This file tracks source-system disposition so the browser version stays useful as a mechanical reference while the Unity/C# implementation becomes canonical.

| Browser source | Unity destination | Status | Notes |
| --- | --- | --- | --- |
| `src/systems/CombatMath.ts` | `MassRPG.Core/Combat` | Parity ported + tests | Pure formulas are engine-independent. |
| `src/entities/Player.ts` | `MassRPG.Core/Characters/PlayerState.cs` | Initial state ported | Simulation state is separated from Unity presentation. |
| `src/data/skills.ts` | Core/Data skill definitions | Initial port complete | 1-99 parity retained; current MassRPG ceiling is 300. XP above 99 is a reference baseline pending balancing. |
| `src/data/items.ts` | `MassRPG.Data/Items` | Schema/catalog foundation | Stable `ContentId` is canonical; bulk item content migration remains. |
| `src/systems/Inventory.ts` | `MassRPG.Core/Inventory` | Core rules ported + tests | Uses settled slots: Head, Amulet, Cape, Chest, Legs, Hands, Boots, Weapon, Shield, Ring1, Ring2. No legacy ammo slot. |
| `src/systems/Combat.ts` | Server authority + Core combat rules | Pending | RuneScape-like auto combat; server owns truth. |
| `src/systems/Gathering.ts` | Server authority + Core gathering rules | Pending | Personal/shared resource-state distinction is new canonical behavior. |
| `src/systems/Production.ts` | Core/Server | Pending | Port after published item/recipe data contracts. |
| `src/systems/Construction.ts` | Core/Server | Pending | Expand to persistent plot/building system rather than direct legacy copy. |
| `src/systems/Pathfinding.ts` | `MassRPG.Core/World` | Canonical foundation ported + tests | Eight directions, exact 1x1 grid, explicit cardinal elevation transitions, and no diagonal corner squeezing. Local A* is separate from future world-map routing. |
| `src/world/World.ts`, `WorldGen.ts` | Authored world storage/streaming | Replace legacy assumptions | Do not direct-port procedural geography or old high-elevation barrier logic. |
| `src/world/Editor*` | `MassRPG.Editor` | Replace with full Unity editor | Browser editor is reference only. |
| `src/core/Renderer.ts`, sprite code | `MassRPG.Client` | Do not port | Replaced by true low-poly 3D Unity presentation. |
| browser DOM UI | `MassRPG.Client` UI | Rebuild | Preserve useful interaction behavior, not DOM implementation. |

## Authority boundary now present

`MassRPG.Core.Authority` defines requests/decisions and `MassRPG.Server.Authority.LocalGameAuthority` is the first in-process authoritative host. The client must eventually submit requests through this boundary rather than directly mutating simulation state. Inventory move/equip/unequip are the first actions wired through it.

## Grid/pathing foundation now present

`GridLocation` keeps terrain plane and building storey separate. `IGridTraversalMap` is the minimal authored-world contract used by movement. `GridTraversal` enforces eight-direction movement while rejecting diagonal corner squeezing, and elevation changes require explicit traversable cardinal edges such as ramps. `GridPathfinder` provides local A* for actor movement; whole-world waypoint routing will be a separate higher-level system.

## Automated parity coverage now present

Editor test assemblies cover the legacy XP curve through level 99, the current 300 skill ceiling, initial combat level, combat math, inventory stacking, two-handed weapon displacement, ring-slot behavior, local-authority request validation, diagonal movement, corner blocking, and explicit ramp traversal.

## Next implementation batch

1. Port/publish the browser item catalog into versionable data while keeping permanent IDs stable.
2. Add equipment requirements and combat-state gear-swap validation.
3. Add movement plans/requests to the local authority rather than letting the client own movement truth.
4. Begin resource definitions and personal/shared depletion state.
5. Define the authored world page/chunk serialization used by the full Unity editor.
