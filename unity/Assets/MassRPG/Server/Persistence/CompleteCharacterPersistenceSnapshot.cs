using System;
using System.Collections.Generic;
using MassRPG.Core.Characters;
using MassRPG.Core.Inventory;
using MassRPG.Server.Death;
using MassRPG.Server.Economy;
using MassRPG.Server.Items;
using MassRPG.Server.Pvp;
using MassRPG.Server.Quests;
using MassRPG.Server.Travel;

namespace MassRPG.Server.Persistence
{
    /// <summary>
    /// Complete character persistence envelope layered over the older character/bank/respawn/travel
    /// snapshot. New server-owned systems are added here rather than silently bloating PlayerState or
    /// serializing transient service internals. The envelope is versioned independently so persistence
    /// migrations can remain explicit when gameplay systems evolve.
    /// </summary>
    public sealed class CompleteCharacterPersistenceSnapshot
    {
        public const int CurrentVersion = 1;

        public CompleteCharacterPersistenceSnapshot(
            int version,
            CharacterPersistenceSnapshot character,
            CharacterQuestSnapshot quests,
            IReadOnlyList<EquipmentDurabilityEntry> equipmentDurability,
            PlayerPvpStatusSnapshot pvp)
        {
            if (version < 1) throw new ArgumentOutOfRangeException(nameof(version));
            Version = version;
            Character = character ?? throw new ArgumentNullException(nameof(character));
            Quests = quests ?? throw new ArgumentNullException(nameof(quests));
            EquipmentDurability = equipmentDurability ?? Array.Empty<EquipmentDurabilityEntry>();
            Pvp = pvp;
        }

        public int Version { get; }
        public CharacterPersistenceSnapshot Character { get; }
        public CharacterQuestSnapshot Quests { get; }
        public IReadOnlyList<EquipmentDurabilityEntry> EquipmentDurability { get; }
        public PlayerPvpStatusSnapshot Pvp { get; }
    }

    public sealed class CompleteCharacterPersistenceRestoreResult
    {
        internal CompleteCharacterPersistenceRestoreResult(
            CharacterPersistenceRestoreResult character,
            CharacterQuestState quests,
            PlayerPvpStatus pvp,
            IReadOnlyList<EquipmentDurabilityEntry> equipmentDurability)
        {
            Character = character ?? throw new ArgumentNullException(nameof(character));
            Quests = quests ?? throw new ArgumentNullException(nameof(quests));
            Pvp = pvp ?? throw new ArgumentNullException(nameof(pvp));
            EquipmentDurability = equipmentDurability ?? Array.Empty<EquipmentDurabilityEntry>();
        }

        public CharacterPersistenceRestoreResult Character { get; }
        public PlayerState Player => Character.Player;
        public CharacterBankState Bank => Character.Bank;
        public PlayerRespawnProfile Respawn => Character.Respawn;
        public CharacterFastTravelState FastTravel => Character.FastTravel;
        public CharacterQuestState Quests { get; }
        public PlayerPvpStatus Pvp { get; }
        public IReadOnlyList<EquipmentDurabilityEntry> EquipmentDurability { get; }
    }

    public static class CompleteCharacterPersistenceSnapshotCodec
    {
        public static CompleteCharacterPersistenceSnapshot Capture(
            PlayerState player,
            CharacterBankRegistry banks,
            PlayerRespawnRegistry respawns,
            FastTravelStateRegistry fastTravelStates,
            QuestService quests,
            EquipmentDurabilityService durability,
            PvpService pvp)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            if (banks == null) throw new ArgumentNullException(nameof(banks));
            if (respawns == null) throw new ArgumentNullException(nameof(respawns));
            if (fastTravelStates == null) throw new ArgumentNullException(nameof(fastTravelStates));
            if (quests == null) throw new ArgumentNullException(nameof(quests));
            if (durability == null) throw new ArgumentNullException(nameof(durability));
            if (pvp == null) throw new ArgumentNullException(nameof(pvp));

            var character = CharacterPersistenceSnapshotCodec.Capture(player, banks, respawns, fastTravelStates);
            var questState = QuestPersistenceSnapshotCodec.Capture(quests.GetOrCreateState(player.CharacterId));
            var equipmentDurability = durability.Capture(player);
            var pvpStatus = pvp.CaptureStatus(player.CharacterId);

            return new CompleteCharacterPersistenceSnapshot(
                CompleteCharacterPersistenceSnapshot.CurrentVersion,
                character,
                questState,
                equipmentDurability,
                pvpStatus);
        }

        public static CompleteCharacterPersistenceRestoreResult Restore(
            CompleteCharacterPersistenceSnapshot snapshot,
            IItemRuleSource itemRules,
            CharacterBankRegistry banks,
            PlayerRespawnRegistry respawns,
            FastTravelStateRegistry fastTravelStates,
            QuestService quests,
            EquipmentDurabilityService durability,
            PvpService pvp)
        {
            if (snapshot == null) throw new ArgumentNullException(nameof(snapshot));
            if (itemRules == null) throw new ArgumentNullException(nameof(itemRules));
            if (banks == null) throw new ArgumentNullException(nameof(banks));
            if (respawns == null) throw new ArgumentNullException(nameof(respawns));
            if (fastTravelStates == null) throw new ArgumentNullException(nameof(fastTravelStates));
            if (quests == null) throw new ArgumentNullException(nameof(quests));
            if (durability == null) throw new ArgumentNullException(nameof(durability));
            if (pvp == null) throw new ArgumentNullException(nameof(pvp));
            if (snapshot.Version > CompleteCharacterPersistenceSnapshot.CurrentVersion)
                throw new InvalidOperationException("Complete character snapshot was written by a newer server version.");

            // Restore the canonical player/equipment first. Quest, durability and PvP state then
            // validate against that restored identity instead of the pre-load runtime object.
            var character = CharacterPersistenceSnapshotCodec.Restore(
                snapshot.Character,
                itemRules,
                banks,
                respawns,
                fastTravelStates);

            var player = character.Player;
            var questState = quests.RestoreState(player.CharacterId, snapshot.Quests);
            durability.Restore(player, snapshot.EquipmentDurability);
            var pvpStatus = pvp.RestoreStatus(player.CharacterId, snapshot.Pvp);

            return new CompleteCharacterPersistenceRestoreResult(
                character,
                questState,
                pvpStatus,
                durability.Capture(player));
        }
    }
}
