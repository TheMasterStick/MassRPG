# MassRPG Online Data Editor

This is the browser-accessible companion to the Unity Data Editor. It exists so gameplay content can be authored from a machine where Unity, Blender and the final art library are unavailable, including a work computer, while still writing normal version-controlled MassRPG data.

## Current scope

The dashboard now supports repository-backed authoring for:

- **Items & Equipment** — weapons, armour, tools, consumables, materials, equipment slots, requirements, dual-wield/two-handed rules, combat bonuses, range and timing.
- **Creatures & Monsters** — combat stats, passive/neutral/aggressive behavior, attack style/range, footprint, aggro/leash and persistent named identity.
- **Resources** — gathering skill/level, XP, yields, respawn, personal/shared availability and tool requirements.
- **Recipes & Production** — skill/level, ingredients, outputs, XP, duration, station/tool requirements and failure/burn output.
- **Other Game Definitions** — immediate design records for NPCs, shops, loot tables, quests, abilities, spells, status effects, factions, services, transports, build pieces, dialogue, world events, achievements and future content types that do not yet have a dedicated typed schema.
- **Asset Backlog** — every draft whose icon/model/portrait/animation presentation is still unfinished.

Drafts are stored as one JSON document per permanent content ID under `ContentData/Drafts/<category>/`, with schemas in `ContentData/Schemas/`.

## Work computer → home computer workflow

The gameplay definition and its presentation assets are deliberately separate.

While away from the home development machine you can create and balance the actual gameplay entry, leave model/icon/portrait/animation IDs blank, keep its presentation state as **Needs assets**, and write visual notes. The entry is immediately visible in the **Asset Backlog**.

Later, at home, pull the branch/repository changes, open the backlog, create or import the proper assets in Unity/Blender, link their stable asset IDs, and move the presentation state through `placeholder` / `linked` / `final` as appropriate. Missing art therefore does not block content design.

Presentation states are:

- `needs-assets` — gameplay/design exists but one or more required visual assets have not been made or linked.
- `placeholder` — temporary art exists.
- `linked` — assets are connected but are not considered final.
- `final` — required presentation assets are finished and linked.
- `not-required` — the definition intentionally has no presentation asset requirement.

## Generic definitions versus typed runtime content

**Other Game Definitions** are intentionally flexible so a new game idea never has to wait for us to first build an editor form. They preserve the permanent ID, description, tags, design notes, optional structured JSON and asset requirements immediately.

They are **design-authoring records**, not a loophole around runtime validation. If a generic definition will affect live simulation, saves, networking or economy, it must be promoted to a dedicated typed schema/runtime system before live publication. Review candidates record how many generic definitions they contain, and the C# publication gate refuses to begin a live published manifest while any remain.

## Browser-only workflow with GitHub Codespaces

1. Open the MassRPG repository on GitHub.
2. Create/open a Codespace on a dedicated work branch (for example `data-editor/work`). Do not use `main` or `master` for direct data editing.
3. The repository dev-container runs `npm ci` and starts the data editor automatically.
4. Open forwarded port **4175** if it did not open automatically. Keep the port visibility **Private**.
5. Author any supported content from the dashboard.
6. **Save draft file** writes JSON into the Codespace working tree.
7. Use dashboard **Draft preflight** before committing.
8. **Commit & Push** explicitly commits `ContentData/Drafts` and pushes the current branch to GitHub.

You can still start it manually with `npm run data-editor`.

No GitHub personal access token is placed in the browser UI. The server relies on the Git credentials already supplied to the Codespace.

## Validation and review candidates

There are deliberately separate validation layers:

1. **Editor form/server validation** prevents obviously invalid values from being saved by the browser UI.
2. **Browser preflight / `npm run data-validate`** scans repository drafts, validates filenames/IDs/basic invariants and reports reference/asset issues.
3. **Unity `MassRPG → Validate Repository Drafts`** reconstructs typed C# definitions and performs the stronger cross-catalog audit against repository drafts plus temporary migration seed catalogs.
4. **Review candidates** (`npm run data-candidate -- "label"`) hash a committed snapshot and record document readiness, generic-definition count and presentation-asset state.

GitHub Actions runs the command-line draft validator automatically for relevant changes. Structural errors fail the check. Missing repository-only item references are warnings while temporary migration seed content can still satisfy them.

## Safety boundaries

- The editor refuses Commit & Push while the current branch is `main`, `master`, or detached HEAD.
- Saving a draft never publishes it to a live MMO server.
- Permanent IDs lock after an existing draft is loaded. Renaming a permanent ID is an explicit migration, not an ordinary edit.
- Only `ContentData/Drafts` is staged by the browser Commit & Push action.
- Generic definitions cannot pass the C# live-publication gate until promoted into typed content.
- The development server has no independent login layer. Use it only through a private Codespaces forwarded port or another trusted private environment.

## Unity bridge

Unity's repository-draft inspector currently reconstructs typed `ItemDefinition`, `CreatureDefinition`, `ResourceDefinition` and `RecipeDefinition` objects from the same files. The browser's added presentation metadata is separate from those gameplay definitions, so typed Unity readers can continue operating while richer Unity-side asset-linking tools are built.

Temporary migration seed catalogs remain fallback/reference data. The next content-migration stage is to move those seed definitions themselves into repository-backed data so the browser editor can search and edit the existing canonical catalog as naturally as newly authored content.

The long-term flow is:

**draft → validate → committed review candidate → local/QA test → typed/versioned publish → live activation/rollback**
