using System;
using MassRPG.Core.Characters;
using MassRPG.Core.World;

namespace MassRPG.Core.Combat
{
    public static class CombatGeometry
    {
        public const double HighGroundAccuracyModifier = 0.05;

        /// <summary>
        /// All melee weapons use one logical tile of reach. Attacker and target must be on the
        /// same logical elevation and a real open adjacent connection must exist.
        /// </summary>
        public static bool CanMelee(IGridTraversalMap map, GridLocation attacker, GridLocation target)
        {
            if (map == null) throw new ArgumentNullException(nameof(map));
            if (!attacker.SameLayer(target)) return false;
            if (!GridMath.IsAdjacent(attacker.Tile, target.Tile)) return false;
            if (map.GetLogicalElevation(attacker) != map.GetLogicalElevation(target)) return false;
            return GridTraversal.CanStep(map, attacker, target);
        }

        /// <summary>
        /// Ranged/magic range uses Chebyshev grid distance: range N reaches N tiles horizontally,
        /// vertically or diagonally. Elevation does not change LOS or range.
        /// </summary>
        public static bool CanRangedOrMagic(
            IRangedLineOfSightMap map,
            GridLocation attacker,
            GridLocation target,
            int rangeTiles)
        {
            if (map == null) throw new ArgumentNullException(nameof(map));
            if (rangeTiles < 1) return false;
            if (!attacker.SameLayer(target)) return false;
            if (GridMath.RangeDistance(attacker.Tile, target.Tile) > rangeTiles) return false;
            return GridLineOfSight.HasLineOfSight(map, attacker, target);
        }

        /// <summary>
        /// Settled static high-ground rule: ranged/magic attacks get +5% accuracy from any higher
        /// logical elevation and -5% from any lower elevation. The amount does not stack by height.
        /// </summary>
        public static double ElevationAccuracyModifier(CombatStyle style, int attackerElevation, int targetElevation)
        {
            if (style == CombatStyle.Melee || attackerElevation == targetElevation) return 0.0;
            return attackerElevation > targetElevation ? HighGroundAccuracyModifier : -HighGroundAccuracyModifier;
        }

        public static double ApplyElevationAccuracyModifier(
            double baseHitChance,
            CombatStyle style,
            int attackerElevation,
            int targetElevation)
        {
            var adjusted = baseHitChance + ElevationAccuracyModifier(style, attackerElevation, targetElevation);
            return Math.Max(0.0, Math.Min(1.0, adjusted));
        }
    }
}
