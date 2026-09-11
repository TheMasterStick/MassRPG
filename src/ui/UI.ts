import type { Game } from '../core/Game';
import { buildHud } from './HUD';
import { buildSidebar } from './Sidebar';
import { buildStationPanel } from './StationPanel';
import { buildBankPanel } from './BankPanel';
import { buildShopPanel } from './ShopPanel';
import { buildWorldMap } from './WorldMap';
import { openPlantMenu } from './PlantMenu';
import { initContextPopup, showContextPopup } from './ContextPopup';
import type { StructureType } from '../world/types';
import { log } from '../core/EventBus';

const CRAFTING_STRUCTURES: StructureType[] = ['furnace', 'anvil', 'cooking_range', 'campfire', 'tannery', 'loom'];

export function initUI(root: HTMLElement, game: Game) {
  initContextPopup(root);
  game.onOpenContextMenu = (x, y, items) => showContextPopup(x, y, items);
  buildHud(root, game);
  buildSidebar(root, game);

  const station = buildStationPanel(root, game);
  const bank = buildBankPanel(root, game);
  const shop = buildShopPanel(root, game);
  const worldMap = buildWorldMap(root, game);
  const floatingPanels = [station.panel, bank.panel, shop.panel, worldMap.panel];
  function hideFloatingExcept(keep?: HTMLElement) {
    for (const p of floatingPanels) if (p !== keep) p.classList.add('hidden');
  }

  game.onUseInventoryItems = (firstItemId, secondItemId) => {
    const opened = station.openInventory([firstItemId, secondItemId]);
    if (opened) hideFloatingExcept(station.panel);
    return opened;
  };

  game.onCraftInventoryItem = (itemId) => {
    const opened = station.openInventory([itemId]);
    if (opened) hideFloatingExcept(station.panel);
    return opened;
  };

  game.onUseInventoryItemOnWorld = (itemId, x, y) => {
    const structure = game.world.getStructure(x, y);
    if (!structure || !CRAFTING_STRUCTURES.includes(structure)) return false;
    const opened = station.openForItem(x, y, structure, itemId);
    if (opened) hideFloatingExcept(station.panel);
    return opened;
  };

  game.onToggleWorldMap = () => {
    if (worldMap.panel.classList.contains('hidden')) {
      hideFloatingExcept(worldMap.panel);
      worldMap.open();
    } else {
      worldMap.close();
    }
  };

  game.onOpenStructure = (x: number, y: number, type: StructureType) => {
    if (type === 'bank_chest' || type === 'storage_chest') {
      hideFloatingExcept(bank.panel);
      bank.open();
    } else if (type === 'general_store') {
      hideFloatingExcept(shop.panel);
      shop.open();
    } else if (CRAFTING_STRUCTURES.includes(type)) {
      hideFloatingExcept(station.panel);
      station.open(x, y, type);
    } else if (type === 'bed') {
      log('You rest for a moment. This is your respawn point.', 'info');
    } else {
      log('There is nothing to do here yet.', 'info');
    }
  };
  game.onOpenPlantMenu = (x: number, y: number) => openPlantMenu(game, x, y);

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (key === 'escape') hideFloatingExcept();
    if (key === 'm') game.onToggleWorldMap?.();
  });
}
