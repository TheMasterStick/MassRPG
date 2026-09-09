# MassRPG

A gigantic, procedurally generated RPG you can play in the browser. Start as
an adventurer with nothing but a hatchet and a pickaxe, and explore an
infinite seeded world: chop trees, mine ore, fish the coasts, farm crops,
smith and craft equipment, cook your catch, fight monsters from chickens to
dragons, and build furnaces, chests and camps as you travel.

It's built as a single-player, RuneScape-flavoured sandbox: no server, no
downloads, everything runs client-side and saves to your browser.

## Running it

```bash
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a static
production build in `dist/` (open `dist/index.html` after building, or
serve the folder with any static file server).

## Controls

- **Click** a tile to walk there, click a resource/monster/structure to
  interact with it (the game auto-walks you into range first).
- **WASD / arrow keys** to walk directly; hold **Shift** to run.
- **I** — Inventory, **K** — Skills, **B** — Construction/build menu.
  Equipment and Save are in the top-right bar.
- Pick a **combat style** (Melee / Ranged / Magic) in the top-right before
  fighting — Ranged needs a bow and arrows equipped/carried, Magic works
  from level 1 with no equipment needed.
- Click an inventory item for contextual actions (Equip, Eat, Drink, Light
  fire, Clean herb, Drop, Examine).

## What's in the world

- **Procedural generation**: seeded simplex noise drives elevation,
  moisture and temperature fields, which combine into biomes — ocean,
  beach, grassland, forest, taiga, swamp, desert, snow and mountains — laid
  out in infinite chunks around a fixed starting village (with a bank,
  general store, furnace, anvil, cooking range, loom and workbench).
- **18 skills**, using RuneScape's real XP curve (level 99 = 13,034,431 xp):
  Hitpoints, Attack, Strength, Defence, Ranged, Magic (combat); Woodcutting,
  Mining, Fishing, Farming (gathering); Cooking, Firemaking, Smithing,
  Crafting, Fletching, Herblore (production); Construction and Agility
  (support/running).
- **Gathering**: six tiers of trees, ten tiers of rock/ore, tiered fishing
  spots (net → rod → pot → harpoon), farming and herb patches with real
  growth timers, and flax fields.
- **Production**: smelt ore into six metal tiers (bronze → rune) and smith
  full equipment sets at an anvil; cook at a fire or range (with a burn
  chance that falls off as your level rises); fletch bows and arrows; tan
  and craft leather armor; cut gems and set jewellery; clean and brew
  herblore potions.
- **Combat**: OSRS-style accuracy/max-hit formulas for melee, ranged and
  magic, monster aggro/leash/wander AI, loot tables, and 20 monster types
  spanning level 1 to 95+. Tougher monsters only start appearing the
  further you wander from the starting village.
- **Construction**: place furnaces, anvils, cooking ranges, tanneries,
  looms, workbenches, storage chests, beds (sets your respawn point),
  fences and walls anywhere you've cleared space, using planks, stone and
  bars you've gathered.
- **Economy**: a general store to buy starter tools and sell loot, plus a
  bank for long-term storage (also reachable through any storage chest you
  build).
- **Persistence**: autosaves every 20s to `localStorage`, plus a manual
  Save button; only the parts of the world you've changed (depleted nodes,
  planted crops, buildings) are stored, so saves stay small in an infinite
  world.

## Architecture

Plain TypeScript + Vite, rendered with the 2D Canvas API (no game engine or
GPU framework dependency) with a DOM-based UI layer on top.

```
src/
  core/       game loop, camera/renderer, RNG, noise, tick-based engine
  world/      chunked procedural world, tile/resource/structure state
  data/       item, monster, recipe, skill and biome definitions (data-driven)
  entities/   Player and Monster models
  systems/    gathering, production, combat, construction, inventory,
              banking, shop, pathfinding, save/load — one file per concern
  ui/         DOM panels (inventory, skills, equipment, build, station,
              bank, shop, context menus) wired to game state via a small
              event bus
```

The simulation runs on fixed 600ms ticks (matching RuneScape's game tick)
for combat, gathering, production and monster AI, decoupled from the
render loop so movement stays smooth regardless of tick rate.

## Known simplifications

This is a huge scope for one build, so a few systems are intentionally
simplified rather than 1:1 with RuneScape: Magic combat is a single
always-available "channel raw magic" style rather than a spellbook/rune
system; there's no Prayer, Runecraft, Thieving, Slayer or Hunter skill;
death has no item loss (you respawn at full health at your bed or the
village); and a built storage chest shares your single global bank rather
than holding its own separate inventory. These are good spots to extend
if you want to keep building this out.
