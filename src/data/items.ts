// The item database. Tiered equipment/ores/bars are generated
// programmatically to keep a deep RuneScape-style progression without
// hand-writing every near-identical entry.

export type EquipSlot = 'weapon' | 'shield' | 'head' | 'body' | 'legs' | 'feet' | 'hands' | 'cape' | 'amulet' | 'ammo' | 'ring' | 'ring2';
export type ItemType = 'tool' | 'weapon' | 'armor' | 'resource' | 'food' | 'potion' | 'material' | 'currency' | 'seed' | 'misc';

export interface CombatBonuses {
  attack?: number;
  strength?: number;
  defence?: number;
  rangedAttack?: number;
  rangedStrength?: number;
  magic?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  stackable: boolean;
  value: number;
  description: string;
  equipSlot?: EquipSlot;
  twoHanded?: boolean;
  bonuses?: CombatBonuses;
  heal?: number; // for food
  toolTier?: number; // gathering speed/success tier for tools
}

export const ITEMS: Record<string, ItemDef> = {};
function reg(def: ItemDef) { ITEMS[def.id] = def; }

// ---- Currency ----
reg({ id: 'coins', name: 'Coins', type: 'currency', stackable: true, value: 1, description: 'The realm\'s currency.' });

// ---- Metal tiers ----
export const METAL_TIERS = [
  { id: 'bronze', name: 'Bronze', tier: 1, oreLevel: 1, smithLevel: 1, value: 4 },
  { id: 'iron', name: 'Iron', tier: 2, oreLevel: 15, smithLevel: 15, value: 12 },
  { id: 'steel', name: 'Steel', tier: 3, oreLevel: 30, smithLevel: 30, value: 30 },
  { id: 'mithril', name: 'Mithril', tier: 4, oreLevel: 55, smithLevel: 50, value: 90 },
  { id: 'adamant', name: 'Adamant', tier: 5, oreLevel: 70, smithLevel: 70, value: 200 },
  { id: 'rune', name: 'Rune', tier: 6, oreLevel: 85, smithLevel: 85, value: 500 },
] as const;

// Ores (primary). Bronze uses copper+tin, and steel uses iron+coal, so
// neither has an ore of its own.
reg({ id: 'copper_ore', name: 'Copper ore', type: 'resource', stackable: true, value: 3, description: 'Used with tin to smith bronze.' });
reg({ id: 'tin_ore', name: 'Tin ore', type: 'resource', stackable: true, value: 3, description: 'Used with copper to smith bronze.' });
reg({ id: 'coal', name: 'Coal', type: 'resource', stackable: true, value: 5, description: 'Fuel for smelting the stronger metals.' });
for (const m of METAL_TIERS) {
  if (m.id === 'bronze' || m.id === 'steel') continue;
  reg({ id: `${m.id}_ore`, name: `${m.name} ore`, type: 'resource', stackable: true, value: m.value, description: `Raw ${m.name.toLowerCase()} ore, smelted into a bar.` });
}
reg({ id: 'gold_ore', name: 'Gold ore', type: 'resource', stackable: true, value: 20, description: 'Smelted into gold bars for jewellery.' });
reg({ id: 'silver_ore', name: 'Silver ore', type: 'resource', stackable: true, value: 15, description: 'Smelted into silver bars for jewellery.' });
// Dragonite - a standalone top-end ore beyond rune, found only in the far
// north. Not part of METAL_TIERS (no equipment line of its own yet, just a
// bar) since only the smelting step was asked for.
reg({ id: 'dragonite_ore', name: 'Dragonite ore', type: 'resource', stackable: true, value: 650, description: 'A rare, near-mythical ore found only in the far north.' });

// Bars
for (const m of METAL_TIERS) {
  reg({ id: `${m.id}_bar`, name: `${m.name} bar`, type: 'material', stackable: true, value: m.value * 3, description: `A bar of ${m.name.toLowerCase()}, smithed into equipment.` });
}
reg({ id: 'gold_bar', name: 'Gold bar', type: 'material', stackable: true, value: 60, description: 'Used in jewellery crafting.' });
reg({ id: 'silver_bar', name: 'Silver bar', type: 'material', stackable: true, value: 45, description: 'Used in jewellery crafting.' });
reg({ id: 'dragonite_bar', name: 'Dragonite bar', type: 'material', stackable: true, value: 2000, description: 'Smelted from dragonite ore and coal.' });

// ---- Weapons & armor per metal tier ----
const WEAPON_SCALE = 6; // bonus per tier index
const ARMOR_SCALE = 4;

for (let i = 0; i < METAL_TIERS.length; i++) {
  const m = METAL_TIERS[i];
  const atk = 4 + i * WEAPON_SCALE;
  const str = 3 + i * WEAPON_SCALE;

  reg({
    id: `${m.id}_sword`, name: `${m.name} sword`, type: 'weapon', stackable: false, value: m.value * 8,
    description: `A ${m.name.toLowerCase()} sword.`, equipSlot: 'weapon',
    bonuses: { attack: atk, strength: str },
  });
  reg({
    id: `${m.id}_dagger`, name: `${m.name} dagger`, type: 'weapon', stackable: false, value: m.value * 5,
    description: `A fast ${m.name.toLowerCase()} dagger.`, equipSlot: 'weapon',
    bonuses: { attack: Math.round(atk * 0.7), strength: Math.round(str * 0.6) },
  });

  const def = 3 + i * ARMOR_SCALE;
  reg({ id: `${m.id}_helmet`, name: `${m.name} full helm`, type: 'armor', stackable: false, value: m.value * 4, description: `A ${m.name.toLowerCase()} helmet.`, equipSlot: 'head', bonuses: { defence: Math.round(def * 0.4) } });
  reg({ id: `${m.id}_platebody`, name: `${m.name} platebody`, type: 'armor', stackable: false, value: m.value * 10, description: `A ${m.name.toLowerCase()} platebody.`, equipSlot: 'body', bonuses: { defence: def } });
  reg({ id: `${m.id}_platelegs`, name: `${m.name} platelegs`, type: 'armor', stackable: false, value: m.value * 7, description: `${m.name} platelegs.`, equipSlot: 'legs', bonuses: { defence: Math.round(def * 0.7) } });
  reg({ id: `${m.id}_shield`, name: `${m.name} kiteshield`, type: 'armor', stackable: false, value: m.value * 6, description: `A ${m.name.toLowerCase()} kiteshield.`, equipSlot: 'shield', bonuses: { defence: Math.round(def * 0.6) } });
  reg({ id: `${m.id}_boots`, name: `${m.name} boots`, type: 'armor', stackable: false, value: m.value * 2, description: `${m.name} boots.`, equipSlot: 'feet', bonuses: { defence: Math.round(def * 0.2) } });
  reg({ id: `${m.id}_gloves`, name: `${m.name} gauntlets`, type: 'armor', stackable: false, value: m.value * 2, description: `${m.name} gauntlets.`, equipSlot: 'hands', bonuses: { defence: Math.round(def * 0.2) } });
  reg({ id: `${m.id}_arrow`, name: `${m.name} arrow`, type: 'weapon', stackable: true, value: Math.max(1, Math.round(m.value * 0.3)), description: `Arrows tipped with ${m.name.toLowerCase()}.`, equipSlot: 'ammo', bonuses: { rangedStrength: 2 + i * 3 } });
}

// ---- Tools ----
reg({ id: 'bronze_hatchet', name: 'Bronze hatchet', type: 'tool', stackable: false, value: 20, description: 'Chop trees for logs.', equipSlot: 'weapon', toolTier: 1, bonuses: { attack: 2, strength: 1 } });
reg({ id: 'iron_hatchet', name: 'Iron hatchet', type: 'tool', stackable: false, value: 50, description: 'Chop trees for logs.', equipSlot: 'weapon', toolTier: 2, bonuses: { attack: 5, strength: 3 } });
reg({ id: 'steel_hatchet', name: 'Steel hatchet', type: 'tool', stackable: false, value: 120, description: 'Chop trees for logs.', equipSlot: 'weapon', toolTier: 3, bonuses: { attack: 10, strength: 6 } });
reg({ id: 'mithril_hatchet', name: 'Mithril hatchet', type: 'tool', stackable: false, value: 300, description: 'Chop trees for logs.', equipSlot: 'weapon', toolTier: 4, bonuses: { attack: 16, strength: 10 } });
reg({ id: 'adamant_hatchet', name: 'Adamant hatchet', type: 'tool', stackable: false, value: 700, description: 'Chop trees for logs.', equipSlot: 'weapon', toolTier: 5, bonuses: { attack: 24, strength: 15 } });
reg({ id: 'rune_hatchet', name: 'Rune hatchet', type: 'tool', stackable: false, value: 1600, description: 'Chop trees for logs.', equipSlot: 'weapon', toolTier: 6, bonuses: { attack: 34, strength: 22 } });

reg({ id: 'bronze_pickaxe', name: 'Bronze pickaxe', type: 'tool', stackable: false, value: 20, description: 'Mine rocks for ore.', equipSlot: 'weapon', toolTier: 1, bonuses: { attack: 2, strength: 1 } });
reg({ id: 'iron_pickaxe', name: 'Iron pickaxe', type: 'tool', stackable: false, value: 50, description: 'Mine rocks for ore.', equipSlot: 'weapon', toolTier: 2, bonuses: { attack: 5, strength: 3 } });
reg({ id: 'steel_pickaxe', name: 'Steel pickaxe', type: 'tool', stackable: false, value: 120, description: 'Mine rocks for ore.', equipSlot: 'weapon', toolTier: 3, bonuses: { attack: 10, strength: 6 } });
reg({ id: 'mithril_pickaxe', name: 'Mithril pickaxe', type: 'tool', stackable: false, value: 300, description: 'Mine rocks for ore.', equipSlot: 'weapon', toolTier: 4, bonuses: { attack: 16, strength: 10 } });
reg({ id: 'adamant_pickaxe', name: 'Adamant pickaxe', type: 'tool', stackable: false, value: 700, description: 'Mine rocks for ore.', equipSlot: 'weapon', toolTier: 5, bonuses: { attack: 24, strength: 15 } });
reg({ id: 'rune_pickaxe', name: 'Rune pickaxe', type: 'tool', stackable: false, value: 1600, description: 'Mine rocks for ore.', equipSlot: 'weapon', toolTier: 6, bonuses: { attack: 34, strength: 22 } });

reg({ id: 'small_fishing_net', name: 'Small fishing net', type: 'tool', stackable: false, value: 15, description: 'Catch shrimp and other small fish.', toolTier: 1 });
reg({ id: 'fishing_rod', name: 'Fishing rod', type: 'tool', stackable: false, value: 25, description: 'Catch trout and salmon with bait.', toolTier: 2 });
reg({ id: 'fishing_bait', name: 'Fishing bait', type: 'material', stackable: true, value: 1, description: 'Bait for a fishing rod.' });
reg({ id: 'lobster_pot', name: 'Lobster pot', type: 'tool', stackable: false, value: 40, description: 'Catch lobsters at deep water.', toolTier: 3 });
reg({ id: 'harpoon', name: 'Harpoon', type: 'tool', stackable: false, value: 60, description: 'Catch swordfish and tuna.', toolTier: 4 });

reg({ id: 'tinderbox', name: 'Tinderbox', type: 'tool', stackable: false, value: 5, description: 'Light fires from logs.' });
reg({ id: 'hammer', name: 'Hammer', type: 'tool', stackable: false, value: 8, description: 'Smith bars into equipment.' });
reg({ id: 'chisel', name: 'Chisel', type: 'tool', stackable: false, value: 5, description: 'Cut gems and carve items.' });
reg({ id: 'needle', name: 'Needle', type: 'tool', stackable: false, value: 3, description: 'Craft leather armor.' });
reg({ id: 'saw', name: 'Saw', type: 'tool', stackable: false, value: 6, description: 'Cut planks for construction.' });
reg({ id: 'spade', name: 'Spade', type: 'tool', stackable: false, value: 4, description: 'Plant and harvest crops.' });
reg({ id: 'seed_dibber', name: 'Seed dibber', type: 'tool', stackable: false, value: 4, description: 'Plant seeds in farming patches.' });
reg({ id: 'pestle_and_mortar', name: 'Pestle and mortar', type: 'tool', stackable: false, value: 5, description: 'Grind herbs for Herblore.' });

// ---- Logs & wood products ----
export const TREE_TIERS = [
  { id: 'normal', name: 'Tree', level: 1, xp: 25, value: 2 },
  { id: 'oak', name: 'Oak', level: 15, xp: 38, value: 8 },
  { id: 'willow', name: 'Willow', level: 30, xp: 68, value: 15 },
  { id: 'maple', name: 'Maple', level: 45, xp: 100, value: 30 },
  { id: 'yew', name: 'Yew', level: 60, xp: 175, value: 90 },
  { id: 'magic', name: 'Magic', level: 75, xp: 250, value: 250 },
] as const;
for (const t of TREE_TIERS) {
  reg({ id: `${t.id}_logs`, name: `${t.id === 'normal' ? '' : t.name + ' '}Logs`.trim(), type: 'resource', stackable: true, value: t.value, description: 'Wood, useful for Firemaking or Fletching.' });
}
reg({ id: 'plank', name: 'Plank', type: 'material', stackable: true, value: 10, description: 'Sawn wood used in Construction.' });

// ---- Fish ----
export const FISH_TIERS = [
  { id: 'shrimp', name: 'Shrimp', level: 1, xp: 10, heal: 3, tool: 'small_fishing_net' },
  { id: 'sardine', name: 'Sardine', level: 5, xp: 15, heal: 4, tool: 'small_fishing_net' },
  { id: 'trout', name: 'Trout', level: 20, xp: 25, heal: 7, tool: 'fishing_rod' },
  { id: 'salmon', name: 'Salmon', level: 30, xp: 42, heal: 9, tool: 'fishing_rod' },
  { id: 'lobster', name: 'Lobster', level: 40, xp: 60, heal: 12, tool: 'lobster_pot' },
  { id: 'swordfish', name: 'Swordfish', level: 55, xp: 90, heal: 16, tool: 'harpoon' },
  { id: 'shark', name: 'Shark', level: 76, xp: 130, heal: 22, tool: 'harpoon' },
] as const;
for (const f of FISH_TIERS) {
  reg({ id: `raw_${f.id}`, name: `Raw ${f.name.toLowerCase()}`, type: 'food', stackable: true, value: Math.round(f.heal * 4), description: 'Best cooked before eating.', heal: 1 });
  reg({ id: `cooked_${f.id}`, name: f.name, type: 'food', stackable: true, value: Math.round(f.heal * 4 * 1.6), description: 'A tasty cooked fish.', heal: f.heal });
  reg({ id: `burnt_${f.id}`, name: `Burnt ${f.name.toLowerCase()}`, type: 'food', stackable: true, value: 0, description: 'Burnt beyond edibility.', heal: 0 });
}

// ---- Farming ----
export const CROP_TIERS = [
  { id: 'potato', name: 'Potato', level: 1, xp: 8, growTicks: 40, heal: 4 },
  { id: 'onion', name: 'Onion', level: 5, xp: 10, growTicks: 50, heal: 3 },
  { id: 'cabbage', name: 'Cabbage', level: 7, xp: 12, growTicks: 55, heal: 3 },
  { id: 'sweetcorn', name: 'Sweetcorn', level: 20, xp: 17, growTicks: 70, heal: 6 },
  { id: 'strawberry', name: 'Strawberry', level: 31, xp: 25, growTicks: 90, heal: 8 },
  { id: 'watermelon', name: 'Watermelon', level: 47, xp: 48, growTicks: 120, heal: 14 },
] as const;
for (const c of CROP_TIERS) {
  reg({ id: `${c.id}_seed`, name: `${c.name} seed`, type: 'seed', stackable: true, value: 2, description: `Plant on a farming patch to grow ${c.name.toLowerCase()}.` });
  reg({ id: c.id, name: c.name, type: 'food', stackable: true, value: c.xp * 3, description: 'A fresh crop.', heal: c.heal });
}

export const HERB_TIERS = [
  { id: 'guam', name: 'Guam leaf', level: 3, xp: 12, growTicks: 60 },
  { id: 'marrentill', name: 'Marrentill', level: 5, xp: 14, growTicks: 65 },
  { id: 'harralander', name: 'Harralander', level: 9, xp: 18, growTicks: 75 },
  { id: 'ranarr', name: 'Ranarr weed', level: 25, xp: 30, growTicks: 100 },
  { id: 'irit', name: 'Irit leaf', level: 44, xp: 48, growTicks: 130 },
  { id: 'avantoe', name: 'Avantoe', level: 50, xp: 55, growTicks: 145 },
] as const;
for (const h of HERB_TIERS) {
  reg({ id: `${h.id}_seed`, name: `${h.name} seed`, type: 'seed', stackable: true, value: 4, description: `Plant on an herb patch to grow ${h.name.toLowerCase()}.` });
  reg({ id: `grimy_${h.id}`, name: `Grimy ${h.name.toLowerCase()}`, type: 'material', stackable: true, value: h.xp * 4, description: 'An unclean herb - clean it before use.' });
  reg({ id: `clean_${h.id}`, name: h.name, type: 'material', stackable: true, value: h.xp * 6, description: 'A cleaned herb, ready for Herblore.' });
}

// ---- Herblore secondaries & potions ----
reg({ id: 'vial_of_water', name: 'Vial of water', type: 'material', stackable: true, value: 3, description: 'The base of most potions.' });
reg({ id: 'eye_of_newt', name: 'Eye of newt', type: 'material', stackable: true, value: 3, description: 'A potion secondary.' });
reg({ id: 'unicorn_horn_dust', name: 'Unicorn horn dust', type: 'material', stackable: true, value: 15, description: 'A potion secondary.' });
reg({ id: 'limpwurt_root', name: 'Limpwurt root', type: 'material', stackable: true, value: 20, description: 'A potion secondary.' });
reg({ id: 'chocolate_dust', name: 'Chocolate dust', type: 'material', stackable: true, value: 5, description: 'A potion secondary.' });

export const POTION_TIERS = [
  { id: 'attack_potion', name: 'Attack potion', level: 1, xp: 25, herb: 'guam', secondary: 'eye_of_newt', boosts: { attack: 3 } },
  { id: 'antipoison', name: 'Antipoison', level: 5, xp: 30, herb: 'marrentill', secondary: 'unicorn_horn_dust', boosts: {} },
  { id: 'strength_potion', name: 'Strength potion', level: 12, xp: 40, herb: 'harralander', secondary: 'limpwurt_root', boosts: { strength: 3 } },
  { id: 'prayer_potion', name: 'Prayer potion', level: 38, xp: 87, herb: 'ranarr', secondary: 'chocolate_dust', boosts: {} },
] as const;
for (const p of POTION_TIERS) {
  reg({ id: p.id, name: p.name, type: 'potion', stackable: true, value: p.xp * 5, description: 'Drink to gain a temporary boost.' });
}

// ---- Crafting: hides & jewellery & gems ----
reg({ id: 'cowhide', name: 'Cowhide', type: 'material', stackable: true, value: 8, description: 'Tan into leather at a tannery.' });
reg({ id: 'leather', name: 'Leather', type: 'material', stackable: true, value: 15, description: 'Craft into armor with a needle.' });
reg({ id: 'leather_body', name: 'Leather body', type: 'armor', stackable: false, value: 40, description: 'Light leather armor.', equipSlot: 'body', bonuses: { defence: 4 } });
reg({ id: 'leather_chaps', name: 'Leather chaps', type: 'armor', stackable: false, value: 30, description: 'Light leather legwear.', equipSlot: 'legs', bonuses: { defence: 3 } });
reg({ id: 'leather_gloves', name: 'Leather gloves', type: 'armor', stackable: false, value: 10, description: 'Light gloves.', equipSlot: 'hands', bonuses: { defence: 1 } });
reg({ id: 'leather_boots', name: 'Leather boots', type: 'armor', stackable: false, value: 10, description: 'Light boots.', equipSlot: 'feet', bonuses: { defence: 1 } });

reg({ id: 'uncut_sapphire', name: 'Uncut sapphire', type: 'material', stackable: true, value: 15, description: 'Cut with a chisel.' });
reg({ id: 'uncut_emerald', name: 'Uncut emerald', type: 'material', stackable: true, value: 30, description: 'Cut with a chisel.' });
reg({ id: 'uncut_ruby', name: 'Uncut ruby', type: 'material', stackable: true, value: 50, description: 'Cut with a chisel.' });
reg({ id: 'uncut_diamond', name: 'Uncut diamond', type: 'material', stackable: true, value: 100, description: 'Cut with a chisel.' });
reg({ id: 'sapphire', name: 'Sapphire', type: 'material', stackable: true, value: 25, description: 'A cut gem.' });
reg({ id: 'emerald', name: 'Emerald', type: 'material', stackable: true, value: 50, description: 'A cut gem.' });
reg({ id: 'ruby', name: 'Ruby', type: 'material', stackable: true, value: 85, description: 'A cut gem.' });
reg({ id: 'diamond', name: 'Diamond', type: 'material', stackable: true, value: 160, description: 'A cut gem.' });
reg({ id: 'ring_mold', name: 'Ring mold', type: 'tool', stackable: false, value: 10, description: 'Mold gold into rings.' });
reg({ id: 'amulet_mold', name: 'Amulet mold', type: 'tool', stackable: false, value: 10, description: 'Mold gold into amulets.' });
reg({ id: 'gold_ring', name: 'Gold ring', type: 'armor', stackable: false, value: 100, description: 'A plain gold ring.', equipSlot: 'ring', bonuses: {} });
reg({ id: 'sapphire_ring', name: 'Sapphire ring', type: 'armor', stackable: false, value: 150, description: 'A gold ring set with sapphire.', equipSlot: 'ring', bonuses: { magic: 2 } });
reg({ id: 'gold_amulet', name: 'Gold amulet', type: 'armor', stackable: false, value: 150, description: 'A plain gold amulet.', equipSlot: 'amulet', bonuses: {} });
reg({ id: 'ruby_amulet', name: 'Ruby amulet', type: 'armor', stackable: false, value: 300, description: 'A gold amulet set with ruby.', equipSlot: 'amulet', bonuses: { strength: 4 } });

// ---- Fletching ----
reg({ id: 'knife', name: 'Knife', type: 'tool', stackable: false, value: 6, description: 'Whittle logs into bows and arrow shafts.' });
reg({ id: 'bow_string', name: 'Bow string', type: 'material', stackable: true, value: 15, description: 'Strung onto a bow to complete it.' });
reg({ id: 'flax', name: 'Flax', type: 'resource', stackable: true, value: 3, description: 'Spun into bow string.' });
reg({ id: 'feather', name: 'Feather', type: 'material', stackable: true, value: 1, description: 'Fletch onto arrow shafts.' });
reg({ id: 'arrow_shaft', name: 'Arrow shaft', type: 'material', stackable: true, value: 1, description: 'Fletch a bow or attach feathers to make arrows.' });
for (let i = 0; i < TREE_TIERS.length; i++) {
  const t = TREE_TIERS[i];
  const label = t.id === 'normal' ? 'Shortbow' : `${t.name} shortbow`;
  reg({ id: `${t.id}_shortbow_u`, name: `${label} (u)`, type: 'material', stackable: false, value: t.value * 4, description: 'An unstrung shortbow.' });
  reg({
    id: `${t.id}_shortbow`, name: label, type: 'weapon', stackable: false, value: t.value * 8, description: 'A finished shortbow.',
    equipSlot: 'weapon', twoHanded: true, bonuses: { rangedAttack: 4 + i * 7, rangedStrength: 2 + i * 4 },
  });
}

// ---- Construction materials ----
reg({ id: 'stone', name: 'Stone', type: 'resource', stackable: true, value: 3, description: 'Quarried stone for building.' });
reg({ id: 'nails', name: 'Nails', type: 'material', stackable: true, value: 2, description: 'Iron nails for construction.' });

// ---- Meat & misc food from monsters ----
reg({ id: 'raw_meat', name: 'Raw meat', type: 'food', stackable: true, value: 4, description: 'Cook it before eating.', heal: 1 });
reg({ id: 'cooked_meat', name: 'Cooked meat', type: 'food', stackable: true, value: 10, description: 'A hearty meal.', heal: 6 });
reg({ id: 'burnt_meat', name: 'Burnt meat', type: 'food', stackable: true, value: 0, description: 'Charred and inedible.', heal: 0 });
reg({ id: 'bread', name: 'Bread', type: 'food', stackable: true, value: 6, description: 'Simple travel food.', heal: 5 });
reg({ id: 'bones', name: 'Bones', type: 'material', stackable: true, value: 1, description: 'Could be useful for something... eventually.' });

export function getItem(id: string): ItemDef {
  const item = ITEMS[id];
  if (!item) throw new Error(`Unknown item id: ${id}`);
  return item;
}
