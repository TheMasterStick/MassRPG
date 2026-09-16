using System.Linq;
using MassRPG.Core.Content;
using MassRPG.Core.Inventory;
using MassRPG.Core.Skills;
using MassRPG.Data.Items;
using MassRPG.Data.Recipes;
using MassRPG.Data.Skills;
using NUnit.Framework;

namespace MassRPG.Tests
{
    public sealed class SkillUnlockCatalogTests
    {
        [Test]
        public void BuilderIndexesRecipeAndEquipmentRequirementsBySkill()
        {
            var items = new ItemCatalog();
            var ore = new ContentId("ore.test");
            var bar = new ContentId("bar.test");
            var sword = new ContentId("sword.test");
            items.Register(new ItemDefinition(ore, "Test ore", ItemType.Resource, true));
            items.Register(new ItemDefinition(bar, "Test bar", ItemType.Material, true));
            items.Register(new ItemDefinition(
                sword,
                "Test sword",
                ItemType.Weapon,
                false,
                description: "A test weapon.",
                allowedEquipmentSlots: new[] { EquipmentSlot.MainHand },
                equipRequirementSkill: SkillId.Attack,
                equipRequirementLevel: 20));

            var recipes = new RecipeCatalog();
            recipes.Register(new RecipeDefinition(
                new ContentId("recipe.test_bar"),
                "Smelt test bar",
                SkillId.Smithing,
                15,
                new[] { new RecipeIngredient(ore, 1) },
                bar,
                1,
                25,
                1000,
                "smelting"));

            var catalog = SkillUnlockCatalogBuilder.Build(recipes, items);
            var smithing = catalog.ForSkill(SkillId.Smithing);
            var attack = catalog.ForSkill(SkillId.Attack);

            Assert.AreEqual(1, smithing.Count);
            Assert.AreEqual(15, smithing[0].LevelRequired);
            Assert.AreEqual("Test bar", smithing[0].DisplayName);
            Assert.AreEqual("Smelting", smithing[0].Category);
            StringAssert.Contains("1x Test ore", smithing[0].Detail);
            StringAssert.Contains("25 XP", smithing[0].Detail);

            Assert.AreEqual(1, attack.Count);
            Assert.AreEqual(20, attack[0].LevelRequired);
            Assert.AreEqual("Equip Test sword", attack[0].DisplayName);
            Assert.AreEqual("Weapons", attack[0].Category);
        }

        [Test]
        public void AlternateRecipeRoutesDoNotDuplicateTheSameUnlock()
        {
            var items = new ItemCatalog();
            var shaftA = new ContentId("shaft.a");
            var shaftB = new ContentId("shaft.b");
            var arrows = new ContentId("arrows.test");
            items.Register(new ItemDefinition(shaftA, "Shaft A", ItemType.Material, true));
            items.Register(new ItemDefinition(shaftB, "Shaft B", ItemType.Material, true));
            items.Register(new ItemDefinition(arrows, "Test arrows", ItemType.Ammunition, true));

            var recipes = new RecipeCatalog();
            recipes.Register(Recipe("recipe.arrows_a", shaftA, arrows));
            recipes.Register(Recipe("recipe.arrows_b", shaftB, arrows));

            var unlocks = SkillUnlockCatalogBuilder.Build(recipes, items).ForSkill(SkillId.Fletching);

            Assert.AreEqual(1, unlocks.Count);
            Assert.AreEqual("Test arrows", unlocks[0].DisplayName);
        }

        [Test]
        public void EntriesAreSortedByLevelThenCategoryThenName()
        {
            var catalog = new SkillUnlockCatalog();
            catalog.Register(new SkillUnlockDefinition(SkillId.Mining, 20, SkillUnlockKind.Gathering, "Ores", "Silver", ""));
            catalog.Register(new SkillUnlockDefinition(SkillId.Mining, 1, SkillUnlockKind.Gathering, "Ores", "Tin", ""));
            catalog.Register(new SkillUnlockDefinition(SkillId.Mining, 1, SkillUnlockKind.Gathering, "Ores", "Copper", ""));

            var entries = catalog.ForSkill(SkillId.Mining).ToArray();

            Assert.AreEqual("Copper", entries[0].DisplayName);
            Assert.AreEqual("Tin", entries[1].DisplayName);
            Assert.AreEqual("Silver", entries[2].DisplayName);
        }

        private static RecipeDefinition Recipe(string id, ContentId input, ContentId output)
            => new RecipeDefinition(
                new ContentId(id),
                "Make arrows",
                SkillId.Fletching,
                5,
                new[] { new RecipeIngredient(input, 1) },
                output,
                15,
                10,
                1000,
                "fletching_arrows");
    }
}
