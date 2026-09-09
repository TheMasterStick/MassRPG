import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { getItem } from '../data/items';
import { bus } from '../core/EventBus';
import { depositItem, withdrawItem } from '../systems/Bank';

export function buildBankPanel(root: HTMLElement, game: Game) {
  const { player, world } = game;
  const invList = el('div', {});
  const bankList = el('div', {});
  const panel = el('div', { className: 'panel hidden', attrs: { id: 'panel-bank' } }, [
    el('h2', {}, ['Bank', el('span', { className: 'close-x', text: '✕', attrs: { id: 'bank-close' } })]),
    el('div', { className: 'tabs' }, [el('span', { text: 'Inventory (click to deposit)' })]),
    invList,
    el('div', { className: 'tabs', attrs: { style: 'margin-top:10px' } }, [el('span', { text: 'Bank (click to withdraw)' })]),
    bankList,
  ]);
  root.append(panel);
  panel.querySelector('#bank-close')!.addEventListener('click', () => panel.classList.add('hidden'));

  function render() {
    clear(invList);
    player.inventory.forEach((slot, i) => {
      if (!slot) return;
      const def = getItem(slot.itemId);
      const row = el('div', { className: 'shop-row' }, [
        el('span', { text: `${def.name} x${slot.qty}` }),
      ]);
      const btn = el('button', { text: 'Deposit' });
      btn.addEventListener('click', () => depositItem(world, player, i, slot.qty));
      row.append(btn);
      invList.append(row);
    });

    clear(bankList);
    const totals = new Map<string, number>();
    for (const s of world.bank) if (s) totals.set(s.itemId, (totals.get(s.itemId) ?? 0) + s.qty);
    for (const [itemId, qty] of totals) {
      const def = getItem(itemId);
      const row = el('div', { className: 'shop-row' }, [el('span', { text: `${def.name} x${qty}` })]);
      const btn = el('button', { text: 'Withdraw' });
      btn.addEventListener('click', () => withdrawItem(world, player, itemId, qty));
      row.append(btn);
      bankList.append(row);
    }
  }

  bus.on('inventoryChanged', () => { if (!panel.classList.contains('hidden')) render(); });

  return {
    panel,
    open: () => { render(); panel.classList.remove('hidden'); },
  };
}
