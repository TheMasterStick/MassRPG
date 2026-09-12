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

function rememberInstalledRevision(revision = CANONICAL_WORLD_REVISION): void {
  try {
    window.localStorage.setItem(CANONICAL_REVISION_STORAGE_KEY, revision);
  } catch {
    // The world itself is stored in IndexedDB. Failure to remember this tiny
    // marker must never prevent the user's authored working copy from loading.
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
 * Git owns the canonical baseline, while IndexedDB is the user's mutable map.
 *
 * The first visit installs Git's authored world. After that, the browser working
 * copy always wins. In particular, a later code/canonical revision must never
 * silently overwrite hours of editor work. New canonical maps can still be
 * adopted deliberately through Import JSON / Clear + reload when desired.
 */
export async function ensureCanonicalWorldInstalled(worldSize: number): Promise<'installed' | 'kept-local' | 'missing'> {
  const current = loadEditorWorld(worldSize);
  const installedRevision = readInstalledRevision();

  // Once this browser has ever had a canonical world installed, preserve its
  // IndexedDB working copy across all future application/canonical revisions.
  if (installedRevision !== null) {
    if (installedRevision !== CANONICAL_WORLD_REVISION) {
      console.warn(
        `[MassRPG] Canonical world revision changed (${installedRevision} -> ${CANONICAL_WORLD_REVISION}), `
        + 'but the local authored working copy was preserved. Export/import explicitly to replace it.',
      );
      rememberInstalledRevision(CANONICAL_WORLD_REVISION);
    }
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
