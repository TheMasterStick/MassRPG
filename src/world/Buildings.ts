// Small multi-tile building prefabs (walls, interior floor, furniture) placed
// at fixed offsets in every town. Modeled on hand-drawn reference blueprints
// (house_small_01, smithy_01) - a fixed rectangular footprint with a wall
// ring, a door gap, and furniture at fixed interior positions. This replaces
// a couple of the old loose point structures (bed, furnace, anvil, workbench)
// that used to just sit on open ground with no building around them.

import type { StructureType } from './types';

export type FloorMaterial = 'floor_wood' | 'floor_cobble';
export type RoofMaterial = 'tile' | 'tatch';

export interface BuildingFurniture {
  x: number; // local offset within the grid, 0..width-1
  y: number; // local offset within the grid, 0..height-1
  type: StructureType;
}

export interface BuildingPrefab {
  id: string;
  width: number;
  height: number;
  floor: FloorMaterial;
  roof: RoofMaterial;
  // One row per y, north (top) to south (bottom/front). Each character:
  // 'W' wall, 'w' wall with a window, '.' interior floor, 'D' door (floor,
  // no wall - the gap in the perimeter).
  grid: string[];
  furniture: BuildingFurniture[];
}

export const HOUSE_SMALL_01: BuildingPrefab = {
  id: 'house_small_01',
  width: 7,
  height: 6,
  floor: 'floor_wood',
  roof: 'tatch',
  grid: [
    'WWWWWWW',
    'W.....W',
    'W.....W',
    'W.....W',
    'W.....W',
    'WwWDWwW',
  ],
  furniture: [
    { x: 5, y: 1, type: 'bed' },
    { x: 1, y: 3, type: 'storage_chest' },
  ],
};

export const SMITHY_01: BuildingPrefab = {
  id: 'smithy_01',
  width: 8,
  height: 9,
  floor: 'floor_cobble',
  roof: 'tile',
  grid: [
    'WWWWWWWW',
    'W......W',
    'W......W',
    'W......W',
    'W......W',
    'W......W',
    'W......W',
    'W......W',
    'WwWDDWwW',
  ],
  furniture: [
    { x: 3, y: 1, type: 'furnace' },
    { x: 5, y: 2, type: 'storage_chest' },
    { x: 1, y: 4, type: 'workbench' },
    { x: 4, y: 4, type: 'anvil' },
  ],
};

// Placed relative to each town's center - dx/dy are the world offset of the
// prefab grid's top-left corner (grid[0][0]). Kept well clear of the loose
// VILLAGE_STRUCTURES positions (bank_chest, general_store, cooking_range,
// loom currently sit within +/-3 tiles of center) and of each other.
export interface TownBuilding { dx: number; dy: number; prefab: BuildingPrefab }

export const TOWN_BUILDINGS: TownBuilding[] = [
  { dx: -10, dy: 2, prefab: HOUSE_SMALL_01 },
  { dx: 3, dy: 2, prefab: SMITHY_01 },
];
