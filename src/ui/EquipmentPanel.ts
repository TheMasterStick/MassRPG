import './EquipmentPanel.css';
import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { getItem, type EquipSlot } from '../data/items';
import { bus, log } from '../core/EventBus';
import { equippedBonus, unequip } from '../systems/Inventory';
import { showContextPopup } from './ContextPopup';

interface DollSlot {
  slot: EquipSlot;
  label: string;
  glyph: string;
  area: string;
}

const DOLL_SLOTS: DollSlot[] = [
  { slot: 'head', label: 'Head', glyph: '⌃', area: 'head' },
  { slot: 'cape', label: 'Cape', glyph: '◢', area: 'cape' },
  { slot: 'amulet', label: 'Neck', glyph: '◇', area: 'neck' },
  { slot: 'ammo', label: 'Ammo', glyph: '➶', area: 'ammo' },
  { slot: 'weapon', label: 'Weapon', glyph: '⚔', area: 'weapon' },
  { slot: 'body', label: 'Body', glyph: '▣', area: 'body' },
  { slot: 'shield', label: 'Shield', glyph: '◈', area: 'shield' },
  { slot: 'hands', label: 'Hands', glyph: '✦', area: 'hands' },
  { slot: 'legs', label: 'Legs', glyph: '║', area: 'legs' },
  { slot: 'ring', label: 'Ring I', glyph: '○', area: 'ring1' },
  { slot: 'ring2', label: 'Ring II', glyph: '○', area: 'ring2' },
  { slot: 'feet', label: 'Feet', glyph: '⌄', area: 'feet' },
];

export function buildEquipmentPanel(root: HTMLElement, game: Game) {
  const { player } = game;
  const doll = el('div', { className: 'equipment-doll' });
  const stats = el('div', { className: 'equipment-stats' });
  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-equipment' } }, [
    el('h3', { text: 'Equipment' }),
    el('div', { className: 'equipment-hint', text: 'Click equipped items to remove or examine them.' }),
    doll,
    el('h3', { className: 'equipment-stats-title', text: 'Bonuses' }),
    stats,
  ]);
  root.append(panel);

  function openSlotMenu(slot: EquipSlot, itemId: string, cell: HTMLElement) {
    const def = getItem(itemId);
    const rect = cell.getBoundingClientRect();
    showContextPopup(rect.left, rect.bottom + 4, [
      { label: 'Remove', onClick: () => unequip(player, slot) },
      { label: 'Examine', onClick: () => log(def.description, 'info') },
    ]);
  }

  function renderDoll() {
    clear(doll);
    doll.append(el('div', { className: 'equipment-silhouette', attrs: { 'aria-hidden': 'true' } }, [
      el('div', { className: 'equipment-silhouette-head' }),
      el('div', { className: 'equipment-silhouette-body' }),
      el('div', { className: 'equipment-silhouette-arms' }),
      el('div', { className: 'equipment-silhouette-legs' }),
    ]));

    for (const entry of DOLL_SLOTS) {
      const itemId = player.equipment[entry.slot];
      const cell = el('button', {
        className: `equipment-slot ${itemId ? 'equipped' : 'empty'}`,
        attrs: { title: itemId ? `${entry.label}: ${getItem(itemId).name}` : entry.label },
      });
      cell.style.gridArea = entry.area;

      if (itemId) {
        const def = getItem(itemId);
        const qty = entry.slot === 'ammo' ? player.equippedAmmoQty : 1;
        cell.append(
          el('span', { className: 'equipment-slot-glyph', text: entry.glyph }),
          el('span', { className: 'equipment-slot-item', text: def.name }),
          ...(entry.slot === 'ammo' ? [el('span', { className: 'equipment-slot-qty', text: `${qty}` })] : []),
        );
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          openSlotMenu(entry.slot, itemId, cell);
        });
      } else {
        cell.append(
          el('span', { className: 'equipment-slot-glyph', text: entry.glyph }),
          el('span', { className: 'equipment-slot-label', text: entry.label }),
        );
      }
      doll.append(cell);
    }
  }

  function renderStats() {
    clear(stats);
    const rows: [string, number][] = [
      ['Attack', equippedBonus(player, 'attack')],
      ['Strength', equippedBonus(player, 'strength')],
      ['Defence', equippedBonus(player, 'defence')],
      ['Ranged attack', equippedBonus(player, 'rangedAttack')],
      ['Ranged strength', equippedBonus(player, 'rangedStrength')],
      ['Magic', equippedBonus(player, 'magic')],
    ];
    for (const [label, value] of rows) {
      stats.append(el('div', { className: 'equipment-stat' }, [
        el('span', { text: label }),
        el('strong', { text: value >= 0 ? `+${value}` : `${value}` }),
      ]));
    }
  }

  function render() {
    renderDoll();
    renderStats();
  }

  render();
  bus.on('equipmentChanged', render);
  bus.on('inventoryChanged', render);

  return { panel, toggle: () => panel.classList.toggle('hidden') };
}
