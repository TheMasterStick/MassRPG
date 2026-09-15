# MassRPG World Editor

The Unity migration contains two production-bound editor-only authoring windows:

- **MassRPG -> World Overview** for blocking out the entire 180,000 x 180,000 Twin Lands world at storage-page scale.
- **MassRPG -> World Editor** for exact 1x1 logical-tile painting and local detail.

Both edit MassRPG's canonical authored world data. They do not paint Unity Terrain and do not create one GameObject per tile.

## Whole-world rough pass

The World Overview renders the complete world as a 352 x 352 page map. One overview pixel/page represents a 512 x 512 logical-tile storage page (the final edge pages extend beyond the 180k boundary but inaccessible cells are ignored by world addressing).

Macro painting writes a selected page directly as a compact single-run canonical page document, so blocking a continent, ocean or broad elevation mass does not first allocate 262,144 individual editor objects/cells. Available coarse modes are Land, Water, Deep Water and Unpainted, with page brushes from 1 through 17 pages wide.

Right-click selects a page and **Open 1x1 Detail Here** jumps the fine editor to its centre. The overview incrementally scans existing page documents so opening a developed world does not synchronously parse the entire world in one UI frame.

Macro page replacement is intentionally a rough-pass/destructive operation rather than local tile-level undo. Git/version history is the safety net for broad replacements. Once a coastline/area needs detail, switch to the 1x1 editor.

## Exact hand painting

The 1x1 World Editor currently supports:

- Terrain ground IDs on exact logical tiles.
- Discrete integer elevation (+1 / -1).
- Water and Deep Water.
- Movement-blocked tiles.
- Ranged/magic line-of-sight blocked tiles.
- No-build tiles.
- Explicit cardinal edge authoring:
  - ramps across exactly +1/-1 logical elevation,
  - movement-only barriers for fence/hedge-style edges,
  - movement + ranged-LOS barriers for full wall-style edges,
  - edge clearing/removal.
- Visible edge overlays: green ramp, orange movement barrier, red LOS-blocking wall.
- Square or circular brushes from 1x1 through 321x321 tiles.
- Surface/underground plane and building-storey selection.
- Right-click terrain eyedropper.
- Pan with middle mouse or Alt+drag; scroll to zoom; direct coordinate jump.
- One undo record per painted stroke; edge operations are undoable through the same edit session.
- Ctrl+S saves only changed 512x512 storage pages.
- Dirty-page recovery copies periodically written beneath `unity/Library/MassRPG/WorldEditorRecovery`.

## Storage location

Canonical production pages live at repository level under:

`WorldData/Pages/plane_<n>/storey_<n>/page_<x>_<y>.json`

They intentionally do **not** live beneath `unity/Assets`. A complete surface can potentially contain roughly 124,000 storage pages; feeding those through Unity's AssetDatabase would turn world IO into an editor-import problem. The pages remain ordinary versionable repository data while Unity reads/writes them through the MassRPG editor.

Only pages entering the local editing area are expanded into 512x512 in-memory tile arrays. Persisted pages remain palette + run-length encoded documents.

## Existing engine-independent editor foundation

`MassRPG.EditorCore` owns page-aware edits, brushes, undo/redo, dirty-page tracking and exact edge editing. A ramp is a cardinal +1/-1 transition; ordinary unequal elevation remains a cliff. Storage pages are not semantic regions: regions, biomes, kingdoms, spawn areas, no-build areas and other layers remain independently authored and may overlap.

## Next editor work

The editor is now usable for both broad whole-world blocking and exact tile painting, but it is not yet the final Warcraft-III/Galaxy-style toolset. Remaining high-priority layers are:

1. Roads with line/spline-style painting and width controls.
2. Objects/doodads plus searchable palette placement.
3. Resource nodes/veins and creature/spawn regions.
4. Region, biome, kingdom and other arbitrary polygon/area layers with overlays.
5. POIs and separate protection/no-build footprints.
6. Deterministic biome-dressing density/exclusion/manual-override tools.
7. Rectangle/line/select/fill/copy/paste/stamp workflows for fine editing.
8. Search, minimap refinements, coordinate bookmarks and named authoring layers.
9. **Play From Here** against the local authoritative simulation.
10. Recovery-restore UI and explicit production publish/version/rollback controls.

The architectural rule remains: these tools author canonical data. Unity scene objects, meshes, colliders and vegetation instances are disposable generated views of that data.
