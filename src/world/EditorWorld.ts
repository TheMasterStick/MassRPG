import type { ResourceType, StructureType, TileType } from './types';

export const EDITOR_WORLD_STORAGE_KEY = 'massrpg_editor_world_v4';

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

export type TerrainStrokeKind = 'square' | 'line' | 'rect_fill' | 'rect_outline';

/**
 * Compact authored terrain primitive. `size` is brush width for square/line/
 * outline shapes. Rectangle fill ignores width except for preview consistency.
 * Shapes are applied in array order; the last shape containing a tile wins.
 */
export interface TerrainStroke {
  kind: TerrainStrokeKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  size: number;
  /** null reveals the blank deep-water base beneath older editor shapes. */
  tile: TileType | null;
}

export interface EditorWorldData {
  version: 4;
  worldSize: number;
  updatedAt: string;
  cells: Record<string, EditorCell>;
  /** Broad terrain is stored as compact shapes instead of millions of cells. */
  terrainStrokes: TerrainStroke[];
  /** Authored reference markers exported so AI/tools can read intended POIs later. */
  markers: EditorMarker[];
}

let cached: EditorWorldData | null = null;

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function blankEditorWorld(worldSize: number): EditorWorldData {
  return {
    version: 4,
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
    ? candidate.terrainStrokes.flatMap((raw): TerrainStroke[] => {
        if (!raw || typeof raw !== 'object') return [];
        const stroke = raw as {
          kind?: unknown;
          x?: unknown; y?: unknown; x2?: unknown; y2?: unknown;
          size?: unknown; tile?: unknown;
        };
        if (!Number.isFinite(stroke.x) || !Number.isFinite(stroke.y) || !Number.isFinite(stroke.size)) return [];
        if (!(stroke.tile === null || typeof stroke.tile === 'string')) return [];
        const kind: TerrainStrokeKind = stroke.kind === 'line' || stroke.kind === 'rect_fill' || stroke.kind === 'rect_outline'
          ? stroke.kind
          : 'square';
        if (kind !== 'square' && (!Number.isFinite(stroke.x2) || !Number.isFinite(stroke.y2))) return [];
        return [{
          kind,
          x: Number(stroke.x),
          y: Number(stroke.y),
          ...(kind !== 'square' ? { x2: Number(stroke.x2), y2: Number(stroke.y2) } : {}),
          size: Math.max(1, Math.round(Number(stroke.size))),
          tile: stroke.tile as TileType | null,
        }];
      })
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

  // v2 stored suppressProcedural flags. The procedural world is retired.
  for (const cell of Object.values(cells)) {
    delete (cell as EditorCell & { suppressProcedural?: boolean }).suppressProcedural;
  }

  return {
    version: 4,
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
      ?? localStorage.getItem('massrpg_editor_world_v3')
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

export function terrainStrokeContains(stroke: TerrainStroke, x: number, y: number): boolean {
  const half = Math.max(0.5, stroke.size / 2);
  if (stroke.kind === 'square') {
    const radius = Math.floor(stroke.size / 2);
    return x >= stroke.x - radius && x <= stroke.x + radius
      && y >= stroke.y - radius && y <= stroke.y + radius;
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

export function getEditorTerrainStrokeAt(x: number, y: number, worldSize: number): TerrainStroke | undefined {
  const strokes = loadEditorWorld(worldSize).terrainStrokes;
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (terrainStrokeContains(strokes[i], x, y)) return strokes[i];
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

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
