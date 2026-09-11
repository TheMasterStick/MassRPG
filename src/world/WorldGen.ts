import type { ResourceType, StructureType, TileType } from './types';
import { getEditorMarkers } from './EditorWorld';
import { WORLD_SIZE } from './AeldorData';

/**
 * Geography is entirely hand-authored. This class only supplies a deliberately
 * sparse ambient population layer in otherwise untouched authored tiles:
 * occasional trees and creatures. Exact editor resources/spawners always win,
 * and an explicit null in the editor suppresses this fallback for that tile.
 */
export class WorldGen {
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  /** Settlement markers are broad monster-safe zones. Mining areas are not. */
  isVillage(x: number, y: number): boolean {
    for (const marker of getEditorMarkers(WORLD_SIZE, 0)) {
      if (marker.type === 'mining_area') continue;
      const radius = marker.name.trim().toLowerCase() === 'capital city' ? 280
        : marker.type === 'city' ? 190
        : marker.type === 'castle' ? 150
        : marker.type === 'town' ? 110
        : marker.type === 'village' ? 70
        : 45;
      if (Math.max(Math.abs(x - marker.x), Math.abs(y - marker.y)) <= radius) return true;
    }
    return false;
  }

  villageStructureAt(_x: number, _y: number): StructureType | null {
    return null;
  }

  roofCellAt(_x: number, _y: number): {
    roof: 'tile' | 'tatch';
    edge: 'top' | 'bottom' | 'left' | 'right' | 'none';
    originX: number;
    originY: number;
  } | null {
    return null;
  }

  buildingOriginAt(_x: number, _y: number): { originX: number; originY: number } | null {
    return null;
  }

  tileAt(_x: number, _y: number): TileType {
    return 'deep_water';
  }

  /**
   * Sparse deterministic ambient trees. The probabilities are intentionally
   * low: even forests remain easy to walk through, while open country only
   * receives an occasional tree for visual variety and early Woodcutting.
   */
  resourceAt(
    x: number,
    y: number,
    getTile: (x: number, y: number) => TileType,
  ): ResourceType | null {
    const tile = getTile(x, y);
    const chance = tile === 'forest' ? 0.0045
      : tile === 'taiga' ? 0.0035
      : tile === 'swamp' ? 0.0010
      : tile === 'grass' ? 0.00022
      : tile === 'plains' ? 0.00018
      : 0;
    if (chance <= 0 || this.roll(x, y, 11) >= chance) return null;

    const pick = this.roll(x, y, 12);
    if (tile === 'forest') {
      if (pick < 0.50) return 'tree_normal';
      if (pick < 0.78) return 'tree_oak';
      if (pick < 0.90) return 'tree_willow';
      if (pick < 0.98) return 'tree_maple';
      return 'tree_yew';
    }
    if (tile === 'taiga') {
      if (pick < 0.62) return 'tree_normal';
      if (pick < 0.84) return 'tree_oak';
      if (pick < 0.97) return 'tree_maple';
      return 'tree_yew';
    }
    if (tile === 'swamp') return pick < 0.70 ? 'tree_willow' : 'tree_normal';
    if (tile === 'plains') return pick < 0.74 ? 'tree_normal' : 'tree_oak';
    return pick < 0.70 ? 'tree_normal' : pick < 0.92 ? 'tree_oak' : 'tree_willow';
  }

  /**
   * Very sparse deterministic wildlife/enemy population. In a typical 5x5
   * active-chunk area this should amount to only a few ambient creatures, not
   * the old wall-to-wall combat field. Strong monsters are mostly left to the
   * user's authored spawn anchors.
   */
  monsterSpawnAt(x: number, y: number, tile: TileType): string | null {
    let chance = 0;
    if (tile === 'grass' || tile === 'plains') chance = 1 / 14000;
    else if (tile === 'forest') chance = 1 / 20000;
    else if (tile === 'taiga') chance = 1 / 24000;
    else if (tile === 'swamp') chance = 1 / 24000;
    else if (tile === 'mountain') chance = 1 / 36000;
    else if (tile === 'snow') chance = 1 / 36000;
    else if (tile === 'desert') chance = 1 / 30000;
    else return null; // paths, settlements, beaches, water, rubble/floors stay quiet

    // Cheap hash rejection first; marker scanning only happens for rare candidates.
    if (this.roll(x, y, 31) >= chance) return null;
    if (this.isVillage(x, y)) return null;

    const pick = this.roll(x, y, 32);
    if (tile === 'grass' || tile === 'plains') {
      if (pick < 0.34) return 'chicken';
      if (pick < 0.61) return 'cow';
      if (pick < 0.84) return 'rat';
      if (pick < 0.95) return 'goblin';
      return 'bandit';
    }
    if (tile === 'forest') {
      if (pick < 0.33) return 'rat';
      if (pick < 0.60) return 'wolf';
      if (pick < 0.82) return 'giant_spider';
      if (pick < 0.96) return 'goblin';
      return 'moss_giant';
    }
    if (tile === 'taiga') {
      if (pick < 0.58) return 'wolf';
      if (pick < 0.94) return 'frost_wolf';
      return 'troll';
    }
    if (tile === 'swamp') {
      if (pick < 0.34) return 'rat';
      if (pick < 0.62) return 'giant_spider';
      if (pick < 0.82) return 'zombie';
      if (pick < 0.95) return 'dark_wizard';
      return 'moss_giant';
    }
    if (tile === 'mountain') {
      if (pick < 0.45) return 'skeleton';
      if (pick < 0.75) return 'hobgoblin';
      if (pick < 0.90) return 'hill_giant';
      if (pick < 0.98) return 'troll';
      return 'wyvern';
    }
    if (tile === 'snow') return pick < 0.82 ? 'frost_wolf' : 'ice_troll';
    // Desert: mostly ordinary threats; giants/demons remain genuinely uncommon.
    if (pick < 0.48) return 'bandit';
    if (pick < 0.78) return 'skeleton';
    if (pick < 0.92) return 'fire_giant';
    if (pick < 0.985) return 'lesser_demon';
    return 'greater_demon';
  }

  private roll(x: number, y: number, salt: number): number {
    let h = (this.seed ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x119de1f3) ^ Math.imul(salt, 0x27d4eb2d)) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
}
