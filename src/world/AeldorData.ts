// Authored world data for the enlarged Twin Lands world.
//
// The original 15,000 x 15,000 Aeldor prototype has been promoted into a much
// larger 180,000 x 180,000 world. The visible geography follows the merged
// Westerland/Estland reference map: one enormous connected landmass with a wet,
// lake-rich Westerland in the west and a broader, drier Estland in the east.
//
// This file intentionally keeps the historical Aeldor filename/export aliases
// so older imports continue to compile while the rest of the codebase migrates.

import type { ResourceType, TileType } from './types';

export const WORLD_SIZE = 180000;
export const WORLD_REVISION = 2;
export const TWIN_LANDS_SEED = 0xa31d02;
export const AELDOR_SEED = TWIN_LANDS_SEED; // compatibility alias

export type SettlementKind = 'farmstead' | 'hamlet' | 'village' | 'town' | 'city' | 'capital';
export type SettlementStyle = 'timber' | 'mixed' | 'stone' | 'desert' | 'coastal';

export interface Town {
  id: string;
  name: string;
  x: number;
  y: number;
  capital: boolean;
  kind: SettlementKind;
  radius: number;
  walled: boolean;
  style: SettlementStyle;
}

const SETTLEMENT_RADIUS: Record<SettlementKind, number> = {
  farmstead: 14,
  hamlet: 25,
  village: 45,
  town: 85,
  city: 150,
  capital: 240,
};

function settlement(
  id: string,
  name: string,
  x: number,
  y: number,
  kind: SettlementKind,
  style: SettlementStyle = 'mixed',
  walled = kind === 'city' || kind === 'capital',
): Town {
  return {
    id,
    name,
    x,
    y,
    kind,
    capital: kind === 'capital',
    radius: SETTLEMENT_RADIUS[kind],
    walled,
    style,
  };
}

// Settlement positions are a first authored pass based on the user's red-dot
// map. Existing prototype names are retained and new settlements fill out the
// much larger world. Sizes are deliberately varied: a city is a real city-sized
// game space, while villages/hamlets stay compact.
export const TOWNS: Town[] = [
  settlement('capital-town', 'Capital Town', 59000, 96000, 'capital', 'mixed', true),

  // Westerland heartland / lakes
  settlement('lakeside', 'Lakeside', 56500, 72000, 'town', 'timber'),
  settlement('highfield', 'Highfield', 40500, 92500, 'town', 'mixed'),
  settlement('rivermeet', 'Rivermeet', 68000, 86500, 'city', 'mixed', true),
  settlement('redvale', 'Redvale', 74500, 74500, 'town', 'mixed'),
  settlement('greenford', 'Greenford', 86500, 70500, 'town', 'timber'),
  settlement('foxhollow', 'Foxhollow', 62500, 59000, 'village', 'timber'),
  settlement('pinewatch', 'Pinewatch', 33500, 56500, 'village', 'timber'),
  settlement('silvermead', 'Silvermead', 30500, 75500, 'town', 'timber'),
  settlement('northwood', 'Northwood', 28000, 66500, 'hamlet', 'timber'),
  settlement('ravenpoint', 'Ravenpoint', 20500, 55000, 'town', 'coastal'),
  settlement('greyhaven', 'Greyhaven', 15500, 79000, 'town', 'coastal', true),
  settlement('westwatch', 'Westwatch', 18000, 96500, 'hamlet', 'coastal'),
  settlement('westmere', 'Westmere', 21000, 111000, 'town', 'coastal'),
  settlement('darkfen', 'Darkfen', 45500, 112000, 'town', 'timber'),
  settlement('blackshore', 'Blackshore', 43500, 133000, 'town', 'coastal'),
  settlement('greywake', 'Greywake', 26500, 126500, 'village', 'coastal'),
  settlement('tideholm', 'Tideholm', 58500, 134000, 'village', 'coastal'),
  settlement('southmere', 'Southmere', 76500, 128500, 'town', 'coastal'),
  settlement('oakrest', 'Oakrest', 90000, 124000, 'village', 'timber'),
  settlement('moorwatch', 'Moorwatch', 69500, 105000, 'town', 'stone', true),

  // Northern Westerland / crown mountains
  settlement('stormwatch', 'Stormwatch', 38500, 42000, 'city', 'stone', true),
  settlement('frostgate', 'Frostgate', 53500, 33500, 'city', 'stone', true),
  settlement('snowmelt', 'Snowmelt', 57500, 50500, 'village', 'stone'),
  settlement('frostmere', 'Frostmere', 31500, 39000, 'village', 'timber'),
  settlement('northpass', 'Northpass', 67500, 49500, 'town', 'stone', true),

  // Central divide / approaches to Estland
  settlement('stonecross', 'Stonecross', 81500, 62500, 'village', 'stone'),
  settlement('ironpass', 'Ironpass', 95500, 65000, 'town', 'stone', true),
  settlement('whitewatch', 'Whitewatch', 111000, 46500, 'village', 'stone'),
  settlement('northreach', 'Northreach', 120000, 44000, 'city', 'stone', true),
  settlement('crownwatch', 'Crownwatch', 139000, 48500, 'city', 'stone', true),

  // Estland river belt / wastes
  settlement('brightwater', 'Brightwater', 130000, 61000, 'town', 'mixed'),
  settlement('eastwatch', 'Eastwatch', 158000, 62000, 'city', 'coastal', true),
  settlement('emberford', 'Emberford', 139000, 76000, 'town', 'mixed'),
  settlement('marshhaven', 'Marshhaven', 106000, 94500, 'village', 'timber'),
  settlement('sunfield', 'Sunfield', 138000, 87500, 'town', 'desert'),
  settlement('dustmere', 'Dustmere', 151000, 79000, 'town', 'desert', true),
  settlement('sandrest', 'Sandrest', 161000, 93500, 'village', 'desert'),
  settlement('red-dunes', 'Red Dunes', 136000, 104000, 'town', 'desert'),
  settlement('ashfall', 'Ashfall', 155000, 108500, 'village', 'desert'),
  settlement('southpoint', 'Southpoint', 146000, 123000, 'city', 'coastal', true),
  settlement('greenhaven', 'Greenhaven', 116000, 124500, 'town', 'coastal'),
  settlement('coastwatch', 'Coastwatch', 159000, 118000, 'village', 'coastal'),

  // Small lived-in satellite sites near the developed heartland.
  settlement('willow-farm', 'Willow Farm', 52500, 95000, 'farmstead', 'timber'),
  settlement('eastfield', 'Eastfield', 64000, 96500, 'hamlet', 'timber'),
  settlement('lake-hamlet', 'Lake Hamlet', 46000, 90000, 'hamlet', 'timber'),
];

export const CAPITAL = TOWNS.find((t) => t.capital)!;

export function nearestTown(x: number, y: number): Town {
  let best = TOWNS[0];
  let bestDist = Infinity;
  for (const t of TOWNS) {
    const dx = t.x - x;
    const dy = t.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

export function settlementAt(x: number, y: number): Town | null {
  let found: Town | null = null;
  let best = Infinity;
  for (const t of TOWNS) {
    const dx = Math.abs(x - t.x);
    const dy = Math.abs(y - t.y);
    if (Math.max(dx, dy) > t.radius) continue;
    const d = dx * dx + dy * dy;
    if (d < best) {
      best = d;
      found = t;
    }
  }
  return found;
}

export function nearestTownDistance(x: number, y: number): number {
  const t = nearestTown(x, y);
  return Math.hypot(t.x - x, t.y - y);
}

export interface Ruin {
  name: string;
  x: number;
  y: number;
  radius: number;
}

export const RUINS: Ruin[] = [
  { name: 'Old Cairn Ruins', x: 73500, y: 69000, radius: 140 },
  { name: 'Moonfall Ruins', x: 111500, y: 80500, radius: 180 },
  { name: "Serpent's Spire", x: 132000, y: 101000, radius: 130 },
  { name: 'Frost Crown Keep', x: 49500, y: 31500, radius: 170 },
  { name: 'Broken Sun Temple', x: 149000, y: 97000, radius: 160 },
];

export interface WorldPoint { x: number; y: number }

export const CONTINENT_OUTLINE: WorldPoint[] = [
  { x: 18000, y: 40000 }, { x: 24500, y: 28500 }, { x: 35500, y: 22500 },
  { x: 46500, y: 23500 }, { x: 56500, y: 30000 }, { x: 66000, y: 40000 },
  { x: 75500, y: 47500 }, { x: 86000, y: 46500 }, { x: 96000, y: 43000 },
  { x: 108000, y: 38500 }, { x: 119500, y: 33500 }, { x: 132000, y: 35000 },
  { x: 145000, y: 40500 }, { x: 158000, y: 43000 }, { x: 169000, y: 50000 },
  { x: 173000, y: 61000 }, { x: 169000, y: 71000 }, { x: 172500, y: 81000 },
  { x: 169500, y: 92500 }, { x: 173500, y: 104000 }, { x: 168500, y: 116500 },
  { x: 165000, y: 130000 }, { x: 157500, y: 140000 }, { x: 147000, y: 145000 },
  { x: 135000, y: 139500 }, { x: 124500, y: 143500 }, { x: 112000, y: 137500 },
  { x: 101000, y: 142000 }, { x: 90000, y: 137500 }, { x: 79000, y: 144500 },
  { x: 67500, y: 141000 }, { x: 56500, y: 148500 }, { x: 47000, y: 143500 },
  { x: 38000, y: 151000 }, { x: 29000, y: 145500 }, { x: 20500, y: 137500 },
  { x: 15000, y: 127000 }, { x: 17500, y: 116000 }, { x: 12000, y: 105500 },
  { x: 15000, y: 95000 }, { x: 10000, y: 85000 }, { x: 14500, y: 74500 },
  { x: 9000, y: 63500 }, { x: 12500, y: 52000 },
];

export const ISLAND_OUTLINES: WorldPoint[][] = [
  [
    { x: 20500, y: 151000 }, { x: 23500, y: 146500 }, { x: 27000, y: 149000 },
    { x: 28000, y: 155500 }, { x: 24500, y: 160000 }, { x: 21000, y: 157000 },
  ],
  [
    { x: 47500, y: 154000 }, { x: 52000, y: 151500 }, { x: 55500, y: 155500 },
    { x: 54500, y: 161000 }, { x: 49500, y: 162500 },
  ],
  [
    { x: 94000, y: 149000 }, { x: 98000, y: 147000 }, { x: 101500, y: 151500 },
    { x: 100000, y: 157000 }, { x: 95500, y: 158000 },
  ],
  [
    { x: 128000, y: 149500 }, { x: 132000, y: 146500 }, { x: 136500, y: 150000 },
    { x: 136000, y: 155500 }, { x: 131000, y: 158000 },
  ],
  [
    { x: 151000, y: 34000 }, { x: 155500, y: 31500 }, { x: 160000, y: 35000 },
    { x: 158000, y: 39500 }, { x: 153500, y: 39500 },
  ],
];

export const LAND_OUTLINES: WorldPoint[][] = [CONTINENT_OUTLINE, ...ISLAND_OUTLINES];

export type RegionKind = 'lake' | 'mountain' | 'snowcap' | 'forest' | 'taiga' | 'desert' | 'swamp';

export interface Region {
  name: string;
  kind: RegionKind;
  points: WorldPoint[];
  edgeWarpScale: number;
  edgeWarpTiles: number;
}

export const REGIONS: Region[] = [
  {
    name: 'Twinmere Lakes', kind: 'lake', edgeWarpScale: 1600, edgeWarpTiles: 90,
    points: [
      { x: 41000, y: 66000 }, { x: 45500, y: 62000 }, { x: 51000, y: 65000 },
      { x: 54500, y: 71000 }, { x: 56500, y: 77500 }, { x: 61000, y: 82000 },
      { x: 59500, y: 90000 }, { x: 55000, y: 95500 }, { x: 50000, y: 92500 },
      { x: 48000, y: 86000 }, { x: 43500, y: 81500 }, { x: 40500, y: 74500 },
    ],
  },
  {
    name: 'Estland Inland Sea', kind: 'lake', edgeWarpScale: 1700, edgeWarpTiles: 100,
    points: [
      { x: 109000, y: 76500 }, { x: 116000, y: 73500 }, { x: 124000, y: 76000 },
      { x: 132000, y: 80500 }, { x: 137000, y: 87000 }, { x: 132000, y: 93500 },
      { x: 124000, y: 97000 }, { x: 116500, y: 94500 }, { x: 110500, y: 88500 },
    ],
  },
  {
    name: 'Frostborn Crown', kind: 'snowcap', edgeWarpScale: 1700, edgeWarpTiles: 170,
    points: [
      { x: 26500, y: 27500 }, { x: 37000, y: 23500 }, { x: 50000, y: 26000 },
      { x: 61000, y: 33000 }, { x: 62500, y: 40500 }, { x: 55500, y: 46500 },
      { x: 45500, y: 45000 }, { x: 35500, y: 41000 }, { x: 28500, y: 35500 },
    ],
  },
  {
    name: 'Frostborn Mountains', kind: 'mountain', edgeWarpScale: 1900, edgeWarpTiles: 220,
    points: [
      { x: 21000, y: 36000 }, { x: 30000, y: 26000 }, { x: 42000, y: 23000 },
      { x: 56000, y: 28500 }, { x: 67500, y: 41000 }, { x: 69000, y: 50500 },
      { x: 62000, y: 57500 }, { x: 52000, y: 53000 }, { x: 42000, y: 50000 },
      { x: 31500, y: 46000 },
    ],
  },
  {
    name: 'Westwall Mountains', kind: 'mountain', edgeWarpScale: 1900, edgeWarpTiles: 200,
    points: [
      { x: 16500, y: 49500 }, { x: 23500, y: 53500 }, { x: 30000, y: 65000 },
      { x: 33500, y: 80000 }, { x: 36500, y: 96000 }, { x: 43000, y: 112000 },
      { x: 39000, y: 132000 }, { x: 30500, y: 138500 }, { x: 23500, y: 128000 },
      { x: 26000, y: 111000 }, { x: 22500, y: 93000 }, { x: 19000, y: 76000 },
    ],
  },
  {
    name: 'Northreach Mountains', kind: 'mountain', edgeWarpScale: 2100, edgeWarpTiles: 220,
    points: [
      { x: 78000, y: 45500 }, { x: 92000, y: 42000 }, { x: 106000, y: 37000 },
      { x: 121000, y: 34500 }, { x: 137000, y: 39000 }, { x: 154000, y: 45000 },
      { x: 162000, y: 53500 }, { x: 153000, y: 59000 }, { x: 139000, y: 57000 },
      { x: 126000, y: 55500 }, { x: 112000, y: 59000 }, { x: 97000, y: 57000 },
      { x: 85000, y: 53000 },
    ],
  },
  {
    name: 'Northreach Snowfields', kind: 'snowcap', edgeWarpScale: 1800, edgeWarpTiles: 170,
    points: [
      { x: 104000, y: 36500 }, { x: 118000, y: 34000 }, { x: 133000, y: 37500 },
      { x: 149000, y: 43000 }, { x: 154000, y: 49500 }, { x: 144000, y: 52000 },
      { x: 130000, y: 50000 }, { x: 118000, y: 52500 }, { x: 108000, y: 47500 },
    ],
  },
  {
    name: 'Central Divide', kind: 'mountain', edgeWarpScale: 2100, edgeWarpTiles: 220,
    points: [
      { x: 50000, y: 100000 }, { x: 61500, y: 103000 }, { x: 73500, y: 108000 },
      { x: 86000, y: 111000 }, { x: 99500, y: 108000 }, { x: 111000, y: 111000 },
      { x: 124000, y: 119000 }, { x: 118000, y: 131000 }, { x: 104000, y: 134000 },
      { x: 90000, y: 128000 }, { x: 76000, y: 128500 }, { x: 63500, y: 121000 },
      { x: 54000, y: 113000 },
    ],
  },
  {
    name: 'Western Greenwood', kind: 'forest', edgeWarpScale: 1700, edgeWarpTiles: 180,
    points: [
      { x: 24500, y: 51500 }, { x: 39000, y: 50000 }, { x: 54000, y: 55000 },
      { x: 68000, y: 62000 }, { x: 73000, y: 76000 }, { x: 67500, y: 93000 },
      { x: 58500, y: 104000 }, { x: 46000, y: 111000 }, { x: 33500, y: 103000 },
      { x: 28500, y: 87500 }, { x: 24500, y: 70000 },
    ],
  },
  {
    name: 'Northern Taiga', kind: 'taiga', edgeWarpScale: 1600, edgeWarpTiles: 160,
    points: [
      { x: 33000, y: 39000 }, { x: 45000, y: 36000 }, { x: 59000, y: 40500 },
      { x: 71500, y: 50000 }, { x: 69000, y: 59000 }, { x: 56000, y: 57000 },
      { x: 44000, y: 52000 }, { x: 35000, y: 48000 },
    ],
  },
  {
    name: 'Myrfen', kind: 'swamp', edgeWarpScale: 1500, edgeWarpTiles: 150,
    points: [
      { x: 92000, y: 78500 }, { x: 101000, y: 76000 }, { x: 111000, y: 80000 },
      { x: 118000, y: 88500 }, { x: 115000, y: 99500 }, { x: 105000, y: 104000 },
      { x: 96000, y: 99000 }, { x: 90000, y: 90000 },
    ],
  },
  {
    name: 'Sunscar Wastes', kind: 'desert', edgeWarpScale: 1900, edgeWarpTiles: 190,
    points: [
      { x: 108000, y: 60500 }, { x: 124000, y: 56500 }, { x: 143000, y: 60000 },
      { x: 160000, y: 67500 }, { x: 166000, y: 83500 }, { x: 164000, y: 102000 },
      { x: 158000, y: 119000 }, { x: 144000, y: 126000 }, { x: 130000, y: 119000 },
      { x: 119000, y: 108000 }, { x: 113000, y: 93000 },
    ],
  },
  {
    name: 'Southern Greenwood', kind: 'forest', edgeWarpScale: 1700, edgeWarpTiles: 170,
    points: [
      { x: 36000, y: 111000 }, { x: 50000, y: 106000 }, { x: 62000, y: 115000 },
      { x: 73500, y: 126000 }, { x: 69000, y: 140000 }, { x: 55500, y: 145500 },
      { x: 42000, y: 140000 }, { x: 32000, y: 129000 },
    ],
  },
  {
    name: 'Emerald Coast', kind: 'forest', edgeWarpScale: 1800, edgeWarpTiles: 180,
    points: [
      { x: 93000, y: 116000 }, { x: 108000, y: 113000 }, { x: 123000, y: 121000 },
      { x: 139000, y: 127000 }, { x: 153000, y: 133000 }, { x: 149000, y: 143000 },
      { x: 134000, y: 139000 }, { x: 119000, y: 136000 }, { x: 104000, y: 139000 },
      { x: 93000, y: 132000 },
    ],
  },
];

export interface River {
  name: string;
  width: number;
  points: WorldPoint[];
}

export const RIVERS: River[] = [
  {
    name: 'Capital River', width: 7,
    points: [
      { x: 35500, y: 56000 }, { x: 41000, y: 64000 }, { x: 45500, y: 70000 },
      { x: 50000, y: 77000 }, { x: 54500, y: 85000 }, { x: 57000, y: 93000 },
      { x: 61000, y: 103000 }, { x: 66500, y: 116000 }, { x: 70000, y: 136000 },
    ],
  },
  {
    name: 'Greenford River', width: 6,
    points: [
      { x: 70000, y: 50000 }, { x: 75000, y: 59000 }, { x: 82000, y: 68000 },
      { x: 90000, y: 77000 }, { x: 98000, y: 85000 }, { x: 108000, y: 89000 },
    ],
  },
  {
    name: 'Eastflow', width: 8,
    points: [
      { x: 121000, y: 51000 }, { x: 124000, y: 62000 }, { x: 127000, y: 73000 },
      { x: 132000, y: 85000 }, { x: 142000, y: 90000 }, { x: 153000, y: 96000 },
      { x: 165000, y: 104000 },
    ],
  },
  {
    name: 'Southrun', width: 6,
    points: [
      { x: 87000, y: 81000 }, { x: 90000, y: 93000 }, { x: 94000, y: 104000 },
      { x: 99000, y: 117000 }, { x: 103000, y: 132000 }, { x: 104000, y: 140000 },
    ],
  },
  {
    name: 'Westmere River', width: 5,
    points: [
      { x: 28000, y: 89000 }, { x: 30500, y: 101000 }, { x: 31500, y: 114000 },
      { x: 30000, y: 127000 }, { x: 27500, y: 139000 },
    ],
  },
];

// First-pass 1-300 macro progression. These boundaries are intentionally
// provisional until the enlarged settlement/POI network has been playtested.
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
  { name: 'Capital Heartland', cx: 59000, cy: 96000, rx: 17500, ry: 14500, minLevel: 1, maxLevel: 20 },
  { name: 'Westerland Marches', cx: 52000, cy: 67500, rx: 28000, ry: 22000, minLevel: 20, maxLevel: 50 },
  { name: 'Central Frontier', cx: 82000, cy: 79000, rx: 25500, ry: 23000, minLevel: 50, maxLevel: 90 },
  { name: 'Estland Approaches', cx: 109000, cy: 76000, rx: 25500, ry: 23500, minLevel: 90, maxLevel: 130 },
  { name: 'Sunscar Wastes', cx: 139000, cy: 91000, rx: 31500, ry: 30000, minLevel: 130, maxLevel: 180 },
  { name: 'Southern Divide', cx: 93000, cy: 119000, rx: 31000, ry: 21000, minLevel: 180, maxLevel: 230 },
  { name: 'Far Emerald Coast', cx: 135000, cy: 128000, rx: 27000, ry: 20000, minLevel: 230, maxLevel: 270 },
  { name: 'Frostborn Crown', cx: 48500, cy: 36000, rx: 26500, ry: 18000, minLevel: 270, maxLevel: 300 },
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
    segments.push({
      ax: TOWNS[best.from].x,
      ay: TOWNS[best.from].y,
      bx: TOWNS[best.to].x,
      by: TOWNS[best.to].y,
    });
    connected.add(best.to);
    remaining.delete(best.to);
  }
  return segments;
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

export interface OreVein {
  name: string;
  x: number;
  y: number;
  ores: { type: ResourceType; count: number }[];
}

export const ORE_VEINS: OreVein[] = [
  { name: 'Capital Mine', x: 61500, y: 97000, ores: [
    { type: 'rock_copper', count: 5 }, { type: 'rock_tin', count: 5 },
  ] },
  { name: 'Highfield Cut', x: 39500, y: 87000, ores: [
    { type: 'rock_iron', count: 5 }, { type: 'rock_coal', count: 5 },
  ] },
  { name: 'Northwood Mine', x: 43000, y: 61000, ores: [
    { type: 'rock_iron', count: 4 }, { type: 'rock_coal', count: 5 },
  ] },
  { name: 'Greywake Silverworks', x: 14500, y: 75500, ores: [
    { type: 'rock_silver', count: 4 }, { type: 'rock_gold', count: 3 },
  ] },
  { name: 'West Range Vein', x: 33500, y: 51000, ores: [
    { type: 'rock_gold', count: 4 }, { type: 'rock_mithril', count: 4 },
  ] },
  { name: 'Snowmelt Deep Mine', x: 61500, y: 50000, ores: [
    { type: 'rock_coal', count: 5 }, { type: 'rock_mithril', count: 4 }, { type: 'rock_adamant', count: 3 },
  ] },
  { name: 'Dragonite Peaks', x: 50500, y: 30000, ores: [
    { type: 'rock_dragonite', count: 3 },
  ] },
  { name: 'Frost Crown Runite', x: 70000, y: 45500, ores: [
    { type: 'rock_rune', count: 3 },
  ] },
  { name: 'Central Pass Mine', x: 85500, y: 76000, ores: [
    { type: 'rock_mithril', count: 5 }, { type: 'rock_adamant', count: 4 },
  ] },
  { name: 'Ironpass Deepworks', x: 104000, y: 72000, ores: [
    { type: 'rock_gold', count: 4 }, { type: 'rock_mithril', count: 4 }, { type: 'rock_adamant', count: 4 },
  ] },
  { name: 'Northreach Runite Mine', x: 123000, y: 53500, ores: [
    { type: 'rock_adamant', count: 4 }, { type: 'rock_rune', count: 4 },
  ] },
  { name: 'Sunfield Works', x: 139000, y: 91500, ores: [
    { type: 'rock_silver', count: 4 }, { type: 'rock_gold', count: 4 }, { type: 'rock_mithril', count: 3 },
  ] },
  { name: 'Deep Wastes Mine', x: 151000, y: 111000, ores: [
    { type: 'rock_adamant', count: 4 }, { type: 'rock_rune', count: 3 },
  ] },
  { name: 'Southern Divide Mine', x: 103000, y: 119000, ores: [
    { type: 'rock_mithril', count: 4 }, { type: 'rock_adamant', count: 4 },
  ] },
  { name: 'Emerald Coast Silverworks', x: 79000, y: 133000, ores: [
    { type: 'rock_silver', count: 5 }, { type: 'rock_gold', count: 3 },
  ] },
  { name: 'Blackshore Colliery', x: 24500, y: 128000, ores: [
    { type: 'rock_coal', count: 5 }, { type: 'rock_iron', count: 4 }, { type: 'rock_mithril', count: 3 },
  ] },
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
