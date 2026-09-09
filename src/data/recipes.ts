import type { SkillId } from './skills';
import type { StructureType } from '../world/types';
import { METAL_TIERS, TREE_TIERS, FISH_TIERS, HERB_TIERS, POTION_TIERS } from './items';

export interface RecipeInput { item: string; qty: number }

export type StationRequirement = StructureType | 'fire' | 'none';

export interface Recipe {
  id: string;
  name: string;
  skill: SkillId;
  levelRequired: number;
  inputs: RecipeInput[];
  outputItem: string;
  outputQty: number;
  xp: number;
  station: StationRequirement;
  toolRequired?: string;
  ticks: number;
  category: string;
  canBurn?: boolean;
}

export const RECIPES: Recipe[] = [];
function reg(r: Recipe) { RECIPES.push(r); }

// ---- Smithing: smelting ore into bars (furnace) ----
reg({ id: 'smelt_bronze_bar', name: 'Bronze bar', skill: 'smithing', levelRequired: 1, inputs: [{ item: 'copper_ore', qty: 1 }, { item: 'tin_ore', qty: 1 }], outputItem: 'bronze_bar', outputQty: 1, xp: 6, station: 'furnace', ticks: 2, category: 'smelting' });
reg({ id: 'smelt_iron_bar', name: 'Iron bar', skill: 'smithing', levelRequired: 15, inputs: [{ item: 'iron_ore', qty: 1 }], outputItem: 'iron_bar', outputQty: 1, xp: 13, station: 'furnace', ticks: 2, category: 'smelting' });
reg({ id: 'smelt_steel_bar', name: 'Steel bar', skill: 'smithing', levelRequired: 30, inputs: [{ item: 'iron_ore', qty: 1 }, { item: 'coal', qty: 2 }], outputItem: 'steel_bar', outputQty: 1, xp: 17, station: 'furnace', ticks: 2, category: 'smelting' });
reg({ id: 'smelt_mithril_bar', name: 'Mithril bar', skill: 'smithing', levelRequired: 50, inputs: [{ item: 'mithril_ore', qty: 1 }, { item: 'coal', qty: 4 }], outputItem: 'mithril_bar', outputQty: 1, xp: 30, station: 'furnace', ticks: 3, category: 'smelting' });
reg({ id: 'smelt_adamant_bar', name: 'Adamant bar', skill: 'smithing', levelRequired: 70, inputs: [{ item: 'adamant_ore', qty: 1 }, { item: 'coal', qty: 6 }], outputItem: 'adamant_bar', outputQty: 1, xp: 38, station: 'furnace', ticks: 3, category: 'smelting' });
reg({ id: 'smelt_rune_bar', name: 'Rune bar', skill: 'smithing', levelRequired: 85, inputs: [{ item: 'rune_ore', qty: 1 }, { item: 'coal', qty: 8 }], outputItem: 'rune_bar', outputQty: 1, xp: 50, station: 'furnace', ticks: 3, category: 'smelting' });
reg({ id: 'smelt_gold_bar', name: 'Gold bar', skill: 'smithing', levelRequired: 40, inputs: [{ item: 'gold_ore', qty: 1 }], outputItem: 'gold_bar', outputQty: 1, xp: 23, station: 'furnace', ticks: 2, category: 'smelting' });
reg({ id: 'smelt_silver_bar', name: 'Silver bar', skill: 'smithing', levelRequired: 20, inputs: [{ item: 'silver_ore', qty: 1 }], outputItem: 'silver_bar', outputQty: 1, xp: 14, station: 'furnace', ticks: 2, category: 'smelting' });

// ---- Smithing: bars into equipment (anvil + hammer) ----
const SMITH_PIECES: { suffix: string; label: string; bars: number }[] = [
  { suffix: 'sword', label: 'sword', bars: 1 },
  { suffix: 'dagger', label: 'dagger', bars: 1 },
  { suffix: 'helmet', label: 'full helm', bars: 1 },
  { suffix: 'platebody', label: 'platebody', bars: 5 },
  { suffix: 'platelegs', label: 'platelegs', bars: 3 },
  { suffix: 'shield', label: 'kiteshield', bars: 2 },
  { suffix: 'boots', label: 'boots', bars: 1 },
  { suffix: 'gloves', label: 'gauntlets', bars: 1 },
];
for (let i = 0; i < METAL_TIERS.length; i++) {
  const m = METAL_TIERS[i];
  for (const piece of SMITH_PIECES) {
    reg({
      id: `smith_${m.id}_${piece.suffix}`, name: `${m.name} ${piece.label}`, skill: 'smithing',
      levelRequired: m.smithLevel, inputs: [{ item: `${m.id}_bar`, qty: piece.bars }],
      outputItem: `${m.id}_${piece.suffix}`, outputQty: 1, xp: piece.bars * (8 + i * 4),
      station: 'anvil', toolRequired: 'hammer', ticks: 2 + piece.bars, category: 'smithing',
    });
  }
}

// ---- Cooking (campfire or cooking range) ----
const FIREMAKING_XP: Record<string, number> = { normal: 40, oak: 60, willow: 90, maple: 135, yew: 202, magic: 303 };
for (const f of FISH_TIERS) {
  reg({
    id: `cook_${f.id}`, name: f.name, skill: 'cooking', levelRequired: f.level,
    inputs: [{ item: `raw_${f.id}`, qty: 1 }], outputItem: `cooked_${f.id}`, outputQty: 1,
    xp: f.xp, station: 'fire', ticks: 2, category: 'cooking', canBurn: true,
  });
}
reg({ id: 'cook_meat', name: 'Cooked meat', skill: 'cooking', levelRequired: 1, inputs: [{ item: 'raw_meat', qty: 1 }], outputItem: 'cooked_meat', outputQty: 1, xp: 15, station: 'fire', ticks: 2, category: 'cooking', canBurn: true });

// ---- Fletching ----
for (let i = 0; i < TREE_TIERS.length; i++) {
  const t = TREE_TIERS[i];
  reg({ id: `fletch_${t.id}_unstrung`, name: `${t.name} shortbow (u)`, skill: 'fletching', levelRequired: t.level, inputs: [{ item: `${t.id}_logs`, qty: 1 }], outputItem: `${t.id}_shortbow_u`, outputQty: 1, xp: Math.round(t.xp * 0.5), station: 'none', toolRequired: 'knife', ticks: 2, category: 'fletching_bows' });
  reg({ id: `fletch_${t.id}_string`, name: `${t.name} shortbow`, skill: 'fletching', levelRequired: t.level, inputs: [{ item: `${t.id}_shortbow_u`, qty: 1 }, { item: 'bow_string', qty: 1 }], outputItem: `${t.id}_shortbow`, outputQty: 1, xp: Math.round(t.xp * 0.7), station: 'none', ticks: 2, category: 'fletching_bows' });
}
reg({ id: 'fletch_arrow_shafts', name: 'Arrow shafts', skill: 'fletching', levelRequired: 1, inputs: [{ item: 'normal_logs', qty: 1 }], outputItem: 'arrow_shaft', outputQty: 15, xp: 5, station: 'none', toolRequired: 'knife', ticks: 2, category: 'fletching_arrows' });
reg({ id: 'craft_bowstring', name: 'Bow string', skill: 'crafting', levelRequired: 10, inputs: [{ item: 'flax', qty: 1 }], outputItem: 'bow_string', outputQty: 1, xp: 15, station: 'loom', ticks: 2, category: 'crafting_misc' });
for (let i = 0; i < METAL_TIERS.length; i++) {
  const m = METAL_TIERS[i];
  reg({ id: `fletch_${m.id}_arrows`, name: `${m.name} arrows`, skill: 'fletching', levelRequired: Math.max(1, m.tier * 5), inputs: [{ item: 'arrow_shaft', qty: 15 }, { item: 'feather', qty: 15 }, { item: `${m.id}_bar`, qty: 1 }], outputItem: `${m.id}_arrow`, outputQty: 15, xp: 15 * (2 + i), station: 'none', ticks: 3, category: 'fletching_arrows' });
}

// ---- Crafting: leather ----
reg({ id: 'tan_leather', name: 'Leather', skill: 'crafting', levelRequired: 1, inputs: [{ item: 'cowhide', qty: 1 }], outputItem: 'leather', outputQty: 1, xp: 4, station: 'tannery', ticks: 1, category: 'crafting_leather' });
reg({ id: 'craft_leather_body', name: 'Leather body', skill: 'crafting', levelRequired: 14, inputs: [{ item: 'leather', qty: 3 }], outputItem: 'leather_body', outputQty: 1, xp: 25, station: 'none', toolRequired: 'needle', ticks: 3, category: 'crafting_leather' });
reg({ id: 'craft_leather_chaps', name: 'Leather chaps', skill: 'crafting', levelRequired: 11, inputs: [{ item: 'leather', qty: 2 }], outputItem: 'leather_chaps', outputQty: 1, xp: 27, station: 'none', toolRequired: 'needle', ticks: 2, category: 'crafting_leather' });
reg({ id: 'craft_leather_gloves', name: 'Leather gloves', skill: 'crafting', levelRequired: 1, inputs: [{ item: 'leather', qty: 1 }], outputItem: 'leather_gloves', outputQty: 1, xp: 12, station: 'none', toolRequired: 'needle', ticks: 1, category: 'crafting_leather' });
reg({ id: 'craft_leather_boots', name: 'Leather boots', skill: 'crafting', levelRequired: 7, inputs: [{ item: 'leather', qty: 1 }], outputItem: 'leather_boots', outputQty: 1, xp: 14, station: 'none', toolRequired: 'needle', ticks: 1, category: 'crafting_leather' });

// ---- Crafting: gems ----
const GEM_TIERS = [
  { id: 'sapphire', level: 1, xp: 20 },
  { id: 'emerald', level: 27, xp: 27 },
  { id: 'ruby', level: 34, xp: 43 },
  { id: 'diamond', level: 43, xp: 65 },
];
for (const g of GEM_TIERS) {
  reg({ id: `cut_${g.id}`, name: `Cut ${g.id}`, skill: 'crafting', levelRequired: g.level, inputs: [{ item: `uncut_${g.id}`, qty: 1 }], outputItem: g.id, outputQty: 1, xp: g.xp, station: 'none', toolRequired: 'chisel', ticks: 1, category: 'crafting_gems' });
}

// ---- Crafting: jewellery ----
reg({ id: 'craft_gold_ring', name: 'Gold ring', skill: 'crafting', levelRequired: 5, inputs: [{ item: 'gold_bar', qty: 1 }], outputItem: 'gold_ring', outputQty: 1, xp: 15, station: 'furnace', toolRequired: 'ring_mold', ticks: 2, category: 'crafting_jewelry' });
reg({ id: 'craft_sapphire_ring', name: 'Sapphire ring', skill: 'crafting', levelRequired: 20, inputs: [{ item: 'gold_bar', qty: 1 }, { item: 'sapphire', qty: 1 }], outputItem: 'sapphire_ring', outputQty: 1, xp: 25, station: 'furnace', toolRequired: 'ring_mold', ticks: 2, category: 'crafting_jewelry' });
reg({ id: 'craft_gold_amulet', name: 'Gold amulet', skill: 'crafting', levelRequired: 7, inputs: [{ item: 'gold_bar', qty: 1 }], outputItem: 'gold_amulet', outputQty: 1, xp: 18, station: 'furnace', toolRequired: 'amulet_mold', ticks: 2, category: 'crafting_jewelry' });
reg({ id: 'craft_ruby_amulet', name: 'Ruby amulet', skill: 'crafting', levelRequired: 27, inputs: [{ item: 'gold_bar', qty: 1 }, { item: 'ruby', qty: 1 }], outputItem: 'ruby_amulet', outputQty: 1, xp: 45, station: 'furnace', toolRequired: 'amulet_mold', ticks: 2, category: 'crafting_jewelry' });

// ---- Construction: planks ----
reg({ id: 'cut_plank', name: 'Plank', skill: 'construction', levelRequired: 1, inputs: [{ item: 'normal_logs', qty: 1 }], outputItem: 'plank', outputQty: 1, xp: 5, station: 'none', toolRequired: 'saw', ticks: 1, category: 'construction' });

// ---- Herblore ----
for (const h of HERB_TIERS) {
  reg({ id: `clean_${h.id}`, name: `Clean ${h.name.toLowerCase()}`, skill: 'herblore', levelRequired: h.level, inputs: [{ item: `grimy_${h.id}`, qty: 1 }], outputItem: `clean_${h.id}`, outputQty: 1, xp: Math.round(h.xp * 0.3), station: 'none', ticks: 1, category: 'herblore_clean' });
}
for (const p of POTION_TIERS) {
  reg({ id: `brew_${p.id}`, name: p.name, skill: 'herblore', levelRequired: p.level, inputs: [{ item: `clean_${p.herb}`, qty: 1 }, { item: 'vial_of_water', qty: 1 }, { item: p.secondary, qty: 1 }], outputItem: p.id, outputQty: 1, xp: p.xp, station: 'none', toolRequired: 'pestle_and_mortar', ticks: 2, category: 'herblore_potions' });
}

export function recipesForStation(station: StationRequirement): Recipe[] {
  return RECIPES.filter((r) => r.station === station);
}
export function getRecipe(id: string): Recipe {
  const r = RECIPES.find((rr) => rr.id === id);
  if (!r) throw new Error(`Unknown recipe id: ${id}`);
  return r;
}
export function firemakingXp(treeId: string): number {
  return FIREMAKING_XP[treeId] ?? 40;
}

// ---- Construction: buildable structures ----
export interface StructureCost {
  type: StructureType;
  name: string;
  levelRequired: number;
  inputs: RecipeInput[];
  xp: number;
  description: string;
}
export const STRUCTURES: StructureCost[] = [
  { type: 'workbench', name: 'Workbench', levelRequired: 1, inputs: [{ item: 'plank', qty: 4 }], xp: 20, description: 'A sturdy surface for crafting.' },
  { type: 'fence', name: 'Fence', levelRequired: 1, inputs: [{ item: 'plank', qty: 2 }], xp: 8, description: 'Marks out your camp.' },
  { type: 'wall', name: 'Stone wall', levelRequired: 10, inputs: [{ item: 'stone', qty: 6 }], xp: 25, description: 'A defensive wall section.' },
  { type: 'bed', name: 'Bed', levelRequired: 5, inputs: [{ item: 'plank', qty: 3 }], xp: 30, description: 'Sets your respawn point.' },
  { type: 'storage_chest', name: 'Storage chest', levelRequired: 15, inputs: [{ item: 'plank', qty: 6 }, { item: 'nails', qty: 6 }], xp: 60, description: 'Extra portable storage.' },
  { type: 'cooking_range', name: 'Cooking range', levelRequired: 10, inputs: [{ item: 'stone', qty: 15 }], xp: 50, description: 'Cook without burning as easily.' },
  { type: 'furnace', name: 'Furnace', levelRequired: 16, inputs: [{ item: 'stone', qty: 30 }], xp: 80, description: 'Smelt ore into bars.' },
  { type: 'anvil', name: 'Anvil', levelRequired: 20, inputs: [{ item: 'iron_bar', qty: 5 }], xp: 90, description: 'Smith bars into equipment.' },
  { type: 'tannery', name: 'Tannery', levelRequired: 25, inputs: [{ item: 'stone', qty: 20 }, { item: 'plank', qty: 5 }], xp: 100, description: 'Tan hides into leather.' },
  { type: 'loom', name: 'Loom', levelRequired: 8, inputs: [{ item: 'plank', qty: 6 }], xp: 40, description: 'Spin flax into bow string.' },
];
export function getStructureCost(type: StructureType): StructureCost {
  const s = STRUCTURES.find((ss) => ss.type === type);
  if (!s) throw new Error(`Unknown structure type: ${type}`);
  return s;
}
