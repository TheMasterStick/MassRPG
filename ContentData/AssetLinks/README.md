# MassRPG presentation asset links

This directory maps stable MassRPG presentation asset IDs to Unity project assets.

Gameplay/content drafts reference stable IDs such as `asset/model/item.iron_sword`. Unity stores the matching `.meta` GUID and current project path in a small JSON link document here. This keeps content data independent from Unity file paths while still allowing assets to be moved or renamed normally inside the Unity project.

Layout is role-first and mirrors the content ID namespace:

- `icon/...` — inventory/UI icon links
- `model/...` — model or prefab links
- `portrait/...` — portrait/UI art links
- `animation/...` — animation-set/controller links

These files are created by **MassRPG → Presentation Asset Linker**. They are repository data and should be committed together with the imported Unity assets and the draft presentation update. `npm run asset-links-validate` (also run by GitHub Actions) checks the ID/role/path/GUID contract before these links are reviewed.

The browser/work editor does not need these files in order to author gameplay. Content may remain in `needs-assets` or `placeholder` state until home/Unity work supplies the presentation assets. The intended workflow is therefore **author gameplay anywhere → leave presentation requirements in the backlog → import/create art at home → link it to the same permanent content ID**; no duplicate item/monster/resource definition is created merely because its art arrived later.
