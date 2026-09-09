# Resource sprites

Trees, ore rocks, fishing spots, flax and farm/herb patches. Any
resolution, transparent background, height free and bottom-anchored to
the tile — see the [top-level rules](../README.md). Trees especially read
better tall: draw the trunk base at the very bottom of the canvas and let
the canopy rise above the tile.

Note that `fishing_shrimp.png` and `fishing_lobster.png` are currently the
same shallow-water image, and `fishing_swordfish.png` reuses the
deep-water variant — draw separate art for any of the three whenever you
want them visually distinct.

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

farm_patch_empty.png    (optional: bare soil, nothing planted)
farm_patch_sown.png     (optional: something planted, still growing)
farm_patch_bloom.png    (optional: ready to harvest)
```

Notes on ore rock colors, if it helps to have a quick visual reference
while drawing: copper (orange-brown), tin (light grey), iron (rust brown),
coal (near-black), mithril (blue), adamant (green), rune (cyan), gold
(yellow), silver (pale grey), gem (pink/purple — it yields a random cut
gem, so keep it generic-looking rather than any one gem color).

`farm_patch.png` and `herb_patch.png` are the single-image fallback: used
as the tile's base/soil look, with a small growing-progress dot drawn on
top once something is planted. For farm patches specifically, you can
instead draw the three growth stages separately as `farm_patch_empty.png`
/ `farm_patch_sown.png` / `farm_patch_bloom.png` — if those exist the game
swaps between them as the crop grows and skips the dot overlay entirely.
Herb patches don't have per-stage art yet, so `herb_patch.png` always gets
the dot overlay.
