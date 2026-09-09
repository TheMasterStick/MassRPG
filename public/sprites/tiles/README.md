# Tile textures

Square, opaque, tileable ground textures. Each is stretched to fill its
32×32 tile exactly (not aspect-preserved), so keep them square. See the
[top-level rules](../README.md) for format/scaling details.

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
```

Optional variety: add `_1` and/or `_2` beside any of the above (e.g.
`grass_1.png`, `grass_2.png`) for a second/third texture the game mixes in
across the ground so it doesn't look like one tile copy-pasted forever.
