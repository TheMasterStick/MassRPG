# MassRPG Online Data Editor

This is the browser-accessible companion to the Unity Data Editor. It exists so content can be authored from a machine where Unity is unavailable, including a work computer, while still writing normal version-controlled MassRPG data.

## Current scope

The first end-to-end content type is **Items**. Item drafts are stored as one JSON file per permanent content ID under:

`ContentData/Drafts/items/`

The editor validates the same settled concepts used by the Unity/C# item model: permanent IDs, item types, equipment slots, skill requirements, gathering tool kinds, weapon timing/range and combat bonuses.

Drafts are deliberately separate from live-published data.

## Browser-only workflow with GitHub Codespaces

1. Open the MassRPG repository on GitHub.
2. Create/open a Codespace on a dedicated work branch (for example `data-editor/work`). Do not use `main` or `master` for direct data editing.
3. In the Codespace terminal run:

   `npm run data-editor`

4. Open forwarded port **4175**. Keep the port visibility **Private**.
5. Create/edit items in the web form.
6. **Save draft file** writes the JSON into the Codespace working tree.
7. **Commit & Push** explicitly commits `ContentData/Drafts` and pushes the current branch to GitHub.

No GitHub personal access token is placed in the browser UI. The server relies on the Git credentials already supplied to the Codespace.

## Safety boundaries

- The editor refuses Commit & Push while the current branch is `main`, `master`, or detached HEAD.
- Saving a draft does not publish it to a live MMO server.
- Permanent IDs are locked in the UI after an existing draft is loaded. Renaming a permanent ID should be handled as an explicit migration, not as an ordinary text edit.
- Only `ContentData/Drafts` is staged by the Commit & Push action.
- This development server has no independent login layer. Use it only through a private Codespaces forwarded port or another trusted private environment. It is **not** yet the public hosted editor.

## Hosted editor later

The production version can be hosted as a normal website. It should authenticate with GitHub through a GitHub App/OAuth-backed server component, then write changes to a dedicated branch and normally create/review a pull request. A static GitHub Pages page alone should not hold a repository write token.

The long-term intent is that Unity Data Editor and Online Data Editor both read/write the same repository draft formats and both run the same validation rules before data can be promoted into a versioned published package.
