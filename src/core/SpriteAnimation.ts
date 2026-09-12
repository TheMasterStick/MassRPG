export type SpriteAnimationFacing = 'up' | 'down' | 'left' | 'right';

export interface SpriteAnimationCell {
  col: number;
  row: number;
}

export interface SpriteAnimationSequence {
  /** Columns in a single row, e.g. [0,1,2,3,4,5]. */
  frames?: number[];
  /** Row used by `frames`. */
  row?: number;
  /** Arbitrary frame cells for sheets that are not laid out in one row. */
  cells?: SpriteAnimationCell[];
  fps?: number;
  loop?: boolean;
}

export interface SpriteAnimationClip {
  fps?: number;
  loop?: boolean;
  directions: Partial<Record<SpriteAnimationFacing, SpriteAnimationSequence>>;
}

export interface SpriteAnimationManifest {
  image: string;
  frameWidth: number;
  frameHeight: number;
  /** Width of the rendered actor in world tiles. Renderer defaults may override this when omitted. */
  renderWidthTiles?: number;
  /** Normalized point inside the frame placed at the world tile's bottom-centre. Defaults to 0.5, 1.0. */
  anchorX?: number;
  anchorY?: number;
  animations: Record<string, SpriteAnimationClip>;
}

export interface SpriteAnimationFrame {
  image: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  renderWidthTiles?: number;
  anchorX: number;
  anchorY: number;
  frameIndex: number;
  frameCount: number;
  finished: boolean;
}

type LoadState = 'loading' | 'loaded' | 'missing' | 'invalid';

interface AnimationSetEntry {
  state: LoadState;
  manifestUrl: string;
  manifest?: SpriteAnimationManifest;
  image?: HTMLImageElement;
}

const animationSets = new Map<string, AnimationSetEntry>();

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function looksLikeManifest(value: unknown): value is SpriteAnimationManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<SpriteAnimationManifest>;
  return typeof manifest.image === 'string'
    && finitePositive(manifest.frameWidth)
    && finitePositive(manifest.frameHeight)
    && !!manifest.animations
    && typeof manifest.animations === 'object';
}

function resolveImageUrl(manifestUrl: string, image: string): string {
  if (image.startsWith('/')) return image;
  const slash = manifestUrl.lastIndexOf('/');
  const base = slash >= 0 ? manifestUrl.slice(0, slash + 1) : '/';
  return `${base}${image}`;
}

/**
 * Begins loading an optional spritesheet manifest. Missing manifests are deliberately
 * silent: static sprites remain the fallback while art is migrated incrementally.
 */
export function preloadSpriteAnimationSet(
  id: string,
  manifestUrl = `/sprites/${id}/animation.json`,
): void {
  if (animationSets.has(id)) return;

  const entry: AnimationSetEntry = { state: 'loading', manifestUrl };
  animationSets.set(id, entry);

  void fetch(manifestUrl, { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) {
        entry.state = 'missing';
        return;
      }
      const json = await response.json() as unknown;
      if (!looksLikeManifest(json)) {
        entry.state = 'invalid';
        console.warn(`Invalid sprite animation manifest: ${manifestUrl}`);
        return;
      }

      const image = new Image();
      entry.manifest = json;
      entry.image = image;
      image.onload = () => { entry.state = 'loaded'; };
      image.onerror = () => {
        entry.state = 'missing';
        console.warn(`Could not load sprite animation image: ${json.image}`);
      };
      image.src = resolveImageUrl(manifestUrl, json.image);
    })
    .catch(() => {
      entry.state = 'missing';
    });
}

function cellsForSequence(sequence: SpriteAnimationSequence): SpriteAnimationCell[] {
  if (sequence.cells?.length) return sequence.cells;
  if (!sequence.frames?.length) return [];
  const row = Math.max(0, Math.floor(sequence.row ?? 0));
  return sequence.frames.map((col) => ({ col: Math.max(0, Math.floor(col)), row }));
}

/**
 * Resolves the current source rectangle for an animation. This does not draw anything,
 * so the same animation system can be used for players, monsters, NPCs and layered gear.
 */
export function getSpriteAnimationFrame(
  id: string,
  animationName: string,
  facing: SpriteAnimationFacing,
  nowMs: number,
  startedAtMs = 0,
): SpriteAnimationFrame | null {
  let entry = animationSets.get(id);
  if (!entry) {
    preloadSpriteAnimationSet(id);
    entry = animationSets.get(id);
  }
  if (!entry || entry.state !== 'loaded' || !entry.manifest || !entry.image) return null;

  const manifest = entry.manifest;
  const clip = manifest.animations[animationName] ?? manifest.animations.idle;
  if (!clip) return null;

  const sequence = clip.directions[facing]
    ?? clip.directions.down
    ?? Object.values(clip.directions)[0];
  if (!sequence) return null;

  const cells = cellsForSequence(sequence);
  if (!cells.length) return null;

  const fps = finitePositive(sequence.fps)
    ? sequence.fps
    : finitePositive(clip.fps) ? clip.fps : 8;
  const loop = sequence.loop ?? clip.loop ?? true;
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const rawIndex = Math.floor(elapsedMs / (1000 / fps));
  const finished = !loop && rawIndex >= cells.length - 1;
  const frameIndex = loop
    ? rawIndex % cells.length
    : Math.min(cells.length - 1, rawIndex);
  const cell = cells[frameIndex];

  return {
    image: entry.image,
    sx: cell.col * manifest.frameWidth,
    sy: cell.row * manifest.frameHeight,
    sw: manifest.frameWidth,
    sh: manifest.frameHeight,
    renderWidthTiles: manifest.renderWidthTiles,
    anchorX: typeof manifest.anchorX === 'number' ? manifest.anchorX : 0.5,
    anchorY: typeof manifest.anchorY === 'number' ? manifest.anchorY : 1,
    frameIndex,
    frameCount: cells.length,
    finished,
  };
}

export function spriteAnimationSetStatus(id: string): LoadState | 'unrequested' {
  return animationSets.get(id)?.state ?? 'unrequested';
}
