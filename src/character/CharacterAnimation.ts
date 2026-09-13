import type { CharacterFacing, CharacterSex } from './CharacterAppearance';

export type CharacterAnimationMotion = 'idle' | 'walk' | 'run' | 'axe' | 'pickaxe';

interface CharacterAnimationSequence {
  frames: string[];
  fps: number;
  loop: boolean;
  source?: string;
}

interface CharacterAnimationManifest {
  version: number;
  renderHeightTiles?: number;
  anchorX?: number;
  anchorY?: number;
  characters: Record<CharacterSex, Partial<Record<CharacterAnimationMotion, Partial<Record<CharacterFacing, CharacterAnimationSequence>>>>>;
}

export interface CharacterAnimationFrame {
  image: HTMLImageElement;
  flipX: boolean;
  renderHeightTiles: number;
  anchorX: number;
  anchorY: number;
  frameIndex: number;
  frameCount: number;
  finished: boolean;
  sourceMotion: CharacterAnimationMotion;
}

type ManifestState = 'unrequested' | 'loading' | 'loaded' | 'missing' | 'invalid';
type ImageState = 'loading' | 'loaded' | 'missing';

interface ImageEntry {
  image: HTMLImageElement;
  state: ImageState;
}

const MANIFEST_URL = '/sprites/character_animations/manifest.json';
let manifestState: ManifestState = 'unrequested';
let manifest: CharacterAnimationManifest | null = null;
const images = new Map<string, ImageEntry>();
const sequenceLoads = new Set<string>();

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function validManifest(value: unknown): value is CharacterAnimationManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CharacterAnimationManifest>;
  return !!candidate.characters && typeof candidate.characters === 'object';
}

function loadImage(url: string): ImageEntry {
  const existing = images.get(url);
  if (existing) return existing;
  const image = new Image();
  const entry: ImageEntry = { image, state: 'loading' };
  images.set(url, entry);
  image.onload = () => { entry.state = 'loaded'; };
  image.onerror = () => { entry.state = 'missing'; };
  image.src = url;
  return entry;
}

function preloadSequence(sequence: CharacterAnimationSequence) {
  const key = sequence.frames.join('|');
  if (sequenceLoads.has(key)) return;
  sequenceLoads.add(key);
  for (const url of sequence.frames) loadImage(url);
}

function preloadManifestSequences(nextManifest: CharacterAnimationManifest) {
  for (const character of Object.values(nextManifest.characters)) {
    if (!character) continue;
    for (const motion of Object.values(character)) {
      if (!motion) continue;
      for (const sequence of Object.values(motion)) {
        if (sequence?.frames?.length) preloadSequence(sequence);
      }
    }
  }
}

export function preloadCharacterAnimations(): void {
  if (manifestState !== 'unrequested') return;
  manifestState = 'loading';
  void fetch(MANIFEST_URL, { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) {
        manifestState = 'missing';
        return;
      }
      const json = await response.json() as unknown;
      if (!validManifest(json)) {
        manifestState = 'invalid';
        console.warn(`Invalid character animation manifest: ${MANIFEST_URL}`);
        return;
      }
      manifest = json;
      preloadManifestSequences(json);
      manifestState = 'loaded';
    })
    .catch(() => {
      manifestState = 'missing';
    });
}

function directSequence(
  sex: CharacterSex,
  motion: CharacterAnimationMotion,
  facing: CharacterFacing,
): CharacterAnimationSequence | undefined {
  return manifest?.characters[sex]?.[motion]?.[facing];
}

function resolveSequence(
  sex: CharacterSex,
  motion: CharacterAnimationMotion,
  facing: CharacterFacing,
): { sequence: CharacterAnimationSequence; flipX: boolean; sourceMotion: CharacterAnimationMotion } | null {
  const exact = directSequence(sex, motion, facing);
  if (exact) return { sequence: exact, flipX: false, sourceMotion: motion };

  // Side-profile source art is authored facing right. Mirror it for westward travel/actions.
  if (facing === 'left') {
    const right = directSequence(sex, motion, 'right');
    if (right) return { sequence: right, flipX: true, sourceMotion: motion };
  }

  // The first test batch has side walking and north/south running rather than every
  // motion in every direction. Reuse those authored cycles so all movement animates.
  if (motion === 'run' && (facing === 'left' || facing === 'right')) {
    const side = directSequence(sex, 'walk', 'right');
    if (side) return { sequence: side, flipX: facing === 'left', sourceMotion: 'walk' };
  }
  if (motion === 'walk' && (facing === 'up' || facing === 'down')) {
    const vertical = directSequence(sex, 'run', facing);
    if (vertical) return { sequence: vertical, flipX: false, sourceMotion: 'run' };
  }

  return null;
}

/**
 * Resolves one frame from the user-authored character animation source set.
 * Missing/unloaded sequences return null so the existing static character rendering
 * remains a seamless fallback while assets are added incrementally.
 */
export function getCharacterAnimationFrame(
  sex: CharacterSex,
  motion: CharacterAnimationMotion,
  facing: CharacterFacing,
  nowMs: number,
  playbackRate = 1,
): CharacterAnimationFrame | null {
  if (manifestState === 'unrequested') preloadCharacterAnimations();
  if (manifestState !== 'loaded' || !manifest) return null;

  const resolved = resolveSequence(sex, motion, facing);
  if (!resolved) return null;
  const { sequence, flipX, sourceMotion } = resolved;
  if (!sequence.frames.length) return null;
  preloadSequence(sequence);

  const fps = finitePositive(sequence.fps) ? sequence.fps : 8;
  const safeRate = finitePositive(playbackRate) ? playbackRate : 1;
  const rawIndex = Math.floor((Math.max(0, nowMs) * safeRate) / (1000 / fps));
  const loop = sequence.loop !== false;
  const finished = !loop && rawIndex >= sequence.frames.length - 1;
  const frameIndex = loop
    ? rawIndex % sequence.frames.length
    : Math.min(sequence.frames.length - 1, rawIndex);
  const entry = images.get(sequence.frames[frameIndex]);
  if (!entry || entry.state !== 'loaded') return null;

  return {
    image: entry.image,
    flipX,
    renderHeightTiles: finitePositive(manifest.renderHeightTiles) ? manifest.renderHeightTiles : 1.7,
    anchorX: typeof manifest.anchorX === 'number' ? manifest.anchorX : 0.5,
    anchorY: typeof manifest.anchorY === 'number' ? manifest.anchorY : 1,
    frameIndex,
    frameCount: sequence.frames.length,
    finished,
    sourceMotion,
  };
}

export function characterAnimationStatus(): ManifestState {
  return manifestState;
}
