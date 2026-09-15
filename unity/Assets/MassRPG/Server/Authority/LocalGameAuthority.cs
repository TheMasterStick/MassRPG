using System;
using System.Collections.Generic;
using MassRPG.Core.Authority;
using MassRPG.Core.Characters;
using MassRPG.Core.Inventory;

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

        public LocalGameAuthority(IItemRuleSource itemRules)
        {
            _itemRules = itemRules ?? throw new ArgumentNullException(nameof(itemRules));
        }

        public void RegisterPlayer(PlayerState player)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            _players[player.CharacterId] = player;
        }

        public bool TryGetPlayer(Guid characterId, out PlayerState player) => _players.TryGetValue(characterId, out player);

        public AuthorityDecision Submit(GameRequest request)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));
            if (!_players.TryGetValue(request.CharacterId, out var player))
                return AuthorityDecision.Reject(request.RequestId, "unknown_character", "The character is not registered with this authority.");

            if (request is MoveInventorySlotRequest move)
                return FromInventoryResult(request.RequestId, InventoryRules.MoveSlot(player.Inventory, _itemRules, move.FromIndex, move.ToIndex));

            if (request is EquipInventoryItemRequest equip)
                return FromInventoryResult(request.RequestId,
                    InventoryRules.EquipFromInventory(player.Inventory, player.Equipment, _itemRules, equip.InventoryIndex, equip.RequestedSlot));

            if (request is UnequipItemRequest unequip)
                return FromInventoryResult(request.RequestId,
                    InventoryRules.Unequip(player.Inventory, player.Equipment, _itemRules, unequip.Slot));

            return AuthorityDecision.Reject(request.RequestId, "unsupported_request", "This request type is not implemented by the local authority yet.");
        }

        private static AuthorityDecision FromInventoryResult(Guid requestId, InventoryOperationResult result)
        {
            return result.Success
                ? AuthorityDecision.Accept(requestId)
                : AuthorityDecision.Reject(requestId, result.Code, result.Message);
        }
    }
}
