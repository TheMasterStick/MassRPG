using System;
using System.Collections.Generic;
using System.Text;
using MassRPG.Core.Content;
using MassRPG.Data.Items;
using MassRPG.Data.Recipes;

namespace MassRPG.Data.Skills
{
    /// <summary>
    /// Builds the migrated skillbook ledger from published gameplay data instead of hard-coded UI
    /// arrays. Gathering/construction providers can append their own entries as those catalogs are
    /// standardized; recipes and item requirements are already fully data driven here.
    /// </summary>
    public static class SkillUnlockCatalogBuilder
    {
        public static SkillUnlockCatalog Build(RecipeCatalog recipes, ItemCatalog items)
        {
            if (recipes == null) throw new ArgumentNullException(nameof(recipes));
            if (items == null) throw new ArgumentNullException(nameof(items));

            var catalog = new SkillUnlockCatalog();
            AddRecipeUnlocks(catalog, recipes, items);
            AddItemRequirementUnlocks(catalog, items);
            return catalog;
        }

        private static void AddRecipeUnlocks(
            SkillUnlockCatalog catalog,
            RecipeCatalog recipes,
            ItemCatalog items)
        {
            // Several recipes may represent alternate assembly routes for the same item. The old
            // browser skillbook intentionally showed that unlock once; preserve that behavior by
            // deduplicating on skill + level + output identity rather than recipe identity.
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var recipe in recipes.All)
            {
                var key = recipe.Skill + "|" + recipe.LevelRequired + "|" + recipe.OutputItemId.Value;
                if (!seen.Add(key)) continue;

                var outputName = NameOf(items, recipe.OutputItemId);
                catalog.Register(new SkillUnlockDefinition(
                    recipe.Skill,
                    recipe.LevelRequired,
                    SkillUnlockKind.Recipe,
                    FriendlyCategory(recipe.Category),
                    outputName,
                    BuildRecipeDetail(recipe, items),
                    recipe.Id));
            }
        }

        private static void AddItemRequirementUnlocks(SkillUnlockCatalog catalog, ItemCatalog items)
        {
            foreach (var item in items.All)
            {
                if (!item.EquipRequirementSkill.HasValue) continue;

                var verb = item.Type == ItemType.Ammunition ? "Use " : "Equip ";
                catalog.Register(new SkillUnlockDefinition(
                    item.EquipRequirementSkill.Value,
                    item.EquipRequirementLevel,
                    SkillUnlockKind.ItemRequirement,
                    ItemRequirementCategory(item),
                    verb + item.DisplayName,
                    item.Description,
                    item.Id));
            }
        }

        private static string BuildRecipeDetail(RecipeDefinition recipe, ItemCatalog items)
        {
            var text = new StringBuilder();
            for (var i = 0; i < recipe.Inputs.Count; i++)
            {
                if (i > 0) text.Append(", ");
                var input = recipe.Inputs[i];
                text.Append(input.Quantity).Append('x').Append(' ').Append(NameOf(items, input.ItemId));
            }

            if (recipe.ToolRequiredId.HasValue)
                text.Append(" · Tool: ").Append(NameOf(items, recipe.ToolRequiredId.Value));
            if (recipe.StationId.HasValue)
                text.Append(" · Station: ").Append(Humanize(recipe.StationId.Value.Value));
            if (recipe.Xp > 0)
                text.Append(" · ").Append(recipe.Xp).Append(" XP");
            return text.ToString();
        }

        private static string NameOf(ItemCatalog items, ContentId itemId)
            => items.TryGetDefinition(itemId, out var item) && !string.IsNullOrWhiteSpace(item.DisplayName)
                ? item.DisplayName
                : Humanize(itemId.Value);

        private static string ItemRequirementCategory(ItemDefinition item)
        {
            switch (item.Type)
            {
                case ItemType.Weapon: return "Weapons";
                case ItemType.Armor: return "Armour";
                case ItemType.Ammunition: return "Ammunition";
                case ItemType.Tool: return "Tools";
                default: return "Equipment";
            }
        }

        private static string FriendlyCategory(string category)
        {
            if (string.IsNullOrWhiteSpace(category)) return "Recipes";
            switch (category)
            {
                case "smelting": return "Smelting";
                case "smithing_misc": return "Materials";
                case "smithing_ammo": return "Ammunition";
                case "cooking": return "Food";
                case "fletching_bows": return "Bows";
                case "fletching_arrows": return "Arrows";
                case "crafting_leather": return "Leather";
                case "crafting_gems": return "Gems";
                case "crafting_jewelry": return "Jewellery";
                case "crafting_misc": return "Materials";
                case "construction": return "Materials";
                case "herblore_clean": return "Herbs";
                case "herblore_potions": return "Potions";
                default: return Humanize(category);
            }
        }

        private static string Humanize(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var source = value.Replace('.', ' ').Replace('_', ' ').Replace('-', ' ').Replace('/', ' ');
            var text = new StringBuilder(source.Length);
            var capitalize = true;
            for (var i = 0; i < source.Length; i++)
            {
                var c = source[i];
                if (char.IsWhiteSpace(c))
                {
                    text.Append(c);
                    capitalize = true;
                    continue;
                }
                text.Append(capitalize ? char.ToUpperInvariant(c) : c);
                capitalize = false;
            }
            return text.ToString();
        }
    }
}
