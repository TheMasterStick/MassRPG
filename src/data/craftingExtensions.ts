import { ITEMS, type ItemDef } from './items';
import { RECIPES, type Recipe } from './recipes';

/**
 * Small production-chain additions that deepen existing skills without
 * introducing new world stations or placeholder resources.
 */
export function registerCraftingExtensions() {
  const thread: ItemDef = {
    id: 'thread',
    name: 'Thread',
    type: 'material',
    stackable: true,
    value: 2,
    description: 'Spun from flax and used to stitch leather and cloth.',
  };
  if (!ITEMS[thread.id]) ITEMS[thread.id] = thread;

  const add = (recipe: Recipe) => {
    if (!RECIPES.some((existing) => existing.id === recipe.id)) RECIPES.push(recipe);
  };

  add({
    id: 'spin_thread',
    name: 'Thread',
    skill: 'crafting',
    levelRequired: 1,
    inputs: [{ item: 'flax', qty: 1 }],
    outputItem: 'thread',
    outputQty: 1,
    xp: 8,
    station: 'loom',
    ticks: 1,
    category: 'crafting_misc',
  });

  // Existing leather recipes already require a needle. Thread is the consumable
  // stitching material; the needle remains the reusable tool.
  const threadCosts: Record<string, number> = {
    craft_leather_body: 2,
    craft_leather_chaps: 1,
    craft_leather_gloves: 1,
    craft_leather_boots: 1,
  };
  for (const [recipeId, qty] of Object.entries(threadCosts)) {
    const recipe = RECIPES.find((entry) => entry.id === recipeId);
    if (!recipe || recipe.inputs.some((input) => input.item === 'thread')) continue;
    recipe.inputs.push({ item: 'thread', qty });
  }
}
