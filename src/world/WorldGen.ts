import { SimplexNoise } from '../core/Noise';
import { hash2D } from '../core/Random';
import type { ResourceType, StructureType, TileType } from './types';
import { RESOURCE_SPAWNS } from '../data/biomes';
import { monstersForBiomeNearOrigin } from '../data/monsters';
import {
  WORLD_SIZE, REGIONS, REGION_BIOME, ROADS, RUINS,
  nearestTown, nearestTownDistance, type Region, type Ruin,
} from './AeldorData';
import { TOWN_BUILDINGS, ALL_TOWN_BUILDINGS, type TownBuilding } from './Buildings';

// Wide enough to comfortably fit the largest town building (smithy_01, up to
// 11 tiles from center) plus a little margin, so village-only effects (path/
// grass terrain, no wild resource/monster spawns) cover the whole town.
const VILLAGE_RADIUS = 13;
// The capital is a proper city, not a village - a much larger safe/urban
// radius, cobblestone streets further out than the small starter-town path
// circle, and its perimeter wall sits right at the edge of that radius.
const CAPITAL_RADIUS = 26;
const CAPITAL_STREET_RADIUS = 22;
const TOWN_WALL_RADIUS = 15; // just outside VILLAGE_RADIUS, clears both town buildings
const CAPITAL_WALL_RADIUS = CAPITAL_RADIUS;
const ROAD_HALF_WIDTH = 1.6;

export interface VillageStructure { x: number; y: number; type: StructureType }

const VILLAGE_STRUCTURES: VillageStructure[] = [
  { x: 3, y: 0, type: 'bank_chest' },
  { x: -3, y: 0, type: 'general_store' },
  { x: -1, y: 3, type: 'cooking_range' },
  { x: -2, y: -2, type: 'loom' },
];

interface BuildingCell { ch: string; localX: number; localY: number; originX: number; originY: number; instance: TownBuilding }

const SNOWCAP_REGIONS = REGIONS.filter((r) => r.kind === 'snowcap');
const OTHER_REGIONS = REGIONS.filter((r) => r.kind !== 'snowcap');

export class WorldGen {
  readonly seed: number;
  private moistureNoise: SimplexNoise;
  private temperatureNoise: SimplexNoise;
  private continentWarp: SimplexNoise;
  private edgeWarp: SimplexNoise;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.moistureNoise = new SimplexNoise(this.seed ^ 0x2222);
    this.temperatureNoise = new SimplexNoise(this.seed ^ 0x3333);
    this.continentWarp = new SimplexNoise(this.seed ^ 0x4444);
    this.edgeWarp = new SimplexNoise(this.seed ^ 0x5555);
  }

  isVillage(x: number, y: number): boolean {
    const town = nearestTown(x, y);
    const dist = Math.hypot(x - town.x, y - town.y);
    return dist <= (town.capital ? CAPITAL_RADIUS : VILLAGE_RADIUS);
  }

  villageStructureAt(x: number, y: number): StructureType | null {
    const building = this.buildingCellAt(x, y);
    if (building) {
      if (building.ch === 'W') return building.instance.prefab.wall;
      if (building.ch === 'w') return 'wall_window';
      const furniture = building.instance.prefab.furniture.find(
        (f) => f.x === building.localX && f.y === building.localY,
      );
      return furniture ? furniture.type : null; // plain floor/door cell - nothing placed there
    }

    const wallCell = this.townWallCellAt(x, y);
    if (wallCell) return wallCell;

    const town = nearestTown(x, y);
    const lx = x - town.x;
    const ly = y - town.y;
    if (Math.abs(lx) > VILLAGE_RADIUS || Math.abs(ly) > VILLAGE_RADIUS) return null;
    for (const s of VILLAGE_STRUCTURES) if (s.x === lx && s.y === ly) return s.type;
    return null;
  }

  /** A square perimeter wall/fence ring at a fixed distance from the town center - stone for the capital's city wall, timber fence for every other town - with a gap left wherever a road actually passes through, so roads always double as gates instead of the wall blocking them. */
  private townWallCellAt(x: number, y: number): StructureType | null {
    const town = nearestTown(x, y);
    const radius = town.capital ? CAPITAL_WALL_RADIUS : TOWN_WALL_RADIUS;
    const lx = x - town.x;
    const ly = y - town.y;
    if (Math.max(Math.abs(lx), Math.abs(ly)) !== radius) return null;
    if (this.onRoad(x, y)) return null;
    return town.capital ? 'wall_stone' : 'fence';
  }

  private buildingCellAt(x: number, y: number): BuildingCell | null {
    const town = nearestTown(x, y);
    const list = town.capital ? ALL_TOWN_BUILDINGS : TOWN_BUILDINGS;
    for (const b of list) {
      const originX = town.x + b.dx;
      const originY = town.y + b.dy;
      const lx = x - originX;
      const ly = y - originY;
      if (lx < 0 || ly < 0 || lx >= b.prefab.width || ly >= b.prefab.height) continue;
      return { ch: b.prefab.grid[ly][lx], localX: lx, localY: ly, originX, originY, instance: b };
    }
    return null;
  }

  /** For the renderer's roof overlay: which building (if any) covers this tile, and which edge of the roof rectangle it's on (the eave-trimmed piece goes around the whole perimeter, oriented outward; 'none' means the interior, which gets the plain repeating piece). The door cell itself is left with no roof at all, so its path tile stays visible year-round - the roof otherwise hides the whole building (door included) from outside, leaving no way to spot the entrance. */
  roofCellAt(x: number, y: number): { roof: 'tile' | 'tatch'; edge: 'top' | 'bottom' | 'left' | 'right' | 'none'; originX: number; originY: number } | null {
    const b = this.buildingCellAt(x, y);
    if (!b || b.ch === 'D') return null;
    const { prefab } = b.instance;
    let edge: 'top' | 'bottom' | 'left' | 'right' | 'none' = 'none';
    if (b.localY === 0) edge = 'top';
    else if (b.localY === prefab.height - 1) edge = 'bottom';
    else if (b.localX === 0) edge = 'left';
    else if (b.localX === prefab.width - 1) edge = 'right';
    return { roof: prefab.roof, edge, originX: b.originX, originY: b.originY };
  }

  /** Which building instance (identified by its world origin) this tile belongs to, if any - used to hide that specific building's roof once the player steps inside it. */
  buildingOriginAt(x: number, y: number): { originX: number; originY: number } | null {
    const b = this.buildingCellAt(x, y);
    return b ? { originX: b.originX, originY: b.originY } : null;
  }

  private onRoad(x: number, y: number): boolean {
    for (const r of ROADS) {
      const abx = r.bx - r.ax;
      const aby = r.by - r.ay;
      const len2 = abx * abx + aby * aby;
      if (len2 === 0) continue;
      // quick reject via bounding box before the more expensive projection
      const minX = Math.min(r.ax, r.bx) - 60, maxX = Math.max(r.ax, r.bx) + 60;
      const minY = Math.min(r.ay, r.by) - 60, maxY = Math.max(r.ay, r.by) + 60;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      let t = ((x - r.ax) * abx + (y - r.ay) * aby) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = r.ax + t * abx;
      const py = r.ay + t * aby;
      const wiggle = this.edgeWarp.fbm(x / 200, y / 200, 2) * 1.2;
      const dist = Math.hypot(x - px, y - py) + wiggle;
      if (dist <= ROAD_HALF_WIDTH) return true;
    }
    return false;
  }

  private continentValue(x: number, y: number): number {
    const cx = WORLD_SIZE / 2;
    const cy = WORLD_SIZE / 2;
    const half = (WORLD_SIZE / 2) * 0.985;
    const nx = (x - cx) / half;
    const ny = (y - cy) / half;
    // A superellipse (rather than a circle) so the landmass reaches
    // toward the map's corners like the reference maps, instead of
    // leaving them all as ocean.
    const dist = Math.pow(Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4), 0.25);
    const warp = this.continentWarp.fbm(x / 1100, y / 1100, 4) * 0.2;
    return 1 - dist + warp;
  }

  private regionMembership(x: number, y: number, r: Region): number {
    let dx = x - r.cx;
    let dy = y - r.cy;
    if (r.rotation) {
      const cos = Math.cos(-r.rotation);
      const sin = Math.sin(-r.rotation);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx; dy = ry;
    }
    const nx = dx / r.rx;
    const ny = dy / r.ry;
    let dist = Math.sqrt(nx * nx + ny * ny);
    const warp = this.edgeWarp.fbm(x / r.edgeWarpScale, y / r.edgeWarpScale, 3);
    dist -= warp * r.edgeWarpStrength;
    return dist; // < 1 means inside
  }

  private fields(x: number, y: number): { moisture: number; temperature: number } {
    const moisture = this.moistureNoise.fbm(x / 40 + 100, y / 40 + 100, 4);
    const temperature = this.temperatureNoise.fbm(x / 90 - 200, y / 90 - 200, 3);
    return { moisture, temperature };
  }

  /** Wilderness filler biome for land that isn't inside any authored region. */
  private fillerBiome(x: number, y: number): TileType {
    const { moisture: m, temperature: t } = this.fields(x, y);
    if (m > 0.34) return 'swamp';
    if (m > 0.12) return 'forest';
    if (t < -0.1) return 'taiga';
    if (m < -0.22) return 'plains';
    return 'grass';
  }

  tileAt(x: number, y: number): TileType {
    if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return 'deep_water';

    const building = this.buildingCellAt(x, y);
    if (building) {
      if (building.ch === '.') return building.instance.prefab.floor;
      // The door renders as the same path texture that leads up to town, so
      // the one gap in the wall ring reads as an obvious way in rather than
      // blending into the (differently-textured) interior floor either side.
      if (building.ch === 'D') return 'path';
    }

    if (this.isVillage(x, y)) {
      const town = nearestTown(x, y);
      const dist = Math.hypot(x - town.x, y - town.y);
      if (town.capital) return dist < CAPITAL_STREET_RADIUS ? 'floor_cobble' : 'grass';
      return dist < 5.5 ? 'path' : 'grass';
    }

    if (this.onRoad(x, y)) return 'path';

    const ruin = ruinMembership(x, y);
    const applyRuin = (biome: TileType): TileType => {
      if (!ruin) return biome;
      if (biome === 'water' || biome === 'deep_water') {
        // A ruin sitting in water gets a small rocky island at its core
        // (e.g. Serpent's Spire), with the water still surrounding it.
        const distRatio = Math.hypot(x - ruin.x, y - ruin.y) / ruin.radius;
        return distRatio < 0.5 ? 'rubble' : biome;
      }
      return hash2D(this.seed, x, y, 6000) < 0.45 ? 'rubble' : biome;
    };

    const cv = this.continentValue(x, y);
    if (cv < -0.07) return applyRuin('deep_water');
    if (cv < 0) return applyRuin('water');
    if (cv < 0.035) return applyRuin('beach');

    for (const r of SNOWCAP_REGIONS) {
      if (this.regionMembership(x, y, r) < 1) return applyRuin(REGION_BIOME[r.kind]!);
    }
    for (const r of OTHER_REGIONS) {
      if (this.regionMembership(x, y, r) < 1) return applyRuin(REGION_BIOME[r.kind]!);
    }

    return applyRuin(this.fillerBiome(x, y));
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
    if (this.isVillage(x, y) || this.onRoad(x, y)) return null;
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
    if ((tile === 'swamp' || tile === 'grass' || tile === 'plains')) {
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
    if (this.isVillage(x, y) || this.onRoad(x, y)) return null;
    if (!this.isLandWalkable(tile)) return null;
    const roll = hash2D(this.seed, x, y, 5000);
    if (roll > 0.02) return null;
    const distance = nearestTownDistance(x, y);
    const candidates = monstersForBiomeNearOrigin(tile, distance);
    if (candidates.length === 0) return null;
    const idx = Math.floor(hash2D(this.seed, x, y, 5001) * candidates.length);
    return candidates[Math.min(idx, candidates.length - 1)].id;
  }
}

function ruinMembership(x: number, y: number): Ruin | null {
  for (const r of RUINS) {
    const dx = r.x - x;
    const dy = r.y - y;
    if (dx * dx + dy * dy <= r.radius * r.radius) return r;
  }
  return null;
}
