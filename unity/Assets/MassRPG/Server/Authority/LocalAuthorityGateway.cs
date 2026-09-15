using System;
using MassRPG.Core.Authority;
using MassRPG.Server.Combat;
using MassRPG.Server.Items;
using MassRPG.Server.Travel;

namespace MassRPG.Server.Authority
{
    /// <summary>
    /// Composition layer for migrated systems that were added after the original LocalGameAuthority
    /// request switch. Unity should bind its gameplay input to this IGameAuthority gateway rather
    /// than mutating travel/ammunition/potion state directly. The inner authority remains the
    /// simulation host for movement, combat, skilling, inventory and economy while this gateway
    /// intercepts newer request families. The same split can later become network command routing.
    /// </summary>
    public sealed class LocalAuthorityGateway : IGameAuthority
    {
        private readonly LocalGameAuthority _inner;
        private readonly FastTravelService _fastTravel;
        private readonly FastTravelStateRegistry _travelStates;
        private readonly RangedAmmunitionService _ammunition;
        private readonly PotionConsumptionService _potions;

        public LocalAuthorityGateway(
            LocalGameAuthority inner,
            FastTravelService fastTravel = null,
            FastTravelStateRegistry travelStates = null,
            RangedAmmunitionService ammunition = null,
            PotionConsumptionService potions = null)
        {
            _inner = inner ?? throw new ArgumentNullException(nameof(inner));
            _fastTravel = fastTravel;
            _travelStates = travelStates;
            _ammunition = ammunition;
            _potions = potions;
        }

        public LocalGameAuthority Inner => _inner;

        public AuthorityDecision Submit(GameRequest request)
            => Submit(request, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

        public AuthorityDecision Submit(GameRequest request, long nowUnixMilliseconds)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));
            if (!_inner.TryGetPlayer(request.CharacterId, out var player))
                return AuthorityDecision.Reject(request.RequestId, "unknown_character", "The character is not registered with this authority.");

            if (request is SelectRangedAmmunitionRequest selectAmmo)
            {
                if (_ammunition == null)
                    return AuthorityDecision.Reject(request.RequestId, "ammunition_unavailable", "Ranged ammunition is not initialized.");
                var result = _ammunition.Select(player, selectAmmo.AmmunitionItemId);
                return result.Success
                    ? AuthorityDecision.Accept(request.RequestId)
                    : AuthorityDecision.Reject(request.RequestId, result.Code, "The requested ammunition could not be selected.");
            }

            if (request is ClearRangedAmmunitionRequest)
            {
                if (_ammunition == null)
                    return AuthorityDecision.Reject(request.RequestId, "ammunition_unavailable", "Ranged ammunition is not initialized.");
                _ammunition.ClearSelection(player);
                return AuthorityDecision.Accept(request.RequestId);
            }

            if (request is DrinkPotionRequest drinkPotion)
            {
                if (_potions == null)
                    return AuthorityDecision.Reject(request.RequestId, "potions_unavailable", "Potion consumption is not initialized.");
                var result = _potions.Drink(player, drinkPotion.InventorySlot, nowUnixMilliseconds);
                if (!result.Success)
                    return AuthorityDecision.Reject(request.RequestId, result.Code, "The requested potion could not be consumed.");

                EndArrivalProtectionIfNeeded(request);
                return AuthorityDecision.Accept(request.RequestId);
            }

            if (request is ActivateFastTravelNodeRequest activate)
            {
                if (_fastTravel == null)
                    return AuthorityDecision.Reject(request.RequestId, "fast_travel_unavailable", "Fast travel is not initialized.");
                return FromTravel(request.RequestId, _fastTravel.ActivateCurrentNode(player, activate.NodeId));
            }

            if (request is OpenFastTravelMapRequest open)
            {
                if (_fastTravel == null)
                    return AuthorityDecision.Reject(request.RequestId, "fast_travel_unavailable", "Fast travel is not initialized.");
                return FromTravel(request.RequestId, _fastTravel.OpenDestinationMap(player, open.OriginNodeId, nowUnixMilliseconds));
            }

            if (request is CommitFastTravelRequest commit)
            {
                if (_fastTravel == null)
                    return AuthorityDecision.Reject(request.RequestId, "fast_travel_unavailable", "Fast travel is not initialized.");
                return FromTravel(request.RequestId, _fastTravel.CommitTravel(player, commit.DestinationNodeId, nowUnixMilliseconds));
            }

            var decision = _inner.Submit(request, nowUnixMilliseconds);
            if (decision.Accepted) EndArrivalProtectionIfNeeded(request);
            return decision;
        }

        private void EndArrivalProtectionIfNeeded(GameRequest request)
        {
            if (_travelStates != null && EndsArrivalProtection(request))
                _travelStates.GetOrCreate(request.CharacterId).ClearArrivalProtection();
        }

        private static AuthorityDecision FromTravel(Guid requestId, FastTravelResult result)
            => result.Success
                ? AuthorityDecision.Accept(requestId)
                : AuthorityDecision.Reject(requestId, result.Code, "Fast travel request was rejected by the authority.");

        private static bool EndsArrivalProtection(GameRequest request)
        {
            return request is MoveToRequest
                || request is AttackCreatureRequest
                || request is GatherResourceRequest
                || request is StartProductionRequest
                || request is PlantCropRequest
                || request is HarvestCropRequest
                || request is LightFireRequest
                || request is EatFoodRequest
                || request is DrinkPotionRequest
                || request is DropInventoryItemRequest
                || request is TakeGroundItemRequest
                || request is DepositBankItemRequest
                || request is WithdrawBankItemRequest
                || request is BuyShopItemRequest
                || request is SellShopItemRequest;
        }
    }
}
