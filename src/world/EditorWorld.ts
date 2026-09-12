import type { ElevationLevel, ResourceType, StructureType, TileType, WorldPlane } from './types';
import {
  clearLegacyEditorLocalStorage,
  readEditorWorldFromIndexedDb,
  readLegacyEditorWorldRaw,
  requestPersistentEditorStorage,
  writeEditorWorldToIndexedDb,
} from './EditorStorage';

export type EditorMarkerType = 'settlement' | 'village' | 'town' | 'city' | 'castle' | 'mining_area' | 'resource_area';
export type PlaneLinkKind = 'cave_entrance' | 'stairs' | 'ladder';

export interface EditorMarker {
  id: string;
  type: EditorMarkerType;
  name: string;
  x: number;
  y: number;
  plane: WorldPlane;
  notes?: string;
}

export interface PlaneEndpoint {
  plane: WorldPlane;
  x: number;
  y: number;
}

export interface EditorPlaneLink {
  id: string;
  kind: PlaneLinkKind;
  name?: string;
  from: PlaneEndpoint;
  to: PlaneEndpoint;
  bidirectional: boolean;
}

export interface EditorCell {
  tile?: TileType;
  resource?: ResourceType | null;
  structure?: StructureType | null;
  spawner?: string | null;
  /** Additional editor layers (object transforms, roofs, cliff decorations) are additive and migrate transparently. */
  [key: string]: unknown;
}

export type TerrainStrokeKind = 'square' | 'line' | 'rect_fill' | 'rect_outline';

export interface TerrainStroke {
  kind: TerrainStrokeKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  size: number;
  /** null reveals that plane's blank base beneath older editor shapes. */
  tile: TileType | null;
}

export interface ElevationStroke {
  kind: TerrainStrokeKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  size: number;
  mode: 'set' | 'delta';
  /** set uses -2..+5; delta is normally +1/-1 and is clamped to that range. */
  value: number;
}

export interface EditorPlaneData {
  cells: Record<string, EditorCell>;
  terrainStrokes: TerrainStroke[];
  elevationStrokes: ElevationStroke[];
}

export interface EditorWorldData {
  version: 5;
  worldSize: number;
  updatedAt: string;
  /** Surface plane (0) remains top-level for compatibility with older map code. */
  cells: Record<string, EditorCell>;
  terrainStrokes: TerrainStroke[];
  elevationStrokes: ElevationStroke[];
  planes: Record<'-1' | '-2', EditorPlaneData>;
  markers: EditorMarker[];
  links: EditorPlaneLink[];
  /** Paintable logical population regions. Typed by SpawnZones.ts; kept here as migration-safe world data. */
  spawnZones?: unknown[];
}

let cached: EditorWorldData | null = null;
let initialized = false;

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function clampElevation(value: number): ElevationLevel {
  return Math.max(-2, Math.min(5, Math.round(value))) as ElevationLevel;
}

export function baseTileForPlane(plane: WorldPlane): TileType {
  return plane === 0 ? 'deep_water' : 'void';
}

function blankPlane(): EditorPlaneData {
  return { cells: {}, terrainStrokes: [], elevationStrokes: [] };
}

export function blankEditorWorld(worldSize: number): EditorWorldData {
  return {
    version: 5,
    worldSize,
    updatedAt: new Date().toISOString(),
    cells: {},
    terrainStrokes: [],
    elevationStrokes: [],
    planes: { '-1': blankPlane(), '-2': blankPlane() },
    markers: [],
    links: [],
    spawnZones: [],
  };
}

function normalizePlane(value: unknown): WorldPlane {
  return value === -1 || value === -2 ? value : 0;
}

function normalizeTerrainStroke(raw: unknown): TerrainStroke | null {
  if (!raw || typeof raw !== 'object') return null;
  const stroke = raw as { kind?: unknown; x?: unknown; y?: unknown; x2?: unknown; y2?: unknown; size?: unknown; tile?: unknown };
  if (!Number.isFinite(stroke.x) || !Number.isFinite(stroke.y) || !Number.isFinite(stroke.size)) return null;
  if (!(stroke.tile === null || typeof stroke.tile === 'string')) return null;
  const kind: TerrainStrokeKind = stroke.kind === 'line' || stroke.kind === 'rect_fill' || stroke.kind === 'rect_outline' ? stroke.kind : 'square';
  if (kind !== 'square' && (!Number.isFinite(stroke.x2) || !Number.isFinite(stroke.y2))) return null;
  return {
    kind,
    x: Number(stroke.x),
    y: Number(stroke.y),
    ...(kind !== 'square' ? { x2: Number(stroke.x2), y2: Number(stroke.y2) } : {}),
    size: Math.max(1, Math.round(Number(stroke.size))),
    tile: stroke.tile as TileType | null,
  };
}

function normalizeElevationStroke(raw: unknown): ElevationStroke | null {
  if (!raw || typeof raw !== 'object') return null;
  const stroke = raw as { kind?: unknown; x?: unknown; y?: unknown; x2?: unknown; y2?: unknown; size?: unknown; mode?: unknown; value?: unknown };
  if (!Number.isFinite(stroke.x) || !Number.isFinite(stroke.y) || !Number.isFinite(stroke.size) || !Number.isFinite(stroke.value)) return null;
  const kind: TerrainStrokeKind = stroke.kind === 'line' || stroke.kind === 'rect_fill' || stroke.kind === 'rect_outline' ? stroke.kind : 'square';
  if (kind !== 'square' && (!Number.isFinite(stroke.x2) || !Number.isFinite(stroke.y2))) return null;
  return {
    kind,
    x: Number(stroke.x),
    y: Number(stroke.y),
    ...(kind !== 'square' ? { x2: Number(stroke.x2), y2: Number(stroke.y2) } : {}),
    size: Math.max(1, Math.round(Number(stroke.size))),
    mode: stroke.mode === 'delta' ? 'delta' : 'set',
    value: Number(stroke.value),
  };
}

function normalizePlaneData(raw: unknown): EditorPlaneData {
  if (!raw || typeof raw !== 'object') return blankPlane();
  const data = raw as { cells?: unknown; terrainStrokes?: unknown; elevationStrokes?: unknown };
  return {
    cells: data.cells && typeof data.cells === 'object' ? data.cells as Record<string, EditorCell> : {},
    terrainStrokes: Array.isArray(data.terrainStrokes) ? data.terrainStrokes.map(normalizeTerrainStroke).filter((s): s is TerrainStroke => !!s) : [],
    elevationStrokes: Array.isArray(data.elevationStrokes) ? data.elevationStrokes.map(normalizeElevationStroke).filter((s): s is ElevationStroke => !!s) : [],
  };
}

function migrateParsedWorld(parsed: unknown, worldSize: number): EditorWorldData {
  if (!parsed || typeof parsed !== 'object') return blankEditorWorld(worldSize);
  const candidate = parsed as {
    updatedAt?: unknown;
    cells?: unknown;
    terrainStrokes?: unknown;
    elevationStrokes?: unknown;
    planes?: unknown;
    markers?: unknown;
    links?: unknown;
    spawnZones?: unknown;
  };
  if (!candidate.cells || typeof candidate.cells !== 'object') return blankEditorWorld(worldSize);

  const surface = normalizePlaneData(candidate);
  const rawPlanes = candidate.planes && typeof candidate.planes === 'object'
    ? candidate.planes as Record<string, unknown>
    : {};

  const markerTypes = new Set<EditorMarkerType>(['settlement', 'village', 'town', 'city', 'castle', 'mining_area', 'resource_area']);
  const markers = Array.isArray(candidate.markers)
    ? candidate.markers.filter((m): m is Omit<EditorMarker, 'plane'> & { plane?: WorldPlane } => {
        if (!m || typeof m !== 'object') return false;
        const marker = m as Partial<EditorMarker>;
        return typeof marker.id === 'string'
          && typeof marker.type === 'string' && markerTypes.has(marker.type as EditorMarkerType)
          && typeof marker.name === 'string'
          && Number.isFinite(marker.x) && Number.isFinite(marker.y);
      }).map((m) => ({ ...m, plane: normalizePlane(m.plane) }))
    : [];

  const linkKinds = new Set<PlaneLinkKind>(['cave_entrance', 'stairs', 'ladder']);
  const links = Array.isArray(candidate.links)
    ? candidate.links.filter((l): l is EditorPlaneLink => {
        if (!l || typeof l !== 'object') return false;
        const link = l as Partial<EditorPlaneLink>;
        return typeof link.id === 'string' && typeof link.kind === 'string' && linkKinds.has(link.kind as PlaneLinkKind)
          && !!link.from && !!link.to && Number.isFinite(link.from.x) && Number.isFinite(link.from.y)
          && Number.isFinite(link.to.x) && Number.isFinite(link.to.y);
      }).map((l) => ({
        ...l,
        from: { ...l.from, plane: normalizePlane(l.from.plane) },
        to: { ...l.to, plane: normalizePlane(l.to.plane) },
        bidirectional: l.bidirectional !== false,
      }))
    : [];

  const underground1 = normalizePlaneData(rawPlanes['-1']);
  const underground2 = normalizePlaneData(rawPlanes['-2']);
  for (const plane of [surface, underground1, underground2]) {
    for (const cell of Object.values(plane.cells)) delete (cell as EditorCell & { suppressProcedural?: boolean }).suppressProcedural;
  }

  return {
    version: 5,
    worldSize,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
    cells: surface.cells,
    terrainStrokes: surface.terrainStrokes,
    elevationStrokes: surface.elevationStrokes,
    planes: { '-1': underground1, '-2': underground2 },
    markers,
    links,
    spawnZones: Array.isArray(candidate.spawnZones) ? candidate.spawnZones : [],
  };
}

/**
 * Must run once during application bootstrap. The editor world lives in IndexedDB;
 * old localStorage revisions are migrated once and deleted only after IndexedDB has
 * accepted the migrated world, freeing the tiny localStorage quota permanently.
 */
export async function initializeEditorWorldStorage(worldSize: number): Promise<void> {
  if (initialized) return;
  initialized = true;
  await requestPersistentEditorStorage();
  try {
    const stored = await readEditorWorldFromIndexedDb();
    if (stored) {
      cached = migrateParsedWorld(stored, worldSize);
      clearLegacyEditorLocalStorage();
      return;
    }
  } catch {
    // Continue to the legacy/bootstrap path below. A later save will surface IDB errors.
  }

  const legacyRaw = readLegacyEditorWorldRaw();
  if (legacyRaw) {
    try {
      cached = migrateParsedWorld(JSON.parse(legacyRaw), worldSize);
    } catch {
      cached = blankEditorWorld(worldSize);
    }
  } else {
    cached = blankEditorWorld(worldSize);
  }

  try {
    await writeEditorWorldToIndexedDb(cached);
    clearLegacyEditorLocalStorage();
  } catch {
    // Keep the in-memory world. Export JSON remains available even if IDB is unavailable.
  }
}

export function loadEditorWorld(worldSize: number): EditorWorldData {
  if (cached) return cached;
  return (cached = blankEditorWorld(worldSize));
}

export async function saveEditorWorld(data: EditorWorldData): Promise<void> {
  data.updatedAt = new Date().toISOString();
  cached = data;
  await writeEditorWorldToIndexedDb(data);
}

export function replaceEditorWorld(data: EditorWorldData): void {
  cached = data;
  void saveEditorWorld(data);
}

export function clearEditorWorld(worldSize: number): EditorWorldData {
  const data = blankEditorWorld(worldSize);
  cached = data;
  void saveEditorWorld(data);
  return data;
}

export function getPlaneData(data: EditorWorldData, plane: WorldPlane): EditorPlaneData {
  if (plane === 0) return { cells: data.cells, terrainStrokes: data.terrainStrokes, elevationStrokes: data.elevationStrokes };
  return data.planes[String(plane) as '-1' | '-2'];
}

export function getEditorCell(x: number, y: number, worldSize: number, plane: WorldPlane = 0): EditorCell | undefined {
  return getPlaneData(loadEditorWorld(worldSize), plane).cells[cellKey(x, y)];
}

export function shapeContains(stroke: Pick<TerrainStroke, 'kind' | 'x' | 'y' | 'x2' | 'y2' | 'size'>, x: number, y: number): boolean {
  const half = Math.max(0.5, stroke.size / 2);
  if (stroke.kind === 'square') {
    const radius = Math.floor(stroke.size / 2);
    return x >= stroke.x - radius && x <= stroke.x + radius && y >= stroke.y - radius && y <= stroke.y + radius;
  }
  const x2 = stroke.x2 ?? stroke.x;
  const y2 = stroke.y2 ?? stroke.y;
  if (stroke.kind === 'line') return distanceToSegment(x, y, stroke.x, stroke.y, x2, y2) <= half;
  const left = Math.min(stroke.x, x2);
  const right = Math.max(stroke.x, x2);
  const top = Math.min(stroke.y, y2);
  const bottom = Math.max(stroke.y, y2);
  if (stroke.kind === 'rect_fill') return x >= left && x <= right && y >= top && y <= bottom;
  if (x < left - half || x > right + half || y < top - half || y > bottom + half) return false;
  const insideInner = x > left + half && x < right - half && y > top + half && y < bottom - half;
  return !insideInner;
}

export const terrainStrokeContains = shapeContains;

export function getEditorTerrainStrokeAt(x: number, y: number, worldSize: number, plane: WorldPlane = 0): TerrainStroke | undefined {
  const strokes = getPlaneData(loadEditorWorld(worldSize), plane).terrainStrokes;
  for (let i = strokes.length - 1; i >= 0; i--) if (shapeContains(strokes[i], x, y)) return strokes[i];
  return undefined;
}

export function getEditorTileAt(x: number, y: number, worldSize: number, plane: WorldPlane = 0): TileType | undefined {
  const cell = getEditorCell(x, y, worldSize, plane);
  if (cell?.tile) return cell.tile;
  return getEditorTerrainStrokeAt(x, y, worldSize, plane)?.tile ?? undefined;
}

export function getEditorElevationAt(x: number, y: number, worldSize: number, plane: WorldPlane = 0): ElevationLevel {
  let elevation: ElevationLevel = 0;
  const strokes = getPlaneData(loadEditorWorld(worldSize), plane).elevationStrokes;
  for (const stroke of strokes) {
    if (!shapeContains(stroke, x, y)) continue;
    elevation = stroke.mode === 'set' ? clampElevation(stroke.value) : clampElevation(elevation + stroke.value);
  }
  return elevation;
}

export function getEditorMarkers(worldSize: number, plane?: WorldPlane): readonly EditorMarker[] {
  const markers = loadEditorWorld(worldSize).markers;
  return plane === undefined ? markers : markers.filter((m) => m.plane === plane);
}

export function getPlaneLinkAt(x: number, y: number, worldSize: number, plane: WorldPlane): { link: EditorPlaneLink; destination: PlaneEndpoint } | undefined {
  for (const link of loadEditorWorld(worldSize).links) {
    if (link.from.plane === plane && link.from.x === x && link.from.y === y) return { link, destination: link.to };
    if (link.bidirectional && link.to.plane === plane && link.to.x === x && link.to.y === y) return { link, destination: link.from };
  }
  return undefined;
}

export function hasOwnEditorField(cell: EditorCell | undefined, field: keyof EditorCell): boolean {
  return !!cell && Object.prototype.hasOwnProperty.call(cell, field);
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
