# MassRPG World Editor

The Unity migration now contains a real editor-only authoring window at **MassRPG -> World Editor**. It edits MassRPG's canonical logical world data directly; it does not paint Unity Terrain and it does not create one GameObject per tile.

## What can be hand-painted now

- Terrain ground IDs on exact 1x1 logical tiles.
- Discrete integer elevation (+1 / -1).
- Water and Deep Water flags.
- Movement-blocked tiles.
- Ranged/magic line-of-sight blocked tiles.
- No-build tiles.
- Square or circular brushes from 1x1 through large-area 321-tile brushes.
- Surface/underground plane and building-storey selection.
- Right-click eyedropper for existing ground/elevation information.
- Pan with middle mouse or Alt+drag; scroll to zoom; direct coordinate jump.
- One undo record per painted stroke, rather than one record per tile.
- Ctrl+S saves only changed 512x512 storage pages.
- Dirty-page recovery copies are written periodically under `Library/MassRPG/WorldEditorRecovery`.

Saved production pages live under `Assets/MassRPG/WorldData/Pages`, divided by plane and storey. The window streams saved pages into its sparse page store as they enter the visible editing area rather than loading the whole 180,000x180,000 world.

## Existing engine-independent editor foundation

The window sits on top of `MassRPG.EditorCore`, which already contains page-aware editing, brushes, undo/redo, dirty-page tracking and explicit edge tools for ramps and barriers. A ramp is a cardinal +1/-1 transition; ordinary unequal elevation remains a cliff.

## Still to wire into the tactile window

The editor is now genuinely usable for exact tile painting, but it is not yet the final fully-realized MassRPG editor. The next UI layers are:

1. Ramp/barrier edge painting in the canvas.
2. Roads and line/rectangle/polygon tools.
3. Objects, doodads, resource nodes and creature/spawn regions.
4. Region/biome/kingdom/no-build overlay authoring.
5. POI authoring and protection footprints.
6. Deterministic biome-dressing density/exclusion overrides.
7. World overview/minimap and macro-scale brushes suitable for shaping the entire 180k world without trying to draw billions of individual cells on screen.
8. Search, stamps/copy-paste and Play From Here.
9. Recovery restore UI and production publish/version controls.

The important architectural rule is already in place: all of these tools author canonical data. Unity scene objects and generated meshes are disposable views of that data.
