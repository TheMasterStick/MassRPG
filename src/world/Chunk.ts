import { CHUNK_SIZE } from '../core/constants';
import type { ResourceType, StructureType, TileType } from './types';
import { WorldGen } from './WorldGen';

export interface InventorySlotData { itemId: string; qty: number }

export interface ChunkDiffs {
  depletedResources: Record<string, number>; // localKey -> tick when available again
  plantedCrops: Record<string, { cropId: string; plantedAtTick: number }>; // localKey
  structures: Record<string, { type: StructureType; storage?: InventorySlotData[] }>; // player-built, localKey
  monsterCooldowns: Record<string, number>; // localKey -> tick when spawn point can respawn
}

export function emptyDiffs(): ChunkDiffs {
  return { depletedResources: {}, plantedCrops: {}, structures: {}, monsterCooldowns: {} };
}

export function localKey(lx: number, ly: number): string {
  return `${lx},${ly}`;
}

export class Chunk {
  readonly cx: number;
  readonly cy: number;
  readonly tiles: TileType[];
  readonly resources: Map<string, ResourceType> = new Map();
  readonly naturalStructures: Map<string, StructureType> = new Map();
  readonly spawnPoints: { lx: number; ly: number; monsterId: string }[] = [];
  diffs: ChunkDiffs;

  constructor(cx: number, cy: number, gen: WorldGen, savedDiffs?: ChunkDiffs) {
    this.cx = cx;
    this.cy = cy;
    this.diffs = savedDiffs ?? emptyDiffs();
    this.tiles = new Array(CHUNK_SIZE * CHUNK_SIZE);

    const getTile = (wx: number, wy: number) => gen.tileAt(wx, wy);

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wy = cy * CHUNK_SIZE + ly;
        const tile = gen.tileAt(wx, wy);
        this.tiles[ly * CHUNK_SIZE + lx] = tile;
        const key = localKey(lx, ly);

        const structure = gen.villageStructureAt(wx, wy);
        if (structure) {
          this.naturalStructures.set(key, structure);
          continue;
        }

        const resource = gen.resourceAt(wx, wy, getTile);
        if (resource) {
          this.resources.set(key, resource);
          continue;
        }

        const monsterId = gen.monsterSpawnAt(wx, wy, tile);
        if (monsterId) this.spawnPoints.push({ lx, ly, monsterId });
      }
    }
  }

  tileLocal(lx: number, ly: number): TileType {
    return this.tiles[ly * CHUNK_SIZE + lx];
  }
}
