export type CharacterSex = 'female' | 'male';
export type CharacterFacing = 'up' | 'down' | 'left' | 'right';

export interface CharacterAppearance {
  sex: CharacterSex;
  hairStyle: number;
  hairColor: string;
  eyeStyle: number;
  eyeColor: string;
  browStyle: number;
  browColor: string;
  noseStyle: number;
  mouthStyle: number;
}

export const CHARACTER_COUNTS = {
  female: { hair: 5, eyes: 8, brows: 4, noses: 5, mouths: 10 },
  male: { hair: 3, eyes: 8, brows: 4, noses: 6, mouths: 9 },
} as const;

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  sex: 'female',
  hairStyle: 1,
  hairColor: '#5f4a43',
  eyeStyle: 1,
  eyeColor: '#4aa866',
  browStyle: 1,
  browColor: '#4b342f',
  noseStyle: 1,
  mouthStyle: 1,
};

const ATLAS_ROOT = '/sprites/characters';
const TILE = 128;
const CREATOR_DRAFT_KEY = 'massrpg_character_creator_draft_v1';

const ATLAS_COLS = {
  base: 4,
  eyes: 4,
  eyebrows: 4,
  noses: 4,
  mouths: 8,
  hair: 8,
} as const;

type AtlasName = keyof typeof ATLAS_COLS;
type TintMode = 'none' | 'full' | 'green';

const atlasCache = new Map<AtlasName, Promise<HTMLImageElement>>();
const layerCache = new Map<string, Promise<HTMLCanvasElement>>();
const compositeCache = new Map<string, Promise<HTMLCanvasElement>>();
const activeSprites = new Map<CharacterFacing, HTMLImageElement>();
let activeAppearance: CharacterAppearance | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeAppearance(input: Partial<CharacterAppearance>): CharacterAppearance {
  const sex: CharacterSex = input.sex === 'male' ? 'male' : 'female';
  const counts = CHARACTER_COUNTS[sex];
  return {
    sex,
    hairStyle: clamp(input.hairStyle ?? DEFAULT_CHARACTER_APPEARANCE.hairStyle, 0, counts.hair),
    hairColor: input.hairColor ?? DEFAULT_CHARACTER_APPEARANCE.hairColor,
    eyeStyle: clamp(input.eyeStyle ?? DEFAULT_CHARACTER_APPEARANCE.eyeStyle, 0, counts.eyes),
    eyeColor: input.eyeColor ?? DEFAULT_CHARACTER_APPEARANCE.eyeColor,
    browStyle: clamp(input.browStyle ?? DEFAULT_CHARACTER_APPEARANCE.browStyle, 0, counts.brows),
    browColor: input.browColor ?? DEFAULT_CHARACTER_APPEARANCE.browColor,
    noseStyle: clamp(input.noseStyle ?? DEFAULT_CHARACTER_APPEARANCE.noseStyle, 0, counts.noses),
    mouthStyle: clamp(input.mouthStyle ?? DEFAULT_CHARACTER_APPEARANCE.mouthStyle, 0, counts.mouths),
  };
}

export function saveCreatorDraft(appearance: CharacterAppearance) {
  try {
    localStorage.setItem(CREATOR_DRAFT_KEY, JSON.stringify(normalizeAppearance(appearance)));
  } catch {
    // Character-creator drafts are optional; private browsing/storage denial should not block play.
  }
}

export function loadCreatorDraft(): CharacterAppearance {
  try {
    const raw = localStorage.getItem(CREATOR_DRAFT_KEY);
    if (raw) return normalizeAppearance(JSON.parse(raw) as Partial<CharacterAppearance>);
  } catch {
    // Fall through to defaults.
  }
  return { ...DEFAULT_CHARACTER_APPEARANCE };
}

function loadAtlas(name: AtlasName): Promise<HTMLImageElement> {
  const cached = atlasCache.get(name);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load character atlas: ${name}`));
    img.src = `${ATLAS_ROOT}/${name}.png`;
  });
  atlasCache.set(name, promise);
  return promise;
}

function atlasRect(name: AtlasName, index: number) {
  const cols = ATLAS_COLS[name];
  return {
    sx: (index % cols) * TILE,
    sy: Math.floor(index / cols) * TILE,
    sw: TILE,
    sh: TILE,
  };
}

function facingVariant(facing: CharacterFacing): number {
  if (facing === 'up') return 0;
  if (facing === 'down') return 1;
  if (facing === 'left') return 2;
  return 3;
}

function baseIndex(sex: CharacterSex, facing: CharacterFacing): number {
  return (sex === 'male' ? 4 : 0) + facingVariant(facing);
}

function hairIndex(sex: CharacterSex, style: number, facing: CharacterFacing): number {
  const sexOffset = sex === 'male' ? 20 : 0;
  return sexOffset + (style - 1) * 4 + facingVariant(facing);
}

function featureIndex(sex: CharacterSex, style: number, femaleCount: number): number {
  return (sex === 'male' ? femaleCount : 0) + style - 1;
}

function hexRgb(hex: string): [number, number, number] {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'ffffff';
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function tintFull(data: ImageData, hex: string) {
  const [tr, tg, tb] = hexRgb(hex);
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3] === 0) continue;
    const luminance = (data.data[i] * 0.299 + data.data[i + 1] * 0.587 + data.data[i + 2] * 0.114) / 255;
    const factor = 0.18 + luminance * 1.12;
    data.data[i] = Math.min(255, Math.round(tr * factor));
    data.data[i + 1] = Math.min(255, Math.round(tg * factor));
    data.data[i + 2] = Math.min(255, Math.round(tb * factor));
  }
}

function hueDegrees(r: number, g: number, b: number): { hue: number; saturation: number; value: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
    else hue = 60 * ((rn - gn) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return { hue, saturation: max === 0 ? 0 : delta / max, value: max };
}

function tintGreenIris(data: ImageData, hex: string) {
  const [tr, tg, tb] = hexRgb(hex);
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3] === 0) continue;
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    const hsv = hueDegrees(r, g, b);
    if (hsv.saturation < 0.22 || hsv.hue < 45 || hsv.hue > 175) continue;
    const factor = 0.28 + hsv.value * 0.95;
    data.data[i] = Math.min(255, Math.round(tr * factor));
    data.data[i + 1] = Math.min(255, Math.round(tg * factor));
    data.data[i + 2] = Math.min(255, Math.round(tb * factor));
  }
}

async function getLayer(name: AtlasName, index: number, tintMode: TintMode = 'none', color = ''): Promise<HTMLCanvasElement> {
  const cacheKey = `${name}|${index}|${tintMode}|${color}`;
  const cached = layerCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const atlas = await loadAtlas(name);
    const rect = atlasRect(name, index);
    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, TILE, TILE);

    if (tintMode !== 'none') {
      const pixels = ctx.getImageData(0, 0, TILE, TILE);
      if (tintMode === 'full') tintFull(pixels, color);
      else tintGreenIris(pixels, color);
      ctx.putImageData(pixels, 0, 0);
    }
    return canvas;
  })();

  layerCache.set(cacheKey, promise);
  return promise;
}

function appearanceKey(appearance: CharacterAppearance, facing: CharacterFacing): string {
  return `${facing}|${JSON.stringify(normalizeAppearance(appearance))}`;
}

export async function composeCharacterCanvas(
  appearanceInput: CharacterAppearance,
  facing: CharacterFacing,
): Promise<HTMLCanvasElement> {
  const appearance = normalizeAppearance(appearanceInput);
  const key = appearanceKey(appearance, facing);
  const cached = compositeCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.imageSmoothingEnabled = false;

    const base = await getLayer('base', baseIndex(appearance.sex, facing));
    ctx.drawImage(base, 0, 0);

    if (facing === 'down') {
      if (appearance.eyeStyle > 0) {
        const eyes = await getLayer(
          'eyes',
          featureIndex(appearance.sex, appearance.eyeStyle, 8),
          'green',
          appearance.eyeColor,
        );
        ctx.drawImage(eyes, 0, 0);
      }
      if (appearance.browStyle > 0) {
        const brows = await getLayer(
          'eyebrows',
          featureIndex(appearance.sex, appearance.browStyle, 4),
          'full',
          appearance.browColor,
        );
        ctx.drawImage(brows, 0, 0);
      }
      if (appearance.noseStyle > 0) {
        const nose = await getLayer('noses', featureIndex(appearance.sex, appearance.noseStyle, 5));
        ctx.drawImage(nose, 0, 0);
      }
      if (appearance.mouthStyle > 0) {
        const mouth = await getLayer('mouths', featureIndex(appearance.sex, appearance.mouthStyle, 10));
        ctx.drawImage(mouth, 0, 0);
      }
    }

    if (appearance.hairStyle > 0) {
      const hair = await getLayer(
        'hair',
        hairIndex(appearance.sex, appearance.hairStyle, facing),
        'full',
        appearance.hairColor,
      );
      ctx.drawImage(hair, 0, 0);
    }

    return canvas;
  })();

  compositeCache.set(key, promise);
  return promise;
}

async function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  const img = new Image();
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not create composed character sprite'));
  });
  img.src = canvas.toDataURL('image/png');
  return loaded;
}

export async function setActiveCharacterAppearance(appearanceInput: CharacterAppearance): Promise<void> {
  const appearance = normalizeAppearance(appearanceInput);
  activeAppearance = appearance;
  activeSprites.clear();

  const facings: CharacterFacing[] = ['up', 'down', 'left', 'right'];
  await Promise.all(facings.map(async (facing) => {
    const canvas = await composeCharacterCanvas(appearance, facing);
    activeSprites.set(facing, await canvasToImage(canvas));
  }));
}

export function clearActiveCharacterAppearance() {
  activeAppearance = null;
  activeSprites.clear();
}

export function getCustomPlayerSprite(facing: CharacterFacing): HTMLImageElement | null {
  if (!activeAppearance) return null;
  return activeSprites.get(facing) ?? null;
}
