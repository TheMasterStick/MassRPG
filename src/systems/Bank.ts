import type { Player } from '../entities/Player';
import type { World } from '../world/World';
import { getItem } from '../data/items';
import { bus, log } from '../core/EventBus';

function findBankSlot(world: World, itemId: string) {
  return world.bank.find((s) => s?.itemId === itemId);
}

export function depositItem(world: World, player: Player, slotIndex: number, qty: number) {
  const slot = player.inventory[slotIndex];
  if (!slot) return;
  const amount = Math.min(qty, slot.qty);
  const def = getItem(slot.itemId);

  if (def.stackable) {
    const existing = findBankSlot(world, slot.itemId);
    if (existing) existing.qty += amount;
    else world.bank.push({ itemId: slot.itemId, qty: amount });
  } else {
    for (let i = 0; i < amount; i++) world.bank.push({ itemId: slot.itemId, qty: 1 });
  }
  slot.qty -= amount;
  if (slot.qty <= 0) player.inventory[slotIndex] = null;
  bus.emit('inventoryChanged', undefined);
  log(`You deposit ${amount}x ${def.name}.`, 'info');
}

export function withdrawItem(world: World, player: Player, itemId: string, qty: number) {
  const def = getItem(itemId);
  const total = world.bank.filter((s) => s?.itemId === itemId).reduce((sum, s) => sum + (s?.qty ?? 0), 0);
  const amount = Math.min(qty, total);
  if (amount <= 0) return;
  if (player.findEmptySlot() === -1 && !player.hasItem(itemId)) { log(`Your inventory is full.`, 'warning'); return; }

  let remaining = amount;
  for (let i = 0; i < world.bank.length && remaining > 0; i++) {
    const s = world.bank[i];
    if (!s || s.itemId !== itemId) continue;
    const take = Math.min(s.qty, remaining);
    s.qty -= take;
    remaining -= take;
    if (s.qty <= 0) world.bank[i] = null;
  }
  world.bank = world.bank.filter((s): s is NonNullable<typeof s> => s !== null);

  if (def.stackable) {
    const idx = player.inventory.findIndex((s) => s?.itemId === itemId);
    if (idx >= 0) player.inventory[idx]!.qty += amount;
    else player.inventory[player.findEmptySlot()] = { itemId, qty: amount };
  } else {
    for (let i = 0; i < amount; i++) {
      const idx = player.findEmptySlot();
      if (idx === -1) break;
      player.inventory[idx] = { itemId, qty: 1 };
    }
  }
  bus.emit('inventoryChanged', undefined);
  log(`You withdraw ${amount}x ${def.name}.`, 'info');
}
