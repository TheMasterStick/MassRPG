# Renewable resource state

MassRPG does not need permanent database state for every ordinary tree in a huge forest.

A deterministic resource node is identified from its stable resource type plus logical grid location and a small local index. While untouched, it has no dynamic server record at all. The authoritative server stores only temporary exceptions such as `depleted until <timestamp>`.

Two availability modes are part of the shared rules:

- **Personal:** routine resources can be depleted independently per character. Harvesting a normal tree does not make it disappear for everyone else.
- **Shared:** rare/high-end/event resources have one world state. If harvested, the depletion is visible to everyone until respawn.

Expiry uses absolute timestamps rather than continuously ticking sleeping chunks. When a resource is queried after its respawn time, the exception is deleted and the node once again comes entirely from authored/deterministic world data. This is the same sleeping-state principle intended for ordinary creature populations.

Exact respawn times remain content data and can be balanced later. The state model does not require a particular timer length.
