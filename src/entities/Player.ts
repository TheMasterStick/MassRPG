import { SKILLS, type SkillId, levelForXp, xpForLevel } from '../data/skills';
import { INVENTORY_SLOTS } from '../core/constants';
import type { EquipSlot } from '../data/items';
import { WORLD_SIZE } from '../world/AeldorData';
import type { WorldPlane } from '../world/types';

export interface InventorySlot { itemId: string; qty: number }
export type CombatStyle = 'melee' | 'ranged' | 'magic';

const WORLD_CENTER = Math.floor(WORLD_SIZE / 2);

export class Player {
  name = 'Adventurer';
  x = WORLD_CENTER;
  y = WORLD_CENTER;
  plane: WorldPlane = 0;
  facing: 'up' | 'down' | 'left' | 'right' = 'down';
  path: { x: number; y: number }[] = [];
  running = false;
  stamina = 100;

  skillsXp: Record<SkillId, number> = {} as Record<SkillId, number>;
  currentHp = 10;
  combatStyle: CombatStyle = 'melee';
  combatTargetId: string | null = null;
  lastAttackTick = 0;

  inventory: (InventorySlot | null)[] = new Array(INVENTORY_SLOTS).fill(null);
  equipment: Partial<Record<EquipSlot, string>> = {};
  equippedAmmoQty = 0;

  respawnPoint = { x: WORLD_CENTER, y: WORLD_CENTER, plane: 0 as WorldPlane };

  action: {
    type: 'gather' | 'produce' | 'build';
    targetX: number;
    targetY: number;
    resourceOrRecipeId: string;
    ticksRemaining: number;
    repeat: boolean;
    qtyRemaining?: number;
  } | null = null;

  constructor() {
    for (const s of SKILLS) this.skillsXp[s.id] = xpForLevel(s.startingLevel);
    this.currentHp = this.maxHp();
  }

  level(skill: SkillId): number {
    return levelForXp(this.skillsXp[skill]);
  }

  maxHp(): number {
    return this.level('hitpoints');
  }

  combatLevel(): number {
    const att = this.level('attack');
    const str = this.level('strength');
    const def = this.level('defence');
    const hp = this.level('hitpoints');
    const ranged = this.level('ranged');
    const magic = this.level('magic');
    const base = 0.25 * (def + hp);
    const melee = 0.325 * (att + str);
    const range = 0.325 * (Math.floor(ranged * 1.5));
    const mage = 0.325 * (Math.floor(magic * 1.5));
    return Math.floor(base + Math.max(melee, range, mage));
  }

  isAlive(): boolean {
    return this.currentHp > 0;
  }

  findEmptySlot(): number {
    return this.inventory.findIndex((s) => s === null);
  }

  countItem(itemId: string): number {
    let total = 0;
    for (const s of this.inventory) if (s && s.itemId === itemId) total += s.qty;
    return total;
  }

  hasItem(itemId: string, qty = 1): boolean {
    return this.countItem(itemId) >= qty;
  }
}
