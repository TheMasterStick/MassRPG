import type { ResourceType, StructureType, TileType } from './types';
import { getEditorMarkers } from './EditorWorld';
import { WORLD_SIZE } from './AeldorData';

/**
 * The procedural world has deliberately been retired.
 *
 * MassRPG starts from the hand-authored World Editor data. This class remains
 * as the base-world API so older runtime systems do not need to know how the
 * world is stored. It never invents terrain/resources/monsters by itself.
 */
export class WorldGen {
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  /**
   * Legacy callers use isVillage() as a monster-safe-zone check. Map that API
   * onto the user's authored settlement markers instead of resurrecting the
   * old procedural town geometry. Mining-area markers intentionally are not
   * safe zones.
   */
  isVillage(x: number, y: number): boolean {
    for (const marker of getEditorMarkers(WORLD_SIZE, 0)) {
      if (marker.type === 'mining_area') continue;
      const radius = marker.name.trim().toLowerCase() === 'capital city' ? 72
        : marker.type === 'city' ? 56
        : marker.type === 'castle' ? 50
        : marker.type === 'town' ? 43
        : marker.type === 'village' ? 32
        : 25;
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

  resourceAt(
    _x: number,
    _y: number,
    _getTile: (x: number, y: number) => TileType,
  ): ResourceType | null {
    return null;
  }

  monsterSpawnAt(_x: number, _y: number, _tile: TileType): string | null {
    return null;
  }
}
