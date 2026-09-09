import type { Player } from '../entities/Player';
import { getItem } from '../data/items';
import { addItem, removeItem } from './Inventory';
import { log } from '../core/EventBus';

export const SHOP_STOCK = [
  'bronze_hatchet', 'bronze_pickaxe', 'small_fishing_net', 'fishing_rod', 'fishing_bait',
  'tinderbox', 'hammer', 'chisel', 'needle', 'saw', 'knife', 'spade', 'seed_dibber',
  'pestle_and_mortar', 'bronze_sword', 'bronze_shield', 'bread', 'vial_of_water',
];

export function buyItem(player: Player, itemId: string, qty: number) {
  const def = getItem(itemId);
  const cost = def.value * qty;
  if (!player.hasItem('coins', cost)) { log(`You can't afford that.`, 'warning'); return; }
  if (player.findEmptySlot() === -1 && !def.stackable) { log(`Your inventory is full.`, 'warning'); return; }
  removeItem(player, 'coins', cost);
  addItem(player, itemId, qty);
  log(`You buy ${qty}x ${def.name} for ${cost} coins.`, 'info');
}

export function sellItem(player: Player, slotIndex: number, qty: number) {
  const slot = player.inventory[slotIndex];
  if (!slot) return;
  const def = getItem(slot.itemId);
  const amount = Math.min(qty, slot.qty);
  const price = Math.max(1, Math.floor(def.value / 2)) * amount;
  slot.qty -= amount;
  if (slot.qty <= 0) player.inventory[slotIndex] = null;
  addItem(player, 'coins', price);
  log(`You sell ${amount}x ${def.name} for ${price} coins.`, 'info');
}
