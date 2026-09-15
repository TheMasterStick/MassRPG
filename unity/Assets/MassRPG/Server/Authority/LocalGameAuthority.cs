using System;
using System.Collections.Generic;
using MassRPG.Core.Authority;
using MassRPG.Core.Characters;
using MassRPG.Core.Inventory;
using MassRPG.Core.World;
using MassRPG.Server.Resources;

namespace MassRPG.Server.Authority
{
    /// <summary>
    /// First authoritative simulation host. Runs locally/in-process now, but the Unity client
    /// must still submit requests instead of mutating player state directly.
    /// </summary>
    public sealed class LocalGameAuthority : IGameAuthority
    {
        private readonly Dictionary<Guid, PlayerState> _players = new Dictionary<Guid, PlayerState>();
        private readonly IItemRuleSource _itemRules;
        private readonly IGridTraversalMap _movementMap;
        private readonly GatheringService _gathering;

        public LocalGameAuthority(
            IItemRuleSource itemRules,
            IGridTraversalMap movementMap = null,
            GatheringService gathering = null)
        {
            _itemRules = itemRules ?? throw new ArgumentNullException(nameof(itemRules));
            _movementMap = movementMap;
            _gathering = gathering;
        }

        public void RegisterPlayer(PlayerState player)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            _players[player.CharacterId] = player;
        }

        public bool TryGetPlayer(Guid characterId, out PlayerState player) => _players.TryGetValue(characterId, out player);

        public AuthorityDecision Submit(GameRequest request)
            => Submit(request, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

        public AuthorityDecision Submit(GameRequest request, long nowUnixMilliseconds)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));
            if (!_players.TryGetValue(request.CharacterId, out var player))
                return AuthorityDecision.Reject(request.RequestId, "unknown_character", "The character is not registered with this authority.");

            if (request is MoveInventorySlotRequest move)
                return FromInventoryResult(request.RequestId, InventoryRules.MoveSlot(player.Inventory, _itemRules, move.FromIndex, move.ToIndex));

            if (request is EquipInventoryItemRequest equip)
                return FromInventoryResult(request.RequestId,
                    InventoryRules.EquipFromInventory(player.Inventory, player.Equipment, _itemRules, player.Skills, equip.InventoryIndex, equip.RequestedSlot));

            if (request is UnequipItemRequest unequip)
                return FromInventoryResult(request.RequestId,
                    InventoryRules.Unequip(player.Inventory, player.Equipment, _itemRules, unequip.Slot));

            if (request is MoveToRequest moveTo)
                return HandleMoveTo(request.RequestId, player, moveTo.Destination);

            if (request is CancelMovementRequest)
            {
                player.Movement.Clear();
                return AuthorityDecision.Accept(request.RequestId);
            }

            if (request is GatherResourceRequest gather)
            {
                if (_gathering == null)
                    return AuthorityDecision.Reject(request.RequestId, "gathering_unavailable", "Gathering is not initialized.");
                return FromGatheringResult(request.RequestId, _gathering.TryGather(player, gather.Node, nowUnixMilliseconds));
            }

            return AuthorityDecision.Reject(request.RequestId, "unsupported_request", "This request type is not implemented by the local authority yet.");
        }

        public bool AdvanceMovementOneStep(Guid characterId)
        {
            if (_movementMap == null) return false;
            if (!_players.TryGetValue(characterId, out var player)) return false;
            if (!player.Movement.TryPeekNext(out var next)) return false;

            if (!GridTraversal.CanStep(_movementMap, player.Location, next))
            {
                player.Movement.Clear();
                return false;
            }

            player.Movement.TryConsumeNext(out next);
            player.Location = next;
            return true;
        }

        public int AdvanceAllMovementOneStep()
        {
            var moved = 0;
            foreach (var player in _players.Values)
                if (AdvanceMovementOneStep(player.CharacterId)) moved++;
            return moved;
        }

        private AuthorityDecision HandleMoveTo(Guid requestId, PlayerState player, GridLocation destination)
        {
            if (_movementMap == null)
                return AuthorityDecision.Reject(requestId, "movement_unavailable", "No authoritative movement map is loaded.");
            if (!WorldConstants.IsInsideWorld(destination.Tile))
                return AuthorityDecision.Reject(requestId, "out_of_bounds", "The requested destination is outside the world.");
            if (!player.Location.SameLayer(destination))
                return AuthorityDecision.Reject(requestId, "transition_required", "Changing plane or building floor requires an explicit traversal connection.");

            var path = GridPathfinder.FindPath(_movementMap, player.Location, destination);
            if (!path.Success)
                return AuthorityDecision.Reject(requestId, path.Code, "No valid local path could be found to that destination.");

            player.Movement.ReplacePath(path.Steps);
            return AuthorityDecision.Accept(requestId);
        }

        private static AuthorityDecision FromInventoryResult(Guid requestId, InventoryOperationResult result)
        {
            return result.Success
                ? AuthorityDecision.Accept(requestId)
                : AuthorityDecision.Reject(requestId, result.Code, result.Message);
        }

        private static AuthorityDecision FromGatheringResult(Guid requestId, GatheringResult result)
        {
            return result.Success
                ? AuthorityDecision.Accept(requestId)
                : AuthorityDecision.Reject(requestId, result.Code, result.Message);
        }
    }
}
