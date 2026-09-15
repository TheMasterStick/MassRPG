using System;

namespace MassRPG.Core.Skills
{
    /// <summary>
    /// RuneScape-style reference XP curve extended to MassRPG's current 1-300 skill ceiling.
    /// Levels 1-99 intentionally match the browser prototype exactly. Values above 99 are a
    /// migration baseline and can be rebalanced later without changing the state model.
    /// </summary>
    public static class SkillProgression
    {
        public const int MaxLevel = 300;
        private static readonly long[] XpTable = BuildXpTable();

        private static long[] BuildXpTable()
        {
            var table = new long[MaxLevel + 1];
            long points = 0;
            table[1] = 0;

            for (var level = 1; level < MaxLevel; level++)
            {
                var term = (long)Math.Floor(level + 300.0 * Math.Pow(2.0, level / 7.0));
                points = checked(points + term);
                table[level + 1] = points / 4;
            }

            return table;
        }

        public static long XpForLevel(int level)
        {
            var clamped = Math.Max(1, Math.Min(MaxLevel, level));
            return XpTable[clamped];
        }

        public static int LevelForXp(long xp)
        {
            if (xp <= 0) return 1;

            for (var level = MaxLevel; level >= 1; level--)
            {
                if (xp >= XpTable[level]) return level;
            }

            return 1;
        }

        public static double ProgressToNextLevel(long xp)
        {
            var level = LevelForXp(xp);
            if (level >= MaxLevel) return 1.0;

            var current = XpTable[level];
            var next = XpTable[level + 1];
            return (double)(xp - current) / (next - current);
        }
    }
}
