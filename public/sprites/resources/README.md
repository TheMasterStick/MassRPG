# Resource sprites

Trees, ore rocks, fishing spots, flax and farm/herb patches. Any
resolution, transparent background, height free and bottom-anchored to
the tile — see the [top-level rules](../README.md). Trees especially read
better tall: draw the trunk base at the very bottom of the canvas and let
the canopy rise above the tile.

Note that only one fishing spot art was provided so far
(`fishing_shrimp.png`, `fishing_lobster.png` and `fishing_swordfish.png`
are currently all the same image) — draw separate art for any of the
three whenever you want them visually distinct.

```
tree_normal.png
tree_oak.png
tree_willow.png
tree_maple.png
tree_yew.png
tree_magic.png

rock_copper.png
rock_tin.png
rock_iron.png
rock_coal.png
rock_mithril.png
rock_adamant.png
rock_rune.png
rock_gold.png
rock_silver.png
rock_gem.png

fishing_shrimp.png
fishing_lobster.png
fishing_swordfish.png

flax_plant.png
farm_patch.png
herb_patch.png
```

Notes on ore rock colors, if it helps to have a quick visual reference
while drawing: copper (orange-brown), tin (light grey), iron (rust brown),
coal (near-black), mithril (blue), adamant (green), rune (cyan), gold
(yellow), silver (pale grey), gem (pink/purple — it yields a random cut
gem, so keep it generic-looking rather than any one gem color).

`farm_patch.png` and `herb_patch.png` are special: whatever you draw is
used as the tile's base/soil look, but the game still draws a small
growing-progress dot on top of it once something is planted (there's no
way to show that with a single static image, so this stays a small
procedural overlay regardless of what art you provide).
