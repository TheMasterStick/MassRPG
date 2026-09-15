using System;
using MassRPG.Core.Characters;
using MassRPG.Core.Content;
using MassRPG.Core.Inventory;
using MassRPG.Core.World;
using MassRPG.Data.Recipes;

namespace MassRPG.Server.Production
{
    public interface IProductionStationSource
    {
        bool IsStationAt(ContentId stationId, GridLocation location);
    }

    public enum ProductionAdvanceKind
    {
        Idle,
        Waiting,
        CompletedOne,
        CompletedAll,
        Cancelled,
        Failed
    }

    public readonly struct ProductionResult
    {
        private ProductionResult(bool success, ProductionAdvanceKind kind, string code, int completedQuantity)
        {
            Success = success;
            Kind = kind;
            Code = code ?? string.Empty;
            CompletedQuantity = completedQuantity;
        }

        public bool Success { get; }
        public ProductionAdvanceKind Kind { get; }
        public string Code { get; }
        public int CompletedQuantity { get; }

        public static ProductionResult Ok(ProductionAdvanceKind kind, int completedQuantity = 0)
            => new ProductionResult(true, kind, "ok", completedQuantity);

        public static ProductionResult Fail(string code, ProductionAdvanceKind kind = ProductionAdvanceKind.Failed)
            => new ProductionResult(false, kind, code, 0);
    }

    /// <summary>
    /// Server-owned recipe execution. Recipe definitions, station IDs and item IDs are published
    /// data; timing, material consumption, outputs and XP are validated by authority.
    /// </summary>
    public sealed class ProductionService
    {
        private readonly IRecipeDefinitionSource _recipes;
        private readonly IItemRuleSource _items;
        private readonly IProductionStationSource _stations;

        public ProductionService(
            IRecipeDefinitionSource recipes,
            IItemRuleSource items,
            IProductionStationSource stations = null)
        {
            _recipes = recipes ?? throw new ArgumentNullException(nameof(recipes));
            _items = items ?? throw new ArgumentNullException(nameof(items));
            _stations = stations;
        }

        public ProductionResult TryStart(
            PlayerState player,
            ContentId recipeId,
            int quantity,
            GridLocation? stationLocation,
            long nowUnixMilliseconds)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            if (quantity < 1) return ProductionResult.Fail("invalid_quantity");
            if (player.Combat.IsActive) return ProductionResult.Fail("in_combat");
            if (player.Production.IsActive) return ProductionResult.Fail("already_producing");
            if (!_recipes.TryGet(recipeId, out var recipe)) return ProductionResult.Fail("unknown_recipe");
            if (player.Skills.GetLevel(recipe.Skill) < recipe.LevelRequired) return ProductionResult.Fail("skill_requirement");
            if (!HasInputs(player, recipe)) return ProductionResult.Fail("missing_ingredients");
            if (!HasRequiredTool(player, recipe)) return ProductionResult.Fail("missing_tool");
            if (!ValidateStation(player, recipe, stationLocation)) return ProductionResult.Fail("invalid_station");
            if (!CanReceiveOutput(player, recipe)) return ProductionResult.Fail("inventory_full");

            player.Movement.Clear();
            player.Production.Begin(
                recipe.Id,
                quantity,
                checked(nowUnixMilliseconds + recipe.DurationMilliseconds),
                stationLocation);
            return ProductionResult.Ok(ProductionAdvanceKind.Waiting);
        }

        public ProductionResult Advance(PlayerState player, long nowUnixMilliseconds)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            if (!player.Production.IsActive) return ProductionResult.Ok(ProductionAdvanceKind.Idle);
            if (nowUnixMilliseconds < player.Production.NextCompletionAtUnixMilliseconds)
                return ProductionResult.Ok(ProductionAdvanceKind.Waiting);

            if (!_recipes.TryGet(player.Production.RecipeId, out var recipe))
            {
                player.Production.Clear();
                return ProductionResult.Fail("unknown_recipe", ProductionAdvanceKind.Cancelled);
            }

            if (player.Combat.IsActive)
            {
                player.Production.Clear();
                return ProductionResult.Fail("interrupted_by_combat", ProductionAdvanceKind.Cancelled);
            }

            if (!ValidateStation(player, recipe, player.Production.StationLocation))
            {
                player.Production.Clear();
                return ProductionResult.Fail("left_station", ProductionAdvanceKind.Cancelled);
            }

            if (!HasInputs(player, recipe))
            {
                player.Production.Clear();
                return ProductionResult.Fail("missing_ingredients", ProductionAdvanceKind.Cancelled);
            }

            if (!HasRequiredTool(player, recipe))
            {
                player.Production.Clear();
                return ProductionResult.Fail("missing_tool", ProductionAdvanceKind.Cancelled);
            }

            if (!CanReceiveOutput(player, recipe))
            {
                player.Production.Clear();
                return ProductionResult.Fail("inventory_full", ProductionAdvanceKind.Cancelled);
            }

            for (var i = 0; i < recipe.Inputs.Count; i++)
            {
                var input = recipe.Inputs[i];
                if (!InventoryRules.RemoveItem(player.Inventory, input.ItemId, input.Quantity))
                    throw new InvalidOperationException("Production input validation changed during atomic recipe execution.");
            }

            var added = InventoryRules.AddItem(player.Inventory, _items, recipe.OutputItemId, recipe.OutputQuantity);
            if (added != recipe.OutputQuantity)
                throw new InvalidOperationException("Production output capacity validation changed during atomic recipe execution.");

            player.Skills.AddXp(recipe.Skill, recipe.Xp);
            var finishing = player.Production.RemainingQuantity <= 1;
            player.Production.CompleteOne(checked(nowUnixMilliseconds + recipe.DurationMilliseconds));
            return ProductionResult.Ok(
                finishing ? ProductionAdvanceKind.CompletedAll : ProductionAdvanceKind.CompletedOne,
                1);
        }

        public void Cancel(PlayerState player)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            player.Production.Clear();
        }

        private bool ValidateStation(PlayerState player, RecipeDefinition recipe, GridLocation? location)
        {
            if (!recipe.StationId.HasValue) return true;
            if (!location.HasValue || _stations == null) return false;
            if (!player.Location.SameLayer(location.Value)) return false;
            if (GridMath.RangeDistance(player.Location.Tile, location.Value.Tile) > 1) return false;
            return _stations.IsStationAt(recipe.StationId.Value, location.Value);
        }

        private static bool HasInputs(PlayerState player, RecipeDefinition recipe)
        {
            for (var i = 0; i < recipe.Inputs.Count; i++)
            {
                var input = recipe.Inputs[i];
                if (player.Inventory.CountItem(input.ItemId) < input.Quantity) return false;
            }
            return true;
        }

        private static bool HasRequiredTool(PlayerState player, RecipeDefinition recipe)
        {
            if (!recipe.ToolRequiredId.HasValue) return true;
            var tool = recipe.ToolRequiredId.Value;
            if (player.Inventory.CountItem(tool) > 0) return true;
            foreach (var equipped in player.Equipment.EquippedItems)
                if (equipped.Value == tool) return true;
            return false;
        }

        private bool CanReceiveOutput(PlayerState player, RecipeDefinition recipe)
        {
            if (!_items.TryGetRule(recipe.OutputItemId, out var outputRule)) return false;
            if (outputRule.Stackable)
            {
                if (player.Inventory.CountItem(recipe.OutputItemId) > 0) return true;
                return player.Inventory.EmptySlotCount > 0;
            }
            return player.Inventory.EmptySlotCount >= recipe.OutputQuantity;
        }
    }
}
