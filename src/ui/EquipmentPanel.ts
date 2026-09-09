import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { getItem, type EquipSlot } from '../data/items';
import { bus } from '../core/EventBus';
import { unequip } from '../systems/Inventory';

const SLOT_ORDER: EquipSlot[] = ['head', 'cape', 'amulet', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
const SLOT_LABEL: Record<EquipSlot, string> = {
  head: 'Head', cape: 'Cape', amulet: 'Amulet', weapon: 'Weapon', body: 'Body',
  shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet', ring: 'Ring',
};

export function buildEquipmentPanel(root: HTMLElement, game: Game) {
  const { player } = game;
  const list = el('div', { attrs: { id: 'equip-list' } });
  const panel = el('div', { className: 'panel hidden', attrs: { id: 'panel-equipment' } }, [
    el('h2', {}, ['Equipment', el('span', { className: 'close-x', text: '✕', attrs: { id: 'equip-close' } })]),
    list,
  ]);
  root.append(panel);
  panel.querySelector('#equip-close')!.addEventListener('click', () => panel.classList.add('hidden'));

  function render() {
    clear(list);
    for (const slot of SLOT_ORDER) {
      const itemId = player.equipment[slot];
      const row = el('div', { className: 'equip-row' }, [
        el('span', {}, [`${SLOT_LABEL[slot]}: ${itemId ? getItem(itemId).name : '-'}`]),
      ]);
      if (itemId) {
        const btn = el('button', { text: 'Remove' });
        btn.addEventListener('click', () => unequip(player, slot));
        row.append(btn);
      }
      list.append(row);
    }
  }
  render();
  bus.on('equipmentChanged', render);
  bus.on('inventoryChanged', render);

  return { panel, toggle: () => panel.classList.toggle('hidden') };
}
