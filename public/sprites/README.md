# Drop-in pixel art

Everything in this folder is optional. The game renders every tile,
resource, structure, monster and the player procedurally out of the box —
drawing a matching PNG here just replaces that one thing with your art. Add
one file, refresh the browser, see it in the game. Nothing to wire up in
code, nothing to register — the game already looks for every filename
listed in each subfolder's README on every load.

## The folders

| Folder | What goes here | Details |
|---|---|---|
| [`tiles/`](tiles/README.md) | Ground textures (grass, water, mountain, ...) | tiles as a repeating pattern |
| [`resources/`](resources/README.md) | Trees, ore rocks, fishing spots, farm patches | can be taller than one tile |
| [`structures/`](structures/README.md) | Furnace, anvil, bank, campfire, ... | can be taller than one tile |
| [`monsters/`](monsters/README.md) | Every enemy, from chicken to dragon | can be taller than one tile |
| [`player/`](player/README.md) | The adventurer: idle, walk cycle, gather animations | can be taller than one tile |
| `hold/` | A staging area, not read by the game | drop files here, they get sorted from there |

## The rules that apply everywhere

- **Format**: PNG with a transparent background (except tile textures,
  which should be fully opaque so they tile without seams).
- **File name**: must exactly match the id given in each folder's list
  below — lowercase, underscores, `.png`. `tree_normal.png`, not
  `TreeNormal.png` or `tree-normal.png`.
- **Any resolution works.** Draw small (32px) native pixel art or a large
  detailed digital painting (hundreds or thousands of pixels wide) —
  either is fine. The renderer downscales everything with high-quality
  smoothing, not nearest-neighbour, so large detailed source art comes out
  looking clean and antialiased rather than noisy.
- **Width is normalized, height is free** (except tile textures, which
  fill their 32×32 tile exactly). Everything else — trees, rocks,
  monsters, the player, structures — is drawn at a fixed tile-width with
  height scaled to match your image's own aspect ratio, anchored to the
  *bottom* of the tile it's standing on. A square rock sits flush in its
  tile; a tall tree rises up above it looking properly tall instead of
  getting squashed into a single tile — draw the trunk's base at the very
  bottom of the canvas and let the canopy extend upward.
- **Nothing is required.** Anything missing quietly falls back to the
  current colored-shape/glyph rendering, so you can add art one file at a
  time in any order and the game keeps working throughout.

## How ground textures actually render

A tile texture is **not** squished into a single 32×32 tile — for a large,
detailed image that would flatten all its character into a near-solid
blur. Instead it's tiled as a continuous repeating pattern anchored to the
world (not the screen), spanning several tiles per repeat, so detail like
scattered flowers or pebbles stays visible and the texture doesn't swim or
reset as the camera pans. You don't need to do anything for this — any
tileable-ish texture you provide, at any resolution, gets this treatment
automatically.

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
each frame) so a big grass field doesn't look like one texture repeated
forever. Totally optional; `grass.png` alone works fine.
