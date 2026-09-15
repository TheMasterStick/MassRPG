using MassRPG.Core.Content;
using MassRPG.Core.Inventory;
using MassRPG.Core.Resources;
using MassRPG.Core.Skills;

namespace MassRPG.Data.Items
{
    /// <summary>
    /// First representative migration of browser item data. This is a development seed catalog,
    /// not the eventual live published manifest. It gives the C# rules real content to exercise
    /// while the Data Editor and external versioned content pipeline are built.
    /// </summary>
    public static class MigrationSeedItemCatalog
    {
        public static ItemCatalog Create()
        {
            var catalog = new ItemCatalog();

            RegisterStack(catalog, "coins", "Coins", ItemType.Currency, 1, "The realm's currency.");

            RegisterStack(catalog, "copper_ore", "Copper ore", ItemType.Resource, 3, "Used with tin to make bronze.");
            RegisterStack(catalog, "tin_ore", "Tin ore", ItemType.Resource, 3, "Used with copper to make bronze.");
            RegisterStack(catalog, "iron_ore", "Iron ore", ItemType.Resource, 12, "Raw iron ore.");
            RegisterStack(catalog, "coal", "Coal", ItemType.Resource, 5, "Fuel used in metalworking.");
            RegisterStack(catalog, "silver_ore", "Silver ore", ItemType.Resource, 15, "Raw silver ore.");
            RegisterStack(catalog, "gold_ore", "Gold ore", ItemType.Resource, 20, "Raw gold ore.");
            RegisterStack(catalog, "mithril_ore", "Mithril ore", ItemType.Resource, 90, "Raw mithril ore.");
            RegisterStack(catalog, "dragonite_ore", "Dragonite ore", ItemType.Resource, 650, "A rare high-tier ore.");

            RegisterStack(catalog, "bronze_bar", "Bronze bar", ItemType.Material, 12, "A bar of bronze.");
            RegisterStack(catalog, "iron_bar", "Iron bar", ItemType.Material, 36, "A bar of iron.");
            RegisterStack(catalog, "steel_bar", "Steel bar", ItemType.Material, 90, "A bar of steel.");
            RegisterStack(catalog, "silver_bar", "Silver bar", ItemType.Material, 45, "A bar of silver.");
            RegisterStack(catalog, "gold_bar", "Gold bar", ItemType.Material, 60, "A bar of gold.");
            RegisterStack(catalog, "mithril_bar", "Mithril bar", ItemType.Material, 270, "A bar of mithril.");
            RegisterStack(catalog, "dragonite_bar", "Dragonite bar", ItemType.Material, 2000, "A bar of dragonite.");

            RegisterStack(catalog, "normal_logs", "Logs", ItemType.Resource, 2, "Wood useful for Firemaking, Fletching and Construction.");
            RegisterStack(catalog, "oak_logs", "Oak logs", ItemType.Resource, 8, "Logs cut from an oak tree.");
            RegisterStack(catalog, "willow_logs", "Willow logs", ItemType.Resource, 15, "Logs cut from a willow tree.");
            RegisterStack(catalog, "maple_logs", "Maple logs", ItemType.Resource, 30, "Logs cut from a maple tree.");
            RegisterStack(catalog, "yew_logs", "Yew logs", ItemType.Resource, 90, "Logs cut from a yew tree.");
            RegisterStack(catalog, "magic_logs", "Magic logs", ItemType.Resource, 250, "Logs cut from a magic tree.");

            RegisterTool(catalog, "bronze_hatchet", "Bronze hatchet", GatheringToolKind.Hatchet, 1, 20, 2, 1);
            RegisterTool(catalog, "iron_hatchet", "Iron hatchet", GatheringToolKind.Hatchet, 2, 50, 5, 3);
            RegisterTool(catalog, "steel_hatchet", "Steel hatchet", GatheringToolKind.Hatchet, 3, 120, 10, 6);
            RegisterTool(catalog, "mithril_hatchet", "Mithril hatchet", GatheringToolKind.Hatchet, 4, 300, 16, 10);
            RegisterTool(catalog, "bronze_pickaxe", "Bronze pickaxe", GatheringToolKind.Pickaxe, 1, 20, 2, 1);
            RegisterTool(catalog, "iron_pickaxe", "Iron pickaxe", GatheringToolKind.Pickaxe, 2, 50, 5, 3);
            RegisterTool(catalog, "steel_pickaxe", "Steel pickaxe", GatheringToolKind.Pickaxe, 3, 120, 10, 6);
            RegisterTool(catalog, "mithril_pickaxe", "Mithril pickaxe", GatheringToolKind.Pickaxe, 4, 300, 16, 10);

            catalog.Register(new ItemDefinition(
                new ContentId("iron_sword"), "Iron sword", ItemType.Weapon, false, 96,
                "A basic iron sword.", new[] { EquipmentSlot.Weapon }, false,
                new CombatBonuses { Attack = 10, Strength = 9 }, SkillId.Attack, 1));
            catalog.Register(new ItemDefinition(
                new ContentId("iron_platebody"), "Iron platebody", ItemType.Armor, false, 120,
                "Iron torso armour.", new[] { EquipmentSlot.Chest }, false,
                new CombatBonuses { Defence = 7 }, SkillId.Defence, 1));
            catalog.Register(new ItemDefinition(
                new ContentId("iron_shield"), "Iron kiteshield", ItemType.Armor, false, 72,
                "An iron shield.", new[] { EquipmentSlot.Shield }, false,
                new CombatBonuses { Defence = 4 }, SkillId.Defence, 1));

            return catalog;
        }

        private static void RegisterStack(ItemCatalog catalog, string id, string name, ItemType type, int value, string description)
            => catalog.Register(new ItemDefinition(new ContentId(id), name, type, true, value, description));

        private static void RegisterTool(
            ItemCatalog catalog,
            string id,
            string name,
            GatheringToolKind kind,
            int tier,
            int value,
            int attack,
            int strength)
            => catalog.Register(new ItemDefinition(
                new ContentId(id), name, ItemType.Tool, false, value, "A gathering tool.",
                new[] { EquipmentSlot.Weapon }, false,
                new CombatBonuses { Attack = attack, Strength = strength }, null, 1, 0, tier, kind));
    }
}
