import type { ResourceType, StructureType, TileType } from './types';

export const EDITOR_WORLD_STORAGE_KEY = 'massrpg_editor_world_v2';

export interface EditorCell {
  tile?: TileType;
  resource?: ResourceType | null;
  structure?: StructureType | null;
  spawner?: string | null;
  /** When true, procedural structures/resources/spawns are suppressed on this tile. */
  suppressProcedural?: boolean;
}

export interface TerrainStroke {
  x: number;
  y: number;
  size: number;
  /** null means reveal the procedural/base terrain beneath older editor strokes. */
  tile: TileType | null;
  /** When true, procedural structures/resources/spawns are suppressed under this stroke. */
  suppressProcedural: boolean;
}

export interface EditorWorldData {
  version: 2;
  worldSize: number;
  updatedAt: string;
  cells: Record<string, EditorCell>;
  /** Large terrain brushes are stored as sparse square dabs instead of millions of cells. */
  terrainStrokes: TerrainStroke[];
}

let cached: EditorWorldData | null = null;

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function blankEditorWorld(worldSize: number): EditorWorldData {
  return { version: 2, worldSize, updatedAt: new Date().toISOString(), cells: {}, terrainStrokes: [] };
}

function migrateParsedWorld(parsed: unknown, worldSize: number): EditorWorldData {
  if (!parsed || typeof parsed !== 'object') return blankEditorWorld(worldSize);
  const candidate = parsed as {
    version?: number;
    updatedAt?: unknown;
    cells?: unknown;
    terrainStrokes?: unknown;
  };
  if (!candidate.cells || typeof candidate.cells !== 'object') return blankEditorWorld(worldSize);

  const cells = candidate.cells as Record<string, EditorCell>;
  const terrainStrokes = Array.isArray(candidate.terrainStrokes)
    ? candidate.terrainStrokes.filter((s): s is TerrainStroke => {
        if (!s || typeof s !== 'object') return false;
        const stroke = s as Partial<TerrainStroke>;
        return Number.isFinite(stroke.x) && Number.isFinite(stroke.y) && Number.isFinite(stroke.size)
          && typeof stroke.suppressProcedural === 'boolean'
          && (stroke.tile === null || typeof stroke.tile === 'string');
      })
    : [];

  return {
    version: 2,
    worldSize,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
    cells,
    terrainStrokes,
  };
}

export function loadEditorWorld(worldSize: number): EditorWorldData {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(EDITOR_WORLD_STORAGE_KEY)
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

export function hasOwnEditorField(cell: EditorCell | undefined, field: keyof EditorCell): boolean {
  return !!cell && Object.prototype.hasOwnProperty.call(cell, field);
}
