import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { getItem } from '../data/items';
import { bus } from '../core/EventBus';
import { buyItem, sellItem, SHOP_STOCK } from '../systems/Shop';

export function buildShopPanel(root: HTMLElement, game: Game) {
  const { player } = game;
  const buyList = el('div', {});
  const sellList = el('div', {});
  const panel = el('div', { className: 'panel hidden', attrs: { id: 'panel-shop' } }, [
    el('h2', {}, ['General Store', el('span', { className: 'close-x', text: '✕', attrs: { id: 'shop-close' } })]),
    el('div', { className: 'tabs' }, [el('span', { text: 'For sale' })]),
    buyList,
    el('div', { className: 'tabs', attrs: { style: 'margin-top:10px' } }, [el('span', { text: 'Your items (sell)' })]),
    sellList,
  ]);
  root.append(panel);
  panel.querySelector('#shop-close')!.addEventListener('click', () => panel.classList.add('hidden'));

  function render() {
    clear(buyList);
    for (const itemId of SHOP_STOCK) {
      const def = getItem(itemId);
      const row = el('div', { className: 'shop-row' }, [el('span', { text: `${def.name} - ${def.value}c` })]);
      const btn = el('button', { text: 'Buy' });
      btn.addEventListener('click', () => buyItem(player, itemId, 1));
      row.append(btn);
      buyList.append(row);
    }

    clear(sellList);
    player.inventory.forEach((slot, i) => {
      if (!slot) return;
      const def = getItem(slot.itemId);
      const price = Math.max(1, Math.floor(def.value / 2));
      const row = el('div', { className: 'shop-row' }, [el('span', { text: `${def.name} x${slot.qty} - ${price}c each` })]);
      const btn = el('button', { text: 'Sell' });
      btn.addEventListener('click', () => sellItem(player, i, 1));
      row.append(btn);
      sellList.append(row);
    });
  }

  bus.on('inventoryChanged', () => { if (!panel.classList.contains('hidden')) render(); });

  return {
    panel,
    open: () => { render(); panel.classList.remove('hidden'); },
  };
}
