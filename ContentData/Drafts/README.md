# MassRPG draft content

This directory contains editable, repository-backed content drafts produced by the MassRPG Data Editor surfaces.

Draft data is **not live MMO data**. It must pass validation, review/local testing and deliberate versioned publication before a live server uses it.

Current layout:

- `items/` — items, equipment, tools, consumables and materials.
- `creatures/` — creature and monster definitions.
- `resources/` — harvestable resource definitions.
- `recipes/` — production recipes.
- `definitions/` — flexible design records for game-content types that do not yet have a dedicated typed runtime schema.

The matching schemas live under `ContentData/Schemas/`.

Permanent content IDs are save/network references. Visible names may change; permanent IDs should not be casually renamed once referenced by other content or saves.

## Presentation assets

Gameplay definitions may include a separate `presentation` block containing stable icon/model/portrait/animation-set IDs, an asset state and visual notes. This intentionally allows content to be authored from a work computer without access to Unity, Blender or the final art files.

Entries marked `needs-assets`, `placeholder` or `linked` appear in the Online Data Editor **Asset Backlog**. At home, those entries can be pulled from Git, supplied with the proper models/icons/animation assets, and moved toward `final` without recreating their gameplay definitions.

## Other Game Definitions

`definitions/` is the universal design-authoring escape hatch. It can capture NPCs, shops, quests, loot tables, abilities, spells, factions, services, transports, build pieces, dialogue, events and future systems immediately, using a stable ID plus notes/tags/optional structured data.

These documents are **design-only until promoted**. If a definition affects runtime simulation, saves, networking, economy or other live behavior, it must be moved into an appropriate dedicated typed schema/runtime system before publication. Review-candidate manifests record the number of generic definitions, and the C# publication gate refuses to begin live publication while any remain.

## Shared source of truth

The browser/Codespaces editor writes here so content can be authored without Unity installed. Unity's repository-data tooling reads the same tree. The two authoring environments therefore share repository data rather than maintaining separate incompatible databases.

For items, creatures and recipes, repository drafts may currently override matching permanent IDs from temporary hard-coded migration seed catalogs when a resolved catalog is built. Resources currently form their repository catalog directly. The migration goal is to move the remaining seed catalogs into this repository-backed system as well.
