// Loads user-supplied pixel art from /public/sprites/** at runtime, with
// silent per-file fallback: anything not yet drawn just keeps using the
// existing procedural glyph/shape rendering in Renderer.ts. Drop a
// correctly-named PNG in the matching folder and it's picked up on the
// next load — no code changes needed. See public/sprites/README.md.

import type { ResourceType, StructureType, TileType } from '../world/types';
import { MONSTERS } from '../data/monsters';
import { getCustomPlayerSprite, loadCreatorDraft } from '../character/CharacterAppearance';
import { getCharacterAnimationFrame, preloadCharacterAnimations } from '../character/CharacterAnimation';
import { getSpriteAnimationImageFrame, preloadSpriteAnimationSet } from './SpriteAnimation';

export type SpriteCategory = 'tiles' | 'resources' | 'structures' | 'monsters' | 'player' | 'roof';
export type Facing = 'up' | 'down' | 'left' | 'right';
export type ElevationTheme = 'grass' | 'snow' | 'desert';

type LoadState = 'loading' | 'loaded' | 'missing';

interface Entry {
  img: HTMLImageElement;
  state: LoadState;
}

const cache = new Map<string, Entry>();
const elevationCache = new Map<string, Entry>();
const mirroredCharacterFrames = new Map<string, Entry>();

function key(category: SpriteCategory, id: string): string {
  return `${category}/${id}`;
}

function load(category: SpriteCategory, id: string) {
  const k = key(category, id);
  if (cache.has(k)) return;
  const img = new Image();
  const entry: Entry = { img, state: 'loading' };
  cache.set(k, entry);
  img.onload = () => { entry.state = 'loaded'; };
  img.onerror = () => { entry.state = 'missing'; };
  img.src = `/sprites/${category}/${id}.png`;
}

function elevationKey(theme: ElevationTheme, id: string): string {
  return `${theme}/${id}`;
}

function loadElevation(theme: ElevationTheme, id: string) {
  const k = elevationKey(theme, id);
  if (elevationCache.has(k)) return;
  const img = new Image();
  const entry: Entry = { img, state: 'loading' };
  elevationCache.set(k, entry);
  img.onload = () => { entry.state = 'loaded'; };
  img.onerror = () => { entry.state = 'missing'; };
  img.src = `/sprites/tiles/${theme}_cliffs/${id}.png`;
}

function customFacingFromPlayerId(id: string): Facing | null {
  const match = /^(up|down|left|right)(?:_walk[12])?$/.exec(id);
  if (!match) return null;
  return match[1] as Facing;
}

function playerAnimationFromId(id: string): 'idle' | 'walk' | null {
  if (/^(up|down|left|right)$/.test(id)) return 'idle';
  if (/^(up|down|left|right)_walk[12]$/.test(id)) return 'walk';
  return null;
}

function mirroredCharacterFrame(image: HTMLImageElement): HTMLImageElement | null {
  const k = image.src;
  const cached = mirroredCharacterFrames.get(k);
  if (cached) return cached.state === 'loaded' ? cached.img : null;
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(image, 0, 0);

  const mirrored = new Image();
  const entry: Entry = { img: mirrored, state: 'loading' };
  mirroredCharacterFrames.set(k, entry);
  mirrored.onload = () => { entry.state = 'loaded'; };
  mirrored.onerror = () => { entry.state = 'missing'; };
  mirrored.src = canvas.toDataURL('image/png');
  return null;
}

function customAnimatedFacing(id: string, facing: Facing, custom: HTMLImageElement): HTMLImageElement {
  const animation = playerAnimationFromId(id);
  if (!animation) return custom;
  const sex = loadCreatorDraft().sex;

  // The first authored movement batch consists of north/south running cycles and
  // a right-facing side walk cycle. Route movement directly to the art that exists
  // instead of depending on the old two-frame walk ids to imply a specific motion.
  const motion = animation === 'idle'
    ? 'idle'
    : facing === 'up' || facing === 'down'
      ? 'run'
      : 'walk';

  const frame = getCharacterAnimationFrame(sex, motion, facing, performance.now());
  if (!frame) return custom;
  if (!frame.flipX) return frame.image;
  return mirroredCharacterFrame(frame.image) ?? custom;
}

function customGatherFrame(id: string): HTMLImageElement | null {
  const match = /^(axe|pickaxe)_(?:prepare|swing)$/.exec(id);
  if (!match || !getCustomPlayerSprite('down')) return null;
  const frame = getCharacterAnimationFrame(
    loadCreatorDraft().sex,
    match[1] as 'axe' | 'pickaxe',
    'right',
    performance.now(),
  );
  return frame?.image ?? null;
}

/** Returns a loaded image ready to draw, or null if missing/not loaded yet (fall back to procedural rendering). */
export function getSprite(category: SpriteCategory, id: string): HTMLImageElement | null {
  if (category === 'player') {
    const facing = customFacingFromPlayerId(id);
    if (facing) {
      const custom = getCustomPlayerSprite(facing);
      if (custom) return customAnimatedFacing(id, facing, custom);

      const animation = playerAnimationFromId(id);
      if (animation) {
        const animated = getSpriteAnimationImageFrame('player', animation, facing, performance.now());
        if (animated) return animated.image;
      }
    } else {
      const gather = customGatherFrame(id);
      if (gather) return gather;
    }
  }

  const entry = cache.get(key(category, id));
  return entry && entry.state === 'loaded' ? entry.img : null;
}

/** Approved 32x32 cliff/crevice art lives in nested biome-specific tile folders. */
export function getElevationSprite(theme: ElevationTheme, id: string): HTMLImageElement | null {
  const entry = elevationCache.get(elevationKey(theme, id));
  return entry && entry.state === 'loaded' ? entry.img : null;
}

export function getPlayerSprite(facing: Facing): HTMLImageElement | null {
  return getSprite('player', facing) ?? getSprite('player', 'down');
}

const TILE_TYPES: TileType[] = [
  'deep_water', 'water', 'beach', 'grass', 'plains', 'forest', 'taiga',
  'mountain', 'snow', 'desert', 'swamp', 'path', 'rubble',
  'floor_wood', 'floor_brick', 'floor_cobble',
  'void', 'cave_floor', 'cave_wall',
];
const RESOURCE_TYPES: ResourceType[] = [
  'tree_normal', 'tree_oak', 'tree_willow', 'tree_maple', 'tree_yew', 'tree_magic',
  'rock_copper', 'rock_tin', 'rock_iron', 'rock_coal', 'rock_mithril', 'rock_adamant', 'rock_rune',
  'rock_gold', 'rock_silver', 'rock_gem', 'rock_dragonite',
  'fishing_shrimp', 'fishing_lobster', 'fishing_swordfish',
  'farm_patch', 'herb_patch', 'flax_plant',
];
const STRUCTURE_TYPES: StructureType[] = [
  'bank_chest', 'furnace', 'anvil', 'cooking_range', 'campfire', 'workbench',
  'fence', 'wall', 'wall_window', 'wall_brick', 'wall_stone', 'wall_cobble',
  'bed', 'storage_chest', 'tannery', 'loom', 'general_store',
];
const PLAYER_FACINGS: Facing[] = ['down', 'up', 'left', 'right'];
const ROOF_IDS = ['tile_middle', 'tile_side', 'tatch_middle', 'tatch_side'];
const ELEVATION_THEMES: ElevationTheme[] = ['grass', 'snow', 'desert'];
const ELEVATION_IDS = [
  'crevice_north', 'crevice_north_east', 'crevice_north_west',
  'cliff_south', 'cliff_south_east', 'cliff_south_west',
  'crevice_east', 'cliff_west',
];

// Gather-action tool animation: legacy prepare/swing PNGs remain a fallback for
// characters that do not use the source-frame animation test set.
export type GatherTool = 'axe' | 'pickaxe';
const GATHER_TOOLS: GatherTool[] = ['axe', 'pickaxe'];

/** Kicks off loading every known sprite once at startup. Missing files fail silently per-file. */
export function preloadAllSprites() {
  preloadCharacterAnimations();
  // Optional metadata-driven player sheet. If animation.json is absent the existing
  // directional PNGs and two-frame walking system continue to work unchanged.
  preloadSpriteAnimationSet('player');

  for (const t of TILE_TYPES) {
    load('tiles', t);
    // Optional extra ground-texture variants (tile_1.png, tile_2.png) for visual variety.
    load('tiles', `${t}_1`);
    load('tiles', `${t}_2`);
  }
  for (const r of RESOURCE_TYPES) load('resources', r);
  // Growth-stage art for the farm patch (bare soil / growing / ready to harvest).
  for (const stage of ['empty', 'sown', 'bloom']) load('resources', `farm_patch_${stage}`);
  for (const s of STRUCTURE_TYPES) load('structures', s);
  for (const id of ROOF_IDS) load('roof', id);
  for (const m of MONSTERS) load('monsters', m.id);
  for (const f of PLAYER_FACINGS) {
    load('player', f);
    load('player', `${f}_walk1`);
    load('player', `${f}_walk2`);
  }
  for (const t of GATHER_TOOLS) {
    load('player', `${t}_prepare`);
    load('player', `${t}_swing`);
  }
  for (const theme of ELEVATION_THEMES) {
    for (const suffix of ELEVATION_IDS) loadElevation(theme, `${theme}_${suffix}`);
  }
}
