import { CHUNK_SIZE } from '../core/constants';
import type { ResourceType, StructureType, TileType, WorldPlane } from './types';
import { WorldGen } from './WorldGen';
import { baseTileForPlane, getEditorCell, hasOwnEditorField } from './EditorWorld';
import { getIndexedTerrainStrokeAt } from './EditorSpatialIndex';
import { WORLD_SIZE } from './AeldorData';

export interface InventorySlotData { itemId: string; qty: number }

export interface ChunkDiffs {
  depletedResources: Record<string, number>;
  plantedCrops: Record<string, { cropId: string; plantedAtTick: number }>;
  structures: Record<string, { type: StructureType; storage?: InventorySlotData[] }>;
  monsterCooldowns: Record<string, number>;
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
  readonly plane: WorldPlane;
  readonly tiles: TileType[];
  readonly resources: Map<string, ResourceType> = new Map();
  readonly naturalStructures: Map<string, StructureType> = new Map();
  readonly spawnPoints: { lx: number; ly: number; monsterId: string }[] = [];
  diffs: ChunkDiffs;

  constructor(cx: number, cy: number, plane: WorldPlane, gen: WorldGen, savedDiffs?: ChunkDiffs) {
    this.cx = cx;
    this.cy = cy;
    this.plane = plane;
    this.diffs = savedDiffs ?? emptyDiffs();
    this.tiles = new Array(CHUNK_SIZE * CHUNK_SIZE);

    const getTile = (wx: number, wy: number): TileType => {
      const edit = getEditorCell(wx, wy, WORLD_SIZE, plane);
      if (edit?.tile) return edit.tile;
      const stroke = getIndexedTerrainStrokeAt(wx, wy, WORLD_SIZE, plane);
      return stroke?.tile ?? baseTileForPlane(plane);
    };

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wy = cy * CHUNK_SIZE + ly;
        const edit = getEditorCell(wx, wy, WORLD_SIZE, plane);
        const terrainStroke = edit?.tile ? undefined : getIndexedTerrainStrokeAt(wx, wy, WORLD_SIZE, plane);
        const tile = edit?.tile ?? terrainStroke?.tile ?? baseTileForPlane(plane);
        this.tiles[ly * CHUNK_SIZE + lx] = tile;
        const key = localKey(lx, ly);

        let structure: StructureType | null = null;
        if (hasOwnEditorField(edit, 'structure')) structure = edit?.structure ?? null;
        else structure = gen.villageStructureAt(wx, wy);
        if (structure) {
          this.naturalStructures.set(key, structure);
          continue;
        }

        let resource: ResourceType | null = null;
        if (hasOwnEditorField(edit, 'resource')) resource = edit?.resource ?? null;
        else resource = gen.resourceAt(wx, wy, getTile);
        if (resource) {
          this.resources.set(key, resource);
          continue;
        }

        let monsterId: string | null = null;
        if (hasOwnEditorField(edit, 'spawner')) monsterId = edit?.spawner ?? null;
        else monsterId = gen.monsterSpawnAt(wx, wy, tile);
        if (monsterId) this.spawnPoints.push({ lx, ly, monsterId });
      }
    }
  }

  tileLocal(lx: number, ly: number): TileType {
    return this.tiles[ly * CHUNK_SIZE + lx];
  }
}
