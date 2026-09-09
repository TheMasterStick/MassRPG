// Loads user-supplied pixel art from /public/sprites/** at runtime, with
// silent per-file fallback: anything not yet drawn just keeps using the
// existing procedural glyph/shape rendering in Renderer.ts. Drop a
// correctly-named PNG in the matching folder and it's picked up on the
// next load — no code changes needed. See public/sprites/README.md.

import type { ResourceType, StructureType, TileType } from '../world/types';
import { MONSTERS } from '../data/monsters';

export type SpriteCategory = 'tiles' | 'resources' | 'structures' | 'monsters' | 'player' | 'roof';
export type Facing = 'up' | 'down' | 'left' | 'right';

type LoadState = 'loading' | 'loaded' | 'missing';

interface Entry {
  img: HTMLImageElement;
  state: LoadState;
}

const cache = new Map<string, Entry>();

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

/** Returns a loaded image ready to draw, or null if missing/not loaded yet (fall back to procedural rendering). */
export function getSprite(category: SpriteCategory, id: string): HTMLImageElement | null {
  const entry = cache.get(key(category, id));
  return entry && entry.state === 'loaded' ? entry.img : null;
}

export function getPlayerSprite(facing: Facing): HTMLImageElement | null {
  return getSprite('player', facing) ?? getSprite('player', 'down');
}

const TILE_TYPES: TileType[] = [
  'deep_water', 'water', 'beach', 'grass', 'plains', 'forest', 'taiga',
  'mountain', 'snow', 'desert', 'swamp', 'path', 'rubble',
  'floor_wood', 'floor_brick', 'floor_cobble',
];
const RESOURCE_TYPES: ResourceType[] = [
  'tree_normal', 'tree_oak', 'tree_willow', 'tree_maple', 'tree_yew', 'tree_magic',
  'rock_copper', 'rock_tin', 'rock_iron', 'rock_coal', 'rock_mithril', 'rock_adamant', 'rock_rune',
  'rock_gold', 'rock_silver', 'rock_gem',
  'fishing_shrimp', 'fishing_lobster', 'fishing_swordfish',
  'farm_patch', 'herb_patch', 'flax_plant',
];
const STRUCTURE_TYPES: StructureType[] = [
  'bank_chest', 'furnace', 'anvil', 'cooking_range', 'campfire', 'workbench',
  'fence', 'wall', 'wall_window', 'bed', 'storage_chest', 'tannery', 'loom', 'general_store',
];
const PLAYER_FACINGS: Facing[] = ['down', 'up', 'left', 'right'];
const ROOF_IDS = ['tile_middle', 'tile_side', 'tatch_middle', 'tatch_side'];

// Gather-action tool animation: a "prepare" (windup) frame and a "swing"
// frame, shown while chopping/mining instead of the idle/walk sprite.
export type GatherTool = 'axe' | 'pickaxe';
const GATHER_TOOLS: GatherTool[] = ['axe', 'pickaxe'];

/** Kicks off loading every known sprite once at startup. Missing files fail silently per-file. */
export function preloadAllSprites() {
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
    // Optional two-frame walk cycle per facing, alternated while moving.
    load('player', `${f}_walk1`);
    load('player', `${f}_walk2`);
  }
  for (const t of GATHER_TOOLS) {
    load('player', `${t}_prepare`);
    load('player', `${t}_swing`);
  }
}
