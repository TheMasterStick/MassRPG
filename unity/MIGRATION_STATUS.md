# Unity migration status

This file tracks source-system disposition so the browser version stays useful as an executable reference rather than becoming an accidental second design document.

| Browser source | Unity destination | Status | Notes |
| --- | --- | --- | --- |
| `src/systems/CombatMath.ts` | `MassRPG.Core/Combat` | Initial parity port | Pure formulas moved first. |
| `src/entities/Player.ts` | Core character/state model | Pending | Split simulation state from Unity presentation. |
| `src/data/skills.ts` | Core/Data skill definitions | Pending | Port behavior first, then apply canonical 1-300 progression decisions deliberately. |
| `src/data/items.ts` | Data item definitions | Pending | Permanent IDs are canonical; inventories reference IDs. |
| `src/systems/Inventory.ts` | Core inventory/equipment rules | Pending | Preserve rules, then align final settled equipment slots. |
| `src/systems/Combat.ts` | Server authority + Core combat rules | Pending | RuneScape-like auto combat; server owns truth. |
| `src/systems/Gathering.ts` | Server authority + Core gathering rules | Pending | Personal/shared resource-state distinction is new canonical behavior. |
| `src/systems/Production.ts` | Core/Server | Pending | Port after inventory/data contracts. |
| `src/systems/Construction.ts` | Core/Server | Pending | Expand to persistent plot/building system rather than direct legacy copy. |
| `src/systems/Pathfinding.ts` | Core world/path rules | Pending / redesign during port | Eight directions remain; no diagonal corner squeezing; explicit elevation connections. |
| `src/world/World.ts`, `WorldGen.ts` | Authored world storage/streaming | Replace legacy assumptions | Do not direct-port procedural geography or old high-elevation barrier logic. |
| `src/world/Editor*` | `MassRPG.Editor` | Replace with full Unity editor | Browser editor is reference only. |
| `src/core/Renderer.ts`, sprite code | `MassRPG.Client` | Do not port | Replaced by true low-poly 3D Unity presentation. |
| browser DOM UI | `MassRPG.Client` UI | Rebuild | Preserve useful interaction behavior, not DOM implementation. |

## Next implementation batch

1. Define stable content IDs and item/skill data contracts.
2. Port inventory/equipment rules into pure C#.
3. Port player skill/combat-level state without Unity dependencies.
4. Add automated parity tests for CombatMath and the first ported rule modules.
5. Define the local authoritative command boundary used by the Unity client.
