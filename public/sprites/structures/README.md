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
wall_brick.png
wall_stone.png
wall_cobble.png
bed.png
storage_chest.png
tannery.png
loom.png
general_store.png
```

`wall.png`/`wall_window.png`/`wall_brick.png`/`wall_stone.png`/`wall_cobble.png`
are also used as the exterior wall/window segments of the game's built-in
multi-tile buildings (houses and a smithy in various materials, see
`src/world/Buildings.ts`) — one image tiled across every wall tile of a
building's perimeter, not a single building-sized sprite. `wall_stone.png`
doubles as every town's perimeter wall/fence material for the capital
specifically (`fence.png` is used for every other town's perimeter).

