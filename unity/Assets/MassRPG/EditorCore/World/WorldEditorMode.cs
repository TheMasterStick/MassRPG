using System;

namespace MassRPG.EditorCore.World
{
    public enum WorldEditorMode
    {
        Terrain,
        Elevation,
        Water,
        Edges,
        Selection,
        Roads,
        Objects,
        Doodads,
        Resources,
        Creatures,
        Regions,
        Pathing,
        PointsOfInterest
    }

    [Flags]
    public enum WorldEditorOverlay
    {
        None = 0,
        Grid = 1 << 0,
        Elevation = 1 << 1,
        Regions = 1 << 2,
        CreatureSpawns = 1 << 3,
        Resources = 1 << 4,
        Pathing = 1 << 5,
        NoBuild = 1 << 6,
        Water = 1 << 7,
        PointsOfInterest = 1 << 8,
        StoragePages = 1 << 9,
        RenderChunks = 1 << 10,
        Edges = 1 << 11
    }

    public enum BrushShape
    {
        Square,
        Circle
    }
}
