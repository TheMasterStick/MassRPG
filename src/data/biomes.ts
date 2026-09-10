import type { ResourceType, TileType } from '../world/types';

export interface ResourceSpawnRule {
  resource: ResourceType;
  chance: number; // probability per eligible tile
}

// Land-based resource spawns keyed by tile type. Water-adjacency resources
// (fishing spots, willows) are handled separately in WorldGen since they
// depend on neighbouring tiles.
//
// IMPORTANT: rocks/metal ores do NOT belong in this table. Metal ores are
// authored world POIs in ORE_VEINS (AeldorData.ts), and gemstone rocks are
// intentionally disabled until the later gemstone pass. This keeps biome
// terrain from turning into a continent-wide mine by accident.
export const RESOURCE_SPAWNS: Partial<Record<TileType, ResourceSpawnRule[]>> = {
  forest: [
    { resource: 'tree_normal', chance: 0.14 },
    { resource: 'tree_oak', chance: 0.03 },
    { resource: 'tree_yew', chance: 0.008 },
    { resource: 'herb_patch', chance: 0.004 },
  ],
  taiga: [
    { resource: 'tree_normal', chance: 0.06 },
    { resource: 'tree_yew', chance: 0.015 },
    { resource: 'tree_magic', chance: 0.003 },
  ],
  grass: [
    { resource: 'tree_normal', chance: 0.03 },
    { resource: 'flax_plant', chance: 0.012 },
    { resource: 'farm_patch', chance: 0.006 },
    { resource: 'herb_patch', chance: 0.006 },
  ],
  plains: [
    { resource: 'tree_maple', chance: 0.01 },
    { resource: 'flax_plant', chance: 0.01 },
    { resource: 'farm_patch', chance: 0.008 },
  ],
  swamp: [
    { resource: 'tree_willow', chance: 0.05 },
    { resource: 'herb_patch', chance: 0.012 },
  ],
  mountain: [],
  snow: [
    { resource: 'tree_normal', chance: 0.015 },
  ],
  desert: [],
  beach: [],
  path: [],
  rubble: [],
  deep_water: [],
  water: [],
};

export const RESOURCE_NAMES: Record<ResourceType, string> = {
  tree_normal: 'Tree', tree_oak: 'Oak tree', tree_willow: 'Willow tree', tree_maple: 'Maple tree',
  tree_yew: 'Yew tree', tree_magic: 'Magic tree',
  rock_copper: 'Copper rock', rock_tin: 'Tin rock', rock_iron: 'Iron rock', rock_coal: 'Coal rock',
  rock_mithril: 'Mithril rock', rock_adamant: 'Adamantite rock', rock_rune: 'Runite rock',
  rock_gold: 'Gold rock', rock_silver: 'Silver rock', rock_gem: 'Gem rock', rock_dragonite: 'Dragonite rock',
  fishing_shrimp: 'Fishing spot', fishing_lobster: 'Deep fishing spot', fishing_swordfish: 'Harpoon fishing spot',
  farm_patch: 'Farming patch', herb_patch: 'Herb patch', flax_plant: 'Flax',
};
