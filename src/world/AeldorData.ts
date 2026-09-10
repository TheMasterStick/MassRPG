// The fixed, authored world of Aeldor: a 15000x15000 tile map replacing
// the old infinite procedural generator. Town/ruin positions come from
// the world spec the map was designed against; everything else (region
// shapes, roads) is this file's best interpretation of the reference
// maps, built from named-region hints on the flavour map plus town
// layout, then filled in with noise so it reads as natural terrain
// rather than hard vector polygons.

import type { ResourceType, TileType } from './types';

export const WORLD_SIZE = 15000;
export const AELDOR_SEED = 0xa31d02;

export interface Town {
  name: string;
  x: number;
  y: number;
  capital: boolean;
}

export const TOWNS: Town[] = [
  { name: 'Stormwatch', x: 1650, y: 1550, capital: false },
  { name: 'Ravenpoint', x: 1450, y: 4000, capital: false },
  { name: 'Silvermead', x: 1650, y: 6750, capital: false },
  { name: 'Westmere', x: 1600, y: 12400, capital: false },
  { name: 'Highfield', x: 4550, y: 11700, capital: false },
  { name: 'Darkfen', x: 4150, y: 7900, capital: false },
  { name: 'Redvale', x: 6600, y: 4250, capital: false },
  { name: 'Greenford', x: 9550, y: 4300, capital: false },
  { name: 'Northreach', x: 11900, y: 1650, capital: false },
  { name: 'Eastwatch', x: 13600, y: 6250, capital: false },
  { name: 'Sunfield', x: 12850, y: 8000, capital: false },
  { name: 'Southpoint', x: 11950, y: 12300, capital: false },
  { name: 'Lakeside', x: 8200, y: 9800, capital: false },
  { name: 'Capital Town', x: 7600, y: 12150, capital: true },
];

export const CAPITAL = TOWNS.find((t) => t.capital)!;

export interface Ruin {
  name: string;
  x: number;
  y: number;
  radius: number;
}

export const RUINS: Ruin[] = [
  { name: 'Old Cairn Ruins', x: 4550, y: 4050, radius: 95 },
  { name: 'Moonfall Ruins', x: 10800, y: 7450, radius: 120 },
  { name: "Serpent's Spire", x: 7100, y: 7750, radius: 75 },
];

// ---- Named terrain regions ----
// Each is an ellipse (optionally rotated) with a noise-warped edge so the
// boundary reads as coastline/treeline rather than a hard vector shape.
export type RegionKind = 'lake' | 'mountain' | 'snowcap' | 'forest' | 'taiga' | 'desert' | 'swamp';

export interface Region {
  name: string;
  kind: RegionKind;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation?: number; // radians
  edgeWarpScale: number;
  edgeWarpStrength: number; // fraction of the radius
}

export const REGIONS: Region[] = [
  { name: 'Embermere Lake', kind: 'lake', cx: 7350, cy: 7150, rx: 1150, ry: 2850, rotation: -0.08, edgeWarpScale: 500, edgeWarpStrength: 0.2 },
  { name: 'Frostpeak Mountains', kind: 'mountain', cx: 6500, cy: 1300, rx: 3300, ry: 1150, edgeWarpScale: 700, edgeWarpStrength: 0.28 },
  { name: 'Frostpeak Peaks', kind: 'snowcap', cx: 6500, cy: 1150, rx: 1450, ry: 500, edgeWarpScale: 400, edgeWarpStrength: 0.3 },
  { name: 'Blackthorn Mountains', kind: 'mountain', cx: 3200, cy: 10800, rx: 2000, ry: 1600, edgeWarpScale: 650, edgeWarpStrength: 0.3 },
  { name: 'Stonehollow Hills', kind: 'mountain', cx: 11300, cy: 3200, rx: 1800, ry: 1500, edgeWarpScale: 600, edgeWarpStrength: 0.3 },
  { name: 'Elderwood Forest', kind: 'taiga', cx: 10200, cy: 1700, rx: 2300, ry: 1500, edgeWarpScale: 600, edgeWarpStrength: 0.3 },
  { name: 'Oakridge Woods', kind: 'forest', cx: 2900, cy: 6600, rx: 1800, ry: 2200, edgeWarpScale: 550, edgeWarpStrength: 0.32 },
  { name: 'Whispering Woods', kind: 'forest', cx: 10800, cy: 6200, rx: 2100, ry: 2000, edgeWarpScale: 550, edgeWarpStrength: 0.32 },
  { name: 'Darkfen', kind: 'swamp', cx: 4200, cy: 8300, rx: 1400, ry: 1300, edgeWarpScale: 450, edgeWarpStrength: 0.3 },
  { name: 'The Gray Wastes', kind: 'desert', cx: 12500, cy: 10200, rx: 2400, ry: 2300, edgeWarpScale: 700, edgeWarpStrength: 0.25 },
];

// ---- Authored progression zones ----
// These follow the user's red-circle reference map instead of inferring
// difficulty from distance to the capital. They deliberately overlap. In an
// overlap, WorldGen may use monsters/resources appropriate to either range,
// which produces a soft transition instead of an invisible hard border.
export interface ProgressionZone {
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  minLevel: number;
  maxLevel: number;
}

export const PROGRESSION_ZONES: ProgressionZone[] = [
  { name: 'Capital Heartland', cx: 7720, cy: 12900, rx: 1510, ry: 2130, minLevel: 1, maxLevel: 10 },
  { name: 'Lakeside March', cx: 8340, cy: 9175, rx: 2000, ry: 1910, minLevel: 10, maxLevel: 19 },
  { name: 'Southwestern Marches', cx: 3210, cy: 11930, rx: 3210, ry: 3020, minLevel: 10, maxLevel: 25 },
  { name: 'Gray Wastes', cx: 12330, cy: 10050, rx: 2670, ry: 2760, minLevel: 20, maxLevel: 35 },
  { name: 'Darkfen and Western Lake', cx: 5670, cy: 6230, rx: 2685, ry: 3085, minLevel: 25, maxLevel: 40 },
  { name: 'Eastern Wilds', cx: 11200, cy: 5290, rx: 3780, ry: 2220, minLevel: 35, maxLevel: 50 },
  { name: 'Western Wilds', cx: 1650, cy: 6170, rx: 1495, ry: 3070, minLevel: 40, maxLevel: 50 },
  { name: 'Northern Frontier', cx: 7560, cy: 1800, rx: 7410, ry: 1690, minLevel: 60, maxLevel: 120 },
];

function progressionDistance(x: number, y: number, zone: ProgressionZone): number {
  const nx = (x - zone.cx) / zone.rx;
  const ny = (y - zone.cy) / zone.ry;
  return Math.sqrt(nx * nx + ny * ny);
}

/**
 * Returns every authored progression zone containing this point. The circles
 * intentionally overlap. If a coordinate falls in a tiny gap between the
 * hand-drawn circles, the nearest zone is returned so no land becomes an
 * unclassified difficulty hole.
 */
export function progressionZonesAt(x: number, y: number): ProgressionZone[] {
  const inside = PROGRESSION_ZONES
    .map((zone) => ({ zone, distance: progressionDistance(x, y, zone) }))
    .filter((entry) => entry.distance <= 1)
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.zone);
  if (inside.length > 0) return inside;

  let nearest = PROGRESSION_ZONES[0];
  let best = Infinity;
  for (const zone of PROGRESSION_ZONES) {
    const distance = progressionDistance(x, y, zone);
    if (distance < best) {
      best = distance;
      nearest = zone;
    }
  }
  return [nearest];
}

/** Combined level envelope for resource-tier gating in overlapping zones. */
export function progressionLevelRangeAt(x: number, y: number): { minLevel: number; maxLevel: number } {
  const zones = progressionZonesAt(x, y);
  return {
    minLevel: Math.min(...zones.map((zone) => zone.minLevel)),
    maxLevel: Math.max(...zones.map((zone) => zone.maxLevel)),
  };
}

// ---- Roads: a minimum-spanning tree over the towns ----
export interface RoadSegment { ax: number; ay: number; bx: number; by: number }

export const ROADS: RoadSegment[] = buildRoadNetwork();

function buildRoadNetwork(): RoadSegment[] {
  const segments: RoadSegment[] = [];
  const connected = new Set<number>([0]);
  const remaining = new Set<number>(TOWNS.map((_, i) => i).filter((i) => i !== 0));
  while (remaining.size > 0) {
    let best = { from: -1, to: -1, dist: Infinity };
    for (const a of connected) {
      for (const b of remaining) {
        const dx = TOWNS[a].x - TOWNS[b].x;
        const dy = TOWNS[a].y - TOWNS[b].y;
        const dist = dx * dx + dy * dy;
        if (dist < best.dist) best = { from: a, to: b, dist };
      }
    }
    segments.push({ ax: TOWNS[best.from].x, ay: TOWNS[best.from].y, bx: TOWNS[best.to].x, by: TOWNS[best.to].y });
    connected.add(best.to);
    remaining.delete(best.to);
  }
  return segments;
}

export function nearestTownDistance(x: number, y: number): number {
  let best = Infinity;
  for (const t of TOWNS) {
    const dx = t.x - x;
    const dy = t.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < best) best = d;
  }
  return best;
}

export function nearestTown(x: number, y: number): Town {
  let best = TOWNS[0];
  let bestDist = Infinity;
  for (const t of TOWNS) {
    const dx = t.x - x;
    const dy = t.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

export function ruinAt(x: number, y: number): Ruin | null {
  for (const r of RUINS) {
    const dx = r.x - x;
    const dy = r.y - y;
    if (dx * dx + dy * dy <= r.radius * r.radius) return r;
  }
  return null;
}

// Kept as a general utility for future systems, but it is no longer the
// authoritative source of combat difficulty. PROGRESSION_ZONES is.
export function distanceFromCapital(x: number, y: number): number {
  return Math.hypot(x - CAPITAL.x, y - CAPITAL.y);
}

// ---- Ore veins ----
// The orange circles on the reference map are authored mining destinations.
// Each site contains 3-5 persistent nodes of EACH listed ore. Ore should not
// be generated by biome anywhere else in the world.
export interface OreVein {
  name: string;
  x: number;
  y: number;
  ores: { type: ResourceType; count: number }[];
}

export const ORE_VEINS: OreVein[] = [
  { name: 'Dragonite Peaks', x: 6390, y: 485, ores: [{ type: 'rock_dragonite', count: 4 }] },
  { name: 'Runite Ridge', x: 11315, y: 880, ores: [{ type: 'rock_rune', count: 4 }] },
  { name: 'Stormwatch Deposit', x: 1670, y: 2490, ores: [
    { type: 'rock_adamant', count: 4 }, { type: 'rock_mithril', count: 4 }, { type: 'rock_coal', count: 5 },
  ] },
  { name: 'Ravenpoint Deposit', x: 1020, y: 5180, ores: [
    { type: 'rock_adamant', count: 3 }, { type: 'rock_gold', count: 4 }, { type: 'rock_silver', count: 4 },
  ] },
  { name: 'Eastwatch Deposit', x: 14555, y: 5215, ores: [
    { type: 'rock_mithril', count: 4 }, { type: 'rock_adamant', count: 4 },
  ] },
  { name: 'Darkfen Deposit', x: 4515, y: 8110, ores: [
    { type: 'rock_mithril', count: 4 }, { type: 'rock_adamant', count: 3 }, { type: 'rock_gold', count: 4 },
  ] },
  { name: 'Lakeside Deposit', x: 8880, y: 8265, ores: [
    { type: 'rock_iron', count: 5 }, { type: 'rock_coal', count: 5 },
  ] },
  { name: 'Southpoint Deposit', x: 12855, y: 12400, ores: [
    { type: 'rock_silver', count: 4 }, { type: 'rock_gold', count: 4 }, { type: 'rock_mithril', count: 3 },
  ] },
  // Deliberately well outside the capital's 26-tile city wall. The previous
  // +15/+6 offset placed the starter mine inside the walls.
  { name: 'Capital Deposit', x: 8265, y: 12685, ores: [
    { type: 'rock_tin', count: 4 }, { type: 'rock_copper', count: 4 },
  ] },
  { name: 'Highfield Deposit', x: 4040, y: 11995, ores: [
    { type: 'rock_iron', count: 4 }, { type: 'rock_coal', count: 4 },
  ] },
  { name: 'Far South Deposit', x: 11900, y: 14390, ores: [{ type: 'rock_silver', count: 4 }] },
];

const ORE_NODE_MAP = new Map<string, ResourceType>();
for (const vein of ORE_VEINS) {
  let groupIndex = 0;
  for (const group of vein.ores) {
    for (let i = 0; i < group.count; i++) {
      // Separate ore types into neighbouring mini-clusters while keeping the
      // entire mining site compact. If an integer coordinate collides, walk
      // one tile farther out so every requested node actually exists.
      const angle = (i / group.count) * Math.PI * 2 + groupIndex * 1.17;
      let radius = 3 + groupIndex * 2 + (i % 2);
      let nx = Math.round(vein.x + Math.cos(angle) * radius);
      let ny = Math.round(vein.y + Math.sin(angle) * radius);
      let key = `${nx},${ny}`;
      while (ORE_NODE_MAP.has(key)) {
        radius++;
        nx = Math.round(vein.x + Math.cos(angle) * radius);
        ny = Math.round(vein.y + Math.sin(angle) * radius);
        key = `${nx},${ny}`;
      }
      ORE_NODE_MAP.set(key, group.type);
    }
    groupIndex++;
  }
}

export function oreVeinResourceAt(x: number, y: number): ResourceType | null {
  return ORE_NODE_MAP.get(`${x},${y}`) ?? null;
}

export const REGION_BIOME: Record<RegionKind, TileType | null> = {
  lake: 'water',
  mountain: 'mountain',
  snowcap: 'snow',
  forest: 'forest',
  taiga: 'taiga',
  desert: 'desert',
  swamp: 'swamp',
};
