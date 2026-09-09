# Player sprites

Any resolution, transparent background, height free and bottom-anchored —
see the [top-level rules](../README.md). Everything here is optional and
layered: idle facing sprites are the baseline, a walk cycle on top of
that while moving, and a gather animation on top of that while chopping
or mining. Missing any piece just falls back to the next one down.

## Idle (one per facing)

```
down.png
up.png
left.png
right.png
```

If a direction is missing, `down.png` is used for it instead, and if
`down.png` itself is missing the game falls back to a simple
circle-with-a-facing-dot. `left.png`/`right.png` are drawn as-is (not
auto-mirrored from one another) — draw both if you want them to differ.

## Walk cycle (optional, two frames per facing)

```
down_walk1.png / down_walk2.png
up_walk1.png / up_walk2.png
left_walk1.png / left_walk2.png
right_walk1.png / right_walk2.png
```

While the player is actually moving, these two frames alternate a few
times a second in place of the idle sprite for that facing. Provide both
frames for a facing to animate it; a facing with no walk frames just
keeps showing its idle sprite while moving (still correct, just static).

## Gather animation (optional, one windup + one swing, not per-facing)

```
axe_prepare.png / axe_swing.png       (shown while Woodcutting)
pickaxe_prepare.png / pickaxe_swing.png   (shown while Mining)
```

Unlike everything else here, these aren't direction-specific — one pose
each, used regardless of which way the player is facing (that's how the
delivered art was drawn, one clear action silhouette rather than four).
While an axe/pickaxe gather action is in progress the `_prepare` frame
shows during the windup, then swaps to `_swing` right as the action
resolves (whether it succeeds or not) and loops back to `_prepare` for
the next swing. Fishing and Farming have no tool-animation frames yet —
they still show the idle/walk sprite while gathering.
