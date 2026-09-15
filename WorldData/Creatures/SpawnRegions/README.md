# Creature Spawn Regions

`MassRPG -> Creature Spawn Editor` writes ordinary creature population definitions here.

A spawn region contains a stable ID, creature definition ID, explicit plane/storey, fixed authored population cap, gradual respawn interval, roam mode and a circle/polygon area. Patrol-route regions can additionally define an explicit route.

These files are simulation data and are **not** automatically exposed on the public player map. Sleeping/materialization and exact runtime creature identities remain authoritative server state; the authored file defines the logical population rule.
