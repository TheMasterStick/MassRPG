# MassRPG draft content

This directory contains editable, repository-backed content drafts produced by the MassRPG Data Editor surfaces.

Draft data is **not live MMO data**. It must pass validation and later be included in a deliberate published data version before a live server uses it.

Current layout:

- `items/` — one JSON document per authored item.
- `creatures/` — one JSON document per creature definition.
- `resources/` — one JSON document per harvestable resource definition.
- `recipes/` — one JSON document per production recipe.

The matching schemas live under `ContentData/Schemas/`.

Permanent content IDs are save/network references. Visible names may change; permanent IDs should not be casually renamed once referenced by other content or saves.

The browser/Codespaces editor writes here so content can be authored from a web browser without requiring Unity to be installed. Unity's **MassRPG → Repository Drafts** window reads these same files and reconstructs the corresponding C# definitions, so the web editor and Unity editor do not maintain separate incompatible content databases.

For items, creatures and recipes, a valid repository draft may override the same permanent ID from the temporary hard-coded migration seed catalog when a resolved draft catalog is built. Resources currently have no centralized migration seed catalog, so their draft catalog is built directly from repository data.
