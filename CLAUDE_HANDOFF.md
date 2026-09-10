# Claude handoff — Twin Lands hand-authored world

This is the current user-directed world/settlement direction. Preserve these rules unless the user explicitly changes them.

## World authority

The old procedural Aeldor/Twin Lands prototype is no longer the gameplay/world authority.

The world remains **180,000 x 180,000 tiles**. The surface starts as a completely blank **deep-water ocean** and the underground planes start as blank **void**. `WorldGen.ts` must not silently recreate the old generated continent, roads, settlements, forests, ore veins or monster population.

The architectural rule is: **authored editor data is the world**.

## Vertical world model — important

MassRPG now deliberately separates **surface elevation** from **world planes**.

### Planes

- `0` = Surface
- `-1` = Underground 1
- `-2` = Underground 2

The underground planes are independent 180k x 180k coordinate layers beneath the surface. They start as non-walkable `void`; the user paints `cave_floor`, `cave_wall`, water, rubble, paths, floors and other terrain into them as needed. A cave can therefore exist underneath any surface feature without consuming or replacing the surface tile.

### Elevation

Each authored plane can carry an elevation field, with the intended surface range:

- `-2`, `-1`, `0`, `+1`, `+2`, `+3`, `+4`, `+5`

Elevation is **not** the same thing as a plane. A surface quarry may be Plane 0 / Elevation -1 while a cave beneath it is Plane -1.

Movement rule:

- elevation difference `0` or `1` between adjacent walkable tiles = traversable normally
- elevation difference `2+` = **cliff / impassable edge**

This allows authored mountain ranges to become real geographic barriers. A pass can be terraced `0 → +1 → +2 → +3`; a direct `0 → +3` edge is a cliff. Similar depressions can be made for quarries, mining cuts, valleys, sunken ruins and trenches.

The runtime draws strong dark cliff-edge cues at 2+ differences rather than trying to fake a fully 3D renderer.

## Plane links / caves

`EditorWorldData.links` stores explicit vertical links. Supported link kinds are:

- `cave_entrance`
- `stairs`
- `ladder`

Each link has two full endpoints containing `plane`, `x`, and `y`, plus an optional name. Links are currently bidirectional.

Editor workflow:

1. Select the **Links** palette.
2. Choose Cave Entrance, Stairs or Ladder.
3. Click the source endpoint.
4. Switch to another plane if desired.
5. Click the destination endpoint.

The runtime shows linked endpoints with a cyan triangular marker. Clicking one causes the player to approach it and, if the destination tile is walkable, transfer to the linked plane/coordinates. The surface world map shows surface cave/link entrances; it does not expose the underground terrain as if it were surface geography.

## World Editor — primary worldbuilding tool

The start screen exposes the **World Editor** (`?editor=1`). It is intended to support building essentially the entire map by hand.

Current editor behavior:

- Surface base terrain is deep water everywhere.
- Underground -1/-2 base terrain is `void` everywhere.
- All land, forests, mountains, beaches, rivers, cave floors/walls, floors and paths are painted manually.
- Structures such as furnaces, beds, anvils, walls, banks, storage, looms and general-store props are hand-placed.
- Trees, ores, fishing spots and farming resources are hand-placed.
- Monster spawners are hand-placed.
- Terrain brush preview is translucent green.
- Tree resources can be placed individually or scattered randomly through the current brush with sparse/normal/dense grove density.
- Zoom reaches **0.005 px per tile**, enough to fit the entire 180k map in the main editor viewport on a typical desktop.
- Terrain brushes range from 1x1 up to **65,535 x 65,535**.
- Large terrain/elevation work remains compact authored shapes; never expand continent-scale edits into millions of JSON cells.
- At macro zoom the editor draws the current plane base once and composites sparse authored shapes/cells over it. Do not return to per-tile sampling across tens of thousands of visible tiles.
- The right-side mini world map and large **M** map are plane-aware and clickable for rapid navigation.
- Underground editing has an optional faint **Surface ghost** overlay so caves can be aligned beneath surface geography.
- The **Elevation overlay** can be toggled. At detailed zoom it tints elevation and shows numeric `+/-` levels; 2+ height boundaries receive strong cliff edges.
- Undo/redo, browser autosave and JSON import/export remain supported.

### Drawing and stamp tools

The editor has:

- Brush
- Line (roads/rivers/cliff bands/etc.)
- Filled rectangle
- Rectangle outline
- Select area
- Paste/Stamp
- Copy selection
- Fill selection
- Clear selection

Terrain and elevation can both use compact brush/line/rectangle shapes. Copy/paste stamps are capped at **256 x 256** and preserve effective terrain, effective elevation, and detailed objects. This is intended for houses, compounds, city blocks, mines, castle sections, cave rooms, etc.

### Elevation palette

The editor has an explicit **Elevation** tab with:

- Set -2
- Set -1
- Set 0
- Set +1
- Set +2
- Set +3
- Set +4
- Set +5
- Raise +1
- Lower -1

Raise/Lower are cumulative ordered elevation strokes and clamp to the valid range. Set operations establish an exact level. Brush, line, rectangles and Fill Selection work with elevation.

## Editor data / migration

`EditorWorld.ts` is now editor-data **version 5** and uses storage key `massrpg_editor_world_v5`.

Surface data remains at top level for compatibility:

- `cells`
- `terrainStrokes`
- `elevationStrokes`

Underground data lives under:

- `planes['-1']`
- `planes['-2']`

Each underground plane has its own `cells`, `terrainStrokes`, and `elevationStrokes`.

Global metadata includes:

- `markers`
- `links`

Old v1-v4 browser editor data migrates forward as surface Plane 0 content. Old markers become Plane 0 markers. The exported file remains **`twinlands-world.json`**.

## Reference markers — important for later AI-assisted implementation

Supported marker types remain:

- `settlement`
- `village`
- `town`
- `city`
- `castle`
- `mining_area`

Each marker stores generated `id`, `type`, `name`, exact `x/y`, **plane**, and optional notes. When the user later exports/uploads `twinlands-world.json`, treat these markers as explicit authored intent. Do not infer replacement locations from obsolete `TOWNS` / `ORE_VEINS` data.

Markers can also be used underground for named mines, cave settlements, ruins, dungeon areas, etc.; they are filtered to the current plane in the editor/minimap.

## Settlement design — preserve

The user explicitly does **not** want the old "three houses = capital" model. The design language is:

**RuneScape function density + World of Warcraft district readability.**

Approximate gameplay-compressed scales discussed:

- farmstead: ~28 tiles across, ~3 buildings
- hamlet: ~50 tiles across, ~8 buildings
- village: ~90 tiles across, ~18 buildings
- town: ~170 tiles across, ~42 buildings
- city: ~300 tiles across, ~78 buildings
- capital: ~480 tiles across, ~130 buildings

These are guidelines, not mandatory squares. Coastal towns can be linear, mining towns can descend into quarries, river cities can span banks, castles can sit on elevated plateaus, etc. Large settlements need multiple streets/blocks/districts rather than a single service crossroad.

## Progression direction

Character maximum level remains **120**, while eventual world danger zones may extend **1 through 300**. Old procedural progression ellipses are not authoritative. Final danger regions should follow the finished hand-authored geography, settlements, passes, caves, mines and POIs.

Rare authored exceptions remain desirable: dragons, moss giant groves, lesser demons, dangerous ruins and bosses may exceed the surrounding area's normal band.

## Ore / gathering rules

Metal ore is fully authored. Do not generate ore from biomes.

Current ore ladder: Copper, Tin, Iron, Coal, Silver, Gold, Mithril, Adamantite, Runite, Dragonite. Mining areas should generally be deliberate clustered sites, commonly ~3-5 nodes of each intended ore type unless the user designs otherwise. Underground mines can now extend from surface quarries into Plane -1 / -2 through explicit links.

Depleted rocks should remain visible but dim/grey while respawning. Mining locations are public information where intended; use `mining_area` reference markers plus exact hand-placed rock cells.

Dragonite remains above Runite. Smelting intent remains **2 Dragonite Ore + 2 Coal -> 1 Dragonite Bar**.

## Runtime / saves

- Chunks are keyed by plane as well as X/Y chunk coordinates.
- `World.activePlane` follows the player's current plane.
- Pathfinding uses `World.canStep`, so cliffs with a 2+ elevation difference are blocked.
- Monsters/spawners are plane-specific.
- Player save data now includes `plane`; authored-world revision is 4 for the introduction of elevation/planes.
- Runtime minimap is plane-aware and shows cliff edges/link endpoints.
- The ordinary world map remains a **surface map**. While underground, it does not permit surface fast travel.

## Near-term refinement

Do not add new procedural geography. Useful future work should come from actual editor use: dedicated cliff/ramp art, explicit stairs/ramps for exceptional same-plane height changes, nicer cave-entrance sprites, polyline/coastline smoothing, marker/link editing, named persistent stamp libraries, and eventual canonicalization of the user's exported `twinlands-world.json` into Git.

Guiding principle: **the user's editor output is canonical; code should help them author it efficiently, not override it.**
