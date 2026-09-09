import type { Player } from '../entities/Player';
import type { World } from '../world/World';
import { STRUCTURES, getStructureCost } from '../data/recipes';
import type { StructureType } from '../world/types';
import { getItem } from '../data/items';
import { removeItem } from './Inventory';
import { addXp } from './Skills';
import { log } from '../core/EventBus';
import { isSameOrAdjacent } from './Pathfinding';

export function buildableStructures(player: Player) {
  return STRUCTURES.map((s) => ({
    structure: s,
    unlocked: player.level('construction') >= s.levelRequired,
    hasMaterials: s.inputs.every((i) => player.hasItem(i.item, i.qty)),
  }));
}

export function placeStructure(world: World, player: Player, type: StructureType, x: number, y: number) {
  const cost = getStructureCost(type);
  if (player.level('construction') < cost.levelRequired) { log(`You need Construction level ${cost.levelRequired}.`, 'warning'); return; }
  for (const input of cost.inputs) {
    if (!player.hasItem(input.item, input.qty)) { log(`You need ${input.qty}x ${getItem(input.item).name}.`, 'warning'); return; }
  }
  if (!world.isWalkable(x, y)) { log(`You can't build there.`, 'warning'); return; }
  if (!isSameOrAdjacent({ x: Math.round(player.x), y: Math.round(player.y) }, { x, y })) { log(`Move closer to build there.`, 'warning'); return; }

  for (const input of cost.inputs) removeItem(player, input.item, input.qty);
  world.placeStructure(x, y, type);
  addXp(player, 'construction', cost.xp);
  log(`You build a ${cost.name}.`, 'info');
  if (type === 'bed') { player.respawnPoint = { x, y }; log(`This is now your respawn point.`, 'info'); }
}
