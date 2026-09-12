import type { Player } from '../entities/Player';
import { getItem } from '../data/items';
import { addItem, removeItem } from './Inventory';
import { log } from '../core/EventBus';

export const SHOP_STOCK = [
  // Gathering and fishing basics.
  'bronze_hatchet', 'bronze_pickaxe', 'small_fishing_net', 'big_fishing_net',
  'fishing_rod', 'fly_fishing_rod', 'fishing_bait', 'lobster_pot', 'harpoon',

  // General workshop tools.
  'tinderbox', 'hammer', 'chisel', 'needle', 'saw', 'knife', 'shears', 'bucket',
  'pestle_and_mortar', 'glassblowing_pipe',

  // Farming tools and ordinary starter seeds. Higher-tier seed acquisition can
  // come from the deeper Farming/world-content pass rather than an infinite shop.
  'rake', 'spade', 'seed_dibber', 'gardening_trowel', 'watering_can', 'secateurs',
  'potato_seed', 'onion_seed', 'cabbage_seed',

  // Common crafting moulds.
  'ring_mold', 'amulet_mold', 'necklace_mold', 'bracelet_mold', 'tiara_mold', 'ammo_mold',

  // Basic adventuring stock. The level-1 ranged kit is sold here so a fresh
  // character can actually enter the Ranged combat branch without first
  // completing several gathering/production professions. Better bows and ammo
  // remain predominantly player-produced progression.
  'bronze_sword', 'bronze_shield', 'normal_shortbow', 'bronze_arrow',
  'bread', 'vial_of_water',
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
