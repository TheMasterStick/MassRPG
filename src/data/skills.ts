// The 18 skills, covering combat, gathering, production and support -
// the "usual RuneScape-like" skill set the game is built around.

export type SkillId =
  | 'hitpoints' | 'attack' | 'strength' | 'defence' | 'ranged' | 'magic'
  | 'woodcutting' | 'mining' | 'fishing' | 'farming'
  | 'cooking' | 'firemaking' | 'smithing' | 'crafting' | 'fletching' | 'herblore'
  | 'construction' | 'agility';

export type SkillCategory = 'combat' | 'gathering' | 'production' | 'support';

export interface SkillDef {
  id: SkillId;
  name: string;
  category: SkillCategory;
  color: string;
  startingLevel: number;
}

export const SKILLS: SkillDef[] = [
  { id: 'hitpoints', name: 'Hitpoints', category: 'combat', color: '#c0392b', startingLevel: 10 },
  { id: 'attack', name: 'Attack', category: 'combat', color: '#e74c3c', startingLevel: 1 },
  { id: 'strength', name: 'Strength', category: 'combat', color: '#e67e22', startingLevel: 1 },
  { id: 'defence', name: 'Defence', category: 'combat', color: '#2980b9', startingLevel: 1 },
  { id: 'ranged', name: 'Ranged', category: 'combat', color: '#27ae60', startingLevel: 1 },
  { id: 'magic', name: 'Magic', category: 'combat', color: '#8e44ad', startingLevel: 1 },
  { id: 'woodcutting', name: 'Woodcutting', category: 'gathering', color: '#6d4c2f', startingLevel: 1 },
  { id: 'mining', name: 'Mining', category: 'gathering', color: '#7f8c8d', startingLevel: 1 },
  { id: 'fishing', name: 'Fishing', category: 'gathering', color: '#3498db', startingLevel: 1 },
  { id: 'farming', name: 'Farming', category: 'gathering', color: '#2ecc71', startingLevel: 1 },
  { id: 'cooking', name: 'Cooking', category: 'production', color: '#d35400', startingLevel: 1 },
  { id: 'firemaking', name: 'Firemaking', category: 'production', color: '#e67e22', startingLevel: 1 },
  { id: 'smithing', name: 'Smithing', category: 'production', color: '#95a5a6', startingLevel: 1 },
  { id: 'crafting', name: 'Crafting', category: 'production', color: '#f39c12', startingLevel: 1 },
  { id: 'fletching', name: 'Fletching', category: 'production', color: '#a0522d', startingLevel: 1 },
  { id: 'herblore', name: 'Herblore', category: 'production', color: '#16a085', startingLevel: 1 },
  { id: 'construction', name: 'Construction', category: 'support', color: '#8d6e63', startingLevel: 1 },
  { id: 'agility', name: 'Agility', category: 'support', color: '#f1c40f', startingLevel: 1 },
];

export const MAX_LEVEL = 99;

// Authentic RuneScape XP curve: xp(level) = floor(sum_{l=1}^{level-1} floor(l + 300*2^(l/7)) / 4)
function buildXpTable(): number[] {
  const table = [0, 0]; // index 0 unused, level 1 = 0xp
  let points = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table.push(Math.floor(points / 4));
  }
  return table;
}

export const XP_TABLE = buildXpTable(); // XP_TABLE[level] = xp required to reach that level

export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = MAX_LEVEL; l >= 1; l--) {
    if (xp >= XP_TABLE[l]) { level = l; break; }
  }
  return level;
}

export function xpForLevel(level: number): number {
  return XP_TABLE[Math.max(1, Math.min(MAX_LEVEL, level))];
}

export function xpProgress(xp: number): { level: number; current: number; next: number; pct: number } {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, current: xp, next: xp, pct: 1 };
  const cur = XP_TABLE[level];
  const next = XP_TABLE[level + 1];
  return { level, current: xp, next, pct: (xp - cur) / (next - cur) };
}
