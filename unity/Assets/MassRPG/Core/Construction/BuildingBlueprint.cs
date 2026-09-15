using System;
using System.Collections.Generic;
using MassRPG.Core.Content;
using MassRPG.Core.World;

namespace MassRPG.Core.Construction
{
    /// <summary>
    /// Relative modular building arrangement saved by a player. A blueprint stores no plot/world
    /// ownership and can therefore be reused, shared or later represented as a marketable item.
    /// </summary>
    public sealed class BuildingBlueprint
    {
        private readonly List<BlueprintPiece> _pieces;

        public BuildingBlueprint(Guid blueprintId, Guid authorCharacterId, string name, IEnumerable<BlueprintPiece> pieces)
        {
            if (blueprintId == Guid.Empty) throw new ArgumentException("Blueprint id cannot be empty.", nameof(blueprintId));
            if (authorCharacterId == Guid.Empty) throw new ArgumentException("Author id cannot be empty.", nameof(authorCharacterId));
            if (pieces == null) throw new ArgumentNullException(nameof(pieces));
            BlueprintId = blueprintId;
            AuthorCharacterId = authorCharacterId;
            Name = string.IsNullOrWhiteSpace(name) ? "Building blueprint" : name;
            _pieces = new List<BlueprintPiece>(pieces);
            if (_pieces.Count == 0) throw new ArgumentException("A building blueprint must contain at least one piece.", nameof(pieces));
        }

        public Guid BlueprintId { get; }
        public Guid AuthorCharacterId { get; }
        public string Name { get; set; }
        public IReadOnlyList<BlueprintPiece> Pieces => _pieces;
    }

    public readonly struct BlueprintPiece
    {
        public BlueprintPiece(
            ContentId definitionId,
            int offsetX,
            int offsetY,
            int storeyOffset = 0,
            CardinalEdgeMask edge = CardinalEdgeMask.None,
            int rotationQuarterTurns = 0)
        {
            if (definitionId.IsEmpty) throw new ArgumentException("Build piece definition id cannot be empty.", nameof(definitionId));
            if (storeyOffset < 0 || storeyOffset > 2) throw new ArgumentOutOfRangeException(nameof(storeyOffset));
            DefinitionId = definitionId;
            OffsetX = offsetX;
            OffsetY = offsetY;
            StoreyOffset = storeyOffset;
            Edge = edge;
            RotationQuarterTurns = NormalizeRotation(rotationQuarterTurns);
        }

        public ContentId DefinitionId { get; }
        public int OffsetX { get; }
        public int OffsetY { get; }
        public int StoreyOffset { get; }
        public CardinalEdgeMask Edge { get; }
        public int RotationQuarterTurns { get; }

        public GridLocation Resolve(GridLocation origin)
            => new GridLocation(
                new GridCoord(origin.Tile.X + OffsetX, origin.Tile.Y + OffsetY),
                origin.Plane,
                origin.Storey + StoreyOffset);

        private static int NormalizeRotation(int quarterTurns)
        {
            var value = quarterTurns % 4;
            return value < 0 ? value + 4 : value;
        }
    }
}
