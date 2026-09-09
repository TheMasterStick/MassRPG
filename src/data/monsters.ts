import type { TileType } from '../world/types';

export type CombatStyle = 'melee' | 'ranged' | 'magic';

export interface LootEntry {
  itemId: string;
  min: number;
  max: number;
  weight: number; // relative weight among non-guaranteed drops
}

export interface MonsterDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  attack: number;
  strength: number;
  defence: number;
  attackBonus: number;
  strengthBonus: number;
  defenceBonus: number;
  style: CombatStyle;
  attackSpeedTicks: number; // ticks between attacks
  aggressive: boolean;
  biomes: TileType[];
  color: string;
  size: number; // render radius multiplier
  guaranteedDrops: LootEntry[];
  drops: LootEntry[];
  noDropChance: number; // chance of getting nothing beyond guaranteed drops
}

export const MONSTERS: MonsterDef[] = [
  {
    id: 'chicken', name: 'Chicken', level: 1, hp: 3, attack: 1, strength: 1, defence: 1,
    attackBonus: 0, strengthBonus: 0, defenceBonus: 0, style: 'melee', attackSpeedTicks: 4,
    aggressive: false, biomes: ['plains', 'grass'], color: '#f4f1de', size: 0.5,
    guaranteedDrops: [{ itemId: 'feather', min: 3, max: 8, weight: 1 }],
    drops: [{ itemId: 'raw_meat', min: 1, max: 1, weight: 1 }], noDropChance: 0.2,
  },
  {
    id: 'rat', name: 'Giant rat', level: 2, hp: 5, attack: 2, strength: 1, defence: 1,
    attackBonus: 0, strengthBonus: 0, defenceBonus: 0, style: 'melee', attackSpeedTicks: 4,
    aggressive: false, biomes: ['grass', 'swamp', 'forest'], color: '#6b5847', size: 0.55,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 1, max: 5, weight: 1 }], noDropChance: 0.5,
  },
  {
    id: 'cow', name: 'Cow', level: 2, hp: 8, attack: 1, strength: 1, defence: 1,
    attackBonus: 0, strengthBonus: 0, defenceBonus: 0, style: 'melee', attackSpeedTicks: 5,
    aggressive: false, biomes: ['plains', 'grass'], color: '#e0dccc', size: 0.8,
    guaranteedDrops: [{ itemId: 'cowhide', min: 1, max: 1, weight: 1 }, { itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'raw_meat', min: 1, max: 2, weight: 1 }], noDropChance: 0.1,
  },
  {
    id: 'goblin', name: 'Goblin', level: 5, hp: 13, attack: 5, strength: 5, defence: 4,
    attackBonus: 2, strengthBonus: 2, defenceBonus: 1, style: 'melee', attackSpeedTicks: 4,
    aggressive: true, biomes: ['forest', 'plains', 'swamp'], color: '#6f9e4c', size: 0.75,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [
      { itemId: 'coins', min: 5, max: 25, weight: 5 },
      { itemId: 'bronze_sword', min: 1, max: 1, weight: 1 },
      { itemId: 'bronze_helmet', min: 1, max: 1, weight: 1 },
    ], noDropChance: 0.35,
  },
  {
    id: 'giant_spider', name: 'Giant spider', level: 7, hp: 16, attack: 6, strength: 6, defence: 5,
    attackBonus: 2, strengthBonus: 3, defenceBonus: 2, style: 'melee', attackSpeedTicks: 4,
    aggressive: true, biomes: ['forest', 'swamp', 'taiga'], color: '#2e2a26', size: 0.7,
    guaranteedDrops: [], drops: [{ itemId: 'coins', min: 3, max: 15, weight: 1 }], noDropChance: 0.5,
  },
  {
    id: 'skeleton', name: 'Skeleton', level: 10, hp: 22, attack: 9, strength: 8, defence: 7,
    attackBonus: 4, strengthBonus: 4, defenceBonus: 3, style: 'melee', attackSpeedTicks: 4,
    aggressive: true, biomes: ['mountain', 'desert', 'swamp'], color: '#d8d3c4', size: 0.85,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 5, max: 30, weight: 3 }, { itemId: 'iron_ore', min: 1, max: 2, weight: 1 }], noDropChance: 0.4,
  },
  {
    id: 'bandit', name: 'Bandit', level: 12, hp: 26, attack: 11, strength: 10, defence: 8,
    attackBonus: 5, strengthBonus: 5, defenceBonus: 4, style: 'melee', attackSpeedTicks: 4,
    aggressive: true, biomes: ['desert', 'plains'], color: '#8a6d3b', size: 0.85,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 10, max: 60, weight: 4 }, { itemId: 'iron_dagger', min: 1, max: 1, weight: 1 }], noDropChance: 0.3,
  },
  {
    id: 'wolf', name: 'Wolf', level: 15, hp: 30, attack: 13, strength: 13, defence: 9,
    attackBonus: 6, strengthBonus: 6, defenceBonus: 3, style: 'melee', attackSpeedTicks: 3,
    aggressive: true, biomes: ['taiga', 'forest'], color: '#7d7d7d', size: 0.9,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 5, max: 20, weight: 1 }], noDropChance: 0.5,
  },
  {
    id: 'frost_wolf', name: 'Frost wolf', level: 20, hp: 38, attack: 16, strength: 16, defence: 11,
    attackBonus: 7, strengthBonus: 8, defenceBonus: 4, style: 'melee', attackSpeedTicks: 3,
    aggressive: true, biomes: ['snow', 'taiga'], color: '#bcd9e8', size: 0.95,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 8, max: 35, weight: 3 }, { itemId: 'iron_ore', min: 1, max: 1, weight: 1 }], noDropChance: 0.4,
  },
  {
    id: 'zombie', name: 'Zombie', level: 18, hp: 38, attack: 16, strength: 15, defence: 10,
    attackBonus: 6, strengthBonus: 7, defenceBonus: 4, style: 'melee', attackSpeedTicks: 5,
    aggressive: true, biomes: ['swamp', 'mountain'], color: '#5c6b47', size: 0.9,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 10, max: 40, weight: 3 }, { itemId: 'iron_bar', min: 1, max: 1, weight: 1 }], noDropChance: 0.35,
  },
  {
    id: 'hobgoblin', name: 'Hobgoblin', level: 25, hp: 45, attack: 22, strength: 20, defence: 15,
    attackBonus: 9, strengthBonus: 9, defenceBonus: 6, style: 'melee', attackSpeedTicks: 4,
    aggressive: true, biomes: ['mountain', 'forest'], color: '#4c7a4a', size: 1,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 20, max: 80, weight: 3 }, { itemId: 'steel_sword', min: 1, max: 1, weight: 1 }], noDropChance: 0.35,
  },
  {
    id: 'hill_giant', name: 'Hill giant', level: 28, hp: 60, attack: 24, strength: 26, defence: 18,
    attackBonus: 10, strengthBonus: 12, defenceBonus: 6, style: 'melee', attackSpeedTicks: 5,
    aggressive: true, biomes: ['mountain'], color: '#8f7a5c', size: 1.3,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 30, max: 100, weight: 3 }, { itemId: 'steel_bar', min: 1, max: 2, weight: 1 }], noDropChance: 0.3,
  },
  {
    id: 'dark_wizard', name: 'Dark wizard', level: 22, hp: 40, attack: 10, strength: 10, defence: 12,
    attackBonus: 4, strengthBonus: 4, defenceBonus: 8, style: 'magic', attackSpeedTicks: 5,
    aggressive: true, biomes: ['swamp', 'mountain'], color: '#4b2e6b', size: 0.9,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 15, max: 50, weight: 2 }, { itemId: 'uncut_sapphire', min: 1, max: 1, weight: 1 }], noDropChance: 0.4,
  },
  {
    id: 'moss_giant', name: 'Moss giant', level: 35, hp: 75, attack: 28, strength: 30, defence: 22,
    attackBonus: 12, strengthBonus: 14, defenceBonus: 8, style: 'melee', attackSpeedTicks: 5,
    aggressive: true, biomes: ['forest', 'swamp'], color: '#3f5c33', size: 1.4,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 40, max: 150, weight: 3 }, { itemId: 'uncut_emerald', min: 1, max: 1, weight: 1 }], noDropChance: 0.3,
  },
  {
    id: 'ogre', name: 'Ogre', level: 40, hp: 90, attack: 32, strength: 36, defence: 26,
    attackBonus: 14, strengthBonus: 17, defenceBonus: 10, style: 'melee', attackSpeedTicks: 5,
    aggressive: true, biomes: ['mountain', 'swamp'], color: '#6d5c42', size: 1.5,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 50, max: 180, weight: 3 }, { itemId: 'mithril_ore', min: 1, max: 2, weight: 1 }], noDropChance: 0.3,
  },
  {
    id: 'lesser_demon', name: 'Lesser demon', level: 45, hp: 100, attack: 38, strength: 40, defence: 30,
    attackBonus: 16, strengthBonus: 18, defenceBonus: 12, style: 'melee', attackSpeedTicks: 4,
    aggressive: true, biomes: ['desert', 'mountain'], color: '#a4341f', size: 1.4,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 60, max: 220, weight: 3 }, { itemId: 'adamant_ore', min: 1, max: 2, weight: 1 }], noDropChance: 0.3,
  },
  {
    id: 'ice_troll', name: 'Ice troll', level: 50, hp: 110, attack: 42, strength: 44, defence: 33,
    attackBonus: 18, strengthBonus: 20, defenceBonus: 13, style: 'melee', attackSpeedTicks: 5,
    aggressive: true, biomes: ['snow'], color: '#a8c4cc', size: 1.5,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 70, max: 250, weight: 3 }, { itemId: 'uncut_ruby', min: 1, max: 1, weight: 1 }], noDropChance: 0.3,
  },
  {
    id: 'fire_giant', name: 'Fire giant', level: 55, hp: 130, attack: 46, strength: 50, defence: 36,
    attackBonus: 20, strengthBonus: 23, defenceBonus: 14, style: 'melee', attackSpeedTicks: 5,
    aggressive: true, biomes: ['desert', 'mountain'], color: '#c1502e', size: 1.6,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 100, max: 350, weight: 3 }, { itemId: 'adamant_bar', min: 1, max: 2, weight: 1 }], noDropChance: 0.25,
  },
  {
    id: 'greater_demon', name: 'Greater demon', level: 65, hp: 150, attack: 52, strength: 58, defence: 42,
    attackBonus: 24, strengthBonus: 27, defenceBonus: 17, style: 'melee', attackSpeedTicks: 4,
    aggressive: true, biomes: ['mountain', 'desert'], color: '#7a1f1f', size: 1.7,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 150, max: 450, weight: 3 }, { itemId: 'rune_ore', min: 1, max: 1, weight: 1 }], noDropChance: 0.25,
  },
  {
    id: 'troll', name: 'Mountain troll', level: 70, hp: 170, attack: 56, strength: 62, defence: 45,
    attackBonus: 26, strengthBonus: 30, defenceBonus: 18, style: 'melee', attackSpeedTicks: 5,
    aggressive: true, biomes: ['mountain', 'snow'], color: '#5a6b57', size: 1.8,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 200, max: 500, weight: 3 }, { itemId: 'uncut_diamond', min: 1, max: 1, weight: 1 }], noDropChance: 0.25,
  },
  {
    id: 'wyvern', name: 'Wyvern', level: 80, hp: 200, attack: 62, strength: 68, defence: 55,
    attackBonus: 30, strengthBonus: 34, defenceBonus: 22, style: 'magic', attackSpeedTicks: 4,
    aggressive: true, biomes: ['mountain', 'snow'], color: '#5b7a9e', size: 1.9,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }],
    drops: [{ itemId: 'coins', min: 300, max: 700, weight: 3 }, { itemId: 'rune_bar', min: 1, max: 1, weight: 1 }], noDropChance: 0.2,
  },
  {
    id: 'dragon', name: 'Dragon', level: 95, hp: 260, attack: 72, strength: 80, defence: 65,
    attackBonus: 36, strengthBonus: 40, defenceBonus: 28, style: 'magic', attackSpeedTicks: 5,
    aggressive: true, biomes: ['mountain'], color: '#8c1c1c', size: 2.4,
    guaranteedDrops: [{ itemId: 'bones', min: 1, max: 1, weight: 1 }, { itemId: 'coins', min: 500, max: 1200, weight: 1 }],
    drops: [{ itemId: 'diamond', min: 1, max: 2, weight: 1 }, { itemId: 'rune_sword', min: 1, max: 1, weight: 1 }], noDropChance: 0.1,
  },
];

export function monstersForBiome(biome: TileType): MonsterDef[] {
  return MONSTERS.filter((m) => m.biomes.includes(biome));
}

// Keeps dangerous monsters away from the starting village: difficulty
// scales up gradually the further you wander from world origin.
export function monstersForBiomeNearOrigin(biome: TileType, distanceFromOrigin: number): MonsterDef[] {
  const maxLevel = 4 + distanceFromOrigin * 0.35;
  const inRange = MONSTERS.filter((m) => m.biomes.includes(biome) && m.level <= maxLevel);
  return inRange.length > 0 ? inRange : MONSTERS.filter((m) => m.biomes.includes(biome)).sort((a, b) => a.level - b.level).slice(0, 1);
}

export function getMonster(id: string): MonsterDef {
  const m = MONSTERS.find((mm) => mm.id === id);
  if (!m) throw new Error(`Unknown monster id: ${id}`);
  return m;
}
