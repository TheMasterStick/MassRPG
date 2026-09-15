using System;
using System.Collections.Generic;
using MassRPG.Core.Content;
using MassRPG.Data.World.Placements;
using MassRPG.Data.World.Semantics;

namespace MassRPG.Data.World.Dressing
{
    public enum DressingOccupancyChannel
    {
        Major,
        Minor,
        GroundDetail
    }

    /// <summary>
    /// One deterministic scenery/resource rule within a biome dressing profile. Density is a
    /// probability per logical tile before minimum-spacing arbitration. Large real trees normally
    /// use Resource/Major; shrubs, saplings and fallen branches can use Doodad/Minor/GroundDetail.
    /// </summary>
    public sealed class BiomeDressingEntry
    {
        public BiomeDressingEntry(
            ContentId id,
            ContentId definitionId,
            WorldPlacementKind placementKind,
            double densityPerTile,
            int minimumSpacingTiles = 0,
            DressingOccupancyChannel channel = DressingOccupancyChannel.Major,
            int priority = 0,
            uint seedSalt = 0)
        {
            if (id.IsEmpty) throw new ArgumentException("Dressing entry id cannot be empty.", nameof(id));
            if (definitionId.IsEmpty) throw new ArgumentException("Dressing definition id cannot be empty.", nameof(definitionId));
            if (densityPerTile < 0.0 || densityPerTile > 1.0) throw new ArgumentOutOfRangeException(nameof(densityPerTile));
            if (minimumSpacingTiles < 0 || minimumSpacingTiles > 64) throw new ArgumentOutOfRangeException(nameof(minimumSpacingTiles));
            Id = id;
            DefinitionId = definitionId;
            PlacementKind = placementKind;
            DensityPerTile = densityPerTile;
            MinimumSpacingTiles = minimumSpacingTiles;
            Channel = channel;
            Priority = priority;
            SeedSalt = seedSalt;
        }

        public ContentId Id { get; }
        public ContentId DefinitionId { get; set; }
        public WorldPlacementKind PlacementKind { get; set; }
        public double DensityPerTile { get; set; }
        public int MinimumSpacingTiles { get; set; }
        public DressingOccupancyChannel Channel { get; set; }
        public int Priority { get; set; }
        public uint SeedSalt { get; set; }
    }

    /// <summary>
    /// Deterministic bulk dressing for one semantic biome area. Same profile + seed + authored area
    /// produces the same untouched scenery after reload without storing one DB row per normal tree.
    /// </summary>
    public sealed class BiomeDressingProfile
    {
        private readonly List<BiomeDressingEntry> _entries = new List<BiomeDressingEntry>();

        public BiomeDressingProfile(ContentId id, ContentId biomeAreaId, uint seed)
        {
            if (id.IsEmpty) throw new ArgumentException("Dressing profile id cannot be empty.", nameof(id));
            if (biomeAreaId.IsEmpty) throw new ArgumentException("Biome area id cannot be empty.", nameof(biomeAreaId));
            Id = id;
            BiomeAreaId = biomeAreaId;
            Seed = seed;
        }

        public ContentId Id { get; }
        public ContentId BiomeAreaId { get; }
        public uint Seed { get; set; }
        public IReadOnlyList<BiomeDressingEntry> Entries => _entries;

        public void AddEntry(BiomeDressingEntry entry)
        {
            if (entry == null) throw new ArgumentNullException(nameof(entry));
            for (var i = 0; i < _entries.Count; i++)
                if (_entries[i].Id == entry.Id) throw new InvalidOperationException($"Duplicate dressing entry id '{entry.Id}'.");
            _entries.Add(entry);
            _entries.Sort((a, b) => b.Priority.CompareTo(a.Priority));
        }
    }

    /// <summary>
    /// Local deterministic-density override. Multiplier 0 is an exclusion area; values above/below
    /// one locally increase/decrease dressing. Optional entry id targets one rule only.
    /// </summary>
    public sealed class BiomeDressingDensityOverride
    {
        public BiomeDressingDensityOverride(
            ContentId id,
            WorldAreaShape shape,
            double densityMultiplier,
            ContentId? targetEntryId = null)
        {
            if (id.IsEmpty) throw new ArgumentException("Override id cannot be empty.", nameof(id));
            if (shape == null) throw new ArgumentNullException(nameof(shape));
            if (densityMultiplier < 0.0 || densityMultiplier > 8.0) throw new ArgumentOutOfRangeException(nameof(densityMultiplier));
            Id = id;
            Shape = shape;
            DensityMultiplier = densityMultiplier;
            TargetEntryId = targetEntryId;
        }

        public ContentId Id { get; }
        public WorldAreaShape Shape { get; }
        public double DensityMultiplier { get; set; }
        public ContentId? TargetEntryId { get; set; }
    }
}
