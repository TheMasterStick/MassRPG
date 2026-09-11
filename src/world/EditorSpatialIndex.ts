import {
  getPlaneData,
  loadEditorWorld,
  shapeContains,
  type ElevationStroke,
  type TerrainStroke,
} from './EditorWorld';
import type { ElevationLevel, WorldPlane } from './types';
import { clampElevation } from './EditorWorld';

// The authored Twin Lands map can contain tens of thousands of brush strokes.
// Chunk generation used to scan that entire array for every single tile. These
// coarse spatial buckets keep authored order/precedence intact while limiting
// each tile lookup to nearby shapes only.
const BUCKET_SIZE = 2048;

type IndexedShape = TerrainStroke | ElevationStroke;

interface ShapeIndex<T extends IndexedShape> {
  source: T[];
  sourceLength: number;
  buckets: Map<string, number[]>;
}

const terrainIndices = new Map<WorldPlane, ShapeIndex<TerrainStroke>>();
const elevationIndices = new Map<WorldPlane, ShapeIndex<ElevationStroke>>();

function bucketKey(bx: number, by: number): string {
  return `${bx},${by}`;
}

function boundsOf(shape: IndexedShape): { left: number; top: number; right: number; bottom: number } {
  const half = Math.max(0.5, shape.size / 2);
  if (shape.kind === 'square') {
    const r = Math.floor(shape.size / 2);
    return { left: shape.x - r, top: shape.y - r, right: shape.x + r, bottom: shape.y + r };
  }
  const x2 = shape.x2 ?? shape.x;
  const y2 = shape.y2 ?? shape.y;
  const left = Math.min(shape.x, x2);
  const top = Math.min(shape.y, y2);
  const right = Math.max(shape.x, x2);
  const bottom = Math.max(shape.y, y2);
  if (shape.kind === 'line' || shape.kind === 'rect_outline') {
    return { left: left - half, top: top - half, right: right + half, bottom: bottom + half };
  }
  return { left, top, right, bottom };
}

function buildIndex<T extends IndexedShape>(source: T[]): ShapeIndex<T> {
  const buckets = new Map<string, number[]>();
  for (let index = 0; index < source.length; index++) {
    const b = boundsOf(source[index]);
    const minBx = Math.floor(b.left / BUCKET_SIZE);
    const maxBx = Math.floor(b.right / BUCKET_SIZE);
    const minBy = Math.floor(b.top / BUCKET_SIZE);
    const maxBy = Math.floor(b.bottom / BUCKET_SIZE);
    for (let by = minBy; by <= maxBy; by++) {
      for (let bx = minBx; bx <= maxBx; bx++) {
        const key = bucketKey(bx, by);
        const list = buckets.get(key);
        if (list) list.push(index);
        else buckets.set(key, [index]);
      }
    }
  }
  return { source, sourceLength: source.length, buckets };
}

function indexFor<T extends IndexedShape>(
  cache: Map<WorldPlane, ShapeIndex<T>>,
  source: T[],
  plane: WorldPlane,
): ShapeIndex<T> {
  const existing = cache.get(plane);
  if (existing && existing.source === source && existing.sourceLength === source.length) return existing;
  const rebuilt = buildIndex(source);
  cache.set(plane, rebuilt);
  return rebuilt;
}

export function invalidateEditorSpatialIndices(): void {
  terrainIndices.clear();
  elevationIndices.clear();
}

export function getIndexedTerrainStrokeAt(
  x: number,
  y: number,
  worldSize: number,
  plane: WorldPlane = 0,
): TerrainStroke | undefined {
  const source = getPlaneData(loadEditorWorld(worldSize), plane).terrainStrokes;
  const index = indexFor(terrainIndices, source, plane);
  const candidates = index.buckets.get(bucketKey(Math.floor(x / BUCKET_SIZE), Math.floor(y / BUCKET_SIZE)));
  if (!candidates) return undefined;
  // Later authored strokes win, exactly as in the original linear lookup.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const stroke = source[candidates[i]];
    if (shapeContains(stroke, x, y)) return stroke;
  }
  return undefined;
}

/**
 * Returns the authored elevation when at least one elevation stroke covers the
 * tile. Undefined specifically means "no authored elevation here", which lets
 * runtime ambience add gentle relief without ever replacing an authored zero.
 */
export function getIndexedElevationOverrideAt(
  x: number,
  y: number,
  worldSize: number,
  plane: WorldPlane = 0,
): ElevationLevel | undefined {
  const source = getPlaneData(loadEditorWorld(worldSize), plane).elevationStrokes;
  const index = indexFor(elevationIndices, source, plane);
  const candidates = index.buckets.get(bucketKey(Math.floor(x / BUCKET_SIZE), Math.floor(y / BUCKET_SIZE)));
  if (!candidates) return undefined;

  let elevation: ElevationLevel = 0;
  let matched = false;
  // Elevation deltas are cumulative, so evaluate matching strokes in original order.
  for (const candidate of candidates) {
    const stroke = source[candidate];
    if (!shapeContains(stroke, x, y)) continue;
    matched = true;
    elevation = stroke.mode === 'set'
      ? clampElevation(stroke.value)
      : clampElevation(elevation + stroke.value);
  }
  return matched ? elevation : undefined;
}

export function getIndexedElevationAt(
  x: number,
  y: number,
  worldSize: number,
  plane: WorldPlane = 0,
): ElevationLevel {
  return getIndexedElevationOverrideAt(x, y, worldSize, plane) ?? 0;
}
