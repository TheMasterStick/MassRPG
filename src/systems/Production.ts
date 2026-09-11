import type { Player } from '../entities/Player';
import type { World } from '../world/World';
import { RECIPES, getRecipe, type Recipe, type StationRequirement } from '../data/recipes';
import { getItem, TREE_TIERS } from '../data/items';
import { addItem, removeItem } from './Inventory';
import { addXp } from './Skills';
import { log } from '../core/EventBus';
import { isSameOrAdjacent } from './Pathfinding';
import { firemakingXp } from '../data/recipes';
import { PLAYER_CAMPFIRE_LIFETIME_TICKS } from '../core/constants';

export interface RecipeAvailability {
  recipe: Recipe;
  unlocked: boolean;
  hasIngredients: boolean;
  missing: string[];
}

function stationMatches(station: StationRequirement, actual: string | undefined): boolean {
  if (station === 'fire') return actual === 'campfire' || actual === 'cooking_range';
  return station === actual;
}

export function recipeUsesItem(recipe: Recipe, itemId: string): boolean {
  return recipe.toolRequired === itemId || recipe.inputs.some((input) => input.item === itemId);
}

export function recipesForPlayerAt(player: Player, world: World, x: number, y: number): RecipeAvailability[] {
  const structure = world.getStructure(x, y);
  const list = RECIPES.filter((r) => stationMatches(r.station, structure));
  return list.map((recipe) => describe(player, recipe));
}

export function recipesForItemAt(player: Player, world: World, x: number, y: number, itemId: string): RecipeAvailability[] {
  return recipesForPlayerAt(player, world, x, y).filter((entry) => recipeUsesItem(entry.recipe, itemId));
}

export function inventoryRecipes(player: Player, category: string): RecipeAvailability[] {
  return RECIPES.filter((r) => r.station === 'none' && r.category === category).map((r) => describe(player, r));
}

export function inventoryRecipesForItems(player: Player, itemIds: string[]): RecipeAvailability[] {
  const required = [...new Set(itemIds)];
  return RECIPES
    .filter((recipe) => recipe.station === 'none' && required.every((itemId) => recipeUsesItem(recipe, itemId)))
    .map((recipe) => describe(player, recipe));
}

function describe(player: Player, recipe: Recipe): RecipeAvailability {
  const missing: string[] = [];
  for (const input of recipe.inputs) {
    if (!player.hasItem(input.item, input.qty)) missing.push(`${input.qty}x ${getItem(input.item).name}`);
  }
  if (recipe.toolRequired && !player.hasItem(recipe.toolRequired) && player.equipment.weapon !== recipe.toolRequired) {
    missing.push(getItem(recipe.toolRequired).name);
  }
  return {
    recipe,
    unlocked: player.level(recipe.skill) >= recipe.levelRequired,
    hasIngredients: missing.length === 0,
    missing,
  };
}

export function startProduction(player: Player, world: World, recipeId: string, quantity: number, stationX: number, stationY: number) {
  const recipe = getRecipe(recipeId);
  const avail = describe(player, recipe);
  if (!avail.unlocked) { log(`You need ${recipe.skill} level ${recipe.levelRequired} for this.`, 'warning'); return; }
  if (!avail.hasIngredients) { log(`You're missing: ${avail.missing.join(', ')}.`, 'warning'); return; }
  if (recipe.station !== 'none') {
    const structure = world.getStructure(stationX, stationY);
    if (!stationMatches(recipe.station, structure)) { log(`You need to be at the right station.`, 'warning'); return; }
    if (!isSameOrAdjacent({ x: Math.round(player.x), y: Math.round(player.y) }, { x: stationX, y: stationY })) { log(`You're too far away.`, 'warning'); return; }
  }
  player.action = {
    type: 'produce', targetX: stationX, targetY: stationY, resourceOrRecipeId: recipeId,
    ticksRemaining: recipe.ticks, repeat: quantity > 1, qtyRemaining: quantity,
  };
}

export function processProduceTick(player: Player) {
  const action = player.action;
  if (!action || action.type !== 'produce') return;
  const recipe = getRecipe(action.resourceOrRecipeId);

  for (const input of recipe.inputs) {
    if (!player.hasItem(input.item, input.qty)) {
      log(`You've run out of materials.`, 'warning');
      player.action = null;
      return;
    }
  }
  if (player.findEmptySlot() === -1) {
    const existingStack = player.inventory.some((s) => s?.itemId === recipe.outputItem);
    if (!existingStack) { log(`Your inventory is full.`, 'warning'); player.action = null; return; }
  }

  for (const input of recipe.inputs) removeItem(player, input.item, input.qty);

  let burned = false;
  if (recipe.canBurn) {
    const stopBurn = Math.min(99, recipe.levelRequired + 30);
    const playerLevel = player.level(recipe.skill);
    const burnChance = playerLevel >= stopBurn ? 0.03 : 0.08 + ((stopBurn - playerLevel) / stopBurn) * 0.5;
    burned = Math.random() < Math.min(0.75, burnChance);
  }

  if (burned) {
    const burntId = recipe.outputItem.replace('cooked_', 'burnt_');
    addItem(player, burntId, recipe.outputQty);
    const failureXp = Math.max(1, recipe.xp * 0.1);
    addXp(player, recipe.skill, failureXp);
    log(`You accidentally burn it, but learn a little from the mistake.`, 'warning');
  } else {
    addItem(player, recipe.outputItem, recipe.outputQty);
    addXp(player, recipe.skill, recipe.xp);
    log(`You make: ${getItem(recipe.outputItem).name}.`, 'info');
  }

  action.qtyRemaining = (action.qtyRemaining ?? 1) - 1;
  if (action.repeat && action.qtyRemaining > 0) {
    action.ticksRemaining = recipe.ticks;
  } else {
    player.action = null;
  }
}

// ---- Firemaking (produces a temporary world structure, not an inventory item) ----
export function lightFire(world: World, player: Player, logItemId: string) {
  if (!player.hasItem('tinderbox')) { log(`You need a tinderbox to light a fire.`, 'warning'); return; }
  if (!player.hasItem(logItemId)) return;
  if (world.getStructure(Math.round(player.x), Math.round(player.y))) { log(`You can't light a fire here.`, 'warning'); return; }
  const treeId = logItemId.replace('_logs', '');
  const tier = TREE_TIERS.find((t) => t.id === treeId);
  if (!tier) return;
  if (player.level('firemaking') < tier.level) { log(`You need Firemaking level ${tier.level}.`, 'warning'); return; }
  removeItem(player, logItemId, 1);
  world.placeTemporaryStructure(Math.round(player.x), Math.round(player.y), 'campfire', PLAYER_CAMPFIRE_LIFETIME_TICKS);
  addXp(player, 'firemaking', firemakingXp(treeId));
  log(`You light a fire. It will burn out after a while.`, 'info');
}
