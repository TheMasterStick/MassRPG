import { CHUNK_SIZE } from '../core/constants';
import type { ResourceType, StructureType, TileType } from './types';
import { WorldGen } from './WorldGen';
import { getEditorCell, getEditorTerrainStrokeAt, hasOwnEditorField } from './EditorWorld';
import { WORLD_SIZE } from './AeldorData';

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

    const getTile = (wx: number, wy: number): TileType => {
      const edit = getEditorCell(wx, wy, WORLD_SIZE);
      if (edit?.tile) return edit.tile;
      const stroke = getEditorTerrainStrokeAt(wx, wy, WORLD_SIZE);
      if (stroke) return stroke.tile ?? gen.tileAt(wx, wy);
      return gen.tileAt(wx, wy);
    };

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wy = cy * CHUNK_SIZE + ly;
        const edit = getEditorCell(wx, wy, WORLD_SIZE);
        const terrainStroke = edit?.tile ? undefined : getEditorTerrainStrokeAt(wx, wy, WORLD_SIZE);
        const tile = edit?.tile ?? terrainStroke?.tile ?? gen.tileAt(wx, wy);
        const suppressProcedural = edit?.suppressProcedural ?? terrainStroke?.suppressProcedural ?? false;
        this.tiles[ly * CHUNK_SIZE + lx] = tile;
        const key = localKey(lx, ly);

        // Manual editor objects always win. If the terrain brush was painted
        // with procedural generation disabled, un-authored structures,
        // resources and monsters are suppressed for that tile.
        let structure: StructureType | null = null;
        if (hasOwnEditorField(edit, 'structure')) structure = edit?.structure ?? null;
        else if (!suppressProcedural) structure = gen.villageStructureAt(wx, wy);
        if (structure) {
          this.naturalStructures.set(key, structure);
          continue;
        }

        let resource: ResourceType | null = null;
        if (hasOwnEditorField(edit, 'resource')) resource = edit?.resource ?? null;
        else if (!suppressProcedural) resource = gen.resourceAt(wx, wy, getTile);
        if (resource) {
          this.resources.set(key, resource);
          continue;
        }

        let monsterId: string | null = null;
        if (hasOwnEditorField(edit, 'spawner')) monsterId = edit?.spawner ?? null;
        else if (!suppressProcedural) monsterId = gen.monsterSpawnAt(wx, wy, tile);
        if (monsterId) this.spawnPoints.push({ lx, ly, monsterId });
      }
    }
  }

  tileLocal(lx: number, ly: number): TileType {
    return this.tiles[ly * CHUNK_SIZE + lx];
  }
}
