import { SimplexNoise } from '../core/Noise';
import { hash2D } from '../core/Random';
import type { ResourceType, StructureType, TileType } from './types';
import { RESOURCE_SPAWNS } from '../data/biomes';
import { monstersForBiomeNearOrigin } from '../data/monsters';

const VILLAGE_RADIUS = 7;

export interface VillageStructure { x: number; y: number; type: StructureType }

const VILLAGE_STRUCTURES: VillageStructure[] = [
  { x: 3, y: 0, type: 'bank_chest' },
  { x: -3, y: 0, type: 'general_store' },
  { x: 0, y: 3, type: 'furnace' },
  { x: 1, y: 3, type: 'anvil' },
  { x: -1, y: 3, type: 'cooking_range' },
  { x: 0, y: -3, type: 'bed' },
  { x: 2, y: -2, type: 'workbench' },
  { x: -2, y: -2, type: 'loom' },
];

export class WorldGen {
  readonly seed: number;
  private elevationNoise: SimplexNoise;
  private moistureNoise: SimplexNoise;
  private temperatureNoise: SimplexNoise;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.elevationNoise = new SimplexNoise(this.seed ^ 0x1111);
    this.moistureNoise = new SimplexNoise(this.seed ^ 0x2222);
    this.temperatureNoise = new SimplexNoise(this.seed ^ 0x3333);
  }

  isVillage(x: number, y: number): boolean {
    return x * x + y * y <= VILLAGE_RADIUS * VILLAGE_RADIUS;
  }

  villageStructureAt(x: number, y: number): StructureType | null {
    for (const s of VILLAGE_STRUCTURES) if (s.x === x && s.y === y) return s.type;
    return null;
  }

  fields(x: number, y: number): { elevation: number; moisture: number; temperature: number } {
    const elevation = this.elevationNoise.fbm(x / 48, y / 48, 5);
    const moisture = this.moistureNoise.fbm(x / 40 + 100, y / 40 + 100, 4);
    const temperature = this.temperatureNoise.fbm(x / 90 - 200, y / 90 - 200, 3);
    return { elevation, moisture, temperature };
  }

  tileAt(x: number, y: number): TileType {
    if (this.isVillage(x, y)) {
      const dist = Math.sqrt(x * x + y * y);
      return dist < 5.5 ? 'path' : 'grass';
    }
    const { elevation: e, moisture: m, temperature: t } = this.fields(x, y);

    if (e < -0.32) return 'deep_water';
    if (e < -0.14) return 'water';
    if (e < -0.07) return 'beach';
    if (e > 0.5) return 'mountain';
    if (t < -0.3) return 'snow';
    if (t > 0.32 && m < -0.05) return 'desert';
    if (m > 0.32) return 'swamp';
    if (m > 0.12) return 'forest';
    if (t < -0.05) return 'taiga';
    if (m < -0.22) return 'plains';
    return 'grass';
  }

  private isWaterTile(t: TileType): boolean {
    return t === 'water' || t === 'deep_water';
  }
  private isLandWalkable(t: TileType): boolean {
    return t !== 'water' && t !== 'deep_water';
  }

  // Resource placement needs to see neighbouring tiles for water-adjacency
  // rules (fishing spots, willows), so it takes a tile lookup callback.
  resourceAt(x: number, y: number, getTile: (x: number, y: number) => TileType): ResourceType | null {
    if (this.isVillage(x, y)) return null;
    const tile = getTile(x, y);

    if (this.isWaterTile(tile)) {
      let adjacentLand = false;
      let adjacentDeep = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nt = getTile(x + dx, y + dy);
        if (this.isLandWalkable(nt)) adjacentLand = true;
        if (nt === 'deep_water') adjacentDeep = true;
      }
      if (!adjacentLand) return null;
      const roll = hash2D(this.seed, x, y, 900);
      if (tile === 'deep_water' && adjacentDeep) {
        if (roll < 0.02) return 'fishing_swordfish';
        if (roll < 0.06) return 'fishing_lobster';
      } else if (roll < 0.09) {
        return 'fishing_shrimp';
      }
      return null;
    }

    if (!this.isLandWalkable(tile)) return null;

    // Willows favour water-adjacent fertile ground.
    if ((tile === 'swamp' || tile === 'grass' || tile === 'plains') ) {
      let nearWater = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (this.isWaterTile(getTile(x + dx, y + dy))) { nearWater = true; break; }
      }
      if (nearWater && hash2D(this.seed, x, y, 901) < 0.1) return 'tree_willow';
    }

    const rules = RESOURCE_SPAWNS[tile];
    if (!rules || rules.length === 0) return null;
    for (let i = 0; i < rules.length; i++) {
      const roll = hash2D(this.seed, x, y, 1000 + i);
      if (roll < rules[i].chance) return rules[i].resource;
    }
    return null;
  }

  // A sparse set of tiles per chunk become monster spawn points.
  monsterSpawnAt(x: number, y: number, tile: TileType): string | null {
    if (this.isVillage(x, y)) return null;
    if (!this.isLandWalkable(tile)) return null;
    const roll = hash2D(this.seed, x, y, 5000);
    if (roll > 0.02) return null;
    const distance = Math.sqrt(x * x + y * y);
    const candidates = monstersForBiomeNearOrigin(tile, distance);
    if (candidates.length === 0) return null;
    const idx = Math.floor(hash2D(this.seed, x, y, 5001) * candidates.length);
    return candidates[Math.min(idx, candidates.length - 1)].id;
  }
}
