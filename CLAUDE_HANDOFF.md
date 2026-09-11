# Claude handoff — Twin Lands hand-authored world

Preserve these rules unless the user explicitly changes them.

## World authority

The old procedural Aeldor/Twin Lands geography is retired. The world is **180,000 x 180,000** and the user's World Editor output is canonical geography. Surface fallback is deep water; Underground -1/-2 fallback is void. Never resurrect the old generated continent, settlements, roads, ore veins, progression ellipses, or dense old monster population.

The user has now drawn a real Twin Lands world and exported `twinlands-world.json` (v5). It contains the authored terrain, elevation, 189 reference markers, hand-placed trees, and explicit monster spawn attempts. Only the capital currently has a meaningful name: **Capital City** at approximately `(48493, 151467)`; most other settlement names are placeholders.

A cleanup/enrichment pass was made from that export into `twinlands-world-enhanced.json`. The intended workflow is to import that file through World Editor; the runtime uses the same IndexedDB editor world, so no separate world generator is required.

## Latest enrichment pass

The enhanced JSON deliberately adds only infrastructure/population scaffolding while retaining the user's geography:

- the many high-frequency square brush samples were simplified into compact line/shape strokes for performance;
- every settlement/castle marker gets a temporary **cobblestone pad** sized roughly to its settlement class;
- every `mining_area` marker also gets a temporary cobblestone pad;
- markers on the same connected landmass are connected by a sparse road network using authored `path` strokes;
- road corridors are flattened to elevation 0 so they can form usable passes through authored mountain elevations;
- the user's explicit monster-spawn brush runs were cleaned: contiguous same-species runs are collapsed to one anchor rather than spawning a monster on every painted tile;
- hand-placed isolated spawns are retained.

Do not mistake these cobblestone pads for finished settlements. They are location placeholders for later hand-built villages/towns/cities/castles/mines.

## Sparse ambient population is intentionally allowed

`WorldGen.ts` remains forbidden from generating geography, but it now has one narrow purpose: **very sparse deterministic ambient trees and creatures on otherwise untouched authored tiles**.

This is specifically requested by the user because the hand-drawn world felt barren. It must remain light enough that movement and resting are not oppressive.

Rules:

- forest/taiga get a few scattered trees; grass/plains only occasional trees; paths, floors, rubble, water, beaches, mountains, deserts and snow do not get ambient trees;
- exact editor resources always win and explicit null suppresses fallback on that tile;
- ambient mobs are only a few per multi-chunk active area, not every few tiles;
- roads, floors, rubble, beaches and water stay quiet;
- settlement markers are broad monster-safe zones; mining areas are not automatically safe;
- open grass/plains mostly produce chickens/cows/rats with rarer goblins/bandits;
- biome threats scale gently (wolves/spiders in forest, skeletons/hobgoblins in mountains, etc.);
- high-end monsters remain primarily authored anchors; dragons are never ambient.

The user's earlier complaint is important: the old implementation could produce enemies almost every other tile and gave the player no rest. **Do not increase density casually.**

## Vertical model

World plane and elevation are separate concepts.

Planes:
- `0` Surface
- `-1` Underground 1
- `-2` Underground 2

Surface/plane elevation range is `-2..+5`. Adjacent elevation difference 0-1 is traversable; 2+ is a cliff and impassable. This supports actual mountain barriers, valleys, quarries and passes.

Plane links support `cave_entrance`, `stairs`, and `ladder`, with full source/destination plane+x+y endpoints. Underground terrain is independently authored and can overlap surface coordinates.

## Editor / storage / performance

World Editor is the primary authoring tool (`?editor=1`). It supports brush, line, rectangles, selection/fill, copy/paste stamps, huge macro brushes, elevation tools, Surface/Underground plane switching, mini worldmap, M-key large map, markers, trees/resources, structures and spawners.

Editor persistence uses **IndexedDB**, not localStorage. Old v1-v5 localStorage saves are migrated once and removed only after IndexedDB accepts the data. JSON export/import remains the portable backup and AI handoff format.

Macro rendering and pointer redraws are throttled. Runtime terrain/elevation lookup uses `EditorSpatialIndex.ts`; do not regress to scanning all authored strokes for every tile.

## Reference markers

Marker types:
- `settlement`
- `village`
- `town`
- `city`
- `castle`
- `mining_area`

Markers are authored intent, not finished construction. Preserve their coordinates. The user's markers should override obsolete legacy `TOWNS` / `ORE_VEINS` data.

New characters should start at the authored marker named **Capital City** when present, falling back to another city/town marker only if it is absent.

## Settlement design

Do not return to the old "three houses = capital" scale. Design language remains **RuneScape function density + World of Warcraft district readability**.

Approximate compressed scales:
- farmstead ~28 tiles / ~3 buildings
- hamlet ~50 / ~8
- village ~90 / ~18
- town ~170 / ~42
- city ~300 / ~78
- capital ~480 / ~130

These are guidelines, not required squares. Finished settlements need recognizable streets/blocks/districts, ordinary houses/workshops/warehouses, and services placed in believable buildings.

## Gathering / progression

Metal ore remains authored only. Do not generate ore automatically from terrain. Ore ladder: Copper, Tin, Iron, Coal, Silver, Gold, Mithril, Adamantite, Runite, Dragonite. Dragonite smelting remains **2 Dragonite Ore + 2 Coal -> 1 Dragonite Bar**.

Character maximum level remains 120. Eventual regional danger can extend 1-300, but final danger regions should follow the finished geography/travel structure rather than old procedural rings.

Guiding principle: **the user's geography and markers are canonical; automation may add restrained scaffolding/ambience, never overwrite the world design.**
