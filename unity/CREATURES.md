# Creature simulation foundation

Creature definitions are published data referenced by permanent content IDs. Materialized runtime instances hold only changing state such as position, HP, target and attack timing. This keeps balance/content changes separate from saved instance state.

Baseline behavior categories are explicit:

- **Passive** — never initiates combat and does not automatically retaliate.
- **Neutral** — never initiates combat, but retaliates after being attacked.
- **Aggressive** — may initiate combat when a valid target enters its authored aggro rules.

Most creatures occupy 1x1 logical tiles. Large creatures can use multi-tile footprints such as 2x2 or 3x3. Range and melee adjacency are evaluated against the footprint rather than an invisible center point.

Creature-to-creature occupancy is soft: materialized creatures prefer separate tiles and cannot intentionally settle into the same footprint. Players and NPCs are not hard blockers and therefore do not appear in the creature occupancy index. In a narrow 1x1 passage, creatures naturally queue because the next creature tile is occupied; they do not gain a tactical rule that makes them circle around the target merely to find another attacking side.

## Ordinary spawn populations

`CreatureSpawnRegionDefinition` is authored simulation data. It references a creature template, an arbitrary painted/circular/polygonal area, a population cap, a respawn interval and a roaming mode. Spawn regions are not automatically public map POIs.

`CreaturePopulationService` implements the settled sleep behavior:

- a region has a logical population independent of whether exact actors are currently materialized;
- killing a creature reduces that population and starts a timestamp-based respawn schedule;
- respawns mature gradually rather than refilling the whole region at once;
- deactivating a region removes ordinary runtime actors but preserves population and the next respawn timestamp;
- re-entering shortly afterward therefore does **not** reset/refill the region;
- after a long absence, elapsed time is applied and the population may legitimately have recovered;
- ordinary creatures may be rematerialized with new instance IDs/positions when the region wakes.

Named rares/bosses remain a separate case. `PersistentNamedInstance` creature definitions are rejected by the ordinary population service because their identity/death/respawn state must survive sleeping explicitly.

## Player auto-combat

The first authoritative auto-attack loop is now present. Clicking a creature establishes the target and the server chooses the approach tile. When combat advances, the server validates range/LOS again, replans if the creature moved, enforces the weapon attack interval, derives hit chance/damage from skills and published equipment, applies the settled +/-5% ranged/magic high-ground accuracy rule, damages the creature and triggers neutral/aggressive retaliation state. The client does not choose its own stopping tile, attack cadence, hit chance or damage.
