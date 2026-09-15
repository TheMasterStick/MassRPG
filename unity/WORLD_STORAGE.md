# MassRPG authored-world storage foundation

The canonical world is 180,000 x 180,000 logical 1x1 tiles: 32.4 billion possible surface cells before underground planes or building floors are considered. MassRPG must therefore never allocate or serialize one giant full-world tile array.

The current foundation uses three different concepts on purpose:

- **Logical tile:** exact 1x1 gameplay cell.
- **Render chunk:** currently 64x64 tiles; a benchmarkable presentation/streaming unit.
- **Storage page:** currently 512x512 tiles; an IO/editor unit containing 8x8 of the current render chunks.

Only loaded/edited storage pages expand into tile arrays in memory. Persisted pages use a ground palette plus run-length encoded tile runs so broad rough-world geography (large grasslands, oceans, elevation masses, etc.) can remain compact. Later codecs may become binary/compressed without changing the gameplay-facing contracts.

A page is **not** a kingdom, region, biome, settlement or POI. Semantic area layers remain independent and may overlap freely. Storage boundaries must be invisible to both the player and the world designer.

Tile data deliberately separates movement blocking from ranged/magic line-of-sight blocking. This supports settled gameplay rules such as fences and trees blocking walking while still allowing ranged/magic attacks across them. Unequal logical elevation is a blocked movement edge unless an explicit transition edge (ramp/stair/etc.) is authored.

The current page codec is a foundation and testable contract, not the final live-world publishing format. The editor still needs dirty-page tracking, crash-recovery saves, version manifests, rollback metadata, asynchronous IO, and background compression before production authoring begins.
