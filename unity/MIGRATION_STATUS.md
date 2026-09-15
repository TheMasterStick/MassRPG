# MassRPG Unity migration status

This file tracks the browser-to-Unity migration. The TypeScript/browser game remains an executable behavior reference while the Unity/C# implementation becomes canonical.

**Unity baseline:** Unity 6.3 LTS `6000.3.24f1` (`4e7b9b5b6244`). `ProjectSettings/ProjectVersion.txt` is pinned to this revision. Real package/render-pipeline metadata still waits for the first home-PC Unity open rather than being guessed remotely.

## Current architecture

- **MassRPG.Core** — engine-independent rules, IDs, character state, inventory, combat math, movement/pathing, logical interaction ordering and construction blueprint data.
- **MassRPG.Data** — item/creature/resource/recipe/build-piece/loot definitions, authored-world documents and migration seed catalogs.
- **MassRPG.Server** — authoritative movement, gathering, production, combat, parties/reward/loot grouping, creature population, construction, upkeep/reclamation and publishing foundations.
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
| Interaction stack | Engine-independent target/action model and settled default/right-click/visual crowd priorities are now represented and tested. Unity physics may discover views, but it is not allowed to decide target priority by collider order. |
| Combat | Authoritative player auto-attacks, creature aggro/retaliation/chase/leash, range/LOS/elevation rules, cooldowns and damage contribution facts active. Party-aware reward planning groups qualifying contributors, nearby party recipients and first-engager claim context without hard-coding final XP balance. |
| Loot | Browser-style guaranteed + one weighted ordinary drop tables now have data definitions and a server-owned deterministic/testable roller. Representative migrated creatures reference those tables. Party item pools support Round Robin, Need/Greed, Leader Distribution and Free For All without duplicating combat eligibility rules. |
| Gathering | Resource definitions, personal/shared depletion, node keys and authoritative gathering active. |
| Production | Smelting, smithing, cooking, crafting, fletching, Herblore and related timed production represented; failures/burns are data/server owned. |
| Creature populations | Fixed authored caps, sleeping/materialization, ordinary-vs-persistent identities, respawn timing and combat-death integration active. |
| Construction | Shared-world plots, future-Large reservation, permissions/blocklists, modular pieces, three storeys, support, stations, upkeep and reusable blueprints active. Atomic whole-blueprint preview/placement validates the complete arrangement before committing. Abandoned plots require an explicit authoritative reclamation command that snapshots the build, removes live stations/structures and releases reserved land. |
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
- Play From Here uses these reusable actor/streaming components rather than maintaining a separate bespoke terrain renderer.

The repository/StreamingAssets loader is a development/build-packaging source. A future MMO page-delivery layer can replace it without changing `AuthoredWorldPage`, `WorldPageCodec` or the logical world contract.

## Logical interaction ordering

The old browser `Game.ts`/`ContextPopup.ts` behavior has now been separated from the DOM and represented as engine-independent interaction data. `InteractionTarget`, `InteractionOption` and `InteractionPriority` define the logical stack that a future Unity cursor/controller consumes.

Left click uses the settled priority rather than raycast accident: current/hostile combat creature first, then NPC, ordinary attackable creature, gameplay object/resource, ground item, other player and finally movement. A neutral creature loses to an overlapping NPC, while the player's current combat target overrides that NPC. Examine-only actions can never accidentally become the left-click default.

Right click retains **all** overlapping options. Primary actions are ordered by target importance, then `Walk here`, then Examine entries; presentation can append Cancel. Actor visual ordering is likewise explicit: hostile/in-combat creature -> NPC -> local player -> passive/neutral creature -> other player. Tests lock those rules down before the Unity physics/raycast adapter is added.

## Combat parties, loot and reward settlement

Server-owned `PartyRegistry`/`PartyState` enforce one-party-per-character membership, leader-controlled loot mode and the four settled party loot modes: **Round Robin, Need/Greed, Leader Distribution and Free For All**. Round-robin selection skips currently ineligible/out-of-range members without silently removing them from the party.

`CombatRewardPlanner` consumes the authoritative damage ledger instead of trusting client reward claims. A contributor must pass the configurable contribution threshold and be in reward range before creating a reward group. Qualifying party contribution is combined into one group, while other nearby party members become shared recipients; non-party contributors remain individual groups. The first engager/group is recorded separately as the initial claim context even if that first tap later fails the contribution threshold. Exact XP multipliers, claim-steal rules and boss/event exceptions remain separate policies rather than arbitrary constants hidden in combat.

Money splitting exposes an equal integer share for each eligible party recipient plus any indivisible remainder. Item drops now use `SharedPartyLootPool`/`PartyLootPoolService`:

- **Round Robin** pre-assigns each rolled stack to the next eligible member and carries the cursor between pools through party state.
- **Need/Greed** records one response per eligible member, Need outranks Greed, ties use an injected authoritative selector, and an explicit forced resolution supports timeout handling.
- **Leader Distribution** requires the party leader to assign an entry to an eligible recipient before it can be claimed.
- **Free For All** gives the first eligible claimant the open entry.

The pool resolves ownership before inventory insertion. That separation is deliberate so a full inventory can later fall back to protected ground loot/mail/other server policy rather than silently deleting an awarded item.

The browser's useful loot-table behavior is also ported. `LootTableDefinition` stores guaranteed entries, weighted entries and a no-drop chance. `LootTableRoller` always rolls guaranteed entries, then rolls at most one weighted ordinary drop exactly like the browser reference, but randomness is injected from the server/test layer. Chicken, cow, goblin, wolf, dark wizard, hill giant and lesser demon migration creatures now point at representative browser-parity tables.

## Construction / housing

Persistent player plots keep claimed land separate from the immutable maximum future reservation. Access rules/blocklists, modular tile/edge pieces, simple support validity, three usable storeys, player-built production stations and configurable prepaid upkeep are represented.

Whole-building blueprint placement is authoritative and atomic:

- complete blueprint can rotate around a chosen origin;
- offsets, cardinal edges and piece facing rotate together;
- preview is side-effect free;
- internal/existing collisions, plot bounds, requirements and support are checked across the full arrangement;
- support-dependent pieces can appear in any blueprint source order;
- material costs and Construction XP aggregate across the complete blueprint;
- failure leaves inventory/XP/building state unchanged;
- successful placement commits all pieces as one server operation.

Plot lifecycle has a deliberate destruction boundary. Upkeep only advances **Active -> Delinquent -> Abandoned**; it never destroys a house by itself. `PlotReclamationService` must be invoked explicitly after abandonment. It captures an audit snapshot, removes live modular-building state so reclaimed furnaces/anvils/etc. stop functioning, releases the complete future-Large reservation, and keeps the abandoned upkeep row as a tombstone for persistence/audit policy.

Blueprint trading/market representation and final live upkeep prices/grace tuning remain later balance/economy work.

## Repository branch hygiene

`chatgpt/unity-csharp-migration` is the canonical migration branch. The repository's current default branch has been fast-forwarded onto the same migration history so active work is not stranded behind the old browser branch history.

`tools/cleanup-migration-branches.ps1` contains a guarded cleanup list. Every branch in its normal deletion set was verified to be an ancestor of the canonical branch or identical to it before being listed. The script re-checks ancestry at execution time and refuses to delete a branch that has gained unique commits. It is compatible with Windows PowerShell 5.1 as well as newer PowerShell versions.

`junction-builder-work` is treated separately because it has four unique pre-Unity browser-renderer/editor commits at audited head `115bf2265a7b13cc7a349cbd9c6d74b49badc746`. They are an abandoned old wall/fence-junction experiment, not canonical Unity work; deleting that branch requires the script's explicit `-DeleteLegacyJunctionWork` flag and verifies the audited head before deletion.

The connected GitHub tooling available to this chat can move/create refs but cannot issue the Git ref deletion operation or change the repository's default-branch setting. Therefore remote branch deletion itself remains a one-command local/GitHub-settings cleanup rather than something falsely reported as completed here.

## Verification state

A substantial Editor test suite exists for skills/XP, combat math, inventory/equipment, movement/pathing, LOS/elevation, world pages, semantic areas/POIs, gathering/resources, creature behavior/populations, production, construction/plots/upkeep and publishing. New tests additionally cover stable presentation IDs/safe JSON patching, atomic blueprint placement/rotation, explicit abandoned-plot reclamation, interaction-stack priorities, party membership/loot-mode authority, party-aware contribution grouping, all four shared party loot modes and browser-parity loot-table rolling.

**Important:** the C# additions are committed source but have still not had their first real Unity compile/Test Runner pass. That requires opening the project in Unity `6000.3.24f1` on the home PC. Until then, do not treat remote static review as a substitute for Unity compilation.

The repository's Node/content-data GitHub Actions validation is separate and was green on its latest applicable run.

## Next implementation work

1. Add the Unity-side cursor/raycast adapter that collects logical interaction targets but delegates default/context ordering to `InteractionPriority`; then wire attack/gather/use/move choices into authority requests.
2. Continue creature/object/ground-item presentation and production-quality terrain material/ground-ID binding.
3. Connect rolled creature drops and reward groups to final XP awarding plus protected item-delivery/ground-loot behavior without inventing unresolved claim/boss policy.
4. Extend presentation binding from socket equipment to skinned body armour after the canonical character bases/rig are imported.
5. Expand typed repository authoring for additional runtime categories (NPCs, shops, build pieces, loot tables, spells/abilities, quests) while retaining Other Definitions as the forward-compatible fallback.
6. Continue world-editor QoL and semantic integration rather than rebuilding already-working terrain/road/area/POI/spawn/placement tools.
7. On first home-PC Unity open: resolve real packages/render pipeline, run full compile/Test Runner, fix any compile/parity failures, then visually inspect ramp terrain, chunk boundaries, camera and character/equipment binding before art production accelerates.
