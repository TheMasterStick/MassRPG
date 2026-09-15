using System;
using MassRPG.Core.Characters;
using MassRPG.Core.Skills;

namespace MassRPG.Server.Combat
{
    public interface ICombatExperiencePolicy
    {
        void AwardDamageExperience(PlayerState player, int damage);
    }

    /// <summary>
    /// Browser-parity combat XP policy. The legacy prototype awarded 1.33 combat-skill XP and
    /// 0.33 Hitpoints XP per point of damage, rounded to whole XP at the award boundary. Keeping
    /// those multipliers configurable lets live balance change without rewriting combat resolution.
    /// Controlled is the Unity-era fourth melee style and shares its combat XP across the three
    /// melee skills rather than silently training only one of them.
    /// </summary>
    public sealed class BrowserCombatExperiencePolicy : ICombatExperiencePolicy
    {
        public BrowserCombatExperiencePolicy(double combatXpPerDamage = 1.33, double hitpointsXpPerDamage = 0.33)
        {
            if (combatXpPerDamage < 0.0) throw new ArgumentOutOfRangeException(nameof(combatXpPerDamage));
            if (hitpointsXpPerDamage < 0.0) throw new ArgumentOutOfRangeException(nameof(hitpointsXpPerDamage));
            CombatXpPerDamage = combatXpPerDamage;
            HitpointsXpPerDamage = hitpointsXpPerDamage;
        }

        public double CombatXpPerDamage { get; }
        public double HitpointsXpPerDamage { get; }

        public void AwardDamageExperience(PlayerState player, int damage)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            if (damage <= 0) return;

            var combatXp = RoundLikeBrowser(damage * CombatXpPerDamage);
            switch (player.CombatStyle)
            {
                case CombatStyle.Ranged:
                    player.Skills.AddXp(SkillId.Ranged, combatXp);
                    break;
                case CombatStyle.Magic:
                    player.Skills.AddXp(SkillId.Magic, combatXp);
                    break;
                default:
                    AwardMelee(player, combatXp);
                    break;
            }

            var hitpointsXp = RoundLikeBrowser(damage * HitpointsXpPerDamage);
            if (hitpointsXp <= 0) return;

            var beforeLevel = player.Skills.GetLevel(SkillId.Hitpoints);
            player.Skills.AddXp(SkillId.Hitpoints, hitpointsXp);
            var afterLevel = player.Skills.GetLevel(SkillId.Hitpoints);
            if (afterLevel > beforeLevel)
                player.CurrentHitpoints = Math.Min(player.MaxHitpoints, player.CurrentHitpoints + (afterLevel - beforeLevel));
        }

        private static void AwardMelee(PlayerState player, int combatXp)
        {
            if (combatXp <= 0) return;
            switch (player.MeleeTrainingStyle)
            {
                case MeleeTrainingStyle.Accurate:
                    player.Skills.AddXp(SkillId.Attack, combatXp);
                    break;
                case MeleeTrainingStyle.Defensive:
                    player.Skills.AddXp(SkillId.Defence, combatXp);
                    break;
                case MeleeTrainingStyle.Controlled:
                    var baseShare = combatXp / 3;
                    var remainder = combatXp - baseShare * 3;
                    player.Skills.AddXp(SkillId.Attack, baseShare + (remainder > 0 ? 1 : 0));
                    player.Skills.AddXp(SkillId.Strength, baseShare + (remainder > 1 ? 1 : 0));
                    player.Skills.AddXp(SkillId.Defence, baseShare);
                    break;
                default:
                    player.Skills.AddXp(SkillId.Strength, combatXp);
                    break;
            }
        }

        private static int RoundLikeBrowser(double value)
        {
            if (value <= 0.0) return 0;
            var rounded = Math.Floor(value + 0.5);
            if (rounded > int.MaxValue) throw new OverflowException("Combat XP award exceeds supported range.");
            return (int)rounded;
        }
    }
}
