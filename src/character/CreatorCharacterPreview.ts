import {
  normalizeAppearance,
  type CharacterAppearance,
  type CharacterFacing,
  type CharacterSex,
} from './CharacterAppearance';

const CREATOR_ATLAS_ROOT = '/sprites/characters_hd';
const CREATOR_ATLAS_VERSION = '1';
const TILE = 512;

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

function loadAtlas(name: AtlasName): Promise<HTMLImageElement> {
  const cached = atlasCache.get(name);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load HD creator atlas: ${name}`));
    img.src = `${CREATOR_ATLAS_ROOT}/${name}.png?v=${CREATOR_ATLAS_VERSION}`;
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

/** High-resolution creator-only composition. Runtime continues to use the smaller atlases. */
export async function composeCreatorCharacterCanvas(
  appearanceInput: CharacterAppearance,
  facing: CharacterFacing,
): Promise<HTMLCanvasElement> {
  const appearance = normalizeAppearance(appearanceInput);
  const key = `${facing}|${JSON.stringify(appearance)}`;
  const cached = compositeCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(await getLayer('base', baseIndex(appearance.sex, facing)), 0, 0);

    if (facing === 'down') {
      if (appearance.eyeStyle > 0) {
        ctx.drawImage(await getLayer(
          'eyes',
          featureIndex(appearance.sex, appearance.eyeStyle, 8),
          'green',
          appearance.eyeColor,
        ), 0, 0);
      }
      if (appearance.browStyle > 0) {
        ctx.drawImage(await getLayer(
          'eyebrows',
          featureIndex(appearance.sex, appearance.browStyle, 4),
          'full',
          appearance.browColor,
        ), 0, 0);
      }
      if (appearance.noseStyle > 0) {
        ctx.drawImage(await getLayer('noses', featureIndex(appearance.sex, appearance.noseStyle, 5)), 0, 0);
      }
      if (appearance.mouthStyle > 0) {
        ctx.drawImage(await getLayer('mouths', featureIndex(appearance.sex, appearance.mouthStyle, 10)), 0, 0);
      }
    }

    if (appearance.hairStyle > 0) {
      const hair = await getLayer(
        'hair',
        hairIndex(appearance.sex, appearance.hairStyle, facing),
        'full',
        appearance.hairColor,
      );
      // The supplied hair layers sat a few source pixels lower than the body masters.
      // Eight HD pixels equals the two-pixel correction used by the 128px runtime set.
      ctx.drawImage(hair, 0, -8);
    }

    return canvas;
  })();

  compositeCache.set(key, promise);
  return promise;
}

export const CREATOR_CHARACTER_TILE_SIZE = TILE;
