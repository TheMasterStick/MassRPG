using System;
using MassRPG.Core.Characters;
using MassRPG.Core.Combat;
using MassRPG.Core.Creatures;
using MassRPG.Core.Skills;
using MassRPG.Core.World;
using MassRPG.Data.Creatures;
using MassRPG.Server.Creatures;

namespace MassRPG.Server.Combat
{
    /// <summary>
    /// Resolves authoritative player auto-attacks against creature instances. The client owns
    /// neither attack cadence, stopping position, hit chance nor damage. If a target moves out of
    /// range this service replans the approach rather than trusting a client-supplied combat tile.
    /// </summary>
    public sealed class CombatSimulationService
    {
        private readonly CreatureRegistry _creatures;
        private readonly ICreatureDefinitionSource _definitions;
        private readonly IPlayerAttackProfileSource _profiles;
        private readonly CombatApproachPlanner _approach;
        private readonly IGridTraversalMap _movementMap;
        private readonly ICombatContributionSink _contributions;

        public CombatSimulationService(
            CreatureRegistry creatures,
            ICreatureDefinitionSource definitions,
            IPlayerAttackProfileSource profiles,
            CombatApproachPlanner approach,
            IGridTraversalMap movementMap,
            ICombatContributionSink contributions = null)
        {
            _creatures = creatures ?? throw new ArgumentNullException(nameof(creatures));
            _definitions = definitions ?? throw new ArgumentNullException(nameof(definitions));
            _profiles = profiles ?? throw new ArgumentNullException(nameof(profiles));
            _approach = approach ?? throw new ArgumentNullException(nameof(approach));
            _movementMap = movementMap ?? throw new ArgumentNullException(nameof(movementMap));
            _contributions = contributions;
        }

        public CombatAdvanceResult AdvancePlayerAttack(PlayerState player, long nowUnixMilliseconds, Func<double> random01)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            if (random01 == null) throw new ArgumentNullException(nameof(random01));
            if (!player.Combat.IsActive || !player.Combat.TargetActorId.HasValue)
                return CombatAdvanceResult.State(CombatAdvanceKind.Idle, "not_in_combat");

            var targetId = player.Combat.TargetActorId.Value;
            if (!_creatures.TryGet(targetId, out var creature) || !creature.IsAlive)
            {
                player.Combat.End();
                player.Movement.Clear();
                return CombatAdvanceResult.State(CombatAdvanceKind.TargetLost, "target_unavailable");
            }

            if (!_definitions.TryGet(creature.DefinitionId, out var definition))
            {
                player.Combat.End();
                player.Movement.Clear();
                return CombatAdvanceResult.State(CombatAdvanceKind.Failed, "unknown_creature_definition");
            }

            var profile = _profiles.Resolve(player);
            if (!_approach.IsInAttackPosition(player.Location, creature, definition.Footprint, profile))
            {
                var path = _approach.FindApproach(player, creature, definition, profile);
                if (!path.Success)
                {
                    player.Combat.End();
                    player.Movement.Clear();
                    return CombatAdvanceResult.State(CombatAdvanceKind.Failed, path.Code);
                }

                player.Movement.ReplacePath(path.Steps);
                return CombatAdvanceResult.State(CombatAdvanceKind.Approaching, "approaching_target");
            }

            player.Movement.Clear();
            if (!player.Combat.IsAttackReady(nowUnixMilliseconds))
                return CombatAdvanceResult.State(CombatAdvanceKind.WaitingForCooldown, "attack_cooldown");

            var attackLevel = ResolvePlayerAttackLevel(player);
            var attackBonus = ResolvePlayerAttackBonus(profile);
            var maxHit = ResolvePlayerMaxHit(player, profile);
            var attackRoll = CombatMath.AttackRoll(attackLevel, attackBonus);
            var defenceRoll = CombatMath.DefenceRoll(definition.DefenceLevel, definition.DefenceBonus);
            var hitChance = CombatMath.HitChance(attackRoll, defenceRoll);

            var targetTile = CombatGeometry.ClosestTargetTile(player.Location, creature.Anchor, definition.Footprint);
            if (targetTile.HasValue)
            {
                var attackerElevation = _movementMap.GetLogicalElevation(player.Location);
                var targetElevation = _movementMap.GetLogicalElevation(targetTile.Value);
                hitChance = CombatGeometry.ApplyElevationAccuracyModifier(
                    hitChance,
                    profile.Style,
                    attackerElevation,
                    targetElevation);
            }

            var firstRoll = random01();
            var hit = firstRoll <= hitChance;
            var damage = hit ? (int)Math.Floor(random01() * (maxHit + 1)) : 0;
            if (damage < 0) damage = 0;
            if (damage > creature.CurrentHitpoints) damage = creature.CurrentHitpoints;
            creature.CurrentHitpoints -= damage;
            player.Combat.ScheduleNextAttack(nowUnixMilliseconds, profile.AttackIntervalMilliseconds);

            if (damage > 0)
                _contributions?.Record(new CombatContribution(creature.InstanceId, player.CharacterId, damage, nowUnixMilliseconds));

            if (!creature.IsAlive)
            {
                creature.TargetCharacterId = null;
                player.Combat.End();
                player.Movement.Clear();
                return CombatAdvanceResult.Attack(damage, hitChance, hit, true);
            }

            // Neutral creatures retaliate only after being attacked; aggressive creatures may have
            // already selected the player through their own AI. Passive creatures do not retaliate.
            if (definition.Disposition != CreatureDisposition.Passive)
                creature.TargetCharacterId = player.CharacterId;

            return CombatAdvanceResult.Attack(damage, hitChance, hit, false);
        }

        private static int ResolvePlayerAttackLevel(PlayerState player)
        {
            switch (player.CombatStyle)
            {
                case CombatStyle.Ranged:
                    return player.Skills.GetLevel(SkillId.Ranged);
                case CombatStyle.Magic:
                    return player.Skills.GetLevel(SkillId.Magic);
                default:
                    return player.Skills.GetLevel(SkillId.Attack);
            }
        }

        private static int ResolvePlayerAttackBonus(PlayerAttackProfile profile)
        {
            switch (profile.Style)
            {
                case CombatStyle.Ranged:
                    return profile.RangedAttackBonus;
                case CombatStyle.Magic:
                    return profile.MagicBonus;
                default:
                    return profile.AttackBonus;
            }
        }

        private static int ResolvePlayerMaxHit(PlayerState player, PlayerAttackProfile profile)
        {
            switch (profile.Style)
            {
                case CombatStyle.Ranged:
                    return CombatMath.MaxHitRanged(player.Skills.GetLevel(SkillId.Ranged), profile.RangedStrengthBonus);
                case CombatStyle.Magic:
                    return CombatMath.MaxHitMagic(player.Skills.GetLevel(SkillId.Magic));
                default:
                    return CombatMath.MaxHitMelee(player.Skills.GetLevel(SkillId.Strength), profile.StrengthBonus);
            }
        }
    }
}
