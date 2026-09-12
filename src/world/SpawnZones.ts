import type { EditorWorldData } from './EditorWorld';
import { loadEditorWorld } from './EditorWorld';
import type { ResourceType, WorldPlane } from './types';

export type SpawnZoneKind = 'monster' | 'resource';

export interface SpawnZoneStroke {
  x: number;
  y: number;
  size: number;
}

/**
 * Named paintable world region used for authored population. Keeping a stable
 * zone id/config separate from the generated actors/nodes is intentional: a
 * future authoritative server can own the same region without changing the map.
 */
export interface EditorSpawnZone {
  id: string;
  name: string;
  kind: SpawnZoneKind;
  targetId: string;
  plane: WorldPlane;
  /** Desired simultaneously-live spawn points/nodes derived from this region. */
  count: number;
  paint: SpawnZoneStroke[];
  erase: SpawnZoneStroke[];
}

type EditorWorldWithSpawnZones = EditorWorldData & { spawnZones?: EditorSpawnZone[] };

export function mutableSpawnZones(data: EditorWorldData): EditorSpawnZone[] {
  const extended = data as EditorWorldWithSpawnZones;
  if (!Array.isArray(extended.spawnZones)) extended.spawnZones = [];
  return extended.spawnZones;
}

export function getEditorSpawnZones(worldSize: number, plane?: WorldPlane): readonly EditorSpawnZone[] {
  const zones = mutableSpawnZones(loadEditorWorld(worldSize));
  return plane === undefined ? zones : zones.filter((zone) => zone.plane === plane);
}

function strokeContains(stroke: SpawnZoneStroke, x: number, y: number): boolean {
  const radius = Math.max(0, Math.floor(Math.max(1, stroke.size) / 2));
  return x >= stroke.x - radius && x <= stroke.x + radius
    && y >= stroke.y - radius && y <= stroke.y + radius;
}

export function spawnZoneContains(zone: EditorSpawnZone, x: number, y: number): boolean {
  if (!zone.paint.some((stroke) => strokeContains(stroke, x, y))) return false;
  return !zone.erase.some((stroke) => strokeContains(stroke, x, y));
}

export function spawnZoneBounds(zone: EditorSpawnZone): { left: number; top: number; right: number; bottom: number } | null {
  if (zone.paint.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const stroke of zone.paint) {
    const radius = Math.max(0, Math.floor(Math.max(1, stroke.size) / 2));
    left = Math.min(left, stroke.x - radius);
    top = Math.min(top, stroke.y - radius);
    right = Math.max(right, stroke.x + radius);
    bottom = Math.max(bottom, stroke.y + radius);
  }
  return { left, top, right, bottom };
}

export function isResourceTarget(value: string): value is ResourceType {
  return value.startsWith('tree_') || value.startsWith('rock_') || value.startsWith('fishing_')
    || value === 'farm_patch' || value === 'herb_patch' || value === 'flax_plant';
}
