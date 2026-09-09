import type { Game } from '../core/Game';
import { buildHud } from './HUD';
import { buildSidebar } from './Sidebar';
import { buildStationPanel } from './StationPanel';
import { buildBankPanel } from './BankPanel';
import { buildShopPanel } from './ShopPanel';
import { openPlantMenu } from './PlantMenu';
import { initContextPopup } from './ContextPopup';
import type { StructureType } from '../world/types';
import { log } from '../core/EventBus';

export function initUI(root: HTMLElement, game: Game) {
  initContextPopup(root);
  buildHud(root, game);
  buildSidebar(root, game);

  const station = buildStationPanel(root, game);
  const bank = buildBankPanel(root, game);
  const shop = buildShopPanel(root, game);
  const floatingPanels = [station.panel, bank.panel, shop.panel];
  function hideFloatingExcept(keep?: HTMLElement) {
    for (const p of floatingPanels) if (p !== keep) p.classList.add('hidden');
  }

  game.onOpenStructure = (x: number, y: number, type: StructureType) => {
    if (type === 'bank_chest' || type === 'storage_chest') {
      hideFloatingExcept(bank.panel);
      bank.open();
    } else if (type === 'general_store') {
      hideFloatingExcept(shop.panel);
      shop.open();
    } else if (['furnace', 'anvil', 'cooking_range', 'campfire', 'tannery', 'loom'].includes(type)) {
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
    if (e.key.toLowerCase() === 'escape') hideFloatingExcept();
  });
}
