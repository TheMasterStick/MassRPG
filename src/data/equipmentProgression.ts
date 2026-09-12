import { ITEMS, METAL_TIERS, TREE_TIERS, type ItemDef } from './items';
import { RECIPES, type Recipe } from './recipes';
import type { SkillId } from './skills';

export type MeleeAttackType = 'stab' | 'slash' | 'crush';

export interface WeaponProfile {
  /** Simulation ticks between attacks. Lower values attack faster. */
  speedTicks: number;
  attackType: MeleeAttackType | 'ranged';
}

export interface EquipmentRequirement {
  skill: Extract<SkillId, 'attack' | 'defence' | 'ranged'>;
  level: number;
}

/**
 * Familiar combat progression for the generic metal line. Smithing remains a
 * separate profession with its own substantially higher material-work levels.
 * Dragonite occupies the top generic metal-equipment tier at level 60; future
 * specialist equipment can fill the upper combat levels without making the
 * basic metal ladder run all the way to 99.
 */
const METAL_COMBAT_LEVELS = [1, 1, 5, 20, 30, 40, 60] as const;
const BOW_RANGED_LEVELS = [1, 5, 20, 30, 40, 50] as const;

export const EQUIPMENT_REQUIREMENTS: Record<string, EquipmentRequirement> = {};
export const WEAPON_PROFILES: Record<string, WeaponProfile> = {};

function setRequirement(itemId: string, requirement: EquipmentRequirement) {
  EQUIPMENT_REQUIREMENTS[itemId] = requirement;
}

function setWeaponProfile(itemId: string, profile: WeaponProfile) {
  WEAPON_PROFILES[itemId] = profile;
}

export function equipmentRequirement(itemId: string): EquipmentRequirement | undefined {
  return EQUIPMENT_REQUIREMENTS[itemId];
}

export function weaponProfile(itemId: string | undefined): WeaponProfile | undefined {
  return itemId ? WEAPON_PROFILES[itemId] : undefined;
}

interface WeaponFamily {
  suffix: string;
  label: string;
  bars: number;
  speedTicks: number;
  attackType: MeleeAttackType;
  attackScale: number;
  strengthScale: number;
  valueScale: number;
  twoHanded?: boolean;
  description: string;
}

const EXTRA_WEAPON_FAMILIES: WeaponFamily[] = [
  {
    suffix: 'longsword', label: 'longsword', bars: 2, speedTicks: 5, attackType: 'slash',
    attackScale: 1.05, strengthScale: 1.15, valueScale: 10,
    description: 'A deliberate, heavier sword with more reach and power than a standard sword.',
  },
  {
    suffix: 'mace', label: 'mace', bars: 1, speedTicks: 4, attackType: 'crush',
    attackScale: 0.90, strengthScale: 1.10, valueScale: 7,
    description: 'A balanced crushing weapon built to deliver force through armour.',
  },
  {
    suffix: 'warhammer', label: 'warhammer', bars: 3, speedTicks: 6, attackType: 'crush',
    attackScale: 0.80, strengthScale: 1.35, valueScale: 11,
    description: 'A slow, heavy crushing weapon that sacrifices accuracy for impact.',
  },
  {
    suffix: 'battleaxe', label: 'battleaxe', bars: 3, speedTicks: 6, attackType: 'slash',
    attackScale: 0.95, strengthScale: 1.45, valueScale: 12,
    description: 'A heavy chopping weapon focused on powerful blows.',
  },
  {
    suffix: '2h_sword', label: 'two-handed sword', bars: 3, speedTicks: 7, attackType: 'slash',
    attackScale: 1.10, strengthScale: 1.70, valueScale: 14, twoHanded: true,
    description: 'A very slow but extremely powerful sword that occupies both hands.',
  },
];

function addRecipe(recipe: Recipe) {
  if (!RECIPES.some((existing) => existing.id === recipe.id)) RECIPES.push(recipe);
}

function addItem(item: ItemDef) {
  if (!ITEMS[item.id]) ITEMS[item.id] = item;
}

/**
 * Register the combat meaning of existing equipment and add the first broader
 * set of generic weapon families. Bonuses provide the accuracy-versus-strength
 * weighting; WeaponProfile provides timing and physical attack type.
 */
export function registerCombatEquipment() {
  for (let i = 0; i < METAL_TIERS.length; i++) {
    const metal = METAL_TIERS[i];
    const combatLevel = METAL_COMBAT_LEVELS[i] ?? 99;
    const atk = 4 + i * 6;
    const str = 3 + i * 6;

    // Existing baseline weapons now have real timing/type differences.
    setRequirement(`${metal.id}_sword`, { skill: 'attack', level: combatLevel });
    setWeaponProfile(`${metal.id}_sword`, { speedTicks: 4, attackType: 'slash' });

    setRequirement(`${metal.id}_dagger`, { skill: 'attack', level: combatLevel });
    setWeaponProfile(`${metal.id}_dagger`, { speedTicks: 3, attackType: 'stab' });

    // Generic metal armour is Defence-gated independently from Smithing.
    for (const suffix of ['helmet', 'platebody', 'platelegs', 'shield', 'boots', 'gloves']) {
      setRequirement(`${metal.id}_${suffix}`, { skill: 'defence', level: combatLevel });
    }

    for (const family of EXTRA_WEAPON_FAMILIES) {
      const itemId = `${metal.id}_${family.suffix}`;
      addItem({
        id: itemId,
        name: `${metal.name} ${family.label}`,
        type: 'weapon',
        stackable: false,
        value: metal.value * family.valueScale,
        description: `${family.description} Made from ${metal.name.toLowerCase()}.`,
        equipSlot: 'weapon',
        twoHanded: family.twoHanded,
        bonuses: {
          attack: Math.max(1, Math.round(atk * family.attackScale)),
          strength: Math.max(1, Math.round(str * family.strengthScale)),
        },
      });
      setRequirement(itemId, { skill: 'attack', level: combatLevel });
      setWeaponProfile(itemId, { speedTicks: family.speedTicks, attackType: family.attackType });
      addRecipe({
        id: `smith_${metal.id}_${family.suffix}`,
        name: `${metal.name} ${family.label}`,
        skill: 'smithing',
        levelRequired: metal.smithLevel,
        inputs: [{ item: `${metal.id}_bar`, qty: family.bars }],
        outputItem: itemId,
        outputQty: 1,
        xp: family.bars * (8 + i * 4),
        station: 'anvil',
        toolRequired: 'hammer',
        ticks: 2 + family.bars,
        category: 'smithing',
      });
    }
  }

  for (let i = 0; i < TREE_TIERS.length; i++) {
    const tree = TREE_TIERS[i];
    const bowId = `${tree.id}_shortbow`;
    setRequirement(bowId, { skill: 'ranged', level: BOW_RANGED_LEVELS[i] ?? 99 });
    setWeaponProfile(bowId, { speedTicks: 5, attackType: 'ranged' });
  }
}
