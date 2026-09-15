using MassRPG.Core.Content;
using MassRPG.Core.Skills;

namespace MassRPG.Data.Recipes
{
    /// <summary>
    /// Representative recipe set ported from the browser prototype. This is development content,
    /// not a final live balance manifest.
    /// </summary>
    public static class MigrationSeedRecipeCatalog
    {
        private static readonly ContentId Furnace = new ContentId("station.furnace");

        public static RecipeCatalog Create()
        {
            var catalog = new RecipeCatalog();

            catalog.Register(Smelt("smelt_bronze_bar", "Bronze bar", 1, 6, 1200, "bronze_bar",
                new RecipeIngredient(new ContentId("copper_ore"), 1),
                new RecipeIngredient(new ContentId("tin_ore"), 1)));
            catalog.Register(Smelt("smelt_iron_bar", "Iron bar", 15, 13, 1200, "iron_bar",
                new RecipeIngredient(new ContentId("iron_ore"), 1)));
            catalog.Register(Smelt("smelt_steel_bar", "Steel bar", 30, 17, 1200, "steel_bar",
                new RecipeIngredient(new ContentId("iron_ore"), 1),
                new RecipeIngredient(new ContentId("coal"), 2)));
            catalog.Register(Smelt("smelt_mithril_bar", "Mithril bar", 50, 30, 1800, "mithril_bar",
                new RecipeIngredient(new ContentId("mithril_ore"), 1),
                new RecipeIngredient(new ContentId("coal"), 4)));
            catalog.Register(Smelt("smelt_dragonite_bar", "Dragonite bar", 92, 75, 1800, "dragonite_bar",
                new RecipeIngredient(new ContentId("dragonite_ore"), 2),
                new RecipeIngredient(new ContentId("coal"), 2)));

            return catalog;
        }

        private static RecipeDefinition Smelt(
            string id,
            string name,
            int level,
            long xp,
            int durationMilliseconds,
            string output,
            params RecipeIngredient[] inputs)
            => new RecipeDefinition(
                new ContentId(id),
                name,
                SkillId.Smithing,
                level,
                inputs,
                new ContentId(output),
                1,
                xp,
                durationMilliseconds,
                "smelting",
                Furnace);
    }
}
