using System;
using MassRPG.Core.Characters;
using MassRPG.Core.Combat;
using MassRPG.Core.Inventory;
using MassRPG.Core.Skills;
using MassRPG.Core.World;
using MassRPG.Server.Combat;

namespace MassRPG.Server.Pvp
{
    public enum PvpAttackKind
    {
        Failed,
        OutOfRange,
        WaitingForCooldown,
        Attacked,
        TargetKilled
    }

    public readonly struct PvpAttackResult
    {
        public PvpAttackResult(PvpAttackKind kind, string code, int damage = 0, bool hit = false, double hitChance = 0.0)
        {
            Kind = kind;
            Code = code;
            Damage = damage;
            Hit = hit;
            HitChance = hitChance;
        }

        public PvpAttackKind Kind { get; }
        public string Code { get; }
        public int Damage { get; }
        public bool Hit { get; }
        public double HitChance { get; }
        public bool DidAttack => Kind == PvpAttackKind.Attacked || Kind == PvpAttackKind.TargetKilled;
    }

    /// <summary>
    /// Authoritative player-versus-player autoattack resolution. PvP eligibility is checked on every
    /// attack attempt so entering a protected area or changing voluntary flags takes effect without
    /// trusting stale client state. Range/LOS/elevation use the same logical combat geometry as PvE.
    /// </summary>
    public sealed class PvpCombatService
    {
        private readonly PvpService _pvp;
        private readonly IPlayerAttackProfileSource _profiles;
        private readonly IGridTraversalMap _movementMap;
        private readonly IRangedLineOfSightMap _lineOfSight;
        private readonly RangedAmmunitionService _ammunition;

        public PvpCombatService(
            PvpService pvp,
            IPlayerAttackProfileSource profiles,
            IGridTraversalMap movementMap,
            IRangedLineOfSightMap lineOfSight,
            RangedAmmunitionService ammunition = null)
        {
            _pvp = pvp ?? throw new ArgumentNullException(nameof(pvp));
            _profiles = profiles ?? throw new ArgumentNullException(nameof(profiles));
            _movementMap = movementMap ?? throw new ArgumentNullException(nameof(movementMap));
            _lineOfSight = lineOfSight ?? throw new ArgumentNullException(nameof(lineOfSight));
            _ammunition = ammunition;
        }

        public PvpAttackResult TryAttack(
            PlayerState attacker,
            PlayerState defender,
            long nowUnixMilliseconds,
            Func<double> random01)
        {
            if (attacker == null || defender == null) return new PvpAttackResult(PvpAttackKind.Failed, "player_missing");
            if (random01 == null) throw new ArgumentNullException(nameof(random01));
            var eligibility = _pvp.EvaluateAttack(attacker, defender);
            if (!eligibility.Allowed) return new PvpAttackResult(PvpAttackKind.Failed, eligibility.Code);

            var attack = _profiles.Resolve(attacker);
            var defence = _profiles.Resolve(defender);
            if (!CanAttackFromCurrentPosition(attacker, defender, attack))
                return new PvpAttackResult(PvpAttackKind.OutOfRange, "out_of_range_or_los");
            if (nowUnixMilliseconds < attacker.Combat.NextAttackAtUnixMilliseconds)
                return new PvpAttackResult(PvpAttackKind.WaitingForCooldown, "attack_cooldown");

            if (attack.Style == CombatStyle.Ranged)
            {
                if (_ammunition == null) return new PvpAttackResult(PvpAttackKind.Failed, "ammunition_unavailable");
                if (!attacker.Equipment.TryGet(EquipmentSlot.MainHand, out _))
                    return new PvpAttackResult(PvpAttackKind.Failed, "ranged_weapon_missing");
                if (!attacker.SelectedAmmunitionItemId.HasValue || attacker.Inventory.CountItem(attacker.SelectedAmmunitionItemId.Value) <= 0)
                    return new PvpAttackResult(PvpAttackKind.Failed, "ranged_ammunition_missing");
            }

            var attackLevel = ResolveAttackLevel(attacker, attack.Style);
            var attackBonus = ResolveAttackBonus(attack);
            var defenceRoll = CombatMath.DefenceRoll(defender.Skills.GetLevel(SkillId.Defence), defence.DefenceBonus);
            var attackRoll = CombatMath.AttackRoll(attackLevel, attackBonus);
            var hitChance = CombatMath.HitChance(attackRoll, defenceRoll);
            hitChance = CombatGeometry.ApplyElevationAccuracyModifier(
                hitChance,
                attack.Style,
                _movementMap.GetLogicalElevation(attacker.Location),
                _movementMap.GetLogicalElevation(defender.Location));

            var hit = random01() <= hitChance;
            var damage = hit ? (int)Math.Floor(random01() * (ResolveMaxHit(attacker, attack) + 1)) : 0;
            damage = Math.Max(0, Math.Min(damage, defender.CurrentHitpoints));

            if (attack.Style == CombatStyle.Ranged)
            {
                var ammoResult = _ammunition.ConsumeOneForAttack(attacker);
                if (!ammoResult.Success) return new PvpAttackResult(PvpAttackKind.Failed, ammoResult.Code);
            }

            attacker.Combat.NextAttackAtUnixMilliseconds = checked(nowUnixMilliseconds + attack.AttackIntervalMilliseconds);
            _pvp.MarkAggressor(attacker, defender, nowUnixMilliseconds);
            defender.CurrentHitpoints -= damage;

            if (!defender.IsAlive)
            {
                defender.Combat.End();
                defender.Movement.Clear();
                defender.Production.Clear();
                return new PvpAttackResult(PvpAttackKind.TargetKilled, "target_killed", damage, hit, hitChance);
            }

            return new PvpAttackResult(PvpAttackKind.Attacked, "attack_resolved", damage, hit, hitChance);
        }

        private bool CanAttackFromCurrentPosition(PlayerState attacker, PlayerState defender, PlayerAttackProfile profile)
        {
            if (profile.Style == CombatStyle.Melee)
                return CombatGeometry.CanMelee(_movementMap, attacker.Location, defender.Location);
            return CombatGeometry.CanRangedOrMagic(_lineOfSight, attacker.Location, defender.Location, profile.RangeTiles);
        }

        private static int ResolveAttackLevel(PlayerState attacker, CombatStyle style)
        {
            switch (style)
            {
                case CombatStyle.Ranged: return attacker.Skills.GetLevel(SkillId.Ranged);
                case CombatStyle.Magic: return attacker.Skills.GetLevel(SkillId.Magic);
                default: return attacker.Skills.GetLevel(SkillId.Attack);
            }
        }

        private static int ResolveAttackBonus(PlayerAttackProfile profile)
        {
            switch (profile.Style)
            {
                case CombatStyle.Ranged: return profile.RangedAttackBonus;
                case CombatStyle.Magic: return profile.MagicBonus;
                default: return profile.AttackBonus;
            }
        }

        private static int ResolveMaxHit(PlayerState attacker, PlayerAttackProfile profile)
        {
            switch (profile.Style)
            {
                case CombatStyle.Ranged:
                    return CombatMath.MaxHitRanged(attacker.Skills.GetLevel(SkillId.Ranged), profile.RangedStrengthBonus);
                case CombatStyle.Magic:
                    return CombatMath.MaxHitMagic(attacker.Skills.GetLevel(SkillId.Magic));
                default:
                    return CombatMath.MaxHitMelee(attacker.Skills.GetLevel(SkillId.Strength), profile.StrengthBonus);
            }
        }
    }
}
