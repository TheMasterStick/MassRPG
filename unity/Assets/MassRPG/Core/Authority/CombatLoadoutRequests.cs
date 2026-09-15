using System;
using MassRPG.Core.Content;

namespace MassRPG.Core.Authority
{
    public sealed class SelectRangedAmmunitionRequest : GameRequest
    {
        public SelectRangedAmmunitionRequest(Guid requestId, Guid characterId, ContentId ammunitionItemId)
            : base(requestId, characterId)
        {
            if (ammunitionItemId.IsEmpty) throw new ArgumentException("Ammunition item id cannot be empty.", nameof(ammunitionItemId));
            AmmunitionItemId = ammunitionItemId;
        }

        public ContentId AmmunitionItemId { get; }
    }

    public sealed class ClearRangedAmmunitionRequest : GameRequest
    {
        public ClearRangedAmmunitionRequest(Guid requestId, Guid characterId)
            : base(requestId, characterId)
        {
        }
    }
}
