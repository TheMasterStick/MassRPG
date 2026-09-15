using System;
using MassRPG.Core.Characters;
using MassRPG.Core.Skills;
using MassRPG.Server.Combat;
using NUnit.Framework;

namespace MassRPG.Tests
{
    public sealed class CombatExperienceTests
    {
        [Test]
        public void AggressiveMeleePreservesBrowserDamageXpSplit()
        {
            var player = new PlayerState(Guid.NewGuid(), "Fighter");
            player.CombatStyle = CombatStyle.Melee;
            player.MeleeTrainingStyle = MeleeTrainingStyle.Aggressive;
            var strengthBefore = player.Skills.GetXp(SkillId.Strength);
            var hitpointsBefore = player.Skills.GetXp(SkillId.Hitpoints);

            new BrowserCombatExperiencePolicy().AwardDamageExperience(player, 10);

            Assert.AreEqual(strengthBefore + 13, player.Skills.GetXp(SkillId.Strength));
            Assert.AreEqual(hitpointsBefore + 3, player.Skills.GetXp(SkillId.Hitpoints));
        }

        [Test]
        public void AccurateDefensiveRangedAndMagicTrainTheirExpectedSkills()
        {
            AssertSingleCombatSkill(CombatStyle.Melee, MeleeTrainingStyle.Accurate, SkillId.Attack);
            AssertSingleCombatSkill(CombatStyle.Melee, MeleeTrainingStyle.Defensive, SkillId.Defence);
            AssertSingleCombatSkill(CombatStyle.Ranged, MeleeTrainingStyle.Aggressive, SkillId.Ranged);
            AssertSingleCombatSkill(CombatStyle.Magic, MeleeTrainingStyle.Aggressive, SkillId.Magic);
        }

        [Test]
        public void ControlledSharesOneRoundedCombatAwardAcrossMeleeSkills()
        {
            var player = new PlayerState(Guid.NewGuid(), "Controlled");
            player.CombatStyle = CombatStyle.Melee;
            player.MeleeTrainingStyle = MeleeTrainingStyle.Controlled;
            var attackBefore = player.Skills.GetXp(SkillId.Attack);
            var strengthBefore = player.Skills.GetXp(SkillId.Strength);
            var defenceBefore = player.Skills.GetXp(SkillId.Defence);

            new BrowserCombatExperiencePolicy().AwardDamageExperience(player, 10);

            Assert.AreEqual(attackBefore + 5, player.Skills.GetXp(SkillId.Attack));
            Assert.AreEqual(strengthBefore + 4, player.Skills.GetXp(SkillId.Strength));
            Assert.AreEqual(defenceBefore + 4, player.Skills.GetXp(SkillId.Defence));
        }

        [Test]
        public void HitpointsLevelGainHealsOnlyTheGainedLevelAmount()
        {
            var player = new PlayerState(Guid.NewGuid(), "Tank");
            player.CurrentHitpoints = 5;
            player.Skills.SetXp(SkillId.Hitpoints, SkillProgression.XpForLevel(11) - 1);
            Assert.AreEqual(10, player.Skills.GetLevel(SkillId.Hitpoints));

            new BrowserCombatExperiencePolicy(0.0, 1.0).AwardDamageExperience(player, 1);

            Assert.AreEqual(11, player.Skills.GetLevel(SkillId.Hitpoints));
            Assert.AreEqual(6, player.CurrentHitpoints);
        }

        [Test]
        public void MissOrZeroDamageAwardsNoExperience()
        {
            var player = new PlayerState(Guid.NewGuid(), "Miss");
            var attackBefore = player.Skills.GetXp(SkillId.Attack);
            var hpBefore = player.Skills.GetXp(SkillId.Hitpoints);

            new BrowserCombatExperiencePolicy().AwardDamageExperience(player, 0);

            Assert.AreEqual(attackBefore, player.Skills.GetXp(SkillId.Attack));
            Assert.AreEqual(hpBefore, player.Skills.GetXp(SkillId.Hitpoints));
        }

        private static void AssertSingleCombatSkill(CombatStyle style, MeleeTrainingStyle meleeStyle, SkillId expected)
        {
            var player = new PlayerState(Guid.NewGuid(), expected.ToString());
            player.CombatStyle = style;
            player.MeleeTrainingStyle = meleeStyle;
            var before = player.Skills.GetXp(expected);

            new BrowserCombatExperiencePolicy().AwardDamageExperience(player, 3);

            Assert.AreEqual(before + 4, player.Skills.GetXp(expected));
        }
    }
}
