using System;
using System.Collections.Generic;
using MassRPG.Core.Characters;
using MassRPG.Core.Content;
using MassRPG.Core.Skills;
using MassRPG.Data.Effects;

namespace MassRPG.Server.Effects
{
    public readonly struct ActiveStatusEffectView
    {
        public ActiveStatusEffectView(ContentId effectId, long expiresAtUnixMilliseconds, StatusEffectFlags flags)
        {
            EffectId = effectId;
            ExpiresAtUnixMilliseconds = expiresAtUnixMilliseconds;
            Flags = flags;
        }

        public ContentId EffectId { get; }
        public long ExpiresAtUnixMilliseconds { get; }
        public StatusEffectFlags Flags { get; }
    }

    /// <summary>
    /// Server-owned temporary effect state. Permanent skills remain XP-driven; this service only
    /// supplies effective levels while an effect is active. Reapplying the same effect id refreshes
    /// its duration instead of stacking duplicate copies. Distinct effect ids may combine, which
    /// keeps stacking policy explicit in content identity rather than hidden in combat code.
    /// </summary>
    public sealed class StatusEffectService : IEffectiveSkillLevelSource
    {
        private sealed class ActiveEffect
        {
            public ActiveEffect(PotionEffectDefinition definition, long expiresAtUnixMilliseconds)
            {
                Definition = definition;
                ExpiresAtUnixMilliseconds = expiresAtUnixMilliseconds;
            }

            public PotionEffectDefinition Definition { get; }
            public long ExpiresAtUnixMilliseconds { get; }
        }

        private readonly Dictionary<Guid, Dictionary<ContentId, ActiveEffect>> _active =
            new Dictionary<Guid, Dictionary<ContentId, ActiveEffect>>();

        public long Apply(PlayerState player, PotionEffectDefinition definition, long nowUnixMilliseconds)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            if (definition == null) throw new ArgumentNullException(nameof(definition));
            if (!player.IsAlive) throw new InvalidOperationException("Cannot apply a potion effect to a dead character.");

            var expiresAt = checked(nowUnixMilliseconds + definition.DurationMilliseconds);
            var state = GetOrCreate(player.CharacterId);
            state[definition.EffectId] = new ActiveEffect(definition, expiresAt);
            return expiresAt;
        }

        public int GetEffectiveLevel(PlayerState player, SkillId skill, long nowUnixMilliseconds)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            var level = player.Skills.GetLevel(skill);
            if (!_active.TryGetValue(player.CharacterId, out var state)) return level;

            RemoveExpired(state, nowUnixMilliseconds);
            foreach (var effect in state.Values)
            {
                var modifiers = effect.Definition.SkillModifiers;
                for (var i = 0; i < modifiers.Count; i++)
                {
                    var modifier = modifiers[i];
                    if (modifier.Skill == skill) level = checked(level + modifier.FlatLevels);
                }
            }

            return Math.Max(1, Math.Min(SkillProgression.MaxLevel, level));
        }

        public bool HasFlag(PlayerState player, StatusEffectFlags flag, long nowUnixMilliseconds)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            if (flag == StatusEffectFlags.None) return false;
            if (!_active.TryGetValue(player.CharacterId, out var state)) return false;

            RemoveExpired(state, nowUnixMilliseconds);
            foreach (var effect in state.Values)
                if ((effect.Definition.Flags & flag) == flag) return true;
            return false;
        }

        public IReadOnlyList<ActiveStatusEffectView> GetActiveEffects(PlayerState player, long nowUnixMilliseconds)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            if (!_active.TryGetValue(player.CharacterId, out var state))
                return Array.Empty<ActiveStatusEffectView>();

            RemoveExpired(state, nowUnixMilliseconds);
            var result = new List<ActiveStatusEffectView>(state.Count);
            foreach (var effect in state.Values)
            {
                result.Add(new ActiveStatusEffectView(
                    effect.Definition.EffectId,
                    effect.ExpiresAtUnixMilliseconds,
                    effect.Definition.Flags));
            }
            result.Sort((left, right) => string.CompareOrdinal(left.EffectId.Value, right.EffectId.Value));
            return result;
        }

        public bool Remove(PlayerState player, ContentId effectId)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            return _active.TryGetValue(player.CharacterId, out var state) && state.Remove(effectId);
        }

        public void Clear(PlayerState player)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            _active.Remove(player.CharacterId);
        }

        private Dictionary<ContentId, ActiveEffect> GetOrCreate(Guid characterId)
        {
            if (!_active.TryGetValue(characterId, out var state))
            {
                state = new Dictionary<ContentId, ActiveEffect>();
                _active.Add(characterId, state);
            }
            return state;
        }

        private static void RemoveExpired(Dictionary<ContentId, ActiveEffect> state, long nowUnixMilliseconds)
        {
            if (state.Count == 0) return;
            var expired = new List<ContentId>();
            foreach (var pair in state)
                if (nowUnixMilliseconds >= pair.Value.ExpiresAtUnixMilliseconds) expired.Add(pair.Key);
            for (var i = 0; i < expired.Count; i++) state.Remove(expired[i]);
        }
    }
}
