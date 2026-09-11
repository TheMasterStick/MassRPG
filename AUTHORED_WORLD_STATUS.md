# Authored Twin Lands world — current integration status

The user supplied a v5 `twinlands-world.json` for the 180,000 × 180,000 surface map. The browser World Editor/IndexedDB data remains the world authority; do not re-enable old procedural Aeldor terrain.

## Supplied authored map

The supplied export contains the full hand-painted surface terrain, elevation, reference markers, trees, and manually attempted monster spawners. Underground -1/-2 are currently empty.

The named capital marker is **Capital City** at **48,493 / 151,467**. Other settlement names are placeholders for later naming/building.

## Enrichment pass prepared from the supplied export

A companion `twinlands-world-enriched.json` was produced outside the repo for one-time import into World Editor. It preserves the user's original terrain/elevation and adds:

- cobblestone placeholder footprints at every settlement/castle/mining marker;
- routed path terrain between settlements and mining locations, routed over authored land rather than drawing straight across water;
- eight ore nodes at each mining marker, with ore tiers increasing broadly with distance from the capital;
- moderate clustered trees across suitable land while leaving roads and marker areas open;
- sparse monster spawns, preserving the user's intended main spawn locations while collapsing obvious brush-created spawn blobs and adding restrained biome-appropriate satellites.

The enriched population is deliberately sparse. Settlement markers are monster-safe zones through `WorldGen.isVillage()` compatibility behavior.

## Runtime integration

- `src/world/EditorSpatialIndex.ts` spatially indexes terrain strokes so chunk creation does not linearly scan the entire authored stroke list for every tile.
- `Chunk.ts` uses that terrain index.
- New characters spawn at the authored `Capital City` marker (falling back to another city/town/marker only if that name is absent).
- Save revision 5 migrates older saves to the authored capital instead of the middle of the 180k ocean.
- `WorldGen.ts` remains non-procedural; its `isVillage()` method now only maps authored settlement markers to safe-zone geometry for legacy combat callers.

## Important

Do not regenerate towns, ore veins, forests, or monster carpets procedurally. The user's JSON/editor output is canonical. Future additions should either be hand-authored in the editor or deliberately merged into that authored data.
