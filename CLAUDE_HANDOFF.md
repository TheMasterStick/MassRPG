# Claude handoff — Twin Lands hand-authored world

This is the current user-directed world/settlement direction. Preserve these rules unless the user explicitly changes them.

## World authority changed completely

The old procedural Aeldor/Twin Lands prototype is no longer the gameplay/world authority.

The world remains **180,000 x 180,000 tiles**, but it now starts as a completely blank **deep-water ocean**. `WorldGen.ts` deliberately returns deep water for terrain and no procedural structures, resources or monster spawns. The user intends to draw the playable world by hand in the World Editor.

Legacy geographic/settlement data may remain in `AeldorData.ts` temporarily for compatibility with old imports, but it must not be treated as canonical geography and must not be silently re-enabled. Do not resurrect the old generated landmass, automatic towns, roads, ore veins, forests or progression regions unless the user explicitly asks for some procedural helper again.

The user has made the architectural decision that **authored editor data is the world**.

## World Editor — primary worldbuilding tool

The start screen exposes the **World Editor** (`?editor=1`). It is intended to support building essentially the entire map by hand.

Current editor behavior:

- Base terrain is deep water everywhere.
- All land, forests, mountains, beaches, rivers, floors and paths are painted manually.
- Structures such as furnaces, beds, anvils, walls, banks, storage, looms and general-store props are hand-placed.
- Trees, ores, fishing spots and farming resources are hand-placed.
- Monster spawners are hand-placed.
- There is no procedural-object toggle because procedural world population has been retired completely.
- Terrain brush preview is translucent green.
- Tree resources can be placed individually or scattered randomly through the current brush with sparse/normal/dense grove density.
- Zoom reaches **0.005 px per tile**, enough to fit the entire 180k map in the main editor viewport on a typical desktop.
- Terrain brushes range from 1x1 up to **65,535 x 65,535**.
- Brushes of 33x33 or larger remain compact macro terrain shapes; never expand them into millions of individual JSON cells.
- At macro zoom the editor paints the ocean once and composites only sparse authored shapes/cells. Do not return to per-tile sampling across tens of thousands of visible tiles; that was a major source of lag.
- The right-side mini world map is clickable for rapid camera movement and reflects authored terrain immediately.
- **M** opens/closes the large editor world map; clicking it moves the editor camera.
- Undo/redo, browser autosave and JSON import/export remain supported.

### Drawing tools now implemented

The editor now has a tool selector with:

- **Brush** — normal freehand terrain/object painting.
- **Line / road / river** — drag from A to B. Terrain lines are compact vector-like world shapes whose width is the selected brush size. Select `path` for roads, `water` for rivers, `beach` for shoreline strips, etc. Structures/resources/spawners use a bounded cell-raster line, useful for fences/walls and exact rows of objects.
- **Filled rectangle** — drag an authored filled area. Terrain rectangles remain compact regardless of size.
- **Rectangle outline** — drag a border. Terrain outlines are compact and respect brush width. With wall/fence structures selected this can quickly make bounded compounds/city walls, subject to the detailed-cell safety limit.
- **Select area** — drag a rectangular selection for copying or filling.
- **Paste stamp** — after copying a selection, click repeatedly to stamp the copied block around the world.

There are toolbar actions for **Copy selection**, **Paste/Stamp**, **Fill selection**, and **Clear selection**. `Ctrl+C` copies the current selection and `Ctrl+V` switches to stamp mode. Selection/stamp footprints are previewed before placement.

`Fill selection` fills the selected rectangle with the currently selected terrain (or blank ocean when using Revert Terrain). This is the safe high-performance replacement for a potentially catastrophic 180k-wide flood-fill operation.

Copy/paste stamps are intentionally capped at **256 x 256 tiles**. They snapshot effective terrain plus explicitly placed structures/resources/spawners, compress terrain into horizontal runs, and paste those runs back as compact filled rectangles. This is intended for reusable houses, compounds, city blocks, farms, mining camps, docks, etc., not whole continents.

Terrain line/rectangle tools and old square macro brushes are all saved in the same ordered `terrainStrokes` list. Later strokes win where shapes overlap. The in-editor minimap, M-map, runtime chunks, and in-game world map all understand square, line, filled-rectangle and rectangle-outline shapes.

`EditorWorld.ts` is now data format **version 4**. Old v1/v2/v3 editor data migrates forward. The exported file remains `twinlands-world.json`.

## Reference markers — important for later AI-assisted implementation

The editor supports explicit map/reference markers. These are not gameplay structures; they are world-design metadata saved into the exported JSON so ChatGPT/Claude can later read exact intended locations and build proper references/implementations around them.

Supported marker types:

- `settlement`
- `village`
- `town`
- `city`
- `castle`
- `mining_area`

Each marker stores a generated `id`, `type`, user-provided `name` (or automatic placeholder), exact world `x`, `y`, and optional free-text `notes`.

Markers appear on the editor mini-map and full M-map. They can be selected from the toolbar jump list. The marker palette also lists placed markers and clicking one jumps to it. A delete-nearest-marker tool is available.

When the user later exports/uploads `twinlands-world.json`, use `markers` as explicit authored intent for where settlements, castles and mining areas are meant to exist. Do not infer replacement locations from old `TOWNS`/`ORE_VEINS` data.

## Settlement design — still important

The user explicitly does **not** want the old "three houses = capital" model. When actual settlements are hand-built or later converted into authored templates, use the design language:

**RuneScape function density + World of Warcraft district readability.**

Approximate gameplay-compressed settlement scales discussed previously:

- farmstead: ~28 tiles across, ~3 buildings
- hamlet: ~50 tiles across, ~8 buildings
- village: ~90 tiles across, ~18 buildings
- town: ~170 tiles across, ~42 buildings
- city: ~300 tiles across, ~78 buildings
- capital: ~480 tiles across, ~130 buildings

These are guidelines, not mandatory squares. Coastal towns can be long and narrow, mining towns can climb terrain, river cities can span banks, etc. Large settlements need multiple streets/blocks/districts rather than one central crossroad. Important services should be actual recognizable destinations surrounded by ordinary houses, workshops, warehouses, yards and civic space.

Existing building prefabs in `Buildings.ts` remain useful as references/stamps, but they must not automatically generate settlements over the user's hand-authored terrain.

## Progression direction

The character maximum level remains **120**, while eventual world danger zones may extend from **1 through 300**. The old provisional procedural progression ellipses are no longer authoritative. The user wants to finish geography, settlement markers and POIs first, then decide progression regions based on the finished map.

Later danger regions should follow geography and travel structure rather than perfect rings. Rare authored exceptions remain desirable: dragons, moss giant groves, lesser demons, dangerous ruins and bosses may exceed the surrounding area's normal band.

## Ore / gathering rules

Metal ore is fully authored. Do not generate ore from mountain/desert/snow biomes.

Current ore ladder remains Copper, Tin, Iron, Coal, Silver, Gold, Mithril, Adamantite, Runite and Dragonite. Mining areas should normally be deliberately built as clustered sites, commonly around 3–5 nodes of each intended ore type unless the user designs otherwise. Depleted rocks should stay visible but dim/grey while respawning.

Mining locations are public information. Use `mining_area` editor markers for macro map references and exact hand-placed resource cells for individual rocks.

Dragonite remains above Runite. Current smelting intent remains **2 Dragonite Ore + 2 Coal -> 1 Dragonite Bar**.

## Runtime / saves

`Chunk.ts` reads hand-authored terrain shapes/cells first. `WorldGen.ts` supplies only the blank ocean/no-object fallback.

The save layer uses authored-world revision 3. Older world saves keep character stats/inventory/bank but are migrated away from obsolete procedural chunk state and moved to the centre of the blank authored world.

The in-game world map and minimap read hand-authored editor terrain/markers rather than displaying the retired procedural settlements and mines.

## Near-term editor improvements

The major road/river/rectangle/fill/select/copy/paste/stamp workflow is now implemented. Useful future refinements, only as needed from actual use, include:

- polyline/freeform coastline chains and curve smoothing
- terrain edge/shore helpers
- marker editing/renaming rather than delete-and-replace
- persistent named stamp libraries rather than only the current in-memory clipboard
- rotate/flip pasted stamps
- larger optimized selection formats if 256x256 becomes limiting
- canonicalizing exported `twinlands-world.json` into Git once the user has substantial authored work

The guiding principle is simple: **the user's editor output is canonical; code should help them author it efficiently, not override it.**
