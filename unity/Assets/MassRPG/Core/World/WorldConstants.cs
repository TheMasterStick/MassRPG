namespace MassRPG.Core.World
{
    public static class WorldConstants
    {
        public const int WorldWidthTiles = 180000;
        public const int WorldHeightTiles = 180000;

        /// <summary>
        /// Current render/streaming chunk starting point. Benchmark and change if needed;
        /// this is not part of the authored world's semantic hierarchy.
        /// </summary>
        public const int DefaultRenderChunkSize = 64;

        public const int SurfacePlane = 0;
        public const int UndergroundPlane1 = -1;
        public const int UndergroundPlane2 = -2;
    }
}
