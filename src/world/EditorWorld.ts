import type { ResourceType, StructureType, TileType } from './types';

export const EDITOR_WORLD_STORAGE_KEY = 'massrpg_editor_world_v3';

export type EditorMarkerType = 'settlement' | 'village' | 'town' | 'city' | 'castle' | 'mining_area';

export interface EditorMarker {
  id: string;
  type: EditorMarkerType;
  name: string;
  x: number;
  y: number;
  notes?: string;
}

export interface EditorCell {
  tile?: TileType;
  resource?: ResourceType | null;
  structure?: StructureType | null;
  spawner?: string | null;
}

export interface TerrainStroke {
  x: number;
  y: number;
  size: number;
  /** null reveals the blank ocean/base beneath older editor strokes. */
  tile: TileType | null;
}

export interface EditorWorldData {
  version: 3;
  worldSize: number;
  updatedAt: string;
  cells: Record<string, EditorCell>;
  /** Large terrain brushes are compact square dabs rather than millions of cells. */
  terrainStrokes: TerrainStroke[];
  /** Authored reference markers exported with the world so AI/tools can read them later. */
  markers: EditorMarker[];
}

let cached: EditorWorldData | null = null;

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function blankEditorWorld(worldSize: number): EditorWorldData {
  return {
    version: 3,
    worldSize,
    updatedAt: new Date().toISOString(),
    cells: {},
    terrainStrokes: [],
    markers: [],
  };
}

function migrateParsedWorld(parsed: unknown, worldSize: number): EditorWorldData {
  if (!parsed || typeof parsed !== 'object') return blankEditorWorld(worldSize);
  const candidate = parsed as {
    updatedAt?: unknown;
    cells?: unknown;
    terrainStrokes?: unknown;
    markers?: unknown;
  };
  if (!candidate.cells || typeof candidate.cells !== 'object') return blankEditorWorld(worldSize);

  const cells = candidate.cells as Record<string, EditorCell>;
  const terrainStrokes = Array.isArray(candidate.terrainStrokes)
    ? candidate.terrainStrokes.filter((s): s is TerrainStroke => {
        if (!s || typeof s !== 'object') return false;
        const stroke = s as Partial<TerrainStroke> & { suppressProcedural?: unknown };
        return Number.isFinite(stroke.x) && Number.isFinite(stroke.y) && Number.isFinite(stroke.size)
          && (stroke.tile === null || typeof stroke.tile === 'string');
      }).map((s) => ({ x: s.x, y: s.y, size: s.size, tile: s.tile }))
    : [];

  const markerTypes = new Set<EditorMarkerType>(['settlement', 'village', 'town', 'city', 'castle', 'mining_area']);
  const markers = Array.isArray(candidate.markers)
    ? candidate.markers.filter((m): m is EditorMarker => {
        if (!m || typeof m !== 'object') return false;
        const marker = m as Partial<EditorMarker>;
        return typeof marker.id === 'string'
          && typeof marker.type === 'string' && markerTypes.has(marker.type as EditorMarkerType)
          && typeof marker.name === 'string'
          && Number.isFinite(marker.x) && Number.isFinite(marker.y);
      }).map((m) => ({ ...m }))
    : [];

  // v2 stored suppressProcedural flags. Procedural world generation no longer
  // exists, so those flags are intentionally discarded during migration.
  for (const cell of Object.values(cells)) {
    delete (cell as EditorCell & { suppressProcedural?: boolean }).suppressProcedural;
  }

  return {
    version: 3,
    worldSize,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
    cells,
    terrainStrokes,
    markers,
  };
}

export function loadEditorWorld(worldSize: number): EditorWorldData {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(EDITOR_WORLD_STORAGE_KEY)
      ?? localStorage.getItem('massrpg_editor_world_v2')
      ?? localStorage.getItem('massrpg_editor_world_v1');
    if (!raw) return (cached = blankEditorWorld(worldSize));
    return (cached = migrateParsedWorld(JSON.parse(raw), worldSize));
  } catch {
    return (cached = blankEditorWorld(worldSize));
  }
}

export function saveEditorWorld(data: EditorWorldData): void {
  data.updatedAt = new Date().toISOString();
  cached = data;
  localStorage.setItem(EDITOR_WORLD_STORAGE_KEY, JSON.stringify(data));
}

export function replaceEditorWorld(data: EditorWorldData): void {
  cached = data;
  saveEditorWorld(data);
}

export function clearEditorWorld(worldSize: number): EditorWorldData {
  const data = blankEditorWorld(worldSize);
  replaceEditorWorld(data);
  return data;
}

export function getEditorCell(x: number, y: number, worldSize: number): EditorCell | undefined {
  return loadEditorWorld(worldSize).cells[cellKey(x, y)];
}

export function getEditorTerrainStrokeAt(x: number, y: number, worldSize: number): TerrainStroke | undefined {
  const strokes = loadEditorWorld(worldSize).terrainStrokes;
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    const half = Math.floor(stroke.size / 2);
    if (x >= stroke.x - half && x <= stroke.x + half && y >= stroke.y - half && y <= stroke.y + half) {
      return stroke;
    }
  }
  return undefined;
}

export function getEditorTileAt(x: number, y: number, worldSize: number): TileType | undefined {
  const cell = getEditorCell(x, y, worldSize);
  if (cell?.tile) return cell.tile;
  return getEditorTerrainStrokeAt(x, y, worldSize)?.tile ?? undefined;
}

export function getEditorMarkers(worldSize: number): readonly EditorMarker[] {
  return loadEditorWorld(worldSize).markers;
}

export function hasOwnEditorField(cell: EditorCell | undefined, field: keyof EditorCell): boolean {
  return !!cell && Object.prototype.hasOwnProperty.call(cell, field);
}
