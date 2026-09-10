import type { ResourceType, StructureType, TileType } from './types';

export const EDITOR_WORLD_STORAGE_KEY = 'massrpg_editor_world_v1';

export interface EditorCell {
  tile?: TileType;
  resource?: ResourceType | null;
  structure?: StructureType | null;
  spawner?: string | null;
}

export interface EditorWorldData {
  version: 1;
  worldSize: number;
  updatedAt: string;
  cells: Record<string, EditorCell>;
}

let cached: EditorWorldData | null = null;

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function blankEditorWorld(worldSize: number): EditorWorldData {
  return { version: 1, worldSize, updatedAt: new Date().toISOString(), cells: {} };
}

export function loadEditorWorld(worldSize: number): EditorWorldData {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(EDITOR_WORLD_STORAGE_KEY);
    if (!raw) return (cached = blankEditorWorld(worldSize));
    const parsed = JSON.parse(raw) as Partial<EditorWorldData>;
    if (parsed.version !== 1 || !parsed.cells || typeof parsed.cells !== 'object') {
      return (cached = blankEditorWorld(worldSize));
    }
    return (cached = {
      version: 1,
      worldSize,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      cells: parsed.cells as Record<string, EditorCell>,
    });
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

export function hasOwnEditorField(cell: EditorCell | undefined, field: keyof EditorCell): boolean {
  return !!cell && Object.prototype.hasOwnProperty.call(cell, field);
}
