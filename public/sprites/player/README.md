# Player sprites

Up to four images, one per facing direction. Drawn at 32px wide, height
free and bottom-anchored — see the [top-level rules](../README.md).

```
down.png
up.png
left.png
right.png
```

You don't need all four to start: if a direction is missing, `down.png`
is used for it instead, and if `down.png` itself is missing the game
falls back to the current simple circle-with-a-facing-dot rendering. So
a single `down.png` alone already gives every direction a sprite (just
not a direction-accurate one) — add `up`/`left`/`right` whenever you get
to them.

`left.png` and `right.png` are drawn as-is (not auto-mirrored from one
another), so if you only want to draw one side, note that the game will
NOT flip it for you — draw both if you want left/right to differ.
