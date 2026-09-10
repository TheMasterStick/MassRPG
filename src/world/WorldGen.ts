import { SimplexNoise } from '../core/Noise';
import { hash2D } from '../core/Random';
import type { ResourceType, StructureType, TileType } from './types';
import { RESOURCE_SPAWNS } from '../data/biomes';
import { MONSTERS } from '../data/monsters';
import {
  WORLD_SIZE, CONTINENT_OUTLINE, REGIONS, REGION_BIOME, ROADS, RUINS,
  nearestTown, oreVeinResourceAt, progressionLevelRangeAt, progressionZonesAt,
  type Region, type Ruin, type WorldPoint,
} from './AeldorData';
import { TOWN_BUILDINGS, ALL_TOWN_BUILDINGS, type TownBuilding } from './Buildings';

const VILLAGE_RADIUS = 15;
const CAPITAL_RADIUS = 26;
const CAPITAL_STREET_RADIUS = 22;
const TOWN_WALL_RADIUS = VILLAGE_RADIUS;
const CAPITAL_WALL_RADIUS = CAPITAL_RADIUS;
const ROAD_HALF_WIDTH = 1.6;

// The painted reference map mostly has grass/cliff coastline with occasional
// small sandy pockets. The old continentValue() thresholds made a beach belt
// hundreds of tiles wide. Six tiles keeps beaches local and readable.
const BEACH_WIDTH = 6;
const SHALLOW_WATER_WIDTH = 28;

export interface VillageStructure { x: number; y: number; type: StructureType }

const VILLAGE_STRUCTURES: VillageStructure[] = [
  { x: 3, y: 0, type: 'bank_chest' },
  { x: -3, y: 0, type: 'general_store' },
  { x: -1, y: 3, type: 'cooking_range' },
  { x: -2, y: -2, type: 'loom' },
];

interface BuildingCell {
  ch: string;
  localX: number;
  localY: number;
  originX: number;
  originY: number;
  instance: TownBuilding;
}

const LAKE_REGIONS = REGIONS.filter((r) => r.kind === 'lake');
const SNOWCAP_REGIONS = REGIONS.filter((r) => r.kind === 'snowcap');
const OTHER_REGIONS = REGIONS.filter((r) => r.kind !== 'lake' && r.kind !== 'snowcap');

export class WorldGen {
  readonly seed: number;
  private moistureNoise: SimplexNoise;
  private temperatureNoise: SimplexNoise;
  private edgeWarp: SimplexNoise;
  private groveNoise: SimplexNoise;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.moistureNoise = new SimplexNoise(this.seed ^ 0x2222);
    this.temperatureNoise = new SimplexNoise(this.seed ^ 0x3333);
    this.edgeWarp = new SimplexNoise(this.seed ^ 0x5555);
    this.groveNoise = new SimplexNoise(this.seed ^ 0x6666);
  }

  private static readonly GROVE_THRESHOLD: Partial<Record<ResourceType, number>> = {
    tree_oak: 0.15,
    tree_willow: 0.22,
    tree_maple: 0.28,
    tree_yew: 0.4,
    tree_magic: 0.55,
  };

  private static readonly RESOURCE_TIER_LEVEL: Partial<Record<ResourceType, number>> = {
    tree_normal: 1,
    tree_oak: 15,
    tree_willow: 30,
    tree_maple: 45,
    tree_yew: 60,
    tree_magic: 75,
  };

  // Defence in depth: metal ore is never a generic biome spawn. Authored
  // ORE_VEINS are the only normal source of metal-rock world nodes.
  private static readonly METAL_ORES = new Set<ResourceType>([
    'rock_copper', 'rock_tin', 'rock_iron', 'rock_coal', 'rock_silver',
    'rock_gold', 'rock_mithril', 'rock_adamant', 'rock_rune', 'rock_dragonite',
  ]);

  private groveEligible(resource: ResourceType, x: number, y: number): boolean {
    const threshold = WorldGen.GROVE_THRESHOLD[resource];
    if (threshold === undefined) return true;
    const offset = resource.length * 41;
    const n = this.groveNoise.fbm(x / 140 + offset, y / 140 - offset, 2);
    return n > threshold;
  }

  private resourceAllowedByProgression(resource: ResourceType, x: number, y: number): boolean {
    const requiredLevel = WorldGen.RESOURCE_TIER_LEVEL[resource];
    if (requiredLevel === undefined) return true;
    return requiredLevel <= progressionLevelRangeAt(x, y).maxLevel;
  }

  isVillage(x: number, y: number): boolean {
    const town = nearestTown(x, y);
    const radius = town.capital ? CAPITAL_RADIUS : VILLAGE_RADIUS;
    return Math.max(Math.abs(x - town.x), Math.abs(y - town.y)) <= radius;
  }

  villageStructureAt(x: number, y: number): StructureType | null {
    const building = this.buildingCellAt(x, y);
    if (building) {
      if (building.ch === 'W') return building.instance.prefab.wall;
      if (building.ch === 'w') return 'wall_window';
      const furniture = building.instance.prefab.furniture.find(
        (f) => f.x === building.localX && f.y === building.localY,
      );
      return furniture ? furniture.type : null;
    }

    const wallCell = this.townWallCellAt(x, y);
    if (wallCell) return wallCell;

    const town = nearestTown(x, y);
    const lx = x - town.x;
    const ly = y - town.y;
    const radius = town.capital ? CAPITAL_RADIUS : VILLAGE_RADIUS;
    if (Math.abs(lx) > radius || Math.abs(ly) > radius) return null;
    for (const s of VILLAGE_STRUCTURES) if (s.x === lx && s.y === ly) return s.type;
    return null;
  }

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
      return {
        ch: b.prefab.grid[ly][lx],
        localX: lx,
        localY: ly,
        originX,
        originY,
        instance: b,
      };
    }
    return null;
  }

  roofCellAt(x: number, y: number): {
    roof: 'tile' | 'tatch';
    edge: 'top' | 'bottom' | 'left' | 'right' | 'none';
    originX: number;
    originY: number;
  } | null {
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

      const minX = Math.min(r.ax, r.bx) - 60;
      const maxX = Math.max(r.ax, r.bx) + 60;
      const minY = Math.min(r.ay, r.by) - 60;
      const maxY = Math.max(r.ay, r.by) + 60;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;

      let t = ((x - r.ax) * abx + (y - r.ay) * aby) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = r.ax + t * abx;
      const py = r.ay + t * aby;
      const wiggle = this.edgeWarp.fbm(x / 200, y / 200, 2) * 1.2;
      if (Math.hypot(x - px, y - py) + wiggle <= ROAD_HALF_WIDTH) return true;
    }
    return false;
  }

  // Apply a subtle coherent displacement before polygon tests. This keeps the
  // traced outlines natural without turning them back into noisy blobs.
  private warpedPoint(x: number, y: number, scale: number, amount: number): WorldPoint {
    const dx = this.edgeWarp.fbm(x / scale + 17.3, y / scale - 31.7, 2) * amount;
    const dy = this.edgeWarp.fbm(x / scale - 47.1, y / scale + 73.9, 2) * amount;
    return { x: x + dx, y: y + dy };
  }

  private inRegion(x: number, y: number, region: Region): boolean {
    const p = this.warpedPoint(x, y, region.edgeWarpScale, region.edgeWarpTiles);
    return pointInPolygon(p.x, p.y, region.points);
  }

  private continentPoint(x: number, y: number): WorldPoint {
    return this.warpedPoint(x, y, 360, 45);
  }

  private fields(x: number, y: number): { moisture: number; temperature: number } {
    const moisture = this.moistureNoise.fbm(x / 40 + 100, y / 40 + 100, 4);
    const temperature = this.temperatureNoise.fbm(x / 90 - 200, y / 90 - 200, 3);
    return { moisture, temperature };
  }

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
      if (building.ch === 'D') return 'path';
    }

    if (this.isVillage(x, y)) {
      const town = nearestTown(x, y);
      const squareDist = Math.max(Math.abs(x - town.x), Math.abs(y - town.y));
      if (town.capital) return squareDist < CAPITAL_STREET_RADIUS ? 'floor_cobble' : 'grass';
      return squareDist < 6 ? 'path' : 'grass';
    }

    if (this.onRoad(x, y)) return 'path';

    const ruin = ruinMembership(x, y);
    const applyRuin = (biome: TileType): TileType => {
      if (!ruin) return biome;
      if (biome === 'water' || biome === 'deep_water') {
        const distRatio = Math.hypot(x - ruin.x, y - ruin.y) / ruin.radius;
        return distRatio < 0.5 ? 'rubble' : biome;
      }
      return hash2D(this.seed, x, y, 6000) < 0.45 ? 'rubble' : biome;
    };

    // The central lake/inlet is an authored water shape and therefore wins
    // over the continent's land polygon.
    for (const r of LAKE_REGIONS) {
      if (this.inRegion(x, y, r)) return applyRuin('water');
    }

    const coastPoint = this.continentPoint(x, y);
    const onLand = pointInPolygon(coastPoint.x, coastPoint.y, CONTINENT_OUTLINE);
    const coastDistance = distanceToPolygonEdges(coastPoint.x, coastPoint.y, CONTINENT_OUTLINE);
    if (!onLand) {
      return applyRuin(coastDistance <= SHALLOW_WATER_WIDTH ? 'water' : 'deep_water');
    }

    // Snow sits on top of the mountain range.
    for (const r of SNOWCAP_REGIONS) {
      if (this.inRegion(x, y, r)) return applyRuin(REGION_BIOME[r.kind]!);
    }
    for (const r of OTHER_REGIONS) {
      if (this.inRegion(x, y, r)) return applyRuin(REGION_BIOME[r.kind]!);
    }

    // Only occasional, very narrow sandy shore pockets. Most of the painted
    // Aeldor shoreline is grass or cliff directly against the sea.
    if (coastDistance <= BEACH_WIDTH) {
      const sandyPatch = this.edgeWarp.fbm(x / 180 + 9, y / 180 - 13, 2);
      if (sandyPatch > -0.05) return applyRuin('beach');
    }

    return applyRuin(this.fillerBiome(x, y));
  }

  private isWaterTile(t: TileType): boolean {
    return t === 'water' || t === 'deep_water';
  }

  private isLandWalkable(t: TileType): boolean {
    return t !== 'water' && t !== 'deep_water';
  }

  resourceAt(x: number, y: number, getTile: (x: number, y: number) => TileType): ResourceType | null {
    if (this.isVillage(x, y) || this.onRoad(x, y)) return null;

    const tile = getTile(x, y);

    const vein = oreVeinResourceAt(x, y);
    if (vein && this.isLandWalkable(tile)) return vein;

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

    if (tile === 'swamp' || tile === 'grass' || tile === 'plains') {
      let nearWater = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (this.isWaterTile(getTile(x + dx, y + dy))) {
          nearWater = true;
          break;
        }
      }
      if (nearWater && hash2D(this.seed, x, y, 901) < 0.1) return 'tree_willow';
    }

    const rules = RESOURCE_SPAWNS[tile];
    if (!rules || rules.length === 0) return null;

    for (let i = 0; i < rules.length; i++) {
      const resource = rules[i].resource;
      if (WorldGen.METAL_ORES.has(resource)) continue;
      if (!this.resourceAllowedByProgression(resource, x, y)) continue;
      if (!this.groveEligible(resource, x, y)) continue;
      const roll = hash2D(this.seed, x, y, 1000 + i);
      if (roll < rules[i].chance) return resource;
    }
    return null;
  }

  monsterSpawnAt(x: number, y: number, tile: TileType): string | null {
    if (this.isVillage(x, y) || this.onRoad(x, y)) return null;
    if (!this.isLandWalkable(tile)) return null;

    const roll = hash2D(this.seed, x, y, 5000);
    if (roll > 0.02) return null;

    const zones = progressionZonesAt(x, y);
    const biomeMonsters = MONSTERS.filter((monster) => monster.biomes.includes(tile));

    // Prefer the exact authored level ranges.
    let candidates = biomeMonsters.filter((monster) =>
      zones.some((zone) => monster.level >= zone.minLevel && monster.level <= zone.maxLevel),
    );

    // Some biomes currently have gaps in the monster roster. Gray Wastes is
    // the clearest case: its 20-35 band had no desert monster at all, so the
    // strict filter made the entire desert empty. If a biome has no exact-band
    // candidate, use the strongest suitable monster not above the local cap.
    if (candidates.length === 0) {
      const maxLevel = Math.max(...zones.map((zone) => zone.maxLevel));
      const belowCap = biomeMonsters.filter((monster) => monster.level <= maxLevel);
      if (belowCap.length > 0) {
        const bestLevel = Math.max(...belowCap.map((monster) => monster.level));
        candidates = belowCap.filter((monster) => monster.level >= bestLevel - 5);
      }
    }

    if (candidates.length === 0) return null;
    const idx = Math.floor(hash2D(this.seed, x, y, 5001) * candidates.length);
    return candidates[Math.min(idx, candidates.length - 1)].id;
  }
}

function pointInPolygon(x: number, y: number, points: WorldPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const crosses = ((yi > y) !== (yj > y)) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToPolygonEdges(x: number, y: number, points: WorldPoint[]): number {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 === 0) continue;
    let t = ((x - a.x) * abx + (y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * abx;
    const py = a.y + t * aby;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

function ruinMembership(x: number, y: number): Ruin | null {
  for (const r of RUINS) {
    const dx = r.x - x;
    const dy = r.y - y;
    if (dx * dx + dy * dy <= r.radius * r.radius) return r;
  }
  return null;
}
