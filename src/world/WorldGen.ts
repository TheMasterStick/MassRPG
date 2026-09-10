import type { ResourceType, StructureType, TileType } from './types';

/**
 * The procedural world has deliberately been retired.
 *
 * MassRPG now starts as a blank 180k x 180k ocean and the World Editor is the
 * authoritative source for terrain, structures, resources and monster spawns.
 * This class remains as the base-world API so the rest of the runtime does not
 * need to care whether content was generated or hand-authored.
 */
export class WorldGen {
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  isVillage(_x: number, _y: number): boolean {
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
