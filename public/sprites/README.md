# Drop-in pixel art

Everything in this folder is optional. The game renders every tile,
resource, structure, monster and the player procedurally out of the box —
drawing a matching PNG here just replaces that one thing with your art. Add
one file, refresh the browser, see it in the game. Nothing to wire up in
code, nothing to register — the game already looks for every filename
listed in each subfolder's README on every load.

## The five folders

| Folder | What goes here | Details |
|---|---|---|
| [`tiles/`](tiles/README.md) | Ground textures (grass, water, mountain, ...) | square, tileable |
| [`resources/`](resources/README.md) | Trees, ore rocks, fishing spots, farm patches | can be taller than one tile |
| [`structures/`](structures/README.md) | Furnace, anvil, bank, campfire, ... | can be taller than one tile |
| [`monsters/`](monsters/README.md) | Every enemy, from chicken to dragon | can be taller than one tile |
| [`player/`](player/README.md) | The adventurer, one image per facing | can be taller than one tile |

## The rules that apply everywhere

- **Format**: PNG with a transparent background (except tile textures,
  which should be fully opaque so they tile without gaps).
- **File name**: must exactly match the id given in each folder's list
  below — lowercase, underscores, `.png`. `tree_normal.png`, not
  `TreeNormal.png` or `tree-normal.png`.
- **Width**: draw everything at a **32px-wide base** (or a clean multiple,
  like 64px, if you want to work larger and let it scale down — just keep
  it square-pixel-friendly). Every sprite is drawn at exactly one
  tile-width (32 screen px); the game does not stretch width.
- **Height is free** for anything except tile textures. A ground tile is
  stretched to fill its 32×32 tile exactly. Everything else (trees, rocks,
  monsters, the player, structures) is drawn at that fixed width with
  height scaled to match your image's own aspect ratio, anchored to the
  *bottom* of the tile it's standing on. So a 32×32 rock sits flush in its
  tile, and a 32×56 tree rises up above it looking properly tall instead
  of getting squashed into a single tile — draw the trunk's base at the
  very bottom of the canvas and let the canopy extend upward.
- **Pixel art scaling is crisp, not blurry** — the renderer disables image
  smoothing, so you can draw small (e.g. 16×16) and it'll scale up cleanly
  without going soft.
- **Nothing is required.** Anything missing quietly falls back to the
  current colored-shape/glyph rendering, so you can add art one file at a
  time in any order and the game keeps working throughout.

## Depth/overlap

Trees, monsters, structures and the player are all depth-sorted by their
position in the world (things further "south" draw in front of things
further "north"), so a tall tree correctly overlaps a monster standing
above it and gets overlapped by one standing below it — draw tall sprites
with confidence, the overlap is handled for you.

## Optional: ground texture variety

Each tile type can optionally have up to two extra texture variants —
`grass_1.png` and `grass_2.png` alongside `grass.png`, for example — and
the game will pick between all three per-tile (consistently, not randomly
each frame) so a big grass field doesn't look like one image repeated
forever. Totally optional; `grass.png` alone works fine.
