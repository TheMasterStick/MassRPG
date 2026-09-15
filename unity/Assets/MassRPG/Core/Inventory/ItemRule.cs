using System;
using MassRPG.Core.Content;

namespace MassRPG.Core.Inventory
{
    /// <summary>
    /// Minimal gameplay-facing item metadata needed by pure Core rules.
    /// Rich authored item data lives in MassRPG.Data and is adapted to this contract.
    /// </summary>
    public sealed class ItemRule
    {
        public ItemRule(ContentId id, bool stackable, EquipmentSlot[] allowedEquipmentSlots, bool twoHanded)
        {
            Id = id;
            Stackable = stackable;
            AllowedEquipmentSlots = allowedEquipmentSlots ?? Array.Empty<EquipmentSlot>();
            TwoHanded = twoHanded;
        }

        public ContentId Id { get; }
        public bool Stackable { get; }
        public EquipmentSlot[] AllowedEquipmentSlots { get; }
        public bool TwoHanded { get; }
    }

    public interface IItemRuleSource
    {
        bool TryGetRule(ContentId itemId, out ItemRule rule);
    }
}
