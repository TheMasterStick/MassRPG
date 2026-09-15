using System;
using MassRPG.Core.Content;
using MassRPG.Data.World.Semantics;

namespace MassRPG.Data.Creatures
{
    public enum CreatureRoamingMode
    {
        FreeRoam,
        LocalPatrolArea,
        FixedSpawnPoint,
        PatrolRoute
    }

    /// <summary>
    /// Authored population rule for ordinary creatures. This is simulation/editor data and is not
    /// automatically exposed on the public player map.
    /// </summary>
    public sealed class CreatureSpawnRegionDefinition
    {
        public CreatureSpawnRegionDefinition(
            ContentId id,
            ContentId creatureDefinitionId,
            WorldAreaShape area,
            int plane,
            int storey,
            int populationCap,
            long respawnIntervalMilliseconds,
            CreatureRoamingMode roamingMode = CreatureRoamingMode.FreeRoam)
        {
            if (id.IsEmpty) throw new ArgumentException("Spawn region id cannot be empty.", nameof(id));
            if (creatureDefinitionId.IsEmpty) throw new ArgumentException("Creature definition id cannot be empty.", nameof(creatureDefinitionId));
            if (area == null) throw new ArgumentNullException(nameof(area));
            if (populationCap < 1) throw new ArgumentOutOfRangeException(nameof(populationCap));
            if (respawnIntervalMilliseconds < 1) throw new ArgumentOutOfRangeException(nameof(respawnIntervalMilliseconds));

            Id = id;
            CreatureDefinitionId = creatureDefinitionId;
            Area = area;
            Plane = plane;
            Storey = storey;
            PopulationCap = populationCap;
            RespawnIntervalMilliseconds = respawnIntervalMilliseconds;
            RoamingMode = roamingMode;
        }

        public ContentId Id { get; }
        public ContentId CreatureDefinitionId { get; }
        public WorldAreaShape Area { get; }
        public int Plane { get; }
        public int Storey { get; }
        public int PopulationCap { get; set; }
        public long RespawnIntervalMilliseconds { get; set; }
        public CreatureRoamingMode RoamingMode { get; set; }
    }
}
