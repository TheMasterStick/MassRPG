export type WorldPlane = 0 | -1 | -2;
export type ElevationLevel = -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5;

export type TileType =
  | 'deep_water' | 'water' | 'beach'
  | 'grass' | 'plains' | 'forest' | 'taiga' | 'mountain' | 'snow' | 'desert' | 'swamp'
  | 'path' | 'rubble'
  | 'floor_wood' | 'floor_brick' | 'floor_cobble'
  | 'void' | 'cave_floor' | 'cave_wall';

export interface TileVisual {
  base: string;
  variants: string[];
  walkable: boolean;
  waterAdjacent?: boolean;
}

export const TILE_VISUALS: Record<TileType, TileVisual> = {
  deep_water: { base: '#1a4c7c', variants: ['#1a4c7c', '#194a78', '#1b4e80'], walkable: false },
  water: { base: '#2f7dc4', variants: ['#2f7dc4', '#2c78bd', '#3282cc'], walkable: false, waterAdjacent: true },
  beach: { base: '#dfd0a0', variants: ['#dfd0a0', '#e2d4a6', '#dccb96'], walkable: true },
  grass: { base: '#5fa64c', variants: ['#5fa64c', '#5a9e48', '#65ac52'], walkable: true },
  plains: { base: '#8bbf5a', variants: ['#8bbf5a', '#86ba54', '#90c460'], walkable: true },
  forest: { base: '#3d7a3a', variants: ['#3d7a3a', '#397536', '#41803e'], walkable: true },
  taiga: { base: '#3f6b5a', variants: ['#3f6b5a', '#3b6656', '#43705e'], walkable: true },
  mountain: { base: '#8d8378', variants: ['#8d8378', '#867c72', '#948a7e'], walkable: true },
  snow: { base: '#e8eef2', variants: ['#e8eef2', '#e2e9ee', '#edf2f5'], walkable: true },
  desert: { base: '#d9c07a', variants: ['#d9c07a', '#d4ba71', '#ddc582'], walkable: true },
  swamp: { base: '#5c6b3f', variants: ['#5c6b3f', '#57663a', '#607044'], walkable: true },
  path: { base: '#b09569', variants: ['#b09569', '#ab9063'], walkable: true },
  rubble: { base: '#8d8378', variants: ['#8d8378'], walkable: true },
  floor_wood: { base: '#a07840', variants: ['#a07840'], walkable: true },
  floor_brick: { base: '#9c5f4a', variants: ['#9c5f4a'], walkable: true },
  floor_cobble: { base: '#8a8a8f', variants: ['#8a8a8f'], walkable: true },
  void: { base: '#090a0c', variants: ['#090a0c'], walkable: false },
  cave_floor: { base: '#4a433b', variants: ['#4a433b', '#453f38', '#50483f'], walkable: true },
  cave_wall: { base: '#262421', variants: ['#262421', '#2b2926'], walkable: false },
};

export type ResourceType =
  | 'tree_normal' | 'tree_oak' | 'tree_willow' | 'tree_maple' | 'tree_yew' | 'tree_magic'
  | 'rock_copper' | 'rock_tin' | 'rock_iron' | 'rock_coal' | 'rock_mithril' | 'rock_adamant' | 'rock_rune'
  | 'rock_gold' | 'rock_silver' | 'rock_gem' | 'rock_dragonite'
  | 'fishing_shrimp' | 'fishing_lobster' | 'fishing_swordfish'
  | 'farm_patch' | 'herb_patch' | 'flax_plant';

export type StructureType =
  | 'bank_chest' | 'furnace' | 'anvil' | 'cooking_range' | 'campfire' | 'workbench'
  | 'fence' | 'fence_l' | 'fence_t' | 'fence_r'
  | 'wall' | 'wall_l' | 'wall_t' | 'wall_r' | 'wall_window'
  | 'wall_brick' | 'wall_brick_l' | 'wall_brick_t' | 'wall_brick_r'
  | 'wall_stone' | 'wall_stone_l' | 'wall_stone_t' | 'wall_stone_r'
  | 'wall_cobble' | 'wall_cobble_l' | 'wall_cobble_t' | 'wall_cobble_r'
  | 'bed' | 'storage_chest' | 'tannery' | 'loom' | 'general_store'
  | 'blocker';

export interface WorldPos {
  x: number;
  y: number;
}
