# MassRPG draft content

This directory contains editable, repository-backed content drafts produced by the MassRPG Data Editor surfaces.

Draft data is **not live MMO data**. It must pass validation and later be included in a deliberate published data version before a live server uses it.

Current layout:

- `items/` — one JSON document per authored item.

Permanent content IDs are save/network references. Visible names may change; permanent IDs should not be casually renamed once referenced by other content or saves.

The browser/Codespaces editor writes here so content can be authored from a web browser without requiring Unity to be installed. The Unity Data Editor will consume the same draft format rather than maintaining a separate incompatible source of truth.
