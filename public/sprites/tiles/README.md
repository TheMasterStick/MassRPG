# Tile textures

Ground textures. Opaque (no transparency), any resolution — see the
[top-level rules](../README.md). Unlike everything else in `sprites/`,
these aren't stretched into a single 32×32 tile; they're tiled as a
continuous repeating pattern anchored to the world, so a detailed texture
keeps its character instead of blurring into a near-solid color.

Drop in any subset — anything missing falls back to today's flat color.

```
deep_water.png
water.png
beach.png
grass.png
plains.png
forest.png
taiga.png
mountain.png
snow.png
desert.png
swamp.png
path.png
rubble.png

floor_wood.png
floor_brick.png
floor_cobble.png
```

The three `floor_*` textures are interior flooring for the game's built-in
buildings (see `src/world/Buildings.ts`) rather than outdoor ground — the
game swaps to one of these automatically for any tile inside a building's
walls.

Optional variety: add `_1` and/or `_2` beside any of the above (e.g.
`grass_1.png`, `grass_2.png`) for a second/third texture the game mixes in
across the ground so it doesn't look like one texture repeated forever.
