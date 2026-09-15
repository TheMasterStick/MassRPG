# Creature simulation foundation

Creature definitions are published data referenced by permanent content IDs. Materialized runtime instances hold only changing state such as position, HP, target and attack timing. This keeps balance/content changes separate from saved instance state.

Baseline behavior categories are explicit:

- **Passive** — never initiates combat; may later flee or use other traits.
- **Neutral** — never initiates combat, but can retaliate after being attacked.
- **Aggressive** — may initiate combat when a valid target enters its authored aggro rules.

Most creatures occupy 1x1 logical tiles. Large creatures can use multi-tile footprints such as 2x2 or 3x3. Range and melee adjacency are evaluated against the footprint rather than an invisible center point.

Creature-to-creature occupancy is soft: materialized creatures prefer separate tiles and cannot intentionally settle into the same footprint. Players and NPCs are not hard blockers and therefore do not appear in the creature occupancy index. In a narrow 1x1 passage, creatures naturally queue because the next creature tile is occupied; they do not gain a tactical rule that makes them circle around the target merely to find another attacking side.

Ordinary creatures are not required to retain individual identity while their population region sleeps. Named rares/bosses can be flagged for persistent identity/state and will later use explicit respawn records.
