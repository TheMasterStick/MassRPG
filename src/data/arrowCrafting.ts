import { ITEMS, METAL_TIERS, type ItemDef } from './items';
import { RECIPES, type Recipe } from './recipes';

/**
 * Arrow-making is intentionally a real production chain rather than a single
 * recipe. Shafts can be feathered first or tipped first, and either intermediate
 * can then receive the missing component to become finished ammunition.
 *
 * Assembly recipes operate one arrow at a time. The player can therefore use
 * however many matching components they actually own instead of needing a full
 * batch of 15. Smithing one bar still produces 15 arrowheads, and cutting one
 * normal log still produces 15 shafts.
 */
export function registerArrowCrafting() {
  const itemDefs: ItemDef[] = [
    {
      id: 'headless_arrow', name: 'Headless arrow', type: 'material', stackable: true, value: 1,
      description: 'An arrow shaft fitted with feathers, ready for an arrowhead.',
    },
  ];

  for (const metal of METAL_TIERS) {
    itemDefs.push(
      {
        id: `${metal.id}_arrowhead`, name: `${metal.name} arrowhead`, type: 'material', stackable: true,
        value: Math.max(1, Math.round(metal.value * 0.25)),
        description: `A small ${metal.name.toLowerCase()} arrowhead, ready to fit to a shaft.`,
      },
      {
        id: `${metal.id}_tipped_arrow_shaft`, name: `${metal.name}-tipped arrow shaft`, type: 'material', stackable: true,
        value: Math.max(1, Math.round(metal.value * 0.3)),
        description: `An arrow shaft fitted with a ${metal.name.toLowerCase()} arrowhead, ready for feathers.`,
      },
    );
  }
  for (const item of itemDefs) if (!ITEMS[item.id]) ITEMS[item.id] = item;

  // Remove the old shortcut recipes (shafts + feathers + a whole bar -> arrows)
  // and any previously registered staged recipes before rebuilding the chain.
  for (let i = RECIPES.length - 1; i >= 0; i--) {
    const id = RECIPES[i].id;
    if (/^fletch_(bronze|iron|steel|mithril|adamant|rune|dragonite)_arrows$/.test(id)
      || id === 'fletch_headless_arrows'
      || /^smith_(bronze|iron|steel|mithril|adamant|rune|dragonite)_arrowheads$/.test(id)
      || /^fletch_(bronze|iron|steel|mithril|adamant|rune|dragonite)_tipped_shafts$/.test(id)
      || /^fletch_(bronze|iron|steel|mithril|adamant|rune|dragonite)_arrows_from_(headless|tipped)$/.test(id)) {
      RECIPES.splice(i, 1);
    }
  }

  const add = (recipe: Recipe) => {
    if (!RECIPES.some((existing) => existing.id === recipe.id)) RECIPES.push(recipe);
  };

  add({
    id: 'fletch_headless_arrows', name: 'Headless arrow', skill: 'fletching', levelRequired: 1,
    inputs: [{ item: 'arrow_shaft', qty: 1 }, { item: 'feather', qty: 1 }],
    outputItem: 'headless_arrow', outputQty: 1, xp: 1,
    station: 'none', ticks: 1, category: 'fletching_arrows',
  });

  // Familiar 1-99 progression spacing for the generic metal ammunition line.
  // Bronze is deliberately available immediately so the starter ranged loop is
  // usable without an arbitrary early Fletching hurdle.
  const fletchLevels = [1, 15, 30, 45, 60, 75, 90];

  for (let i = 0; i < METAL_TIERS.length; i++) {
    const metal = METAL_TIERS[i];
    const fletchLevel = fletchLevels[i] ?? 99;
    const finalArrowXp = 2 + i;

    add({
      id: `smith_${metal.id}_arrowheads`, name: `${metal.name} arrowheads`, skill: 'smithing',
      levelRequired: metal.smithLevel,
      inputs: [{ item: `${metal.id}_bar`, qty: 1 }],
      outputItem: `${metal.id}_arrowhead`, outputQty: 15,
      xp: 8 + i * 4, station: 'anvil', toolRequired: 'hammer', ticks: 2, category: 'smithing_ammo',
    });

    add({
      id: `fletch_${metal.id}_tipped_shafts`, name: `${metal.name}-tipped arrow shaft`, skill: 'fletching',
      levelRequired: fletchLevel,
      inputs: [{ item: 'arrow_shaft', qty: 1 }, { item: `${metal.id}_arrowhead`, qty: 1 }],
      outputItem: `${metal.id}_tipped_arrow_shaft`, outputQty: 1,
      xp: 1, station: 'none', ticks: 1, category: 'fletching_arrows',
    });

    add({
      id: `fletch_${metal.id}_arrows_from_headless`, name: `${metal.name} arrow`, skill: 'fletching',
      levelRequired: fletchLevel,
      inputs: [{ item: 'headless_arrow', qty: 1 }, { item: `${metal.id}_arrowhead`, qty: 1 }],
      outputItem: `${metal.id}_arrow`, outputQty: 1,
      xp: finalArrowXp, station: 'none', ticks: 1, category: 'fletching_arrows',
    });

    add({
      id: `fletch_${metal.id}_arrows_from_tipped`, name: `${metal.name} arrow`, skill: 'fletching',
      levelRequired: fletchLevel,
      inputs: [{ item: `${metal.id}_tipped_arrow_shaft`, qty: 1 }, { item: 'feather', qty: 1 }],
      outputItem: `${metal.id}_arrow`, outputQty: 1,
      xp: finalArrowXp, station: 'none', ticks: 1, category: 'fletching_arrows',
    });
  }
}
