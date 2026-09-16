using System;

namespace MassRPG.Core.Skills
{
    /// <summary>
    /// Presentation-ready progression facts derived from authoritative XP rules. UI code should use
    /// this snapshot rather than duplicating level thresholds or assuming the legacy browser cap.
    /// </summary>
    public readonly struct SkillProgressSnapshot
    {
        private SkillProgressSnapshot(
            long totalXp,
            int level,
            long levelStartXp,
            long nextLevelXp,
            long xpRemaining,
            double progress,
            bool isMaximumLevel)
        {
            TotalXp = totalXp;
            Level = level;
            LevelStartXp = levelStartXp;
            NextLevelXp = nextLevelXp;
            XpRemaining = xpRemaining;
            Progress = progress;
            IsMaximumLevel = isMaximumLevel;
        }

        public long TotalXp { get; }
        public int Level { get; }
        public long LevelStartXp { get; }
        public long NextLevelXp { get; }
        public long XpRemaining { get; }
        public double Progress { get; }
        public bool IsMaximumLevel { get; }

        public static SkillProgressSnapshot FromXp(long xp)
        {
            var totalXp = Math.Max(0, xp);
            var level = SkillProgression.LevelForXp(totalXp);
            var levelStart = SkillProgression.XpForLevel(level);
            if (level >= SkillProgression.MaxLevel)
            {
                return new SkillProgressSnapshot(
                    totalXp,
                    level,
                    levelStart,
                    totalXp,
                    0,
                    1.0,
                    true);
            }

            var next = SkillProgression.XpForLevel(level + 1);
            var remaining = Math.Max(0, next - totalXp);
            var progress = SkillProgression.ProgressToNextLevel(totalXp);
            if (progress < 0.0) progress = 0.0;
            else if (progress > 1.0) progress = 1.0;

            return new SkillProgressSnapshot(
                totalXp,
                level,
                levelStart,
                next,
                remaining,
                progress,
                false);
        }
    }
}
