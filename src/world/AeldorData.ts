// Fixed authored world data for Aeldor.
// Town/ruin coordinates are canonical. Visible terrain follows the original
// illustrated Aeldor map with irregular traced polygons rather than ellipses.

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

export interface WorldPoint { x: number; y: number }

// Main coastline traced from the original Aeldor illustrated map. The outline
// deliberately has coves, headlands and southern inlets; WorldGen adds only a
// small amount of local noise to soften the straight segments.
export const CONTINENT_OUTLINE: WorldPoint[] = [
  { x: 778, y: 658 }, { x: 1316, y: 1196 }, { x: 2751, y: 778 },
  { x: 4426, y: 658 }, { x: 5742, y: 1017 }, { x: 6818, y: 538 },
  { x: 8971, y: 598 }, { x: 11124, y: 778 }, { x: 13158, y: 1017 },
  { x: 13876, y: 1435 }, { x: 14294, y: 3110 }, { x: 14234, y: 5144 },
  { x: 14055, y: 7297 }, { x: 14234, y: 9211 }, { x: 14354, y: 10766 },
  { x: 13756, y: 11603 }, { x: 13038, y: 11124 }, { x: 12560, y: 12679 },
  { x: 11722, y: 12978 }, { x: 10766, y: 12978 }, { x: 9749, y: 11364 },
  { x: 9211, y: 11603 }, { x: 8792, y: 12201 }, { x: 8014, y: 12081 },
  { x: 7297, y: 12560 }, { x: 6280, y: 13098 }, { x: 4904, y: 13278 },
  { x: 3589, y: 13457 }, { x: 2392, y: 13098 }, { x: 1077, y: 12799 },
  { x: 837, y: 11603 }, { x: 1316, y: 10467 }, { x: 837, y: 9988 },
  { x: 1017, y: 8732 }, { x: 658, y: 8014 }, { x: 1017, y: 6878 },
  { x: 1136, y: 5622 }, { x: 1376, y: 4665 }, { x: 658, y: 5024 },
  { x: 538, y: 3828 }, { x: 1316, y: 2572 }, { x: 658, y: 1794 },
];

export type RegionKind = 'lake' | 'mountain' | 'snowcap' | 'forest' | 'taiga' | 'desert' | 'swamp';

export interface Region {
  name: string;
  kind: RegionKind;
  points: WorldPoint[];
  edgeWarpScale: number;
  edgeWarpTiles: number;
}

// These polygons are traced/approximated from the original painted map rather
// than represented as giant circles. They are intentionally irregular and the
// low-frequency edge warp in WorldGen makes the borders organic.
export const REGIONS: Region[] = [
  {
    name: 'Embermere Lake', kind: 'lake', edgeWarpScale: 300, edgeWarpTiles: 35,
    points: [
      { x: 6220, y: 4665 }, { x: 5981, y: 5383 }, { x: 5981, y: 6220 },
      { x: 5981, y: 7177 }, { x: 6041, y: 8134 }, { x: 5981, y: 9091 },
      { x: 6220, y: 9868 }, { x: 6818, y: 10167 }, { x: 7297, y: 10407 },
      { x: 7656, y: 10885 }, { x: 7775, y: 11483 }, { x: 8134, y: 11962 },
      { x: 8612, y: 12201 }, { x: 9091, y: 11962 }, { x: 9450, y: 11364 },
      { x: 9809, y: 11124 }, { x: 10766, y: 11005 }, { x: 11124, y: 10646 },
      { x: 10167, y: 10407 }, { x: 9330, y: 10167 }, { x: 8732, y: 9928 },
      { x: 8254, y: 9689 }, { x: 8014, y: 9330 }, { x: 8373, y: 8971 },
      { x: 8134, y: 8612 }, { x: 8074, y: 7895 }, { x: 8194, y: 7177 },
      { x: 8254, y: 6459 }, { x: 8194, y: 5742 }, { x: 8074, y: 5144 },
      { x: 7536, y: 4785 }, { x: 6818, y: 4605 },
    ],
  },
  {
    name: 'Frostpeak Peaks', kind: 'snowcap', edgeWarpScale: 250, edgeWarpTiles: 75,
    points: [
      { x: 4785, y: 957 }, { x: 5622, y: 658 }, { x: 6340, y: 778 },
      { x: 7057, y: 897 }, { x: 7416, y: 1376 }, { x: 6998, y: 1734 },
      { x: 6579, y: 2093 }, { x: 6100, y: 1914 }, { x: 5682, y: 2213 },
      { x: 5263, y: 1914 }, { x: 4904, y: 1615 },
    ],
  },
  {
    name: 'Frostpeak Mountains', kind: 'mountain', edgeWarpScale: 350, edgeWarpTiles: 120,
    points: [
      { x: 3947, y: 1017 }, { x: 5024, y: 658 }, { x: 5981, y: 897 },
      { x: 6699, y: 598 }, { x: 7416, y: 897 }, { x: 8254, y: 1435 },
      { x: 7775, y: 2033 }, { x: 7416, y: 2632 }, { x: 6818, y: 3110 },
      { x: 5981, y: 3589 }, { x: 5263, y: 3230 }, { x: 4665, y: 2751 },
      { x: 4187, y: 2153 },
    ],
  },
  {
    name: 'Blackthorn Mountains', kind: 'mountain', edgeWarpScale: 320, edgeWarpTiles: 115,
    points: [
      { x: 1196, y: 8911 }, { x: 2033, y: 8553 }, { x: 2990, y: 8672 },
      { x: 3947, y: 9211 }, { x: 4904, y: 9809 }, { x: 5144, y: 10526 },
      { x: 4665, y: 11005 }, { x: 3947, y: 11124 }, { x: 3230, y: 10766 },
      { x: 2512, y: 10526 }, { x: 1794, y: 10167 }, { x: 1316, y: 9689 },
    ],
  },
  {
    name: 'Stonehollow Hills', kind: 'mountain', edgeWarpScale: 320, edgeWarpTiles: 100,
    points: [
      { x: 10407, y: 3589 }, { x: 11364, y: 3349 }, { x: 12440, y: 3589 },
      { x: 13457, y: 4127 }, { x: 13756, y: 4964 }, { x: 13158, y: 5383 },
      { x: 12201, y: 5263 }, { x: 11364, y: 5024 }, { x: 10766, y: 4545 },
    ],
  },
  {
    name: 'Elderwood Forest', kind: 'taiga', edgeWarpScale: 300, edgeWarpTiles: 130,
    points: [
      { x: 7177, y: 957 }, { x: 8254, y: 658 }, { x: 9569, y: 837 },
      { x: 10526, y: 1435 }, { x: 11124, y: 2273 }, { x: 10766, y: 2990 },
      { x: 9809, y: 3349 }, { x: 8732, y: 3110 }, { x: 7775, y: 2632 },
      { x: 7297, y: 1914 },
    ],
  },
  {
    name: 'Oakridge Woods', kind: 'forest', edgeWarpScale: 260, edgeWarpTiles: 120,
    points: [
      { x: 2033, y: 4665 }, { x: 2871, y: 4426 }, { x: 3828, y: 4545 },
      { x: 4665, y: 5024 }, { x: 5084, y: 5861 }, { x: 4785, y: 6459 },
      { x: 4067, y: 6818 }, { x: 3230, y: 6699 }, { x: 2512, y: 6220 },
      { x: 2153, y: 5622 },
    ],
  },
  {
    name: 'Whispering Woods', kind: 'forest', edgeWarpScale: 260, edgeWarpTiles: 120,
    points: [
      { x: 8612, y: 5263 }, { x: 9569, y: 5024 }, { x: 10766, y: 5383 },
      { x: 11423, y: 5981 }, { x: 11124, y: 6878 }, { x: 10287, y: 7416 },
      { x: 9330, y: 7177 }, { x: 8792, y: 6639 },
    ],
  },
  {
    name: 'Darkfen', kind: 'swamp', edgeWarpScale: 240, edgeWarpTiles: 95,
    points: [
      { x: 3230, y: 6998 }, { x: 4067, y: 6818 }, { x: 5144, y: 7057 },
      { x: 5981, y: 7596 }, { x: 6100, y: 8373 }, { x: 5622, y: 8971 },
      { x: 4665, y: 9211 }, { x: 3708, y: 8852 }, { x: 3349, y: 8254 },
    ],
  },
  {
    name: 'The Gray Wastes', kind: 'desert', edgeWarpScale: 300, edgeWarpTiles: 105,
    points: [
      { x: 10885, y: 8134 }, { x: 11962, y: 7955 }, { x: 13038, y: 8254 },
      { x: 13876, y: 8792 }, { x: 14115, y: 9809 }, { x: 13816, y: 10766 },
      { x: 13278, y: 11483 }, { x: 12321, y: 11124 }, { x: 11603, y: 10646 },
      { x: 11124, y: 9809 },
    ],
  },
];

// ---- Authored progression zones ----
// These are gameplay ranges from the user's red-circle reference map. Unlike
// visible terrain they intentionally remain overlapping soft ellipses.
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

export function progressionLevelRangeAt(x: number, y: number): { minLevel: number; maxLevel: number } {
  const zones = progressionZonesAt(x, y);
  return {
    minLevel: Math.min(...zones.map((zone) => zone.minLevel)),
    maxLevel: Math.max(...zones.map((zone) => zone.maxLevel)),
  };
}

// ---- Roads: existing town connectivity ----
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
    const d = Math.hypot(t.x - x, t.y - y);
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

export function distanceFromCapital(x: number, y: number): number {
  return Math.hypot(x - CAPITAL.x, y - CAPITAL.y);
}

// ---- Authored ore sites ----
export interface OreVein {
  name: string;
  x: number;
  y: number;
  ores: { type: ResourceType; count: number }[];
}

export const ORE_VEINS: OreVein[] = [
  { name: 'Dragonite Peaks', x: 6600, y: 700, ores: [{ type: 'rock_dragonite', count: 4 }] },
  { name: 'Runite Ridge', x: 11315, y: 880, ores: [{ type: 'rock_rune', count: 4 }] },
  { name: 'Stormwatch Deposit', x: 1670, y: 2490, ores: [
    { type: 'rock_adamant', count: 4 }, { type: 'rock_mithril', count: 4 }, { type: 'rock_coal', count: 5 },
  ] },
  { name: 'Ravenpoint Deposit', x: 1300, y: 5200, ores: [
    { type: 'rock_adamant', count: 3 }, { type: 'rock_gold', count: 4 }, { type: 'rock_silver', count: 4 },
  ] },
  { name: 'Eastwatch Deposit', x: 14200, y: 5300, ores: [
    { type: 'rock_mithril', count: 4 }, { type: 'rock_adamant', count: 4 },
  ] },
  { name: 'Darkfen Deposit', x: 4515, y: 8110, ores: [
    { type: 'rock_mithril', count: 4 }, { type: 'rock_adamant', count: 3 }, { type: 'rock_gold', count: 4 },
  ] },
  { name: 'Lakeside Deposit', x: 8880, y: 8265, ores: [
    { type: 'rock_iron', count: 5 }, { type: 'rock_coal', count: 5 },
  ] },
  { name: 'Southpoint Deposit', x: 12600, y: 12450, ores: [
    { type: 'rock_silver', count: 4 }, { type: 'rock_gold', count: 4 }, { type: 'rock_mithril', count: 3 },
  ] },
  { name: 'Capital Deposit', x: 8160, y: 12090, ores: [
    { type: 'rock_tin', count: 4 }, { type: 'rock_copper', count: 4 },
  ] },
  { name: 'Highfield Deposit', x: 4040, y: 11995, ores: [
    { type: 'rock_iron', count: 4 }, { type: 'rock_coal', count: 4 },
  ] },
  { name: 'Far South Deposit', x: 11650, y: 12960, ores: [{ type: 'rock_silver', count: 4 }] },
];

const ORE_NODE_MAP = new Map<string, ResourceType>();
for (const vein of ORE_VEINS) {
  let groupIndex = 0;
  for (const group of vein.ores) {
    for (let i = 0; i < group.count; i++) {
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
