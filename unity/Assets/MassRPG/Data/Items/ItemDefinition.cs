using System;
using MassRPG.Core.Content;
using MassRPG.Core.Inventory;
using MassRPG.Core.Resources;
using MassRPG.Core.Skills;

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
        Ammunition,
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
            CombatBonuses bonuses = null,
            SkillId? equipRequirementSkill = null,
            int equipRequirementLevel = 1,
            int healAmount = 0,
            int toolTier = 0,
            GatheringToolKind gatheringToolKind = GatheringToolKind.None)
        {
            if (id.IsEmpty) throw new ArgumentException("Item id cannot be empty.", nameof(id));
            if (equipRequirementLevel < 1 || equipRequirementLevel > 300) throw new ArgumentOutOfRangeException(nameof(equipRequirementLevel));
            if (healAmount < 0) throw new ArgumentOutOfRangeException(nameof(healAmount));
            if (toolTier < 0) throw new ArgumentOutOfRangeException(nameof(toolTier));

            Id = id;
            DisplayName = displayName ?? string.Empty;
            Type = type;
            Stackable = stackable;
            Value = value;
            Description = description ?? string.Empty;
            AllowedEquipmentSlots = allowedEquipmentSlots ?? Array.Empty<EquipmentSlot>();
            TwoHanded = twoHanded;
            Bonuses = bonuses ?? new CombatBonuses();
            EquipRequirementSkill = equipRequirementSkill;
            EquipRequirementLevel = equipRequirementLevel;
            HealAmount = healAmount;
            ToolTier = toolTier;
            GatheringToolKind = gatheringToolKind;
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
        public SkillId? EquipRequirementSkill { get; set; }
        public int EquipRequirementLevel { get; set; }
        public int HealAmount { get; set; }
        public int ToolTier { get; set; }
        public GatheringToolKind GatheringToolKind { get; set; }

        public ItemRule ToRule() => new ItemRule(
            Id,
            Stackable,
            AllowedEquipmentSlots,
            TwoHanded,
            EquipRequirementSkill,
            EquipRequirementLevel);
    }
}
