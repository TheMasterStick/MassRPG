import type { Game } from '../core/Game';
import { buildHud } from './HUD';
import { buildInventoryPanel } from './InventoryPanel';
import { buildSkillsPanel } from './SkillsPanel';
import { buildEquipmentPanel } from './EquipmentPanel';
import { buildBuildPanel } from './BuildPanel';
import { buildStationPanel } from './StationPanel';
import { buildBankPanel } from './BankPanel';
import { buildShopPanel } from './ShopPanel';
import { openPlantMenu } from './PlantMenu';
import { initContextPopup } from './ContextPopup';
import type { StructureType } from '../world/types';
import { log } from '../core/EventBus';

export function initUI(root: HTMLElement, game: Game) {
  initContextPopup(root);

  const inventory = buildInventoryPanel(root, game);
  const skills = buildSkillsPanel(root, game);
  const equipment = buildEquipmentPanel(root, game);
  const build = buildBuildPanel(root, game);
  const station = buildStationPanel(root, game);
  const bank = buildBankPanel(root, game);
  const shop = buildShopPanel(root, game);

  const panels = [inventory.panel, skills.panel, equipment.panel, build.panel, station.panel, bank.panel, shop.panel];
  function hideAllExcept(keep?: HTMLElement) {
    for (const p of panels) if (p !== keep) p.classList.add('hidden');
  }

  buildHud(root, game, [
    { key: 'inv', label: '🎒 Inventory (I)', onToggle: () => { hideAllExcept(inventory.panel); inventory.toggle(); } },
    { key: 'skills', label: '📊 Skills (K)', onToggle: () => { hideAllExcept(skills.panel); skills.toggle(); } },
    { key: 'equip', label: '🛡 Equipment', onToggle: () => { hideAllExcept(equipment.panel); equipment.toggle(); } },
    { key: 'build', label: '🔨 Build (B)', onToggle: () => { hideAllExcept(build.panel); build.toggle(); } },
  ]);

  game.onOpenStructure = (x: number, y: number, type: StructureType) => {
    if (type === 'bank_chest' || type === 'storage_chest') {
      hideAllExcept(bank.panel);
      bank.open();
    } else if (type === 'general_store') {
      hideAllExcept(shop.panel);
      shop.open();
    } else if (['furnace', 'anvil', 'cooking_range', 'campfire', 'tannery', 'loom'].includes(type)) {
      hideAllExcept(station.panel);
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
    if (key === 'i') { hideAllExcept(inventory.panel); inventory.toggle(); }
    if (key === 'k') { hideAllExcept(skills.panel); skills.toggle(); }
    if (key === 'b') { hideAllExcept(build.panel); build.toggle(); }
    if (key === 'escape') { hideAllExcept(); game.buildMode = null; }
  });
}
