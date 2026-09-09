# MassRPG

A gigantic RPG you can play in the browser, set in **Aeldor** — a fixed,
hand-mapped 15,000×15,000 tile world with 14 named towns, a capital, and
ruins to explore, not an infinite random one. Start as an adventurer with
nothing but a hatchet and a pickaxe: chop trees, mine ore, fish the coasts,
farm crops, smith and craft equipment, cook your catch, fight monsters from
chickens to dragons, and build furnaces, chests and camps as you travel.

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

The right-hand sidebar is a classic fixed RPG interface: a minimap (click
it to walk toward that spot — it always stays centred on you and shows
nearby towns/ruins), and a tab bar for Combat style, Skills, Quests
(placeholder for now), Inventory, Equipment and Construction, plus Save.

- **Click** a tile to walk there, click a resource/monster/structure to
  interact with it (the game auto-walks you into range first). Click
  anywhere on the **minimap** to walk there directly.
- **WASD / arrow keys** to walk directly; hold **Shift** to run. Manual
  movement always takes priority — pressing a direction key breaks off
  combat/gathering the same as clicking away does, so you can always
  choose to run.
- **I** — Inventory, **K** — Skills, **B** — Construction, **M** — World
  map, or just click the matching sidebar tab/icon.
- The **world map** shows the whole continent at once with every town and
  ruin labelled, plus a zoom in/out control that narrows in on your
  current surroundings. Click anywhere on it to instantly fast-travel
  there (it snaps to the nearest walkable ground if you click on water) —
  this is a teleport, not a walked path, since the map covers distances
  far beyond normal pathfinding range.
- Pick a **combat style** (Melee / Ranged / Magic) on the Combat tab
  before fighting — Ranged needs a bow and arrows equipped/carried, Magic
  works from level 1 with no equipment needed.
- Click an inventory item for contextual actions (Equip, Eat, Drink, Light
  fire, Clean herb, Drop, Examine).

## The world of Aeldor

A fixed 15,000×15,000 tile continent, generated once from an authored
layout (not randomized per playthrough): a central lake (Embermere Lake,
with the island ruin Serpent's Spire at its heart), the snow-capped
Frostpeak Mountains in the north, Blackthorn Mountains and Stonehollow
Hills flanking it, forests (Oakridge Woods, Whispering Woods, Elderwood
Forest), the Darkfen swamp, and the desert Gray Wastes in the southeast —
all surrounded by ocean. Named-region shapes are this build's own
interpretation of a set of reference maps, filled in with simplex noise so
biome edges read as natural coastline/treeline rather than hard shapes,
not a pixel-exact reproduction of any source map.

14 towns (plus the capital, where you start) are placed at fixed
coordinates, each a full hub with a bank, general store, furnace, anvil,
cooking range, loom and workbench, connected by a road network (a minimum
spanning tree over all the towns) that doubles as a bridge wherever it
needs to cross water. Three ruins (Old Cairn Ruins, Moonfall Ruins,
Serpent's Spire) are marked zones of scattered rubble. Monster difficulty
scales up with distance from the nearest town, so the roads and their
surrounding land stay safe while the deep wilderness between settlements
gets dangerous. World generation lives in `src/world/AeldorData.ts` (the
authored towns/ruins/regions) and `src/world/WorldGen.ts` (turns that into
tiles, still chunked and lazily generated so the browser never holds more
than the nearby area in memory).
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
  magic, loot tables, and 21 monster types spanning level 1 to 95+.
  Chickens, rats and cows are neutral (won't attack unless attacked);
  everything else aggroes within a short range, gives up if you get more
  than a few tiles from where it spawned, ambles back home, and won't
  re-aggro for several seconds after giving up a chase — so you can
  always run rather than being followed indefinitely. Tougher monsters
  only start appearing the further you get from the nearest town.
- **Construction**: place furnaces, anvils, cooking ranges, tanneries,
  looms, workbenches, storage chests, beds (sets your respawn point),
  fences and walls anywhere you've cleared space, using planks, stone and
  bars you've gathered.
- **Economy**: a general store to buy starter tools and sell loot, plus a
  bank for long-term storage (also reachable through any storage chest you
  build).
- **Persistence**: autosaves every 20s to `localStorage`, plus a manual
  Save button; only the parts of the world you've changed (depleted nodes,
  planted crops, buildings) are stored, so saves stay small even across a
  225-million-tile map.

## Adding your own pixel art

Every tile, tree, ore, structure, monster and the player currently render
as colored shapes/glyphs — that's a deliberate fallback, not a placeholder
you need to strip out. Drop a correctly-named PNG into `public/sprites/`
and it's picked up automatically on the next load, no code changes needed;
anything you haven't drawn yet just keeps using the procedural look. Start
at [`public/sprites/README.md`](public/sprites/README.md) for the exact
file names, sizing rules and how tall art (like trees) is anchored to its
tile — each subfolder (`tiles/`, `resources/`, `structures/`, `monsters/`,
`player/`) has its own README listing precisely what it's looking for.

## Architecture

Plain TypeScript + Vite, rendered with the 2D Canvas API (no game engine or
GPU framework dependency) with a DOM-based UI layer on top.

```
src/
  core/       game loop, camera/renderer, sprite loading, RNG, noise, tick-based engine
  world/      chunked world (fixed Aeldor layout), tile/resource/structure state
  data/       item, monster, recipe, skill and biome definitions (data-driven)
  entities/   Player and Monster models
  systems/    gathering, production, combat, construction, inventory,
              banking, shop, pathfinding, save/load — one file per concern
  ui/         Sidebar (minimap, tabs) and its embedded panels (combat
              style, skills, inventory, equipment, build), plus floating
              popups (station, bank, shop, context menus) - wired to game
              state via a small event bus
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
nearest town); and a built storage chest shares your single global bank
rather than holding its own separate inventory. These are good spots to
extend if you want to keep building this out.

On the world itself: every town uses the same building layout rather than
a unique one per settlement; roads are straight-ish lines between towns
and will cross water as a "bridge" rather than routing around it;
Serpent's Spire is a real island in the middle of the lake with no boat or
swim mechanic yet to reach it (it renders correctly, it's just not
reachable on foot); and the named-region shapes (mountains, forests, the
lake, the desert) are this build's own interpretation of the reference
maps it was designed from, not a pixel-exact reproduction.

On the UI: the Quest tab is a placeholder (there's no quest system yet);
WASD movement steps one tile at a time in whatever direction you're
holding and won't slide around a single-tile obstacle like a tree, so if
you get stuck fleeing in a straight line, angle around it or click
elsewhere/on the minimap instead (that uses real pathfinding).
