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
2. **Metal ore comes from authored mining sites only.** `ORE_VEINS` is the
   authoritative normal source of Copper, Tin, Iron, Coal, Silver, Gold,
   Mithril, Adamantite, Runite and Dragonite.
3. Each listed ore at a site has roughly **3-5 persistent nodes**.
4. Depleted rocks stay visible but dim/grey while waiting to respawn.
5. Authored mining sites are **public information**. The local minimap shows
   individual rocks as black dots and the world map shows a mining-site icon.
6. Town safety wins over resource placement. Never put authored ore inside a
   settlement footprint.
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

The user wants to continue refining the **map layout first**, then use that to
settle:

- final settlement hierarchy and unique city layouts
- level-region shapes/ranges
- mining/gathering locations
- major roads, passes, bridges and ports
- points of interest / dungeons / special encounters

Do not rush into filling all 180k x 180k with random content. The point of the
large world is to support authored destinations and meaningful travel, not to
make procedural emptiness larger.
