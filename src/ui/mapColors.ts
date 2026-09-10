import type { TileType } from '../world/types';

// Shared between the minimap and the full world map so both read the terrain the same way.
export const TILE_MAP_COLORS: Record<TileType, string> = {
  deep_water: '#0f3d6e', water: '#1c6cad', beach: '#c9b578',
  grass: '#4a8a3c', plains: '#889c4d', forest: '#204c28', taiga: '#2f5946',
  mountain: '#5c584f', snow: '#dfe6e6', desert: '#b89a5e', swamp: '#334d3e',
  path: '#9c8258', rubble: '#6d6a60',
  floor_wood: '#a07840', floor_brick: '#9c5f4a', floor_cobble: '#8a8a8f',
  void: '#090a0c', cave_floor: '#4a433b', cave_wall: '#262421',
};
