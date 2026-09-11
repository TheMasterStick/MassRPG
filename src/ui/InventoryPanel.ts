import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { getItem } from '../data/items';
import { bus, log } from '../core/EventBus';
import { equip, dropSlot, moveInventorySlot, removeFromSlot } from '../systems/Inventory';
import { lightFire, startProduction, recipeUsesItem } from '../systems/Production';
import { RECIPES } from '../data/recipes';
import { showContextPopup } from './ContextPopup';

type PrimaryAction = 'equip' | 'eat' | 'drink' | 'use';

export function buildInventoryPanel(root: HTMLElement, game: Game) {
  const { player, world } = game;
  const selectionHint = el('div', { className: 'tooltip-desc' });
  selectionHint.style.marginBottom = '6px';
  selectionHint.style.minHeight = '14px';
  const grid = el('div', { attrs: { id: 'inventory-grid' } });
  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-inventory' } }, [selectionHint, grid]);
  root.append(panel);

  let draggingIndex: number | null = null;
  let suppressClick = false;

  function primaryAction(itemId: string): PrimaryAction {
    const def = getItem(itemId);
    if (def.equipSlot) return 'equip';
    if (def.type === 'potion') return 'drink';
    if (def.type === 'food' && def.heal !== undefined && def.heal > 0 && !itemId.startsWith('raw_')) return 'eat';
    return 'use';
  }

  function eat(slotIndex: number) {
    const slot = player.inventory[slotIndex];
    if (!slot) return;
    const def = getItem(slot.itemId);
    if (def.heal === undefined || def.heal <= 0) { log(`You can't eat that.`, 'warning'); return; }
    player.currentHp = Math.min(player.maxHp(), player.currentHp + def.heal);
    log(`You eat the ${def.name}. It heals ${def.heal} HP.`, 'info');
    removeFromSlot(player, slotIndex, 1);
  }

  function drink(slotIndex: number) {
    const slot = player.inventory[slotIndex];
    if (!slot) return;
    const def = getItem(slot.itemId);
    log(`You drink the ${def.name}.`, 'info');
    removeFromSlot(player, slotIndex, 1);
  }

  function selectForUse(itemId: string) {
    game.selectInventoryItem(itemId);
    log(`Use ${getItem(itemId).name} with...`, 'info');
  }

  function performPrimary(slotIndex: number) {
    const slot = player.inventory[slotIndex];
    if (!slot) return;
    switch (primaryAction(slot.itemId)) {
      case 'equip': equip(player, slotIndex); break;
      case 'eat': eat(slotIndex); break;
      case 'drink': drink(slotIndex); break;
      case 'use': selectForUse(slot.itemId); break;
    }
  }

  function hasInventoryCrafting(itemId: string): boolean {
    return RECIPES.some((recipe) => recipe.station === 'none' && recipeUsesItem(recipe, itemId));
  }

  function craftWith(itemId: string) {
    if (!(game.onCraftInventoryItem?.(itemId) ?? false)) log(`You don't know anything you can make with that yet.`, 'info');
  }

  function actionsFor(slotIndex: number) {
    const slot = player.inventory[slotIndex];
    if (!slot) return [];
    const def = getItem(slot.itemId);
    const primary = primaryAction(slot.itemId);
    const actions: { label: string; onClick: () => void }[] = [];

    if (primary === 'equip') actions.push({ label: 'Equip', onClick: () => equip(player, slotIndex) });
    else if (primary === 'eat') actions.push({ label: 'Eat', onClick: () => eat(slotIndex) });
    else if (primary === 'drink') actions.push({ label: 'Drink', onClick: () => drink(slotIndex) });
    else actions.push({ label: 'Use', onClick: () => selectForUse(slot.itemId) });

    if (primary !== 'use') actions.push({ label: 'Use', onClick: () => selectForUse(slot.itemId) });
    if (hasInventoryCrafting(slot.itemId)) actions.push({ label: 'Craft...', onClick: () => craftWith(slot.itemId) });

    if (slot.itemId.endsWith('_logs')) actions.push({ label: 'Light fire', onClick: () => lightFire(world, player, slot.itemId) });
    if (slot.itemId.startsWith('grimy_')) {
      const recipe = RECIPES.find((r) => r.inputs[0]?.item === slot.itemId && r.category === 'herblore_clean');
      if (recipe) actions.push({ label: 'Clean', onClick: () => startProduction(player, world, recipe.id, 1, Math.round(player.x), Math.round(player.y)) });
    }
    actions.push({ label: 'Examine', onClick: () => log(def.description, 'info') });
    actions.push({ label: 'Drop', onClick: () => dropSlot(player, slotIndex) });
    actions.push({ label: 'Cancel', onClick: () => {} });
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
      const stored = Number(e.dataTransfer?.getData('text/plain'));
      const from = draggingIndex ?? (Number.isInteger(stored) ? stored : null);
      draggingIndex = null;
      suppressClick = true;
      if (from !== null) moveInventorySlot(player, from, targetIndex);
      setTimeout(() => { suppressClick = false; }, 0);
    });
  }

  function useSelectedOn(targetItemId: string) {
    const selected = game.selectedInventoryItemId;
    if (!selected) return false;
    const handled = game.onUseInventoryItems?.(selected, targetItemId) ?? false;
    if (!handled) log(`Nothing interesting happens.`, 'info');
    game.clearInventoryItemSelection();
    return true;
  }

  function render() {
    clear(grid);
    const selectedItemId = game.selectedInventoryItemId;
    selectionHint.textContent = selectedItemId ? `Use ${getItem(selectedItemId).name} with...` : '';

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
      cell.title = `${def.description}\nLeft click: ${primaryAction(slot.itemId)} · Right click: options · Drag to move or swap.`;
      if (selectedItemId === slot.itemId) {
        cell.style.borderColor = '#d4af37';
        cell.style.boxShadow = '0 0 0 2px rgba(212,175,55,0.35), 0 0 10px rgba(212,175,55,0.45)';
      }
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
        if (game.selectedInventoryItemId) {
          useSelectedOn(slot.itemId);
          return;
        }
        performPrimary(i);
      });
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (suppressClick) return;
        const rect = cell.getBoundingClientRect();
        showContextPopup(rect.left, rect.bottom + 4, actionsFor(i));
      });
      grid.append(cell);
    });
  }

  function refreshAfterInventoryChange() {
    const selected = game.selectedInventoryItemId;
    if (selected && !player.hasItem(selected)) game.clearInventoryItemSelection();
    else render();
  }

  render();
  bus.on('inventoryChanged', refreshAfterInventoryChange);
  bus.on('equipmentChanged', render);
  bus.on('itemSelectionChanged', render);

  return { panel, toggle: () => panel.classList.toggle('hidden') };
}
