import {
  loadEditorWorld,
  saveEditorWorld,
  type EditorWorldData,
} from './EditorWorld';

const CANONICAL_WORLD_URL = '/world/twinlands-world.json';

function planeIsBlank(plane: EditorWorldData['planes']['-1']): boolean {
  return Object.keys(plane.cells).length === 0
    && plane.terrainStrokes.length === 0
    && plane.elevationStrokes.length === 0;
}

/**
 * True only for the empty-ocean editor state. A world with even one authored
 * cell, stroke, marker, link, or underground edit is treated as user work and
 * is never silently replaced by the repository baseline.
 */
export function isEditorWorldBlank(world: EditorWorldData): boolean {
  return Object.keys(world.cells).length === 0
    && world.terrainStrokes.length === 0
    && world.elevationStrokes.length === 0
    && world.markers.length === 0
    && world.links.length === 0
    && planeIsBlank(world.planes['-1'])
    && planeIsBlank(world.planes['-2']);
}

/** Load the repository-owned Twin Lands baseline distributed with the game. */
export async function loadCanonicalWorld(): Promise<EditorWorldData | null> {
  try {
    const response = await fetch(CANONICAL_WORLD_URL, { cache: 'no-cache' });
    if (!response.ok) {
      console.error(`Canonical Twin Lands world returned HTTP ${response.status}.`);
      return null;
    }

    const parsed = await response.json() as EditorWorldData;
    if (parsed.version !== 5 || parsed.worldSize !== 180000 || !Array.isArray(parsed.markers)) {
      console.error('Canonical Twin Lands world failed basic validation.');
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to load canonical Twin Lands baseline:', error);
    return null;
  }
}

/**
 * IndexedDB is the mutable editor working copy. On a fresh browser/origin the
 * storage layer initially contains an empty ocean, so seed that empty state
 * from the Git-owned world. Existing authored browser work is preserved.
 */
export async function ensureCanonicalWorldInstalled(worldSize: number): Promise<'installed' | 'kept-local' | 'missing'> {
  const current = loadEditorWorld(worldSize);
  if (!isEditorWorldBlank(current)) return 'kept-local';

  const canonical = await loadCanonicalWorld();
  if (!canonical) return 'missing';

  await saveEditorWorld(canonical);
  return 'installed';
}
