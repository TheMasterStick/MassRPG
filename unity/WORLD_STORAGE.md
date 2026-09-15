# MassRPG authored-world storage foundation

The canonical world is 180,000 x 180,000 logical 1x1 tiles: 32.4 billion possible surface cells before underground planes or building floors are considered. MassRPG therefore never allocates or serializes one giant full-world tile array.

The foundation deliberately separates three concepts:

- **Logical tile:** exact 1x1 gameplay cell.
- **Render chunk:** currently 64x64 tiles; a benchmarkable presentation/streaming unit.
- **Storage page:** currently 512x512 tiles; an IO/editor unit containing 8x8 of the current render chunks.

Only loaded/edited storage pages expand into tile arrays in memory. Persisted pages use a ground palette plus run-length encoded tile runs so broad grasslands, oceans, elevation masses and similar rough geography remain compact. A coarse whole-world page filled with one terrain/water/elevation state is therefore only one encoded run rather than 262,144 serialized cell records.

## Where authored pages live

Canonical pages are repository data under:

`WorldData/Pages/plane_<n>/storey_<n>/page_<x>_<y>.json`

They intentionally sit **outside** `unity/Assets`. The 180k surface uses a 352 x 352 storage-page address space, meaning a sufficiently authored world can approach 124,000 page files on one plane. Importing every page into Unity's AssetDatabase would be unnecessary overhead and would couple world streaming to asset importing. The World Editor reads/writes the repository files directly.

Crash-recovery copies remain local under `unity/Library/MassRPG/WorldEditorRecovery` and are not canonical production data.

## Whole-world vs fine authoring

`MassRPG -> World Overview` operates at 512x512 page granularity and can replace a page with a compact uniform Land, Water or Deep Water document. This exists specifically for the first rough 180k world pass.

`MassRPG -> World Editor` streams those same documents into a sparse `AuthoredWorldPageStore` only when the local 1x1 editing view reaches them. Fine edits can then modify individual terrain cells, elevations, water, pathing or explicit cardinal edges and save only dirty pages.

A page is **not** a kingdom, region, biome, settlement or POI. Semantic area layers remain independent and may overlap freely. Storage boundaries must be invisible to both the player and the world designer.

Tile data deliberately separates movement blocking from ranged/magic line-of-sight blocking. This supports settled gameplay rules such as fences blocking walking while still permitting ranged/magic attacks. Unequal logical elevation is a blocked movement edge unless an explicit transition edge is authored.

The current JSON/RLE page codec is a development contract, not necessarily the final live-world delivery codec. Binary compression, asynchronous IO and publish packaging can change later without changing the logical world model or editor-facing storage-page addresses.
