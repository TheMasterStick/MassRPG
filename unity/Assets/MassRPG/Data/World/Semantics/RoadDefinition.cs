using System;
using System.Collections.Generic;
using MassRPG.Core.Content;
using MassRPG.Core.World;

namespace MassRPG.Data.World.Semantics
{
    /// <summary>
    /// Authored road polyline. Roads are public navigation/world-guidance data and may later carry
    /// movement/pathfinding preference without becoming fast-travel links.
    /// </summary>
    public sealed class RoadDefinition
    {
        private readonly List<GridCoord> _points;

        public RoadDefinition(ContentId id, string displayName, IEnumerable<GridCoord> points)
        {
            if (id.IsEmpty) throw new ArgumentException("Road id cannot be empty.", nameof(id));
            if (points == null) throw new ArgumentNullException(nameof(points));
            _points = new List<GridCoord>(points);
            if (_points.Count < 2) throw new ArgumentException("A road requires at least two points.", nameof(points));
            Id = id;
            DisplayName = displayName ?? string.Empty;
        }

        public ContentId Id { get; }
        public string DisplayName { get; set; }
        public IReadOnlyList<GridCoord> Points => _points;
        public bool VisibleOnPlayerMap { get; set; } = true;
        public double MovementSpeedMultiplier { get; set; } = 1.0;
        public double RoutePreferenceWeight { get; set; } = 1.0;
    }
}
