using System;
using System.Collections.Generic;
using MassRPG.Core.Content;
using MassRPG.Core.World;

namespace MassRPG.Data.World.Semantics
{
    public sealed class WorldSemanticCatalog
    {
        private readonly Dictionary<ContentId, WorldAreaDefinition> _areas = new Dictionary<ContentId, WorldAreaDefinition>();
        private readonly Dictionary<ContentId, PointOfInterestDefinition> _pois = new Dictionary<ContentId, PointOfInterestDefinition>();
        private readonly Dictionary<ContentId, RoadDefinition> _roads = new Dictionary<ContentId, RoadDefinition>();

        public IEnumerable<WorldAreaDefinition> Areas => _areas.Values;
        public IEnumerable<PointOfInterestDefinition> PointsOfInterest => _pois.Values;
        public IEnumerable<RoadDefinition> Roads => _roads.Values;

        public void RegisterArea(WorldAreaDefinition area)
        {
            if (area == null) throw new ArgumentNullException(nameof(area));
            EnsureUnique(area.Id);
            _areas.Add(area.Id, area);
        }

        public void RegisterPointOfInterest(PointOfInterestDefinition poi)
        {
            if (poi == null) throw new ArgumentNullException(nameof(poi));
            EnsureUnique(poi.Id);
            _pois.Add(poi.Id, poi);
        }

        public void RegisterRoad(RoadDefinition road)
        {
            if (road == null) throw new ArgumentNullException(nameof(road));
            EnsureUnique(road.Id);
            _roads.Add(road.Id, road);
        }

        public IReadOnlyList<WorldAreaDefinition> AreasContaining(GridCoord tile)
        {
            var result = new List<WorldAreaDefinition>();
            foreach (var area in _areas.Values)
                if (area.Shape.Contains(tile)) result.Add(area);
            return result;
        }

        public bool TryGetPointOfInterest(ContentId id, out PointOfInterestDefinition poi) => _pois.TryGetValue(id, out poi);

        private void EnsureUnique(ContentId id)
        {
            if (_areas.ContainsKey(id) || _pois.ContainsKey(id) || _roads.ContainsKey(id))
                throw new InvalidOperationException($"World semantic id '{id}' is already registered.");
        }
    }
}
