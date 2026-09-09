// The fixed, authored world of Aeldor: a 15000x15000 tile map replacing
// the old infinite procedural generator. Town/ruin positions come from
// the world spec the map was designed against; everything else (region
// shapes, roads) is this file's best interpretation of the reference
// maps, built from named-region hints on the flavour map plus town
// layout, then filled in with noise so it reads as natural terrain
// rather than hard vector polygons.

import type { TileType } from './types';

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

// ---- Named regions ----
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
  // Embermere Lake - the long north-south water body most towns sit around.
  { name: 'Embermere Lake', kind: 'lake', cx: 7350, cy: 7150, rx: 1150, ry: 2850, rotation: -0.08, edgeWarpScale: 500, edgeWarpStrength: 0.2 },

  // Frostpeak Mountains - the northern range, with a snow-capped core.
  { name: 'Frostpeak Mountains', kind: 'mountain', cx: 6500, cy: 1300, rx: 3300, ry: 1150, edgeWarpScale: 700, edgeWarpStrength: 0.28 },
  { name: 'Frostpeak Peaks', kind: 'snowcap', cx: 6500, cy: 1150, rx: 1450, ry: 500, edgeWarpScale: 400, edgeWarpStrength: 0.3 },

  // Blackthorn Mountains - southwest, near Highfield/Westmere.
  { name: 'Blackthorn Mountains', kind: 'mountain', cx: 3200, cy: 10800, rx: 2000, ry: 1600, edgeWarpScale: 650, edgeWarpStrength: 0.3 },

  // Stonehollow Hills - northeast, near Greenford/Northreach.
  { name: 'Stonehollow Hills', kind: 'mountain', cx: 11300, cy: 3200, rx: 1800, ry: 1500, edgeWarpScale: 600, edgeWarpStrength: 0.3 },

  // Forests.
  { name: 'Elderwood Forest', kind: 'taiga', cx: 10200, cy: 1700, rx: 2300, ry: 1500, edgeWarpScale: 600, edgeWarpStrength: 0.3 },
  { name: 'Oakridge Woods', kind: 'forest', cx: 2900, cy: 6600, rx: 1800, ry: 2200, edgeWarpScale: 550, edgeWarpStrength: 0.32 },
  { name: 'Whispering Woods', kind: 'forest', cx: 10800, cy: 6200, rx: 2100, ry: 2000, edgeWarpScale: 550, edgeWarpStrength: 0.32 },

  // Darkfen - swamp around the town of the same name.
  { name: 'Darkfen', kind: 'swamp', cx: 4200, cy: 8300, rx: 1400, ry: 1300, edgeWarpScale: 450, edgeWarpStrength: 0.3 },

  // The Gray Wastes - desert in the southeast, near Sunfield/Southpoint.
  { name: 'The Gray Wastes', kind: 'desert', cx: 12500, cy: 10200, rx: 2400, ry: 2300, edgeWarpScale: 700, edgeWarpStrength: 0.25 },
];

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

export const REGION_BIOME: Record<RegionKind, TileType | null> = {
  lake: 'water',
  mountain: 'mountain',
  snowcap: 'snow',
  forest: 'forest',
  taiga: 'taiga',
  desert: 'desert',
  swamp: 'swamp',
};
