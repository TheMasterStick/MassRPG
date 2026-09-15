using System;
using MassRPG.Core.Content;
using MassRPG.Core.Inventory;

namespace MassRPG.Data.Items
{
    public enum ItemType
    {
        Tool,
        Weapon,
        Armor,
        Resource,
        Food,
        Potion,
        Material,
        Currency,
        Seed,
        Miscellaneous
    }

    public sealed class CombatBonuses
    {
        public int Attack { get; set; }
        public int Strength { get; set; }
        public int Defence { get; set; }
        public int RangedAttack { get; set; }
        public int RangedStrength { get; set; }
        public int Magic { get; set; }
    }

    public sealed class ItemDefinition
    {
        public ItemDefinition(
            ContentId id,
            string displayName,
            ItemType type,
            bool stackable,
            int value = 0,
            string description = "",
            EquipmentSlot[] allowedEquipmentSlots = null,
            bool twoHanded = false,
            CombatBonuses bonuses = null)
        {
            Id = id;
            DisplayName = displayName ?? string.Empty;
            Type = type;
            Stackable = stackable;
            Value = value;
            Description = description ?? string.Empty;
            AllowedEquipmentSlots = allowedEquipmentSlots ?? Array.Empty<EquipmentSlot>();
            TwoHanded = twoHanded;
            Bonuses = bonuses ?? new CombatBonuses();
        }

        public ContentId Id { get; }
        public string DisplayName { get; set; }
        public ItemType Type { get; set; }
        public bool Stackable { get; set; }
        public int Value { get; set; }
        public string Description { get; set; }
        public EquipmentSlot[] AllowedEquipmentSlots { get; set; }
        public bool TwoHanded { get; set; }
        public CombatBonuses Bonuses { get; set; }

        public ItemRule ToRule() => new ItemRule(Id, Stackable, AllowedEquipmentSlots, TwoHanded);
    }
}
