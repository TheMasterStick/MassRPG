# Roof overlays

Roofs for the game's built-in multi-tile building prefabs (see
`src/world/Buildings.ts`). Opaque, tileable, same "tiled as a continuous
repeating pattern" treatment as ground textures in [`tiles/`](../tiles/README.md)
— any resolution works.

```
tile_middle.png    tile_side.png
tatch_middle.png   tatch_side.png
```

Two roof materials (`tile` = terracotta, `tatch` = thatch), each with two
pieces:

- `_middle` — the plain repeating roof surface, used for every row of a
  building's roof except the front.
- `_side` — the front (south-facing) row, meant to carry the eave/trim
  detail where the roof meets the wall the player walks up to.

The roof draws as an overlay above the whole building (walls, furniture,
monsters, the player) when seen from outside, and disappears entirely for
whichever building the player is currently standing inside, so you can see
in. Missing files just mean that row goes untextured — the walls and floor
still render normally.
