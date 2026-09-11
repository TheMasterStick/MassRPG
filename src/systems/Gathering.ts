import type { Player } from '../entities/Player';
import type { World } from '../world/World';
import type { ResourceType } from '../world/types';
import { TREE_TIERS, FISH_TIERS, CROP_TIERS, HERB_TIERS, getItem } from '../data/items';
import { RESOURCE_NAMES } from '../data/biomes';
import { addItem, removeItem } from './Inventory';
import { addXp } from './Skills';
import { log } from '../core/EventBus';
import { RESOURCE_RESPAWN_TICKS, FISHING_RESPAWN_TICKS } from '../core/constants';
import type { SkillId } from '../data/skills';

const GATHER_TICKS = 3;

interface GatherOutcome {
  skill: SkillId;
  levelRequired: number;
  xp: number;
  itemId: string;
  qty: number;
  toolIds?: string[]; // any one of these tools satisfies the requirement
  depleteChance: number;
  respawnTicks: number;
}

const WOODCUTTING: Record<string, GatherOutcome> = {};
for (const t of TREE_TIERS) {
  WOODCUTTING[`tree_${t.id}`] = {
    skill: 'woodcutting', levelRequired: t.level, xp: t.xp, itemId: `${t.id}_logs`, qty: 1,
    toolIds: ['bronze_hatchet', 'iron_hatchet', 'steel_hatchet', 'mithril_hatchet', 'adamant_hatchet', 'rune_hatchet'],
    depleteChance: 0.12, respawnTicks: RESOURCE_RESPAWN_TICKS,
  };
}

const MINING: Record<string, GatherOutcome> = {
  rock_copper: { skill: 'mining', levelRequired: 1, xp: 17.5, itemId: 'copper_ore', qty: 1, toolIds: pickaxes(), depleteChance: 0.3, respawnTicks: RESOURCE_RESPAWN_TICKS },
  rock_tin: { skill: 'mining', levelRequired: 1, xp: 17.5, itemId: 'tin_ore', qty: 1, toolIds: pickaxes(), depleteChance: 0.3, respawnTicks: RESOURCE_RESPAWN_TICKS },
  rock_iron: { skill: 'mining', levelRequired: 15, xp: 35, itemId: 'iron_ore', qty: 1, toolIds: pickaxes(), depleteChance: 0.25, respawnTicks: RESOURCE_RESPAWN_TICKS },
  rock_coal: { skill: 'mining', levelRequired: 30, xp: 50, itemId: 'coal', qty: 1, toolIds: pickaxes(), depleteChance: 0.2, respawnTicks: RESOURCE_RESPAWN_TICKS },
  rock_gold: { skill: 'mining', levelRequired: 40, xp: 65, itemId: 'gold_ore', qty: 1, toolIds: pickaxes(), depleteChance: 0.18, respawnTicks: RESOURCE_RESPAWN_TICKS },
  rock_silver: { skill: 'mining', levelRequired: 20, xp: 40, itemId: 'silver_ore', qty: 1, toolIds: pickaxes(), depleteChance: 0.22, respawnTicks: RESOURCE_RESPAWN_TICKS },
  rock_mithril: { skill: 'mining', levelRequired: 55, xp: 80, itemId: 'mithril_ore', qty: 1, toolIds: pickaxes(), depleteChance: 0.15, respawnTicks: RESOURCE_RESPAWN_TICKS * 2 },
  rock_adamant: { skill: 'mining', levelRequired: 70, xp: 95, itemId: 'adamant_ore', qty: 1, toolIds: pickaxes(), depleteChance: 0.12, respawnTicks: RESOURCE_RESPAWN_TICKS * 2 },
  rock_rune: { skill: 'mining', levelRequired: 85, xp: 125, itemId: 'rune_ore', qty: 1, toolIds: pickaxes(), depleteChance: 0.1, respawnTicks: RESOURCE_RESPAWN_TICKS * 3 },
  rock_gem: { skill: 'mining', levelRequired: 40, xp: 60, itemId: 'uncut_sapphire', qty: 1, toolIds: pickaxes(), depleteChance: 0.15, respawnTicks: RESOURCE_RESPAWN_TICKS * 2 },
  rock_dragonite: { skill: 'mining', levelRequired: 92, xp: 150, itemId: 'dragonite_ore', qty: 1, toolIds: pickaxes(), depleteChance: 0.08, respawnTicks: RESOURCE_RESPAWN_TICKS * 4 },
};
function pickaxes() {
  return ['bronze_pickaxe', 'iron_pickaxe', 'steel_pickaxe', 'mithril_pickaxe', 'adamant_pickaxe', 'rune_pickaxe'];
}

const GEM_ROLL: { itemId: string; weight: number }[] = [
  { itemId: 'uncut_sapphire', weight: 40 }, { itemId: 'uncut_emerald', weight: 28 },
  { itemId: 'uncut_ruby', weight: 16 }, { itemId: 'uncut_diamond', weight: 8 },
];

export function resourceLabel(type: ResourceType): string {
  return RESOURCE_NAMES[type];
}

export function toolTierOwned(player: Player, toolIds: string[] | undefined): string | null {
  if (!toolIds) return 'hands';
  for (let i = toolIds.length - 1; i >= 0; i--) {
    const id = toolIds[i];
    if (player.equipment.weapon === id || player.hasItem(id)) return id;
  }
  return null;
}

function fishOutcome(player: Player, spot: ResourceType): GatherOutcome | null {
  const hasRod = player.hasItem('fishing_rod') || player.equipment.weapon === 'fishing_rod';
  const hasNet = player.hasItem('small_fishing_net');
  const hasPot = player.hasItem('lobster_pot');
  const hasHarpoon = player.hasItem('harpoon');

  const byId = (id: string) => FISH_TIERS.find((f) => f.id === id)!;
  if (spot === 'fishing_shrimp') {
    if (hasRod && player.level('fishing') >= 20) {
      const f = player.level('fishing') >= 30 ? byId('salmon') : byId('trout');
      return { skill: 'fishing', levelRequired: f.level, xp: f.xp, itemId: `raw_${f.id}`, qty: 1, depleteChance: 0, respawnTicks: FISHING_RESPAWN_TICKS };
    }
    if (hasNet) {
      const f = player.level('fishing') >= 5 ? byId('sardine') : byId('shrimp');
      return { skill: 'fishing', levelRequired: f.level, xp: f.xp, itemId: `raw_${f.id}`, qty: 1, depleteChance: 0, respawnTicks: FISHING_RESPAWN_TICKS };
    }
    return null;
  }
  if (spot === 'fishing_lobster') {
    if (hasPot) { const f = byId('lobster'); return { skill: 'fishing', levelRequired: f.level, xp: f.xp, itemId: `raw_${f.id}`, qty: 1, depleteChance: 0, respawnTicks: FISHING_RESPAWN_TICKS }; }
    if (hasRod) { const f = byId('salmon'); return { skill: 'fishing', levelRequired: f.level, xp: f.xp, itemId: `raw_${f.id}`, qty: 1, depleteChance: 0, respawnTicks: FISHING_RESPAWN_TICKS }; }
    return null;
  }
  if (spot === 'fishing_swordfish') {
    if (hasHarpoon) {
      const f = player.level('fishing') >= 76 ? byId('shark') : byId('swordfish');
      return { skill: 'fishing', levelRequired: f.level, xp: f.xp, itemId: `raw_${f.id}`, qty: 1, depleteChance: 0, respawnTicks: FISHING_RESPAWN_TICKS };
    }
    return null;
  }
  return null;
}

export function canGather(player: Player, resource: ResourceType): { ok: boolean; reason?: string } {
  if (resource.startsWith('tree_')) {
    const o = WOODCUTTING[resource];
    if (!toolTierOwned(player, o.toolIds)) return { ok: false, reason: 'You need a hatchet to chop this.' };
    if (player.level('woodcutting') < o.levelRequired) return { ok: false, reason: `You need Woodcutting level ${o.levelRequired}.` };
    return { ok: true };
  }
  if (resource.startsWith('rock_')) {
    const o = MINING[resource];
    if (!toolTierOwned(player, o.toolIds)) return { ok: false, reason: 'You need a pickaxe to mine this.' };
    if (player.level('mining') < o.levelRequired) return { ok: false, reason: `You need Mining level ${o.levelRequired}.` };
    return { ok: true };
  }
  if (resource.startsWith('fishing_')) {
    const o = fishOutcome(player, resource);
    if (!o) return { ok: false, reason: 'You need the right fishing equipment here.' };
    if (player.level('fishing') < o.levelRequired) return { ok: false, reason: `You need Fishing level ${o.levelRequired}.` };
    return { ok: true };
  }
  if (resource === 'flax_plant') return { ok: true };
  if (resource === 'farm_patch' || resource === 'herb_patch') return { ok: true };
  return { ok: false, reason: 'Nothing to gather here.' };
}

export function startGathering(player: Player, x: number, y: number, resource: ResourceType) {
  player.action = { type: 'gather', targetX: x, targetY: y, resourceOrRecipeId: resource, ticksRemaining: GATHER_TICKS, repeat: true };
}

export function processGatherTick(world: World, player: Player) {
  const action = player.action;
  if (!action || action.type !== 'gather') return;
  const resource = world.getResourceNode(action.targetX, action.targetY);
  if (!resource || !world.isResourceAvailable(action.targetX, action.targetY)) {
    if (resource) log(`The ${resourceLabel(resource)} is exhausted.`, 'info');
    player.action = null;
    return;
  }
  const check = canGather(player, resource);
  if (!check.ok) { log(check.reason ?? 'You cannot do that.', 'warning'); player.action = null; return; }

  if (resource === 'flax_plant') {
    addItem(player, 'flax', 1);
    addXp(player, 'farming', 5);
    world.depleteResource(action.targetX, action.targetY, RESOURCE_RESPAWN_TICKS);
    player.action = null;
    return;
  }

  let outcome: GatherOutcome | null = null;
  if (resource.startsWith('tree_')) outcome = WOODCUTTING[resource];
  else if (resource.startsWith('rock_')) outcome = MINING[resource];
  else if (resource.startsWith('fishing_')) outcome = fishOutcome(player, resource);
  if (!outcome) { player.action = null; return; }

  if (player.findEmptySlot() === -1 && !player.hasItem(outcome.itemId)) {
    log(`Your inventory is full.`, 'warning');
    player.action = null;
    return;
  }

  const successChance = Math.max(0.15, Math.min(0.95, 0.4 + (player.level(outcome.skill) - outcome.levelRequired) * 0.02));
  if (Math.random() < successChance) {
    let itemId = outcome.itemId;
    if (resource === 'rock_gem') {
      const totalW = GEM_ROLL.reduce((s, g) => s + g.weight, 0);
      let roll = Math.random() * totalW;
      for (const g of GEM_ROLL) { roll -= g.weight; if (roll <= 0) { itemId = g.itemId; break; } }
    }
    addItem(player, itemId, outcome.qty);
    if (resource.startsWith('rock_')) addItem(player, 'stone', 1);
    addXp(player, outcome.skill, outcome.xp);
    log(`You get some ${getItem(itemId).name.toLowerCase()}.`, 'info');
    if (outcome.depleteChance > 0 && Math.random() < outcome.depleteChance) {
      world.depleteResource(action.targetX, action.targetY, outcome.respawnTicks);
      log(`The ${resourceLabel(resource)} is exhausted.`, 'info');
      player.action = null;
      return;
    }
  }
  action.ticksRemaining = GATHER_TICKS;
}

// ---- Farming ----
export function plantableSeeds(player: Player, patchType: ResourceType): { id: string; name: string }[] {
  const tiers = patchType === 'farm_patch' ? CROP_TIERS : HERB_TIERS;
  return tiers.filter((t) => player.hasItem(`${t.id}_seed`)).map((t) => ({ id: t.id, name: t.name }));
}

export function plant(world: World, player: Player, x: number, y: number, cropId: string) {
  const seedId = `${cropId}_seed`;
  if (!removeItem(player, seedId, 1)) return;
  world.plantCrop(x, y, cropId);
  addXp(player, 'farming', 12);
  log(`You plant the ${getItem(seedId).name.toLowerCase()}.`, 'info');
}

export function harvest(world: World, player: Player, x: number, y: number) {
  const state = world.getCropState(x, y);
  if (!state || !state.ready) return;
  const isHerb = HERB_TIERS.some((h) => h.id === state.cropId);
  const outputId = isHerb ? `grimy_${state.cropId}` : state.cropId;
  const qty = 2 + Math.floor(Math.random() * 3);
  addItem(player, outputId, qty);
  const tierList = isHerb ? HERB_TIERS : CROP_TIERS;
  const tier = tierList.find((t) => t.id === state.cropId)!;
  addXp(player, 'farming', tier.xp);
  world.harvestCrop(x, y);
  log(`You harvest ${qty}x ${getItem(outputId).name}.`, 'loot');
}
