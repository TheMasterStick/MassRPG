import { ITEMS, type ItemDef } from './items';

// Mundane utility tools that support the wider life-sim/crafting direction.
// These stay deliberately generic: quest rewards, magical variants and highly
// specialised profession tools belong with the systems that eventually use them.
const UTILITY_TOOLS: ItemDef[] = [
  // General workshop / household tools.
  { id: 'shears', name: 'Shears', type: 'tool', stackable: false, value: 5, description: 'Cut wool, cloth and light vegetation.' },
  { id: 'bucket', name: 'Bucket', type: 'tool', stackable: false, value: 2, description: 'Carry water and other loose materials.' },

  // Farming tools. Their deeper patch/disease/watering behaviours can be wired
  // in as the Farming simulation expands.
  { id: 'rake', name: 'Rake', type: 'tool', stackable: false, value: 4, description: 'Clear weeds and prepare farming patches.' },
  { id: 'watering_can', name: 'Watering can', type: 'tool', stackable: false, value: 8, description: 'Water crops and seedlings.' },
  { id: 'gardening_trowel', name: 'Gardening trowel', type: 'tool', stackable: false, value: 5, description: 'Work soil and prepare plant pots.' },
  { id: 'secateurs', name: 'Secateurs', type: 'tool', stackable: false, value: 5, description: 'Prune plants, bushes and diseased growth.' },

  // Fishing tools that are useful for later fishing-spot expansion.
  { id: 'big_fishing_net', name: 'Big fishing net', type: 'tool', stackable: false, value: 30, description: 'Catch larger netted fish and sea creatures.' },
  { id: 'fly_fishing_rod', name: 'Fly fishing rod', type: 'tool', stackable: false, value: 35, description: 'Catch river fish with feathers or flies.' },

  // Crafting tools and moulds. Existing jewellery recipes already use ring and
  // amulet moulds from items.ts; these additions reserve the rest of the common
  // baseline without inventing named RuneScape equipment.
  { id: 'glassblowing_pipe', name: 'Glassblowing pipe', type: 'tool', stackable: false, value: 12, description: 'Shape molten glass into useful objects.' },
  { id: 'necklace_mold', name: 'Necklace mold', type: 'tool', stackable: false, value: 10, description: 'Mold precious metal into necklaces.' },
  { id: 'bracelet_mold', name: 'Bracelet mold', type: 'tool', stackable: false, value: 10, description: 'Mold precious metal into bracelets.' },
  { id: 'tiara_mold', name: 'Tiara mold', type: 'tool', stackable: false, value: 10, description: 'Mold precious metal into tiaras.' },
  { id: 'ammo_mold', name: 'Ammo mold', type: 'tool', stackable: false, value: 12, description: 'Cast suitable metal into small ammunition components.' },
];

export const UTILITY_TOOL_IDS = UTILITY_TOOLS.map((tool) => tool.id);

export function registerUtilityTools() {
  for (const tool of UTILITY_TOOLS) {
    if (!ITEMS[tool.id]) ITEMS[tool.id] = tool;
  }
}
