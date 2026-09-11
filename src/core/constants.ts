export const GAMEPLAY_ZOOM_LEVELS = [24, 32, 40, 52, 64, 80, 96] as const;
export type GameplayTileSize = (typeof GAMEPLAY_ZOOM_LEVELS)[number];

export let TILE_SIZE: GameplayTileSize = 40;

export function setGameplayTileSize(size: number): GameplayTileSize {
  const next = GAMEPLAY_ZOOM_LEVELS.includes(size as GameplayTileSize) ? size as GameplayTileSize : 40;
  TILE_SIZE = next;
  return next;
}

export const CHUNK_SIZE = 16;
export const TICK_MS = 600;
export const VIEW_RADIUS_CHUNKS = 3;
export const SIM_RADIUS_CHUNKS = 4; // chunks that get resource/monster simulation
export const INVENTORY_SLOTS = 28;
export const BANK_SLOTS = 200;
export const RESOURCE_RESPAWN_TICKS = 8; // trees/rocks
export const FISHING_RESPAWN_TICKS = 3;
export const MONSTER_RESPAWN_TICKS = 50;
// Player-lit fires are temporary world objects. 150 ticks at 600ms/tick = 90 seconds.
export const PLAYER_CAMPFIRE_LIFETIME_TICKS = 150;
export const REACH_TILES = 1; // interaction range (adjacent, incl. diagonal)
export const MONSTER_AGGRO_RANGE = 4;
export const MONSTER_LEASH_RANGE = 8;
export const MONSTER_AGGRO_COOLDOWN_TICKS = 15; // ~9s before a monster that gave up a chase will re-aggro
export const PLAYER_WALK_SPEED = 4; // tiles/sec
export const PLAYER_RUN_SPEED = 7; // tiles/sec
