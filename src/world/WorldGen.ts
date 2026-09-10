import { SimplexNoise } from '../core/Noise';
import { hash2D } from '../core/Random';
import type { ResourceType, StructureType, TileType } from './types';
import { RESOURCE_SPAWNS } from '../data/biomes';
import { MONSTERS } from '../data/monsters';
import {
  WORLD_SIZE, LAND_OUTLINES, REGIONS, REGION_BIOME, RIVERS, ROADS, RUINS,
  settlementAt, oreVeinResourceAt, progressionLevelRangeAt, progressionZonesAt,
  type Region, type River, type Ruin, type Town, type WorldPoint,
} from './AeldorData';
import { getSettlementBuildings, settlementStreetTile, type TownBuilding } from './Buildings';

const ROAD_HALF_WIDTH = 1.6;
const BEACH_WIDTH = 6;
const SHALLOW_WATER_WIDTH = 28;

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

  // Metal ore remains authored-only. Adding an ore to a biome table must not
  // accidentally repaint an entire mountain/desert with valuable rocks.
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

  // Historical method name retained because other systems may still call it.
  // It now means "inside any authored settlement safe area".
  isVillage(x: number, y: number): boolean {
    return settlementAt(x, y) !== null;
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

    return this.townWallCellAt(x, y);
  }

  private townWallCellAt(x: number, y: number): StructureType | null {
    const town = settlementAt(x, y);
    if (!town || !town.walled) return null;
    const lx = x - town.x;
    const ly = y - town.y;
    if (Math.max(Math.abs(lx), Math.abs(ly)) !== town.radius) return null;

    // Four broad gates align with the settlement's main avenues. External road
    // routing can later choose which gates are actually used.
    if (Math.abs(lx) <= 3 || Math.abs(ly) <= 3) return null;

    if (town.kind === 'capital' || town.kind === 'city' || town.style === 'stone') return 'wall_stone';
    if (town.style === 'desert') return 'wall_brick';
    return 'fence';
  }

  private buildingCellAt(x: number, y: number): BuildingCell | null {
    const town = settlementAt(x, y);
    if (!town) return null;
    const list = getSettlementBuildings(town);
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

  private settlementGround(town: Town): TileType {
    if (town.style === 'desert') return 'desert';
    if (town.style === 'stone') return 'plains';
    return 'grass';
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
      const wiggle = this.edgeWarp.fbm(x / 220, y / 220, 2) * 1.2;
      if (Math.hypot(x - px, y - py) + wiggle <= ROAD_HALF_WIDTH) return true;
    }
    return false;
  }

  private warpedPoint(x: number, y: number, scale: number, amount: number): WorldPoint {
    const dx = this.edgeWarp.fbm(x / scale + 17.3, y / scale - 31.7, 2) * amount;
    const dy = this.edgeWarp.fbm(x / scale - 47.1, y / scale + 73.9, 2) * amount;
    return { x: x + dx, y: y + dy };
  }

  private inRegion(x: number, y: number, region: Region): boolean {
    const p = this.warpedPoint(x, y, region.edgeWarpScale, region.edgeWarpTiles);
    return pointInPolygon(p.x, p.y, region.points);
  }

  private landPoint(x: number, y: number): WorldPoint {
    return this.warpedPoint(x, y, 1800, 110);
  }

  private landOutlineAt(x: number, y: number): WorldPoint[] | null {
    const p = this.landPoint(x, y);
    for (const outline of LAND_OUTLINES) {
      if (pointInPolygon(p.x, p.y, outline)) return outline;
    }
    return null;
  }

  private nearestCoastDistance(x: number, y: number): number {
    const p = this.landPoint(x, y);
    let best = Infinity;
    for (const outline of LAND_OUTLINES) {
      best = Math.min(best, distanceToPolygonEdges(p.x, p.y, outline));
    }
    return best;
  }

  private riverAt(x: number, y: number): River | null {
    for (const river of RIVERS) {
      const minX = Math.min(...river.points.map((p) => p.x)) - river.width - 1;
      const maxX = Math.max(...river.points.map((p) => p.x)) + river.width + 1;
      const minY = Math.min(...river.points.map((p) => p.y)) - river.width - 1;
      const maxY = Math.max(...river.points.map((p) => p.y)) + river.width + 1;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      if (distanceToPolyline(x, y, river.points) <= river.width) return river;
    }
    return null;
  }

  private fields(x: number, y: number): { moisture: number; temperature: number } {
    // Macro-scale filler fields: authored regions control the broad map while
    // these fields stop the remaining grasslands from becoming one flat colour.
    const moisture = this.moistureNoise.fbm(x / 1100 + 100, y / 1100 + 100, 4);
    const temperature = this.temperatureNoise.fbm(x / 2600 - 200, y / 2600 - 200, 3);
    return { moisture, temperature };
  }

  private fillerBiome(x: number, y: number): TileType {
    const { moisture: m, temperature: t } = this.fields(x, y);
    if (m > 0.43) return 'swamp';
    if (m > 0.19) return 'forest';
    if (t < -0.2) return 'taiga';
    if (m < -0.2) return 'plains';
    return 'grass';
  }

  tileAt(x: number, y: number): TileType {
    if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return 'deep_water';

    // Settlements are intentionally authored game spaces. Their buildings and
    // streets win over underlying wilderness so a lakeside town does not have
    // random water/forest tiles cutting through its interior.
    const town = settlementAt(x, y);
    if (town) {
      const building = this.buildingCellAt(x, y);
      if (building) return building.ch === 'D' ? 'path' : building.instance.prefab.floor;

      const lx = x - town.x;
      const ly = y - town.y;
      const street = settlementStreetTile(town, lx, ly);
      if (street) return street;
      return this.settlementGround(town);
    }

    const ruin = ruinMembership(x, y);
    const applyRuin = (biome: TileType): TileType => {
      if (!ruin) return biome;
      if (biome === 'water' || biome === 'deep_water') {
        const distRatio = Math.hypot(x - ruin.x, y - ruin.y) / ruin.radius;
        return distRatio < 0.5 ? 'rubble' : biome;
      }
      return hash2D(this.seed, x, y, 6000) < 0.45 ? 'rubble' : biome;
    };

    // Authored inland seas/lakes cut into the merged supercontinent.
    for (const r of LAKE_REGIONS) {
      if (this.inRegion(x, y, r)) return applyRuin('water');
    }

    const landOutline = this.landOutlineAt(x, y);
    const coastDistance = this.nearestCoastDistance(x, y);
    if (!landOutline) return applyRuin(coastDistance <= SHALLOW_WATER_WIDTH ? 'water' : 'deep_water');

    // Rivers are true local water tiles. They are additionally overdrawn on
    // the continental map so their narrow gameplay width remains readable.
    if (this.riverAt(x, y)) return applyRuin('water');

    // Roads are only allowed to become path terrain once we already know the
    // tile is land. This prevents the simple road graph from paving the sea.
    if (this.onRoad(x, y)) return 'path';

    for (const r of SNOWCAP_REGIONS) {
      if (this.inRegion(x, y, r)) return applyRuin(REGION_BIOME[r.kind]!);
    }
    for (const r of OTHER_REGIONS) {
      if (this.inRegion(x, y, r)) return applyRuin(REGION_BIOME[r.kind]!);
    }

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
      if (WorldGen.METAL_ORES.has(resource) || resource === 'rock_gem') continue;
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

    let candidates = biomeMonsters.filter((monster) =>
      zones.some((zone) => monster.level >= zone.minLevel && monster.level <= zone.maxLevel),
    );

    // The present monster roster is much smaller than the new 1-300 world
    // progression. Until higher-tier creatures are authored, a biome with no
    // exact candidate falls back to its strongest suitable existing monster.
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
    best = Math.min(best, distanceToSegment(x, y, points[i], points[(i + 1) % points.length]));
  }
  return best;
}

function distanceToPolyline(x: number, y: number, points: WorldPoint[]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    best = Math.min(best, distanceToSegment(x, y, points[i], points[i + 1]));
  }
  return best;
}

function distanceToSegment(x: number, y: number, a: WorldPoint, b: WorldPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(x - a.x, y - a.y);
  let t = ((x - a.x) * abx + (y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * abx;
  const py = a.y + t * aby;
  return Math.hypot(x - px, y - py);
}

function ruinMembership(x: number, y: number): Ruin | null {
  for (const r of RUINS) {
    const dx = r.x - x;
    const dy = r.y - y;
    if (dx * dx + dy * dy <= r.radius * r.radius) return r;
  }
  return null;
}
