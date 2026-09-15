using System.Linq;
using MassRPG.Core.Content;
using MassRPG.Core.World;
using MassRPG.Data.World.Semantics;
using NUnit.Framework;

namespace MassRPG.Tests
{
    public sealed class WorldSemanticTests
    {
        [Test]
        public void AreaLayersOverlapInsteadOfPartitioningTheWorld()
        {
            var catalog = new WorldSemanticCatalog();
            var shape = new CircleAreaShape(new GridCoord(100, 100), 20);
            catalog.RegisterArea(new WorldAreaDefinition(
                new ContentId("region.emberwatch"), "Emberwatch Region", WorldAreaKind.NamedRegion, shape, PlayerMapVisibility.Public));
            catalog.RegisterArea(new WorldAreaDefinition(
                new ContentId("biome.forest.emberwatch"), "Forest", WorldAreaKind.Biome, shape, PlayerMapVisibility.NotPlayerMapData));
            catalog.RegisterArea(new WorldAreaDefinition(
                new ContentId("spawn.wolves.emberwatch"), "Wolf population", WorldAreaKind.CreatureSpawnZone, shape, PlayerMapVisibility.NotPlayerMapData));

            var matches = catalog.AreasContaining(new GridCoord(100, 100));

            Assert.AreEqual(3, matches.Count);
            Assert.IsTrue(matches.Any(a => a.Kind == WorldAreaKind.NamedRegion));
            Assert.IsTrue(matches.Any(a => a.Kind == WorldAreaKind.CreatureSpawnZone));
        }

        [Test]
        public void NormalPoiIsPublicButProtectionFootprintCanDifferFromVisibleFootprint()
        {
            var poi = new PointOfInterestDefinition(
                new ContentId("poi.capital"),
                "Capital",
                PointOfInterestKind.Capital,
                new GridLocation(new GridCoord(90000, 90000), WorldConstants.SurfacePlane, 0),
                MapMarkerCategory.Settlement);
            poi.VisibleFootprint = new CircleAreaShape(new GridCoord(90000, 90000), 40);
            poi.ProtectionFootprint = new CircleAreaShape(new GridCoord(90000, 90000), 80);

            Assert.AreEqual(PlayerMapVisibility.Public, poi.MapVisibility);
            Assert.IsFalse(poi.VisibleFootprint.Contains(new GridCoord(90060, 90000)));
            Assert.IsTrue(poi.ProtectionFootprint.Contains(new GridCoord(90060, 90000)));
        }

        [Test]
        public void CreatureAreasAreSystemDataNotPublicMapMarkersByDefault()
        {
            var area = new WorldAreaDefinition(
                new ContentId("spawn.wolves.test"),
                "Wolves",
                WorldAreaKind.CreatureSpawnZone,
                new CircleAreaShape(new GridCoord(50, 50), 10));

            Assert.AreEqual(PlayerMapVisibility.NotPlayerMapData, area.MapVisibility);
        }
    }
}
