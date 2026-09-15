using System;
using MassRPG.Core.Characters;
using MassRPG.Core.Content;
using MassRPG.Core.Inventory;
using MassRPG.Core.World;
using MassRPG.Data.Items;
using MassRPG.Data.Quests;
using MassRPG.Data.World.Semantics;
using MassRPG.Server.Death;
using MassRPG.Server.Economy;
using MassRPG.Server.Items;
using MassRPG.Server.Persistence;
using MassRPG.Server.Pvp;
using MassRPG.Server.Quests;
using MassRPG.Server.Travel;
using NUnit.Framework;

namespace MassRPG.Tests
{
    public sealed class CompleteCharacterPersistenceSnapshotTests
    {
        private static readonly ContentId SwordId = new ContentId("test_sword");
        private static readonly ContentId QuestId = new ContentId("quest.persist_everything");
        private static readonly ContentId NpcId = new ContentId("npc.guide");

        [Test]
        public void CompleteRoundTripPreservesQuestDurabilityAndPvpAlongsideBaseCharacterState()
        {
            var items = CreateItems();
            var quests = CreateQuestService(items);
            var durability = new EquipmentDurabilityService();
            var pvp = new PvpService(new WorldSemanticCatalog());
            var banks = new CharacterBankRegistry();
            var respawns = new PlayerRespawnRegistry();
            var travel = new FastTravelStateRegistry();
            var player = new PlayerState(Guid.NewGuid(), "Persistent Hero")
            {
                Location = Loc(40, 50)
            };

            InventoryRules.AddItem(player.Inventory, items, SwordId, 1);
            var swordSlot = FindSlot(player.Inventory, SwordId);
            Assert.GreaterOrEqual(swordSlot, 0);
            Assert.IsTrue(InventoryRules.EquipFromInventory(
                player.Inventory,
                player.Equipment,
                items,
                player.Skills,
                swordSlot,
                EquipmentSlot.MainHand).Success);

            Assert.IsTrue(quests.TryStart(player, QuestId).Success);
            quests.RecordContentEvent(player, QuestObjectiveKind.TalkToNpc, NpcId);
            Assert.IsTrue(quests.GetOrCreateState(player.CharacterId).TryGetActive(QuestId, out var questBefore));
            Assert.AreEqual(QuestRunStatus.ReadyToClaim, questBefore.Status);

            Assert.IsTrue(durability.TryDamage(player, EquipmentSlot.MainHand, 2500));
            Assert.IsTrue(durability.TryGet(player, EquipmentSlot.MainHand, out var damaged));
            Assert.AreEqual(7500, damaged.DurabilityBasisPoints);

            pvp.RestoreStatus(player.CharacterId, new PlayerPvpStatusSnapshot(true, 123456789));
            var respawn = respawns.GetOrCreate(player.CharacterId);
            respawn.Preference = RespawnPreference.Home;
            respawn.HomeLocation = Loc(7, 8);

            var snapshot = CompleteCharacterPersistenceSnapshotCodec.Capture(
                player,
                banks,
                respawns,
                travel,
                quests,
                durability,
                pvp);

            var restoredQuests = CreateQuestService(items);
            var restoredDurability = new EquipmentDurabilityService();
            var restoredPvp = new PvpService(new WorldSemanticCatalog());
            var restored = CompleteCharacterPersistenceSnapshotCodec.Restore(
                snapshot,
                items,
                new CharacterBankRegistry(),
                new PlayerRespawnRegistry(),
                new FastTravelStateRegistry(),
                restoredQuests,
                restoredDurability,
                restoredPvp);

            Assert.AreEqual(player.CharacterId, restored.Player.CharacterId);
            Assert.AreEqual(Loc(40, 50), restored.Player.Location);
            Assert.AreEqual(Loc(7, 8), restored.Respawn.HomeLocation.Value);
            Assert.IsTrue(restored.Player.Equipment.TryGet(EquipmentSlot.MainHand, out var restoredSword));
            Assert.AreEqual(SwordId, restoredSword);

            Assert.IsTrue(restored.Quests.TryGetActive(QuestId, out var restoredQuest));
            Assert.AreEqual(QuestRunStatus.ReadyToClaim, restoredQuest.Status);
            Assert.AreEqual(1, restoredQuest.GetCount("talk"));

            Assert.IsTrue(restoredDurability.TryGet(restored.Player, EquipmentSlot.MainHand, out var restoredCondition));
            Assert.AreEqual(SwordId, restoredCondition.ItemId);
            Assert.AreEqual(7500, restoredCondition.DurabilityBasisPoints);

            Assert.IsTrue(restored.Pvp.OptedIn);
            Assert.AreEqual(123456789, restored.Pvp.SkulledUntilUnixMilliseconds);
        }

        [Test]
        public void RestoreRejectsFutureEnvelopeVersionBeforeApplyingSubsystemState()
        {
            var items = CreateItems();
            var player = new PlayerState(Guid.NewGuid(), "Future");
            var banks = new CharacterBankRegistry();
            var respawns = new PlayerRespawnRegistry();
            var travel = new FastTravelStateRegistry();
            var quests = CreateQuestService(items);
            var durability = new EquipmentDurabilityService();
            var pvp = new PvpService(new WorldSemanticCatalog());
            var valid = CompleteCharacterPersistenceSnapshotCodec.Capture(
                player, banks, respawns, travel, quests, durability, pvp);
            var future = new CompleteCharacterPersistenceSnapshot(
                CompleteCharacterPersistenceSnapshot.CurrentVersion + 1,
                valid.Character,
                valid.Quests,
                valid.EquipmentDurability,
                valid.Pvp);

            Assert.Throws<InvalidOperationException>(() => CompleteCharacterPersistenceSnapshotCodec.Restore(
                future,
                items,
                new CharacterBankRegistry(),
                new PlayerRespawnRegistry(),
                new FastTravelStateRegistry(),
                CreateQuestService(items),
                new EquipmentDurabilityService(),
                new PvpService(new WorldSemanticCatalog())));
        }

        private static ItemCatalog CreateItems()
        {
            var catalog = new ItemCatalog();
            catalog.Register(new ItemDefinition(new ContentId("coins"), "Coins", ItemType.Currency, true, 1));
            catalog.Register(new ItemDefinition(
                SwordId,
                "Test Sword",
                ItemType.Weapon,
                false,
                10,
                allowedEquipmentSlots: new[] { EquipmentSlot.MainHand }));
            return catalog;
        }

        private static QuestService CreateQuestService(ItemCatalog items)
        {
            var catalog = new QuestCatalog();
            catalog.Register(new QuestDefinition(
                QuestId,
                "Persistent Quest",
                new[]
                {
                    new QuestObjectiveDefinition("talk", QuestObjectiveKind.TalkToNpc, 1, NpcId)
                }));
            return new QuestService(catalog, items);
        }

        private static int FindSlot(InventoryState inventory, ContentId itemId)
        {
            for (var i = 0; i < inventory.Capacity; i++)
            {
                var stack = inventory.GetSlot(i);
                if (stack != null && stack.ItemId == itemId) return i;
            }
            return -1;
        }

        private static GridLocation Loc(int x, int y)
            => new GridLocation(new GridCoord(x, y), WorldConstants.SurfacePlane, 0);
    }
}
