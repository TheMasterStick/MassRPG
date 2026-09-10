# Claude handoff — authored progression and resource placement

This note records a user-directed correction made after commit `901c258`.
Please preserve these rules in future world-generation work unless the user
explicitly changes them.

## Why this correction was needed

The player tested `901c258` in Codespaces and still saw Copper/Tin inside the
Capital walls and apparent ore carpeting in the desert. Inspection found a
real ordering/location bug: `WorldGen.resourceAt()` checked
`oreVeinResourceAt()` before checking whether the tile was inside a town, and
the Capital Deposit itself was centered only `(+15,+6)` from the Capital even
though the Capital safe/wall radius is 26. That made authored ore nodes able to
bypass town safety by design.

The broader implementation also still approximated the hand-drawn red level
regions with one smooth `distanceFromCapital()` curve. The user explicitly
wants the red overlapping regions themselves to be the normal progression
bands.

## World-generation rules now intended

1. **Biome = terrain/appearance, not ore tier.** Mountain/desert/snow tiles do
   not imply metal rocks. Generic biome resource tables must never reintroduce
   Copper/Tin/Iron/Coal/Silver/Gold/Mithril/Adamantite/Runite/Dragonite.
2. **Metal ore = authored mining sites only.** `ORE_VEINS` is the authoritative
   source. Each orange-map site has roughly 3–5 nodes of each listed ore type.
3. **Town and road safety wins over resource placement.** `resourceAt()` checks
   `isVillage()` / roads before consulting authored ore veins. A mining site
   must also be physically outside the settlement safe/wall footprint.
4. **Depletion remains persistent and dimmed.** Do not make mined rocks vanish;
   keep the existing grey/dim cooldown rendering from `901c258`.
5. **Red ellipses = authored progression zones.** `PROGRESSION_ZONES` in
   `AeldorData.ts` approximates the user's drawn 1–10, 10–19, 10–25, 20–35,
   25–40, 35–50, 40–50 and 60–120 overlapping areas. Normal monster selection
   now uses those ranges directly instead of `distanceFromCapital()`.
6. **Overlaps are deliberate.** A position inside more than one red zone can
   draw monsters valid for either zone. Do not turn the regions into hard
   non-overlapping rings.
7. **Out-of-band monsters should be authored exceptions later.** The user wants
   occasional specific Moss Giant/Dragon/Lesser Demon/etc. locations despite a
   local level band. No such exception POIs were invented in this correction;
   add them as explicit world data when the user specifies or approves them.
8. **Trees/gatherables should respect progression and occur in pockets.** Tree
   tiers are level-gated by the local progression range and the rarer tree
   types use grove noise rather than uniform salt-and-pepper placement.
9. **Gemstones are deferred.** Random `rock_gem` biome spawning is disabled for
   now. The user said gemstones and their full system will come later.

## Ore-site positions

The vein centers are approximate coordinates derived by scaling the orange
markers on the user's 944×958 reference map into the 15,000×15,000 world.
They are intentionally data-driven and can be tuned later without changing
world-generation logic. The Capital Copper/Tin site has been moved well
outside the 26-tile city wall.

## Debugging note

With the current code, `WorldGen.resourceAt()` has a defense-in-depth metal-ore
block for generic biome rules. Therefore, if a future test still shows Mithril
(or another metal) carpeted across an entire biome, do not "tune the chance".
First verify the running client is actually on the newest commit / Vite bundle,
then inspect the runtime resource ID and sprite mapping. Generic biome
spawning should be structurally incapable of returning a metal ore.
