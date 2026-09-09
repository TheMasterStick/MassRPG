# Monster sprites

One image per monster type — not per instance, so a single `goblin.png`
covers every goblin in the world. Any resolution, transparent background,
bottom-anchored to its tile — see the [top-level rules](../README.md).

Draw every monster **facing right**. There's no separate left-facing frame
— the game mirrors the same image horizontally whenever a monster needs to
face left (fleeing, wandering, or fighting a player standing to its west),
so a single drawing covers both directions automatically.

Draw all of these at the same canonical proportions (frame each the same
way in its own canvas, whatever size you're working at). The game
automatically draws bigger monsters wider — a dragon is drawn at roughly
2.4× a goblin's width — so you don't need to pre-scale anything; just
draw each one true to its own shape and the size column below tells you
roughly how prominent it'll end up on screen relative to the others.
Note that a chicken at 0.5× ends up genuinely small on screen (roughly
16px wide) — that's expected, not a bug, chickens are meant to read as
small critters next to everything else.

| file | monster | level | relative size |
|---|---|---:|---:|
| `chicken.png` | Chicken | 1 | 0.5× |
| `rat.png` | Giant rat | 2 | 0.55× |
| `cow.png` | Cow | 2 | 0.8× |
| `goblin.png` | Goblin | 5 | 0.75× |
| `giant_spider.png` | Giant spider | 7 | 0.7× |
| `skeleton.png` | Skeleton | 10 | 0.85× |
| `bandit.png` | Bandit | 12 | 0.85× |
| `wolf.png` | Wolf | 15 | 0.9× |
| `frost_wolf.png` | Frost wolf | 20 | 0.95× |
| `zombie.png` | Zombie | 18 | 0.9× |
| `hobgoblin.png` | Hobgoblin | 25 | 1× (baseline) |
| `dark_wizard.png` | Dark wizard | 22 | 0.9× |
| `hill_giant.png` | Hill giant | 28 | 1.3× |
| `moss_giant.png` | Moss giant | 35 | 1.4× |
| `ogre.png` | Ogre | 40 | 1.5× |
| `lesser_demon.png` | Lesser demon | 45 | 1.4× |
| `ice_troll.png` | Ice troll | 50 | 1.5× |
| `fire_giant.png` | Fire giant | 55 | 1.6× |
| `greater_demon.png` | Greater demon | 65 | 1.7× |
| `troll.png` | Mountain troll | 70 | 1.8× |
| `wyvern.png` | Wyvern | 80 | 1.9× |
| `dragon.png` | Dragon | 95 | 2.4× |

Until an enemy has its own sprite it renders as a colored circle labelled
with its name and level, so it's always identifiable even half-finished.
