import {
  loadEditorWorld,
  saveEditorWorld,
  type EditorWorldData,
} from './EditorWorld';

const CANONICAL_WORLD_URL = '/world/twinlands-world.json';
const CANONICAL_WORLD_REVISION = '2026-09-11-twinlands-authored-v1';
const CANONICAL_REVISION_STORAGE_KEY = 'massrpg_canonical_world_revision';

function readInstalledRevision(): string | null {
  try {
    return window.localStorage.getItem(CANONICAL_REVISION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberInstalledRevision(): void {
  try {
    window.localStorage.setItem(CANONICAL_REVISION_STORAGE_KEY, CANONICAL_WORLD_REVISION);
  } catch {
    // The world itself is stored in IndexedDB. Failure to remember this tiny
    // migration marker only means the canonical baseline may be reinstalled
    // on the next reload; it must not prevent the game from starting now.
  }
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
    const hasCapital = Array.isArray(parsed.markers)
      && parsed.markers.some((marker) => marker.plane === 0 && marker.name.trim().toLowerCase() === 'capital city');

    if (
      parsed.version !== 5
      || parsed.worldSize !== 180000
      || !Array.isArray(parsed.terrainStrokes)
      || parsed.terrainStrokes.length === 0
      || !hasCapital
    ) {
      console.error('Canonical Twin Lands world failed validation: expected authored terrain and the Capital City marker.');
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load canonical Twin Lands baseline:', error);
    return null;
  }
}

/**
 * Git owns the canonical Twin Lands baseline. IndexedDB is only the mutable
 * browser working copy.
 *
 * Older builds created an empty-ocean (or nearly empty) IndexedDB world before
 * Git had a canonical baseline. Merely checking whether that world was blank
 * was not sufficient: even one old brush stroke prevented the real Twin Lands
 * from ever being installed. The revision marker below deliberately performs a
 * one-time migration for each canonical Git revision, then preserves local
 * editor changes on subsequent reloads.
 */
export async function ensureCanonicalWorldInstalled(worldSize: number): Promise<'installed' | 'kept-local' | 'missing'> {
  const current = loadEditorWorld(worldSize);
  const installedRevision = readInstalledRevision();

  if (installedRevision === CANONICAL_WORLD_REVISION) {
    console.info(
      `[MassRPG] Keeping local Twin Lands working copy (${current.terrainStrokes.length} terrain strokes, ${current.markers.length} markers).`,
    );
    return 'kept-local';
  }

  const canonical = await loadCanonicalWorld();
  if (!canonical) return 'missing';

  await saveEditorWorld(canonical);
  rememberInstalledRevision();
  console.info(
    `[MassRPG] Installed canonical Twin Lands ${CANONICAL_WORLD_REVISION} (${canonical.terrainStrokes.length} terrain strokes, ${canonical.markers.length} markers).`,
  );
  return 'installed';
}
