# Structure sprites

Every player-built or village structure. Any resolution, transparent
background, height free and bottom-anchored — see the
[top-level rules](../README.md).

```
bank_chest.png
furnace.png
anvil.png
cooking_range.png
campfire.png
workbench.png
fence.png
wall.png
wall_window.png
bed.png
storage_chest.png
tannery.png
loom.png
general_store.png
```

`wall.png` and `wall_window.png` are also used as the exterior wall/window
segments of the game's built-in multi-tile buildings (a house and a
smithy, see `src/world/Buildings.ts`) — one image tiled across every wall
tile of the building's perimeter, not a single building-sized sprite.

