# MassRPG Unity migration status

This file tracks the browser-to-Unity migration. The TypeScript/browser game remains an executable behavior reference while the Unity/C# implementation becomes canonical.

**Unity baseline:** Unity 6.3 LTS `6000.3.24f1` (`4e7b9b5b6244`). `ProjectSettings/ProjectVersion.txt` is pinned to this revision. Real package/render-pipeline metadata still waits for the first home-PC Unity open rather than being guessed remotely.

## Current architecture

- **MassRPG.Core** — engine-independent rules, IDs, character state, inventory, combat math, movement/pathing, construction blueprint data.
- **MassRPG.Data** — item/creature/resource/recipe/build-piece definitions, authored-world documents and migration seed catalogs.
- **MassRPG.Server** — authoritative movement, gathering, production, combat, creature population, construction, upkeep and publishing foundations.
- **MassRPG.Client** — Unity presentation: camera, logical actor interpolation, terrain meshes/streaming, presentation-asset catalog and equipment visuals.
- **MassRPG.EditorCore** — engine-light world-authoring/session logic.
- **MassRPG.Editor** — tactile Unity authoring windows, repository content bridge, Play From Here and asset-link tooling.

The authority rule remains unchanged: the client requests actions and renders results; authoritative simulation does not read Unity transforms back as gameplay truth.

## Gameplay migration

| Browser/source area | Current Unity/C# state |
| --- | --- |
| Skills / XP | Core progression ported with tests; 1-99 parity retained while MassRPG supports levels up to 300. |
| Items / equipment | Broad migration catalog, requirements, dual-hand semantics, two-handed exclusion, combat bonuses, tools and consumables represented. |
| Inventory | Core rules ported and authority-facing operations tested. |
| Movement / pathfinding | Eight-direction exact 1x1 movement, no corner cutting, explicit elevation transitions and LOS foundations ported. |
| Combat | Authoritative player auto-attacks, creature aggro/retaliation/chase/leash, range/LOS/elevation rules, cooldowns and damage contribution facts active. |
| Gathering | Resource definitions, personal/shared depletion, node keys and authoritative gathering active. |
| Production | Smelting, smithing, cooking, crafting, fletching, Herblore and related timed production represented; failures/burns are data/server owned. |
| Creature populations | Fixed authored caps, sleeping/materialization, ordinary-vs-persistent identities, respawn timing and combat-death integration active. |
| Construction | Shared-world plots, future-Large reservation, permissions/blocklists, modular pieces, three storeys, support, stations, upkeep and reusable blueprints active. Atomic whole-blueprint preview/placement now validates the complete arrangement and aggregate materials before committing anything. |
| Publishing | Version/manifest/rollback and review-candidate foundations exist; live-server promotion remains deliberately separate from ordinary editing. |

## Repository-backed game data editor

The browser/Codespaces editor is now a real content-authoring surface rather than a temporary form. It writes normal repository JSON under `ContentData/Drafts` and is intended to be usable from a work computer without Unity or local art files.

Typed authoring currently covers:

- items and equipment;
- creatures/monsters;
- gathering resources;
- production recipes;
- flexible **Other Definitions** for game concepts whose final typed runtime schema does not exist yet.

Every entry keeps a permanent machine ID separate from its display name. Presentation requirements are optional and can remain `needs-assets` while gameplay/design data is authored. The browser Asset Backlog collects unfinished icon/model/portrait/animation needs.

Unity reads the same repository drafts. Migration seed materialization can convert old hard-coded item/creature/recipe seed entries into normal draft JSON without overwriting newer web-authored files.

### Presentation asset bridge

Gameplay data no longer needs a Unity path or art file to exist. Stable presentation IDs use forms such as:

`asset/model/item.iron_sword`

`ContentData/AssetLinks` maps those IDs to Unity `.meta` GUIDs/current project paths. The Unity **Asset Linker** patches only a draft's `presentation` block, so attaching an icon or model at home cannot rewrite unknown gameplay/generic-definition data authored at work.

The generated `PresentationAssetCatalog` converts source AssetLinks into a compact build/runtime lookup. The first `EquipmentVisualBinder` consumes that catalog for Main Hand, Off Hand, Head and Cape socket-mounted models. Body-fitted skinned armour remains intentionally deferred until the canonical male/female rigs are imported.

The Node/content GitHub Actions pipeline now syntax-checks the browser tooling and validates both repository drafts and AssetLinks. This pipeline has completed successfully on the migration branch.

## World/editor foundation

The canonical Twin Lands world is **180,000 x 180,000 logical 1x1 tiles**. It is authored data, not Unity Terrain and not millions of GameObjects.

### Authoring tools already present

- **World Overview** — broad whole-world 512x512-page blocking for the first continent/ocean/elevation pass.
- **1x1 World Editor** — exact terrain, elevation, water, movement/LOS/no-build painting; large brushes; authored edges and ramps; selection/stamp foundations.
- **Road Editor** — semantic roads and route/spawn guidance.
- **Area Editor** — overlapping semantic regions/biomes/level/faction/resource/no-build/PvP layers.
- **POI Editor** — public/hidden POIs with separate visible/protection footprints.
- **Placement Editor** — anchored objects/resources/NPC anchors/transport/manual doodads.
- **Creature Spawn Editor** — fixed-cap spawn regions, roam/patrol authoring.
- **Biome Dressing** — deterministic scenery generation with density/exclusion/manual-override foundations.
- **World Recovery** — crash-recovery pages separate from canonical repository pages.
- **Play From Here** — saves current editor work, enters Play Mode at the chosen logical location and runs through `LocalGameAuthority`.

Canonical production pages live under repository-level `WorldData/Pages`, outside Unity `Assets`, so a six-figure page count does not turn Unity's AssetDatabase into the world database.

## Unity client world presentation

The first reusable client streaming path is active in source:

- authored storage pages are read by `RepositoryWorldPageSource` without depending on UnityEditor code;
- `LogicalTerrainChunkStreamer` follows an authoritative logical actor with a default **5x5 window of 64x64 render chunks**;
- only nearby 512x512 authored pages are materialized in the sparse store;
- chunk GameObjects/meshes are disposable presentation views;
- the same sparse store can be shared with local authority so pathfinding and rendered terrain observe the same tile truth;
- `GridPresentationSpace` supports presentation-only floating-origin shifts while global logical coordinates remain unchanged;
- `LogicalActorView` and terrain chunk views resynchronize automatically after an origin shift;
- authored legal +1 elevation-transition edges are rendered as one-tile slopes instead of vertical cliffs;
- Play From Here now uses these reusable actor/streaming components rather than maintaining a separate bespoke terrain renderer.

The repository/StreamingAssets loader is a development/build-packaging source. A future MMO page-delivery layer can replace it without changing `AuthoredWorldPage`, `WorldPageCodec` or the logical world contract.

## Construction / housing

Persistent player plots keep claimed land separate from the immutable maximum future reservation. Access rules/blocklists, modular tile/edge pieces, simple support validity, three usable storeys, player-built production stations and configurable prepaid upkeep are represented.

Whole-building blueprint work has advanced from storage-only to authoritative placement:

- complete blueprint can rotate around a chosen origin;
- offsets, cardinal edges and piece facing rotate together;
- preview is side-effect free;
- internal/existing collisions, plot bounds, requirements and support are checked across the full arrangement;
- support-dependent pieces can appear in any blueprint source order;
- material costs and Construction XP aggregate across the complete blueprint;
- failure leaves inventory/XP/building state unchanged;
- successful placement commits all pieces as one server operation.

Trading/market representation of blueprint items and final abandoned-plot reclamation policy remain later work.

## Verification state

A substantial Editor test suite exists for skills/XP, combat math, inventory/equipment, movement/pathing, LOS/elevation, world pages, semantic areas/POIs, gathering/resources, creature behavior/populations, production, construction/plots/upkeep and publishing. New tests also cover stable presentation IDs/safe JSON patching and atomic blueprint placement/rotation.

**Important:** the C# additions are committed source but have still not had their first real Unity compile/Test Runner pass. That requires opening the project in Unity `6000.3.24f1` on the home PC. Until then, do not treat remote static review as a substitute for Unity compilation.

The repository's Node/content-data GitHub Actions validation is separate and is currently green.

## Next implementation work

1. Continue the client shell: click-selection/interaction-stack adapters, creature/object presentation and production-quality terrain material/ground-ID binding.
2. Extend presentation binding from socket equipment to skinned body armour after the canonical character bases/rig are imported.
3. Continue party-aware XP/loot settlement on top of the existing contribution facts and one shared loot-pool design.
4. Expand typed repository authoring for additional runtime categories (NPCs, shops, build pieces, loot tables, spells/abilities, quests) while retaining Other Definitions as the forward-compatible fallback.
5. Continue world-editor QoL and semantic integration rather than rebuilding already-working terrain/road/area/POI/spawn/placement tools.
6. On first home-PC Unity open: resolve real packages/render pipeline, run full compile/Test Runner, fix any compile/parity failures, then visually inspect ramp terrain, chunk boundaries, camera and character/equipment binding before art production accelerates.
