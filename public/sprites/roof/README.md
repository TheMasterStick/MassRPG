# Roof overlays

Roofs for the game's built-in multi-tile building prefabs (see
`src/world/Buildings.ts`). Opaque; each tile is drawn individually at a
fixed 32x32 size (not pattern-tiled like ground textures) since building
footprints are small — any resolution works, it's just scaled to fit.

```
tile_middle.png    tile_side.png
tatch_middle.png   tatch_side.png
```

Two roof materials (`tile` = terracotta, `tatch` = thatch), each with two
pieces:

- `_middle` — the plain repeating roof surface, used for every interior
  cell of a building's roof.
- `_side` — the eave/trim piece, used for every cell around the outer
  ring of the roof (all four edges, not just the front). Draw its trim
  detail facing the *bottom* of the canvas — the game rotates the same
  image per edge so the trim always faces outward (unrotated on the
  bottom edge, flipped 180° on top, rotated 90°/-90° on the left/right
  edges), so one image wraps the whole perimeter.

The roof draws as an overlay above the whole building (walls, furniture,
monsters, the player) when seen from outside, and disappears entirely for
whichever building the player is currently standing inside, so you can see
in. Missing files just mean that cell goes untextured — the walls and
floor still render normally.
