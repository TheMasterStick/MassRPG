import { CHUNK_SIZE, MONSTER_RESPAWN_TICKS } from '../core/constants';
import { Chunk, emptyDiffs, localKey, type ChunkDiffs, type InventorySlotData } from './Chunk';
import { WorldGen } from './WorldGen';
import type { ElevationLevel, ResourceType, StructureType, TileType, WorldPlane, WorldPos } from './types';
import { TILE_VISUALS } from './types';
import { Monster } from '../entities/Monster';
import { CROP_TIERS, HERB_TIERS } from '../data/items';
import { getEditorElevationAt, getPlaneLinkAt } from './EditorWorld';
import { WORLD_SIZE } from './AeldorData';

function chunkKey(plane: WorldPlane, cx: number, cy: number): string {
  return `${plane}:${cx},${cy}`;
}
function worldToChunk(x: number, y: number): { cx: number; cy: number; lx: number; ly: number } {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  return { cx, cy, lx, ly };
}

const GROW_TICKS: Record<string, number> = {};
for (const c of CROP_TIERS) GROW_TICKS[c.id] = c.growTicks;
for (const h of HERB_TIERS) GROW_TICKS[h.id] = h.growTicks;

export interface CropState {
  cropId: string;
  ready: boolean;
  progress: number;
}

export class World {
  readonly seed: number;
  readonly gen: WorldGen;
  readonly chunks = new Map<string, Chunk>();
  private savedDiffs = new Map<string, ChunkDiffs>();
  activePlane: WorldPlane = 0;
  tick = 0;
  monsters: Monster[] = [];
  bank: (InventorySlotData | null)[] = [];

  constructor(seed: number) {
    this.seed = seed;
    this.gen = new WorldGen(seed);
  }

  setActivePlane(plane: WorldPlane) {
    if (this.activePlane === plane) return;
    this.activePlane = plane;
    // Monsters are simulated only on the currently occupied plane. They will
    // respawn from authored spawners when that plane becomes active again.
    this.monsters = [];
  }

  loadSavedDiffs(entries: Record<string, ChunkDiffs>) {
    for (const [k, v] of Object.entries(entries)) {
      const normalized = /^-?[012]:/.test(k) ? k : `0:${k}`;
      this.savedDiffs.set(normalized, v);
    }
  }

  getChunk(cx: number, cy: number, plane: WorldPlane = this.activePlane): Chunk {
    const key = chunkKey(plane, cx, cy);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      const saved = this.savedDiffs.get(key);
      chunk = new Chunk(cx, cy, plane, this.gen, saved);
      this.savedDiffs.delete(key);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getChunkAt(x: number, y: number, plane: WorldPlane = this.activePlane): Chunk {
    const { cx, cy } = worldToChunk(x, y);
    return this.getChunk(cx, cy, plane);
  }

  getTile(x: number, y: number, plane: WorldPlane = this.activePlane): TileType {
    const { lx, ly } = worldToChunk(x, y);
    return this.getChunkAt(x, y, plane).tileLocal(lx, ly);
  }

  getElevation(x: number, y: number, plane: WorldPlane = this.activePlane): ElevationLevel {
    return getEditorElevationAt(x, y, WORLD_SIZE, plane);
  }

  getStructure(x: number, y: number, plane: WorldPlane = this.activePlane): StructureType | undefined {
    const { lx, ly } = worldToChunk(x, y);
    const chunk = this.getChunkAt(x, y, plane);
    const key = localKey(lx, ly);
    return chunk.diffs.structures[key]?.type ?? chunk.naturalStructures.get(key);
  }

  placeStructure(x: number, y: number, type: StructureType) {
    const { lx, ly } = worldToChunk(x, y);
    const chunk = this.getChunkAt(x, y);
    chunk.diffs.structures[localKey(lx, ly)] = { type, storage: type === 'storage_chest' ? [] : undefined };
  }

  getChestStorage(x: number, y: number): InventorySlotData[] | undefined {
    const { lx, ly } = worldToChunk(x, y);
    const chunk = this.getChunkAt(x, y);
    return chunk.diffs.structures[localKey(lx, ly)]?.storage;
  }

  getResourceNode(x: number, y: number, plane: WorldPlane = this.activePlane): ResourceType | undefined {
    const { lx, ly } = worldToChunk(x, y);
    return this.getChunkAt(x, y, plane).resources.get(localKey(lx, ly));
  }

  isResourceAvailable(x: number, y: number): boolean {
    const { lx, ly } = worldToChunk(x, y);
    const chunk = this.getChunkAt(x, y);
    const key = localKey(lx, ly);
    if (!chunk.resources.has(key)) return false;
    const respawnAt = chunk.diffs.depletedResources[key];
    if (respawnAt === undefined) return true;
    if (this.tick >= respawnAt) {
      delete chunk.diffs.depletedResources[key];
      return true;
    }
    return false;
  }

  depleteResource(x: number, y: number, respawnDelayTicks: number) {
    const { lx, ly } = worldToChunk(x, y);
    this.getChunkAt(x, y).diffs.depletedResources[localKey(lx, ly)] = this.tick + respawnDelayTicks;
  }

  plantCrop(x: number, y: number, cropId: string) {
    const { lx, ly } = worldToChunk(x, y);
    this.getChunkAt(x, y).diffs.plantedCrops[localKey(lx, ly)] = { cropId, plantedAtTick: this.tick };
  }

  getCropState(x: number, y: number): CropState | null {
    const { lx, ly } = worldToChunk(x, y);
    const planted = this.getChunkAt(x, y).diffs.plantedCrops[localKey(lx, ly)];
    if (!planted) return null;
    const growTicks = GROW_TICKS[planted.cropId] ?? 40;
    const elapsed = this.tick - planted.plantedAtTick;
    const progress = Math.min(1, elapsed / growTicks);
    return { cropId: planted.cropId, ready: progress >= 1, progress };
  }

  harvestCrop(x: number, y: number) {
    const { lx, ly } = worldToChunk(x, y);
    delete this.getChunkAt(x, y).diffs.plantedCrops[localKey(lx, ly)];
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    if (!TILE_VISUALS[tile].walkable) return false;
    const structure = this.getStructure(x, y);
    if (structure && structure !== 'campfire') return false;
    if (this.isResourceAvailable(x, y)) {
      const res = this.getResourceNode(x, y)!;
      if (!res.startsWith('fishing_')) return false;
    }
    return true;
  }

  /** A normal step may climb/drop one elevation level. A 2+ level edge is a cliff. */
  canStep(fromX: number, fromY: number, toX: number, toY: number): boolean {
    if (!this.isWalkable(toX, toY)) return false;
    return Math.abs(this.getElevation(toX, toY) - this.getElevation(fromX, fromY)) <= 1;
  }

  getPlaneLink(x: number, y: number) {
    return getPlaneLinkAt(x, y, WORLD_SIZE, this.activePlane);
  }

  // ---- Monsters ----
  ensureSpawns(activeChunks: Chunk[]) {
    for (const chunk of activeChunks) {
      if (chunk.plane !== this.activePlane) continue;
      for (const sp of chunk.spawnPoints) {
        const wx = chunk.cx * CHUNK_SIZE + sp.lx;
        const wy = chunk.cy * CHUNK_SIZE + sp.ly;
        const key = localKey(sp.lx, sp.ly);
        const cooldown = chunk.diffs.monsterCooldowns[key];
        if (cooldown !== undefined && this.tick < cooldown) continue;
        const spawnId = `${chunk.plane}|${chunk.cx},${chunk.cy}:${key}`;
        const alreadyAlive = this.monsters.some((m) => m.spawnLocalKey === spawnId);
        if (alreadyAlive) continue;
        if (cooldown !== undefined) delete chunk.diffs.monsterCooldowns[key];
        if (!this.isWalkable(wx, wy)) continue;
        this.monsters.push(new Monster(sp.monsterId, wx, wy, spawnId));
      }
    }
  }

  killMonster(monster: Monster) {
    const [planePart, rest] = monster.spawnLocalKey.includes('|') ? monster.spawnLocalKey.split('|') : ['0', monster.spawnLocalKey];
    const [chunkPart, key] = rest.split(':');
    const [cx, cy] = chunkPart.split(',').map(Number);
    const plane = Number(planePart) as WorldPlane;
    this.getChunk(cx, cy, plane).diffs.monsterCooldowns[key] = this.tick + MONSTER_RESPAWN_TICKS;
    this.monsters = this.monsters.filter((m) => m.instanceId !== monster.instanceId);
  }

  activeChunksAround(pos: WorldPos, radius: number): Chunk[] {
    const { cx, cy } = worldToChunk(pos.x, pos.y);
    const result: Chunk[] = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) result.push(this.getChunk(cx + dx, cy + dy));
    }
    return result;
  }

  serializeDiffs(): Record<string, ChunkDiffs> {
    const out: Record<string, ChunkDiffs> = {};
    for (const [key, chunk] of this.chunks) {
      const d = chunk.diffs;
      const hasContent = Object.keys(d.depletedResources).length > 0
        || Object.keys(d.plantedCrops).length > 0
        || Object.keys(d.structures).length > 0
        || Object.keys(d.monsterCooldowns).length > 0;
      if (hasContent) out[key] = d;
    }
    for (const [key, d] of this.savedDiffs) out[key] = d;
    return out;
  }
}

export function emptyChunkDiffs(): ChunkDiffs {
  return emptyDiffs();
}
