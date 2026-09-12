# Player spritesheet animation

MassRPG supports an optional metadata-driven player spritesheet at runtime.

## Files

Place these in `public/sprites/player/`:

- `animation.json` — animation layout metadata
- the PNG named by the manifest's `image` field (for example `player_sheet.png`)

`animation.example.json` is a template. Copy/rename it to `animation.json` and edit it to match whatever layout your spritesheet generator exports.

If `animation.json` or its image is absent, the game silently falls back to the existing directional PNG files (`down.png`, `left.png`, `*_walk1.png`, etc.). This allows old and new assets to coexist while animation art is produced gradually.

## Manifest fields

- `image`: spritesheet PNG path relative to this folder, or an absolute `/sprites/...` path.
- `frameWidth`, `frameHeight`: pixel dimensions of one frame cell.
- `renderWidthTiles`: optional intended world render width. The current legacy player renderer still uses its existing scale while migration is underway.
- `anchorX`, `anchorY`: normalized frame anchor. `0.5, 1.0` means bottom-centre and is the recommended convention for characters.
- `animations`: named clips such as `idle`, `walk`, `attack`, `death`, `gather_axe`, etc.
- `fps`: playback speed.
- `loop`: whether a clip repeats.
- `directions`: `up`, `down`, `left`, `right` sequences.
- `row` + `frames`: common row/column layout. `frames` can contain any column order, not only consecutive numbers.
- `cells`: alternative arbitrary `{ "col": n, "row": n }` cells for generators whose frames are scattered around the sheet.

## Current integration

`idle` and `walk` are already consumed by the existing player renderer. Any frame count is supported; the old two-frame walk PNGs are now only a fallback.

The animation core is generic and already supports non-looping clips and arbitrary animation names. Combat, gathering, monsters, NPCs and layered character-creator sheets can therefore use the same renderer as those systems are connected.

## Important authoring rule

Keep the same frame dimensions and the same bottom-centre foot anchor across all directions and animations. For modular characters, body, hair, clothing, armour and equipment animation sheets should eventually share the exact same frame grid so their corresponding cells can be layered without per-frame manual offsets.
