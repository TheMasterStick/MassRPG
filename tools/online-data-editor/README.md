# MassRPG Online Data Editor

This is the browser-accessible companion to the Unity Data Editor. It exists so content can be authored from a machine where Unity is unavailable, including a work computer, while still writing normal version-controlled MassRPG data.

## Current scope

The browser editor now has repository-backed authoring for:

- **Items** — equipment, dual wield/two-handed rules, requirements, tools, healing, combat bonuses, range and timing.
- **Creatures** — combat stats, behavior disposition, attack style/range, footprint, aggro/leash and persistent named identity.
- **Resources** — gathering skill/level, XP, yields, respawn, personal/shared availability and tool requirements.
- **Recipes** — production skill/level, ingredients, outputs, XP, duration, station/tool requirements and failure/burn output.

Drafts are stored as one JSON document per permanent content ID under `ContentData/Drafts/<category>/`, with matching JSON schemas in `ContentData/Schemas/`.

Drafts are deliberately separate from live-published data. Unity reads the same files through **MassRPG → Repository Drafts**, so web authoring and Unity authoring share one repository source of truth.

## Browser-only workflow with GitHub Codespaces

1. Open the MassRPG repository on GitHub.
2. Create/open a Codespace on a dedicated work branch (for example `data-editor/work`). Do not use `main` or `master` for direct data editing.
3. The repository dev-container runs `npm ci` and starts the data editor automatically.
4. Open forwarded port **4175** if it did not open automatically. Keep the port visibility **Private**.
5. Choose Items, Creatures, Resources or Recipes from the dashboard.
6. **Save draft file** writes JSON into the Codespace working tree.
7. Use the dashboard **Draft preflight** before committing. It catches malformed drafts and highlights repository-only reference gaps.
8. **Commit & Push** explicitly commits `ContentData/Drafts` and pushes the current branch to GitHub.

You can still start it manually with `npm run data-editor`.

No GitHub personal access token is placed in the browser UI. The server relies on the Git credentials already supplied to the Codespace.

## Validation layers

There are now three deliberately separate validation layers:

1. **Editor form/server validation** prevents obviously invalid values from being saved by the web UI.
2. **Browser preflight / `npm run data-validate`** scans every repository draft, validates filenames/IDs/basic invariants, and warns about item references that do not exist in repository drafts.
3. **Unity `MassRPG → Validate Repository Drafts`** reconstructs the C# definitions and runs the authoritative cross-catalog audit against repository drafts plus temporary migration seed catalogs.

GitHub Actions runs the command-line draft validator automatically when draft/schema validation files change. Structural errors fail the check. Missing repository-only references are warnings for now because they may still resolve from migration seed content; that distinction disappears once all canonical content has moved into repository data.

## Safety boundaries

- The editor refuses Commit & Push while the current branch is `main`, `master`, or detached HEAD.
- Saving a draft does not publish it to a live MMO server.
- Permanent IDs are locked in the UI after an existing draft is loaded. Renaming a permanent ID should be handled as an explicit migration, not as an ordinary text edit.
- Only `ContentData/Drafts` is staged by the Commit & Push action.
- This development server has no independent login layer. Use it only through a private Codespaces forwarded port or another trusted private environment. It is **not** yet the public hosted editor.

## Unity bridge

Unity's repository-draft inspector parses the same JSON into `ItemDefinition`, `CreatureDefinition`, `ResourceDefinition` and `RecipeDefinition` objects. Malformed files, unsupported schema versions, duplicate IDs and filename/ID mismatches are surfaced as invalid drafts instead of being silently accepted.

The temporary migration seed catalogs remain useful fallback/reference data. Valid repository item/creature/recipe drafts can override matching seed IDs when a resolved draft catalog is built; resource drafts currently form their own repository catalog because no centralized resource seed catalog exists yet.

## Hosted editor later

The production version can be hosted as a normal website. It should authenticate with GitHub through a GitHub App/OAuth-backed server component, then write changes to a dedicated branch and normally create/review a pull request. A static GitHub Pages page alone should not hold a repository write token.

The long-term flow remains **draft → validate → local test → review → versioned publish → live activation/rollback**.
