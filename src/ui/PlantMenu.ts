import type { Game } from '../core/Game';
import { plantableSeeds, plant } from '../systems/Gathering';
import { showContextPopup } from './ContextPopup';
import { log } from '../core/EventBus';
import type { ResourceType } from '../world/types';

export function openPlantMenu(game: Game, x: number, y: number) {
  const { player, world } = game;
  const resource = world.getResourceNode(x, y) as ResourceType | undefined;
  if (!resource) return;
  const seeds = plantableSeeds(player, resource);
  if (seeds.length === 0) {
    log(`You have no seeds to plant here. Buy some or find them while exploring.`, 'info');
    return;
  }
  const rect = { left: window.innerWidth / 2 - 60, bottom: window.innerHeight / 2 };
  showContextPopup(rect.left, rect.bottom, seeds.map((s) => ({
    label: `Plant ${s.name}`,
    onClick: () => plant(world, player, x, y, s.id),
  })));
}
