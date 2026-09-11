import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { getItem } from '../data/items';
import { bus, log } from '../core/EventBus';
import { equip, dropSlot, moveInventorySlot, removeFromSlot } from '../systems/Inventory';
import { lightFire, startProduction } from '../systems/Production';
import { RECIPES } from '../data/recipes';
import { showContextPopup } from './ContextPopup';

export function buildInventoryPanel(root: HTMLElement, game: Game) {
  const { player, world } = game;
  const grid = el('div', { attrs: { id: 'inventory-grid' } });
  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-inventory' } }, [grid]);
  root.append(panel);

  let draggingIndex: number | null = null;
  let suppressClick = false;

  function actionsFor(slotIndex: number) {
    const slot = player.inventory[slotIndex];
    if (!slot) return [];
    const def = getItem(slot.itemId);
    const actions: { label: string; onClick: () => void }[] = [];

    if (def.equipSlot) {
      actions.push({ label: 'Equip', onClick: () => equip(player, slotIndex) });
    }
    if (def.type === 'food' && def.heal !== undefined) {
      actions.push({
        label: 'Eat', onClick: () => {
          if (def.heal! > 0) {
            player.currentHp = Math.min(player.maxHp(), player.currentHp + def.heal!);
            log(`You eat the ${def.name}. It heals ${def.heal} HP.`, 'info');
          } else {
            log(`It's inedible.`, 'warning');
          }
          removeFromSlot(player, slotIndex, 1);
        },
      });
    }
    if (def.type === 'potion') {
      actions.push({
        label: 'Drink', onClick: () => {
          log(`You drink the ${def.name}.`, 'info');
          removeFromSlot(player, slotIndex, 1);
        },
      });
    }
    if (slot.itemId.endsWith('_logs')) {
      actions.push({ label: 'Light fire', onClick: () => lightFire(world, player, slot.itemId) });
    }
    if (slot.itemId.startsWith('grimy_')) {
      const recipe = RECIPES.find((r) => r.inputs[0]?.item === slot.itemId && r.category === 'herblore_clean');
      if (recipe) actions.push({ label: 'Clean', onClick: () => startProduction(player, world, recipe.id, 1, Math.round(player.x), Math.round(player.y)) });
    }
    actions.push({ label: 'Examine', onClick: () => log(def.description, 'info') });
    actions.push({ label: 'Drop', onClick: () => dropSlot(player, slotIndex) });
    return actions;
  }

  function attachDropTarget(cell: HTMLElement, targetIndex: number) {
    cell.addEventListener('dragover', (e) => {
      if (draggingIndex === null) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      cell.style.borderColor = '#d4af37';
    });
    cell.addEventListener('dragleave', () => { cell.style.borderColor = ''; });
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.style.borderColor = '';
      const from = draggingIndex ?? Number(e.dataTransfer?.getData('text/plain'));
      if (Number.isInteger(from)) moveInventorySlot(player, from, targetIndex);
      suppressClick = true;
    });
  }

  function render() {
    clear(grid);
    player.inventory.forEach((slot, i) => {
      const cell = el('div', { className: slot ? 'slot' : 'slot empty' });
      attachDropTarget(cell, i);

      if (!slot) {
        grid.append(cell);
        return;
      }

      const def = getItem(slot.itemId);
      cell.append(
        el('div', { className: 'name', text: def.name }),
        ...(slot.qty > 1 ? [el('div', { className: 'qty', text: `${slot.qty}` })] : []),
      );
      cell.title = `${def.description}\nDrag to move or swap slots.`;
      cell.draggable = true;
      cell.addEventListener('dragstart', (e) => {
        draggingIndex = i;
        suppressClick = true;
        cell.style.opacity = '0.55';
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(i));
        }
      });
      cell.addEventListener('dragend', () => {
        draggingIndex = null;
        cell.style.opacity = '';
        setTimeout(() => { suppressClick = false; }, 0);
      });
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        if (suppressClick) return;
        const acts = actionsFor(i);
        const rect = cell.getBoundingClientRect();
        showContextPopup(rect.left, rect.bottom + 4, acts);
      });
      grid.append(cell);
    });
  }
  render();
  bus.on('inventoryChanged', render);
  bus.on('equipmentChanged', render);

  return {
    panel,
    toggle: () => panel.classList.toggle('hidden'),
  };
}
