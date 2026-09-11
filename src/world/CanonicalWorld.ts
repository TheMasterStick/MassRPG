import type { EditorWorldData } from './EditorWorld';

const CANONICAL_WORLD_URL = '/world/twinlands-world.json.gz';

/**
 * Load the repository-owned Twin Lands baseline. This file is the canonical
 * authored world distributed with the game. Browser IndexedDB is only the
 * mutable working copy layered on top of this baseline.
 */
export async function loadCanonicalWorld(): Promise<EditorWorldData | null> {
  try {
    const response = await fetch(CANONICAL_WORLD_URL, { cache: 'no-cache' });
    if (!response.ok) return null;

    const compressed = await response.arrayBuffer();
    if (typeof DecompressionStream === 'undefined') return null;

    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    return JSON.parse(text) as EditorWorldData;
  } catch (error) {
    console.error('Failed to load canonical Twin Lands baseline:', error);
    return null;
  }
}
