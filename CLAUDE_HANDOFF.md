# Claude handoff — Twin Lands world expansion

This is the current user-directed world/settlement direction. Preserve these
rules unless the user explicitly changes them.

## Current macro world

The old 15,000 x 15,000 Aeldor prototype has now been expanded to a
**180,000 x 180,000** tile world. The new macro geography is based on the
user's merged **Twin Lands** reference: Westerland and Estland are now one huge
connected landmass rather than two continents separated by a sea strait.

`src/world/AeldorData.ts` keeps its old filename for compatibility, but now
contains Twin Lands data. `AELDOR_SEED` is intentionally retained as an alias
while new code should prefer `TWIN_LANDS_SEED`.

The intended continental character remains:

- **Westerland / west:** wetter, greener, lake/river rich, extensive forests,
  strong mountain barriers and broken coasts.
- **Estland / east:** broader, drier, more open, major desert/steppe country,
  long mountain systems and river lifelines.
- The main capital is in central Westerland beside the large river/lake system.

The current coastline/biome polygons are a first implementation pass based on
the merged visual reference. Refine them from the user's map rather than
reverting to giant ellipses/circles.

## Settlement design — important

The user explicitly does **not** want the old "three houses = capital" model.
Settlement scale now matters and is encoded in `Town.kind` / `Town.radius`:

- farmstead: ~28 tiles across, ~3 buildings
- hamlet: ~50 tiles across, ~8 buildings
- village: ~90 tiles across, ~18 buildings
- town: ~170 tiles across, ~42 buildings
- city: ~300 tiles across, ~78 buildings
- capital: ~480 tiles across, ~130 buildings

These are gameplay-compressed settlements, not literal real-world medieval
population simulations. The design language discussed with the user is:

**RuneScape function density + World of Warcraft district readability.**

That means:

1. Important services live in actual buildings, not loose utility objects on
   grass. Banks, general stores, smithies, inns, workshops, etc. should be
   recognizable destinations.
2. Cities need ordinary houses, workshops, warehouses and non-critical
   buildings around their services so they feel inhabited.
3. Large settlements need multiple streets / blocks / districts instead of one
   crossroad with everything in the middle.
4. The capital and cities may have duplicate/secondary service nodes so the
   entire city is not functionally one tiny hub inside a giant wall.
5. Settlement shapes can become more organic later, but the current first-pass
   layout intentionally establishes proper *scale and density* before detailed
   hand-authoring.
6. Do not shrink cities back down merely because a small radius is easier for
   generation or pathfinding.

`src/world/Buildings.ts` now defines `house_small_01`, `house_small_02`,
`house_small_03`, `smithy_01`, `inn_01`, bank/store/workshop/tannery/weaver/
warehouse/chapel prefabs and a deterministic settlement-layout generator.
These are still reusable prototypes; future settlement-specific landmarks and
unique city plans should layer on top of them rather than replacing the scale
system with tiny identical hubs.

The enlarged map currently contains the original settlement names plus new
provisional settlements corresponding to the user's rough red-dot placement
map. Names/positions can be revised during the upcoming map-layout pass.

## Hand-authored world editor — now preferred for local layouts

The user explicitly asked for a tile editor because authored mining sites were
still hard to locate in live testing and because towns/cities now need to be
laid out deliberately rather than inferred from procedural rules.

The game now exposes a **World Editor** from the start screen (`?editor=1`).
It supports:

- painting all current terrain/floor tile types with 1x1, 3x3, 5x5 or 9x9 brushes
- placing/removing structures such as furnaces, beds, anvils, walls, banks,
  storage, looms and general-store objects
- placing trees, ores, fishing spots, farm/herb/flax resources
- placing monster spawners from the existing monster roster
- jumping directly to known settlements and authored mining-site centers
- zooming and panning a local tile view using the actual current world generator
- undo/redo
- local browser autosave
- JSON import/export (`twinlands-world-edits.json`)

Editor changes are a **sparse override layer** (`src/world/EditorWorld.ts`).
`Chunk.ts` applies those overrides ahead of normal generated structures,
resources and spawns. Explicit `null` values suppress generated objects, so the
editor can genuinely erase procedural content rather than merely drawing over
it. Returning from the editor reloads the game and immediately applies the
locally saved layout.

This is intentionally a local/location editor, not an attempt to paint all
180,000 x 180,000 tiles individually. Use the procedural macro geography for
continental landform and use the editor to hand-build settlements, mines,
dungeons, roads, POIs and other meaningful areas. Large finished edits should
be exported to JSON and committed/canonicalized later instead of relying only
on browser storage.

**Future direction:** once the user has hand-built representative settlements,
the procedural settlement generator should become a fallback/template source,
not overwrite those authored layouts. The editor data should ultimately be
promoted into canonical world data in Git.

## Progression direction

The character maximum level remains **120**, but world danger/progression zones
may extend from **1 through 300**. The user expects late-game equipment, food,
potions/buffs and other preparation to allow a max-level character to challenge
content well above 120.

The current 1-300 zones in `AeldorData.ts` are explicitly a **first-pass macro
layout**, not final balance. The user wants the final ranges to follow geography,
settlements, travel corridors and POIs rather than perfect concentric circles.
Two places equally far from the capital may have very different danger levels.

Rare authored exceptions remain desirable: a dragon, moss giant grove, lesser
demon, dangerous ruin, boss site, etc. may sit above the normal level range of
its surrounding region.

## Ore / gathering rules — preserve these

1. **Biome does not determine metal ore.** Mountain/desert/snow terrain must not
   create random carpets of metal rocks.
2. **Metal ore comes from authored mining sites only.** `ORE_VEINS` remains the
   macro/public map list, while the new editor can be used to place the exact
   individual rock nodes by hand.
3. Each listed ore at a site should normally have roughly **3-5 persistent
   nodes** unless the user deliberately designs a larger/smaller mine.
4. Depleted rocks stay visible but dim/grey while waiting to respawn.
5. Authored mining sites are **public information**. The local minimap shows
   individual rocks as black dots and the world map shows a mining-site icon.
6. Town safety wins over resource placement. Never put authored ore inside a
   settlement footprint unless the user explicitly places it there in the editor.
7. Trees/gatherables should occur in progression-appropriate pockets/groves,
   not salt-and-pepper carpets across an entire biome.
8. Gemstone expansion is still deferred; do not randomly re-enable gem rocks
   until that system is deliberately introduced.
9. Dragonite remains above Runite. Current smelting intent is **2 Dragonite Ore
   + 2 Coal -> 1 Dragonite Bar**.

## Terrain / coastline rules

- Keep beaches narrow and intermittent. The old huge beach belt was a bug.
- Visible terrain regions should use irregular polygons / organic boundaries,
  not huge circles.
- Rivers are real narrow water features locally and are separately overdrawn on
  the world map so they remain visible at continental zoom.
- Roads currently use a simple connected graph and are intentionally blocked
  from converting ocean/lake tiles to paths. A future pass should make routes
  terrain-aware and add explicit bridges/passes.

## Save migration

`WORLD_REVISION = 2` marks the 180k Twin Lands conversion. Old 15k-world saves
retain character inventory/stats/bank, but obsolete chunk diffs are discarded
and the character is moved to the new capital. Do not load old terrain diffs at
their original coordinates into the new world.

## Near-term work

The user now wants to use the editor to begin authoring real locations. The
next useful development cycle is:

- verify one mining site by hand-placing its ore nodes and testing them in-game
- hand-build the capital as the first genuinely city-sized authored settlement
- then build representative town/village/hamlet layouts
- after geography and settlements read well, refine level-region shapes/ranges
- add terrain-aware roads, passes, bridges, ports and major POIs

Do not rush into filling all 180k x 180k with random content. The point of the
large world is to support authored destinations and meaningful travel, not to
make procedural emptiness larger.
