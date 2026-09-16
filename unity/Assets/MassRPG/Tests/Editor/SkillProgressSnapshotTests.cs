using MassRPG.Core.Skills;
using NUnit.Framework;

namespace MassRPG.Tests
{
    public sealed class SkillProgressSnapshotTests
    {
        [Test]
        public void LevelOneStartsAtZeroWithNextThresholdRemaining()
        {
            var snapshot = SkillProgressSnapshot.FromXp(0);

            Assert.AreEqual(1, snapshot.Level);
            Assert.AreEqual(0, snapshot.TotalXp);
            Assert.AreEqual(0, snapshot.LevelStartXp);
            Assert.AreEqual(SkillProgression.XpForLevel(2), snapshot.NextLevelXp);
            Assert.AreEqual(snapshot.NextLevelXp, snapshot.XpRemaining);
            Assert.AreEqual(0.0, snapshot.Progress, 0.000001);
            Assert.IsFalse(snapshot.IsMaximumLevel);
        }

        [Test]
        public void ExactLevelBoundaryShowsZeroProgressIntoNewLevel()
        {
            var xp = SkillProgression.XpForLevel(42);
            var snapshot = SkillProgressSnapshot.FromXp(xp);

            Assert.AreEqual(42, snapshot.Level);
            Assert.AreEqual(xp, snapshot.LevelStartXp);
            Assert.AreEqual(SkillProgression.XpForLevel(43), snapshot.NextLevelXp);
            Assert.AreEqual(snapshot.NextLevelXp - xp, snapshot.XpRemaining);
            Assert.AreEqual(0.0, snapshot.Progress, 0.000001);
        }

        [Test]
        public void MidLevelProgressAndRemainingXpUseSameAuthoritativeThresholds()
        {
            var start = SkillProgression.XpForLevel(70);
            var next = SkillProgression.XpForLevel(71);
            var xp = start + (next - start) / 2;
            var snapshot = SkillProgressSnapshot.FromXp(xp);

            Assert.AreEqual(70, snapshot.Level);
            Assert.AreEqual(next - xp, snapshot.XpRemaining);
            Assert.Greater(snapshot.Progress, 0.49);
            Assert.Less(snapshot.Progress, 0.51);
        }

        [Test]
        public void ProgressContinuesPastLegacyBrowserLevelNinetyNine()
        {
            var xp = SkillProgression.XpForLevel(100);
            var snapshot = SkillProgressSnapshot.FromXp(xp);

            Assert.AreEqual(100, snapshot.Level);
            Assert.IsFalse(snapshot.IsMaximumLevel);
            Assert.AreEqual(SkillProgression.XpForLevel(101), snapshot.NextLevelXp);
            Assert.Greater(snapshot.XpRemaining, 0);
        }

        [Test]
        public void MaximumLevelHasNoRemainingXp()
        {
            var threshold = SkillProgression.XpForLevel(SkillProgression.MaxLevel);
            var snapshot = SkillProgressSnapshot.FromXp(threshold + 12345);

            Assert.AreEqual(SkillProgression.MaxLevel, snapshot.Level);
            Assert.IsTrue(snapshot.IsMaximumLevel);
            Assert.AreEqual(0, snapshot.XpRemaining);
            Assert.AreEqual(1.0, snapshot.Progress, 0.000001);
            Assert.AreEqual(threshold + 12345, snapshot.TotalXp);
        }

        [Test]
        public void NegativeXpIsPresentedAsZero()
        {
            var snapshot = SkillProgressSnapshot.FromXp(-500);

            Assert.AreEqual(0, snapshot.TotalXp);
            Assert.AreEqual(1, snapshot.Level);
            Assert.AreEqual(0.0, snapshot.Progress, 0.000001);
        }
    }
}
