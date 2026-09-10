// Settlement building prefabs and deterministic town/city layout generation.
//
// Design target: RuneScape-style function density combined with WoW-style
// district/road readability. A settlement is no longer two prefabs beside a
// chest; its kind controls its physical footprint, service buildings, street
// network and approximate building count.

import { hash2D } from '../core/Random';
import type { StructureType, TileType } from './types';
import type { SettlementKind, Town } from './AeldorData';

export type FloorMaterial = 'floor_wood' | 'floor_brick' | 'floor_cobble';
export type RoofMaterial = 'tile' | 'tatch';
export type WallMaterial = 'wall' | 'wall_brick' | 'wall_stone' | 'wall_cobble';

export interface BuildingFurniture {
  x: number;
  y: number;
  type: StructureType;
}

export interface BuildingPrefab {
  id: string;
  width: number;
  height: number;
  wall: WallMaterial;
  floor: FloorMaterial;
  roof: RoofMaterial;
  // 'W' wall, 'w' window wall, '.' floor, 'D' door/open threshold.
  grid: string[];
  furniture: BuildingFurniture[];
}

export const HOUSE_SMALL_01: BuildingPrefab = {
  id: 'house_small_01', width: 7, height: 6,
  wall: 'wall', floor: 'floor_wood', roof: 'tatch',
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

export const HOUSE_SMALL_02: BuildingPrefab = {
  id: 'house_small_02', width: 8, height: 6,
  wall: 'wall', floor: 'floor_wood', roof: 'tatch',
  grid: [
    'WWWWWWWW',
    'W......W',
    'W......W',
    'W......W',
    'W......W',
    'WWwDDwWW',
  ],
  furniture: [
    { x: 1, y: 1, type: 'bed' },
    { x: 6, y: 3, type: 'storage_chest' },
  ],
};

export const HOUSE_SMALL_03: BuildingPrefab = {
  id: 'house_small_03', width: 6, height: 7,
  wall: 'wall', floor: 'floor_wood', roof: 'tatch',
  grid: [
    'WWWWWW',
    'W....W',
    'W....W',
    'W....W',
    'W....W',
    'W....W',
    'WwDDwW',
  ],
  furniture: [
    { x: 4, y: 1, type: 'bed' },
    { x: 1, y: 4, type: 'storage_chest' },
  ],
};

export const SMITHY_01: BuildingPrefab = {
  id: 'smithy_01', width: 8, height: 9,
  wall: 'wall_cobble', floor: 'floor_cobble', roof: 'tile',
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

export const INN_01: BuildingPrefab = {
  id: 'inn_01', width: 12, height: 10,
  wall: 'wall', floor: 'floor_wood', roof: 'tatch',
  grid: [
    'WWWWWWWWWWWW',
    'W..........W',
    'W..........W',
    'W..........W',
    'W..........W',
    'W..........W',
    'W..........W',
    'W..........W',
    'W..........W',
    'WwWWWDDWWWwW',
  ],
  furniture: [
    { x: 2, y: 2, type: 'bed' },
    { x: 9, y: 2, type: 'bed' },
    { x: 2, y: 7, type: 'cooking_range' },
    { x: 9, y: 7, type: 'storage_chest' },
  ],
};

export const BANK_01: BuildingPrefab = {
  id: 'bank_01', width: 10, height: 8,
  wall: 'wall_cobble', floor: 'floor_cobble', roof: 'tile',
  grid: [
    'WWWWWWWWWW',
    'W........W',
    'W........W',
    'W........W',
    'W........W',
    'W........W',
    'W........W',
    'WwWWDDWwWW',
  ],
  furniture: [
    { x: 2, y: 2, type: 'bank_chest' },
    { x: 7, y: 2, type: 'bank_chest' },
    { x: 5, y: 5, type: 'storage_chest' },
  ],
};

export const GENERAL_STORE_01: BuildingPrefab = {
  id: 'general_store_01', width: 10, height: 8,
  wall: 'wall', floor: 'floor_wood', roof: 'tatch',
  grid: [
    'WWWWWWWWWW',
    'W........W',
    'W........W',
    'W........W',
    'W........W',
    'W........W',
    'W........W',
    'WwWWDDWwWW',
  ],
  furniture: [
    { x: 5, y: 3, type: 'general_store' },
    { x: 2, y: 5, type: 'storage_chest' },
    { x: 7, y: 5, type: 'storage_chest' },
  ],
};

export const WORKSHOP_01: BuildingPrefab = {
  id: 'workshop_01', width: 9, height: 8,
  wall: 'wall', floor: 'floor_wood', roof: 'tatch',
  grid: [
    'WWWWWWWWW',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'WwWDDWwWW',
  ],
  furniture: [
    { x: 2, y: 3, type: 'workbench' },
    { x: 6, y: 3, type: 'storage_chest' },
  ],
};

export const TANNERY_01: BuildingPrefab = {
  ...WORKSHOP_01,
  id: 'tannery_01',
  furniture: [
    { x: 2, y: 3, type: 'tannery' },
    { x: 6, y: 3, type: 'storage_chest' },
  ],
};

export const WEAVER_01: BuildingPrefab = {
  ...WORKSHOP_01,
  id: 'weaver_01',
  furniture: [
    { x: 2, y: 3, type: 'loom' },
    { x: 6, y: 3, type: 'storage_chest' },
  ],
};

export const WAREHOUSE_01: BuildingPrefab = {
  id: 'warehouse_01', width: 12, height: 9,
  wall: 'wall_cobble', floor: 'floor_cobble', roof: 'tile',
  grid: [
    'WWWWWWWWWWWW',
    'W..........W',
    'W..........W',
    'W..........W',
    'W..........W',
    'W..........W',
    'W..........W',
    'W..........W',
    'WWWWDDWWWWWW',
  ],
  furniture: [
    { x: 2, y: 2, type: 'storage_chest' },
    { x: 5, y: 2, type: 'storage_chest' },
    { x: 8, y: 2, type: 'storage_chest' },
  ],
};

export const CHAPEL_01: BuildingPrefab = {
  id: 'chapel_01', width: 9, height: 12,
  wall: 'wall_stone', floor: 'floor_cobble', roof: 'tile',
  grid: [
    'WWWWWWWWW',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'W.......W',
    'WWWwDwWWW',
  ],
  furniture: [],
};

const HOUSE_BRICK_01: BuildingPrefab = { ...HOUSE_SMALL_01, id: 'house_brick_01', wall: 'wall_brick', floor: 'floor_brick', roof: 'tile' };
const HOUSE_BRICK_02: BuildingPrefab = { ...HOUSE_SMALL_02, id: 'house_brick_02', wall: 'wall_brick', floor: 'floor_brick', roof: 'tile' };
const HOUSE_COBBLE_01: BuildingPrefab = { ...HOUSE_SMALL_03, id: 'house_cobble_01', wall: 'wall_cobble', floor: 'floor_cobble', roof: 'tile' };

export interface TownBuilding {
  dx: number;
  dy: number;
  prefab: BuildingPrefab;
  district?: 'civic' | 'trade' | 'craft' | 'residential';
}

const BUILDING_TARGET: Record<SettlementKind, number> = {
  farmstead: 3,
  hamlet: 8,
  village: 18,
  town: 42,
  city: 78,
  capital: 130,
};

const LAYOUT_CACHE = new Map<string, TownBuilding[]>();

function overlaps(a: TownBuilding, b: TownBuilding, padding = 2): boolean {
  return !(
    a.dx + a.prefab.width + padding <= b.dx ||
    b.dx + b.prefab.width + padding <= a.dx ||
    a.dy + a.prefab.height + padding <= b.dy ||
    b.dy + b.prefab.height + padding <= a.dy
  );
}

function addIfFree(list: TownBuilding[], building: TownBuilding): boolean {
  if (list.some((other) => overlaps(other, building))) return false;
  list.push(building);
  return true;
}

function cityHouseFor(town: Town, roll: number): BuildingPrefab {
  if (town.style === 'stone') return roll < 0.5 ? HOUSE_COBBLE_01 : HOUSE_BRICK_01;
  if (town.style === 'desert') return roll < 0.65 ? HOUSE_BRICK_01 : HOUSE_COBBLE_01;
  if ((town.kind === 'capital' || town.kind === 'city') && roll < 0.55) {
    return roll < 0.25 ? HOUSE_BRICK_02 : HOUSE_COBBLE_01;
  }
  if (roll < 0.34) return HOUSE_SMALL_01;
  if (roll < 0.67) return HOUSE_SMALL_02;
  return HOUSE_SMALL_03;
}

function serviceBuildings(town: Town): TownBuilding[] {
  const list: TownBuilding[] = [];
  const add = (dx: number, dy: number, prefab: BuildingPrefab, district: TownBuilding['district']) => {
    addIfFree(list, { dx, dy, prefab, district });
  };

  if (town.kind === 'farmstead') {
    add(-6, -8, HOUSE_SMALL_02, 'residential');
    add(5, 3, WORKSHOP_01, 'craft');
    add(-8, 5, HOUSE_SMALL_01, 'residential');
    return list;
  }

  if (town.kind === 'hamlet') {
    add(-11, -9, HOUSE_SMALL_02, 'residential');
    add(4, -8, GENERAL_STORE_01, 'trade');
    add(-5, 5, HOUSE_SMALL_01, 'residential');
    add(-20, -20, HOUSE_SMALL_01, 'residential');
    add(10, -20, HOUSE_SMALL_03, 'residential');
    add(-20, 9, HOUSE_SMALL_02, 'residential');
    add(11, 9, HOUSE_SMALL_01, 'residential');
    add(-5, 16, HOUSE_SMALL_03, 'residential');
    return list;
  }

  // Every village has a clear functional centre rather than loose utility
  // objects sitting outdoors.
  add(-15, -17, GENERAL_STORE_01, 'trade');
  add(4, -18, INN_01, 'trade');

  if (town.kind === 'village') {
    add(-11, 6, SMITHY_01, 'craft');
    add(5, 7, HOUSE_SMALL_02, 'residential');
    return list;
  }

  // Town and above: bank/store/inn/smithy form the central functional core.
  add(-18, 5, BANK_01, 'civic');
  add(4, 6, SMITHY_01, 'craft');
  add(-4, -42, CHAPEL_01, 'civic');
  add(26, -17, WORKSHOP_01, 'craft');
  add(-34, -17, WEAVER_01, 'craft');

  if (town.kind === 'town') {
    add(25, 9, WAREHOUSE_01, 'trade');
    return list;
  }

  // Cities get secondary service nodes so the whole settlement does not feel
  // like one tiny RuneScape village copied into a giant wall.
  add(48, -35, INN_01, 'trade');
  add(-58, -32, GENERAL_STORE_01, 'trade');
  add(48, 22, WAREHOUSE_01, 'trade');
  add(-58, 24, TANNERY_01, 'craft');
  add(18, 48, SMITHY_01, 'craft');

  if (town.kind === 'capital') {
    add(-78, 4, BANK_01, 'civic');
    add(72, 3, GENERAL_STORE_01, 'trade');
    add(-76, 62, INN_01, 'trade');
    add(67, 65, WAREHOUSE_01, 'trade');
    add(-8, 78, SMITHY_01, 'craft');
    add(86, -64, WEAVER_01, 'craft');
    add(-95, -64, TANNERY_01, 'craft');
  }

  return list;
}

function streetLine(v: number, spacing: number, halfWidth: number): boolean {
  const m = ((v % spacing) + spacing) % spacing;
  return m <= halfWidth || m >= spacing - halfWidth;
}

export function settlementStreetTile(town: Town, localX: number, localY: number): TileType | null {
  const ax = Math.abs(localX);
  const ay = Math.abs(localY);

  if ((town.kind === 'town' || town.kind === 'city' || town.kind === 'capital') && ax <= 9 && ay <= 9) {
    return 'floor_cobble';
  }

  if (ax <= 2 || ay <= 2) {
    return town.kind === 'city' || town.kind === 'capital' || town.kind === 'town' ? 'floor_cobble' : 'path';
  }

  if (town.kind === 'capital') {
    if (streetLine(localX, 48, 1) || streetLine(localY, 48, 1)) return 'floor_cobble';
  } else if (town.kind === 'city') {
    if (streetLine(localX, 42, 1) || streetLine(localY, 42, 1)) return 'floor_cobble';
  } else if (town.kind === 'town') {
    if (streetLine(localX, 34, 1) || streetLine(localY, 34, 1)) return 'path';
  } else if (town.kind === 'village') {
    if (streetLine(localX, 28, 0)) return 'path';
  }

  return null;
}

function generatedResidentialBuildings(town: Town, already: TownBuilding[]): TownBuilding[] {
  const target = BUILDING_TARGET[town.kind];
  const list = [...already];
  if (list.length >= target) return list;

  // Small settlements need tighter lots; cities need larger blocks/courtyards.
  const small = town.kind === 'village';
  const extent = small ? Math.floor(town.radius * 0.9) : Math.max(10, Math.floor(town.radius * 0.76));
  const slotX = small ? 11 : 14;
  const slotY = small ? 10 : 13;
  const centralClearance = small ? 12 : 18;
  let salt = 0;

  for (let y = -extent; y <= extent - slotY; y += slotY) {
    for (let x = -extent; x <= extent - slotX; x += slotX) {
      if (list.length >= target) break;
      const cx = x + Math.floor(slotX / 2);
      const cy = y + Math.floor(slotY / 2);
      if (settlementStreetTile(town, cx, cy)) continue;
      if (Math.abs(cx) < centralClearance && Math.abs(cy) < centralClearance) continue;

      const densityRoll = hash2D(0x51e771e, town.x + x, town.y + y, salt++);
      const density = town.kind === 'capital' ? 0.84
        : town.kind === 'city' ? 0.78
          : town.kind === 'town' ? 0.72
            : town.kind === 'village' ? 0.85
              : 0.58;
      if (densityRoll > density) continue;

      const typeRoll = hash2D(0x19c7a11, town.x + x, town.y + y, salt++);
      let prefab: BuildingPrefab;
      if ((town.kind === 'capital' || town.kind === 'city') && typeRoll > 0.91) prefab = WORKSHOP_01;
      else if ((town.kind === 'capital' || town.kind === 'city' || town.kind === 'town') && typeRoll > 0.86) prefab = WAREHOUSE_01;
      else prefab = cityHouseFor(town, typeRoll);

      const dx = x + Math.floor((slotX - prefab.width) / 2);
      const dy = y + Math.floor((slotY - prefab.height) / 2);
      addIfFree(list, {
        dx,
        dy,
        prefab,
        district: prefab === WAREHOUSE_01 || prefab === WORKSHOP_01 ? 'craft' : 'residential',
      });
    }
    if (list.length >= target) break;
  }

  return list;
}

export function getSettlementBuildings(town: Town): TownBuilding[] {
  const cached = LAYOUT_CACHE.get(town.id);
  if (cached) return cached;
  const layout = generatedResidentialBuildings(town, serviceBuildings(town));
  LAYOUT_CACHE.set(town.id, layout);
  return layout;
}

export function settlementBuildingTarget(kind: SettlementKind): number {
  return BUILDING_TARGET[kind];
}
