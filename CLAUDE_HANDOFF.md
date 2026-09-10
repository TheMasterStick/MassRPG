# Claude handoff — Twin Lands world expansion

This is the current user-directed world/settlement direction. Preserve these rules unless the user explicitly changes them.

## Current macro world

The old 15,000 x 15,000 Aeldor prototype has been expanded to a **180,000 x 180,000** tile world. The new macro geography is based on the user's merged **Twin Lands** reference: Westerland and Estland are one huge connected landmass rather than two continents separated by a sea strait.

`src/world/AeldorData.ts` keeps its old filename for compatibility, but now contains Twin Lands data. `AELDOR_SEED` is retained as an alias while new code should prefer `TWIN_LANDS_SEED`.

The intended continental character remains:

- **Westerland / west:** wetter, greener, lake/river rich, extensive forests, strong mountain barriers and broken coasts.
- **Estland / east:** broader, drier, more open, major desert/steppe country, long mountain systems and river lifelines.
- The main capital is in central Westerland beside the large river/lake system.

The current coastline/biome polygons are a first implementation pass based on the merged visual reference. Refine them from the user's map rather than reverting to giant ellipses/circles.

## Settlement design — important

The user explicitly does **not** want the old "three houses = capital" model. Settlement scale matters and is encoded in `Town.kind` / `Town.radius`:

- farmstead: ~28 tiles across, ~3 buildings
- hamlet: ~50 tiles across, ~8 buildings
- village: ~90 tiles across, ~18 buildings
- town: ~170 tiles across, ~42 buildings
- city: ~300 tiles across, ~78 buildings
- capital: ~480 tiles across, ~130 buildings

These are gameplay-compressed settlements, not literal medieval population simulations. The design language is **RuneScape function density + World of Warcraft district readability**.

Important services should live inside recognizable buildings. Cities need ordinary homes, workshops, warehouses, side streets and non-critical buildings around those services. Large settlements need multiple streets/blocks/districts rather than one crossroad. Capitals/cities can have duplicate secondary services. Do not shrink settlements back to tiny hubs just because that is easier for generation or pathfinding.

`src/world/Buildings.ts` defines reusable house, smithy, inn, bank, store, workshop, tannery, weaver, warehouse and chapel prefabs plus deterministic fallback layouts. These are prototypes; hand-authored city plans should layer over or replace the fallback locally.

## Hand-authored world editor — now a major workflow

The user now intends to be able to build **the entire world by hand if desired**, not merely individual settlements. The procedural world should be treated as a convenient base/fallback, not as the final authority over authored areas.

The start screen exposes the **World Editor** (`?editor=1`). Current editor features include:

- all current terrain/floor tiles
- structures such as furnaces, beds, anvils, walls, banks, storage, looms and general-store props
- trees, ores, fishing spots and farming resources
- monster spawners
- exact coordinate jumping plus known settlement/mine jump targets
- undo/redo, browser autosave and JSON import/export
- a permanent clickable **mini world map** for rapid navigation
- **M** opens/closes a much larger full-world editor map; clicking it moves the editing camera
- map overlays update as manual terrain/objects are placed
- zoom now extends far below one pixel per tile for regional/macro editing
- terrain brushes now range from 1x1 up to 8193x8193
- brushes of 33x33 or larger are stored as compact `terrainStrokes` rather than expanding into millions of JSON cells
- the brush footprint is previewed as a translucent **green placement area** before painting
- tree placement supports a single-tree mode or randomized grove/scatter mode with sparse/normal/dense density
- terrain painting has a **Procedural objects** checkbox. If unchecked, the painted area suppresses automatically generated structures/resources/monster spawns, allowing intentionally empty grassland, forest floors, city sites, etc.

`src/world/EditorWorld.ts` is now editor-data version 2. Detailed object work remains per-cell while broad terrain can be stored as square macro strokes. `Chunk.ts` applies cell terrain first, then macro terrain, then procedural terrain. Manual structures/resources/spawners always win. `suppressProcedural` prevents generated objects beneath manually painted terrain without preventing manually placed objects.

This scalable stroke system is important: do not revert the editor to millions of individual cell records for large terrain brushes. The whole purpose is to make a 180k world hand-authorable without immediately exhausting browser storage.

Large finished edits should still be exported to `twinlands-world-edits.json` and eventually committed/canonicalized in Git rather than existing only in one browser's local storage.

## Progression direction

The character maximum level remains **120**, while world danger/progression zones may extend from **1 through 300**. Late-game equipment, food, potions/buffs and preparation are expected to let a max-level character challenge content above 120.

The current 1-300 zones are a provisional macro layout. Final danger regions should follow geography, settlements, travel corridors and POIs rather than perfect concentric circles. Rare authored exceptions are desirable: dragons, moss giant groves, lesser demons, dangerous ruins and bosses can exceed the surrounding region's normal band.

## Ore / gathering rules — preserve these

1. **Biome does not determine metal ore.** Mountains/deserts/snow must not create carpets of valuable rocks.
2. `ORE_VEINS` remains the macro/public list, while the editor can place the exact individual rock nodes by hand.
3. A normal listed ore should generally have roughly **3-5 persistent nodes** unless the user deliberately builds a different mine.
4. Depleted rocks stay visible but dim/grey while respawning.
5. Mining sites are public information. The local minimap shows rocks as black dots and world maps show mining locations.
6. Town safety wins over automatic resource placement; manual editor placement is authoritative.
7. Trees/gatherables should occur in intentional pockets/groves rather than salt-and-pepper carpets.
8. Gemstone expansion is still deferred.
9. Dragonite remains above Runite. Current smelting intent is **2 Dragonite Ore + 2 Coal -> 1 Dragonite Bar**.

## Terrain / coastline rules

- Keep beaches narrow and intermittent. The old enormous beach belt was a bug.
- Visible terrain should use irregular/organic boundaries, not huge circles.
- Rivers are real local water features and are overdrawn on continental maps for readability.
- Roads still need a future terrain-aware pass with proper passes, bridges and ports.
- Hand-painted editor terrain is allowed to supersede the procedural macro geography entirely where the user chooses.

## Save migration

`WORLD_REVISION = 2` marks the 180k Twin Lands conversion. Old 15k-world saves retain character inventory/stats/bank, but obsolete chunk diffs are discarded and the character is moved to the new capital.

## Near-term direction

The user is increasingly leaning toward authoring the world directly in the editor. Support that workflow rather than fighting it with more procedural complexity. Useful next steps are richer editor tools (roads/lines, fill, rectangles, named POIs, settlement markers, copy/paste/stamps), then hand-building the capital and representative towns/villages, then finalizing progression and resource locations from the completed geography.
