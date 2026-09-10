# Claude handoff — authored progression and resource placement

This note records user-directed corrections made after commit `901c258`.
Please preserve these rules in future world-generation work unless the user
explicitly changes them.

## Why the ore/town correction was needed

The player tested `901c258` in Codespaces and still saw Copper/Tin inside the
Capital walls and apparent ore carpeting in the desert. Inspection found a
real ordering/location bug: `WorldGen.resourceAt()` checked
`oreVeinResourceAt()` before checking whether the tile was inside a town, and
the Capital Deposit itself was centered only `(+15,+6)` from the Capital even
though the Capital safe/wall radius is 26. That made authored ore nodes able to
bypass town safety by design.

A second town-safety bug was also present: the perimeter walls are square, but
`isVillage()` used circular `Math.hypot()` distance. That left four corner
wedges *inside* each wall eligible for wilderness resource/monster spawns. The
safe-zone geometry now matches the square wall footprint.

The broader implementation also approximated the hand-drawn red level regions
with one smooth `distanceFromCapital()` curve. The user explicitly wants the
red overlapping regions themselves to be the normal progression bands.

## World-generation rules now intended

1. **Biome = terrain/appearance, not ore tier.** Mountain/desert/snow tiles do
   not imply metal rocks. Generic biome resource tables must never reintroduce
   Copper/Tin/Iron/Coal/Silver/Gold/Mithril/Adamantite/Runite/Dragonite.
2. **Metal ore = authored mining sites only.** `ORE_VEINS` is the authoritative
   source. Each site has roughly 3–5 nodes of each listed ore type.
3. **Town and road safety wins over resource placement.** `resourceAt()` checks
   `isVillage()` / roads before consulting authored ore veins. A mining site
   must also be physically outside the settlement safe/wall footprint.
4. **Town safety uses the same geometry as the walls.** Current town/capital
   perimeter walls are square, so the protected area must also cover the whole
   square interior, including the corners.
5. **Depletion remains persistent and dimmed.** Do not make mined rocks vanish;
   keep the existing grey/dim cooldown rendering from `901c258`.
6. **Red ellipses = authored progression zones, not visible terrain.**
   `PROGRESSION_ZONES` approximates the user's drawn 1–10, 10–19, 10–25,
   20–35, 25–40, 35–50, 40–50 and 60–120 overlapping gameplay areas. Normal
   monster selection uses those ranges rather than `distanceFromCapital()`.
7. **Overlaps are deliberate.** A position inside more than one progression
   zone can draw monsters valid for either zone. Do not turn them into hard
   non-overlapping rings.
8. **Out-of-band monsters should be authored exceptions later.** The user wants
   occasional specific Moss Giant/Dragon/Lesser Demon/etc. locations despite a
   local level band. Add those as explicit world data when specified/approved.
9. **Trees/gatherables should respect progression and occur in pockets.** Tree
   tiers are level-gated by the local progression range and rarer tree types use
   grove noise rather than uniform salt-and-pepper placement.
10. **Gemstones are deferred.** Random `rock_gem` biome spawning is disabled
    for now. The user said gemstones and their full system will come later.

## Terrain fidelity correction (September 10)

The player then tested the corrected ore build and confirmed the scattered ores
were gone and the Capital was square, but reported that the world itself still
looked far too circular and that the beaches were enormous. That was caused by
visible terrain regions being represented as ellipses and by the old
`continentValue()` beach threshold creating a coastline band hundreds of tiles
wide.

The original illustrated map **`Aeldor: Mahdollisuuksien maa.png` is now the
visual terrain source of truth**. `AeldorData.ts` contains an irregular traced
`CONTINENT_OUTLINE` and irregular polygon outlines for Embermere Lake,
Frostpeak, Blackthorn, Stonehollow, Elderwood, Oakridge, Whispering Woods,
Darkfen and the Gray Wastes. `WorldGen.ts` uses polygon membership plus only a
small coherent edge warp. Do not replace these visible regions with circles or
large ellipses again just because ellipses are simpler.

Beaches are now intentionally **very narrow and intermittent**: the normal
outer-coast beach width is only six world tiles, and most shoreline is allowed
to remain grass/cliff-like as in the painted map. Do not recreate a broad
continuous sand belt.

The Gray Wastes also exposed a monster-roster gap: its normal 20–35 progression
range had no desert-biome monster in that exact band, so strict filtering made
the desert empty. Normal spawn selection now prefers the exact range but, when
a biome has no candidate there, falls back to the strongest biome monster at or
below the local maximum. This is a roster-gap fallback, not permission to ignore
progression zones generally.

Ore nodes are now drawn as **black dots on the local minimap**, including while
depleted, so authored mining sites become discoverable when the player gets
near them. When the coastline trace moved some old approximate vein centers
into water, those centers were nudged to nearby reachable land in the same
part of the world. Do not silently put mining nodes back in ocean tiles.

## Cities and settlements

Do **not** perform a broad redesign of cities yet. The user has said they want
to expand on cities themselves next. Preserve the current square settlement
safety/wall behavior and wait for the city-layout discussion rather than
inventing a new settlement system during terrain work.

## Debugging note

With the current code, `WorldGen.resourceAt()` has a defense-in-depth metal-ore
block for generic biome rules. If a future test shows Mithril (or another metal)
carpeted across an entire biome, do not tune the chance. First verify the
running client is actually on the newest commit / Vite bundle, then inspect the
runtime resource ID and sprite mapping. Generic biome spawning should be
structurally incapable of returning a metal ore.
