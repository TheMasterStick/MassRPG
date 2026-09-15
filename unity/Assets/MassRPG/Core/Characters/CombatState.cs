using System;

namespace MassRPG.Core.Characters
{
    /// <summary>
    /// Minimal authoritative combat engagement state. The full combat loop will expand this, but
    /// equipment-lock and travel rules can already depend on one shared source of truth.
    /// </summary>
    public sealed class CombatState
    {
        public bool IsActive { get; private set; }
        public Guid? TargetActorId { get; private set; }

        public void Begin(Guid? targetActorId = null)
        {
            IsActive = true;
            TargetActorId = targetActorId;
        }

        public void End()
        {
            IsActive = false;
            TargetActorId = null;
        }
    }
}
