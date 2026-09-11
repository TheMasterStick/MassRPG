import type { Player, InventorySlot } from '../entities/Player';
import { getItem, type EquipSlot } from '../data/items';
import { bus, log } from '../core/EventBus';

export function addItem(player: Player, itemId: string, qty: number): number {
  if (qty <= 0) return 0;
  const def = getItem(itemId);
  let remaining = qty;
  if (def.stackable) {
    const slot = player.inventory.find((s) => s?.itemId === itemId) as InventorySlot | undefined;
    if (slot) { slot.qty += remaining; remaining = 0; }
  }
  while (remaining > 0) {
    const idx = player.findEmptySlot();
    if (idx === -1) break;
    const amount = def.stackable ? remaining : 1;
    player.inventory[idx] = { itemId, qty: amount };
    remaining -= amount;
  }
  const added = qty - remaining;
  if (added > 0) bus.emit('inventoryChanged', undefined);
  if (remaining > 0) log(`Your inventory is too full to hold everything.`, 'warning');
  return added;
}

export function removeItem(player: Player, itemId: string, qty: number): boolean {
  if (player.countItem(itemId) < qty) return false;
  let remaining = qty;
  for (let i = 0; i < player.inventory.length && remaining > 0; i++) {
    const slot = player.inventory[i];
    if (!slot || slot.itemId !== itemId) continue;
    const take = Math.min(slot.qty, remaining);
    slot.qty -= take;
    remaining -= take;
    if (slot.qty <= 0) player.inventory[i] = null;
  }
  bus.emit('inventoryChanged', undefined);
  return true;
}

export function removeFromSlot(player: Player, slotIndex: number, qty: number) {
  const slot = player.inventory[slotIndex];
  if (!slot) return;
  slot.qty -= qty;
  if (slot.qty <= 0) player.inventory[slotIndex] = null;
  bus.emit('inventoryChanged', undefined);
}

export function moveInventorySlot(player: Player, fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= player.inventory.length || toIndex >= player.inventory.length) return;
  const from = player.inventory[fromIndex];
  if (!from) return;
  const to = player.inventory[toIndex];
  if (!to) {
    player.inventory[toIndex] = from;
    player.inventory[fromIndex] = null;
  } else if (to.itemId === from.itemId && getItem(from.itemId).stackable) {
    to.qty += from.qty;
    player.inventory[fromIndex] = null;
  } else {
    player.inventory[toIndex] = from;
    player.inventory[fromIndex] = to;
  }
  bus.emit('inventoryChanged', undefined);
}

function chooseSlot(player: Player, requested: EquipSlot): EquipSlot {
  if (requested !== 'ring') return requested;
  if (!player.equipment.ring) return 'ring';
  if (!player.equipment.ring2) return 'ring2';
  return 'ring';
}

export function equip(player: Player, slotIndex: number) {
  const slot = player.inventory[slotIndex];
  if (!slot) return;
  const def = getItem(slot.itemId);
  if (!def.equipSlot) { log(`You can't wear that.`, 'warning'); return; }

  if (def.equipSlot === 'ammo') {
    player.equipment.ammo = slot.itemId;
    bus.emit('equipmentChanged', undefined);
    log(`You ready the ${def.name}.`, 'info');
    return;
  }

  const target = chooseSlot(player, def.equipSlot);
  const displaced = new Set<EquipSlot>();
  if (player.equipment[target]) displaced.add(target);
  if (target === 'weapon' && def.twoHanded && player.equipment.shield) displaced.add('shield');
  if (target === 'shield') {
    const weapon = player.equipment.weapon;
    if (weapon && getItem(weapon).twoHanded) displaced.add('weapon');
  }

  const emptySlots = player.inventory.filter((entry) => !entry).length + 1;
  if (displaced.size > emptySlots) {
    log(`Your inventory is too full to unequip the items this would replace.`, 'warning');
    return;
  }

  player.inventory[slotIndex] = null;
  for (const displacedSlot of displaced) {
    const itemId = player.equipment[displacedSlot];
    if (!itemId) continue;
    delete player.equipment[displacedSlot];
    addItem(player, itemId, 1);
  }
  player.equipment[target] = slot.itemId;
  bus.emit('equipmentChanged', undefined);
  bus.emit('inventoryChanged', undefined);
  log(`You equip the ${def.name}.`, 'info');
}

export function unequip(player: Player, slot: EquipSlot) {
  const itemId = player.equipment[slot];
  if (!itemId) return;
  if (slot === 'ammo') {
    delete player.equipment.ammo;
    bus.emit('equipmentChanged', undefined);
    return;
  }
  if (player.findEmptySlot() === -1) { log(`Your inventory is too full.`, 'warning'); return; }
  delete player.equipment[slot];
  addItem(player, itemId, 1);
  bus.emit('equipmentChanged', undefined);
}

export function dropSlot(player: Player, slotIndex: number) {
  const slot = player.inventory[slotIndex];
  if (!slot) return;
  player.inventory[slotIndex] = null;
  if (player.equipment.ammo === slot.itemId && player.countItem(slot.itemId) === 0) {
    delete player.equipment.ammo;
    bus.emit('equipmentChanged', undefined);
  }
  log(`You drop the ${getItem(slot.itemId).name}.`, 'info');
  bus.emit('inventoryChanged', undefined);
}

export function equippedBonus(player: Player, key: 'attack' | 'strength' | 'defence' | 'rangedAttack' | 'rangedStrength' | 'magic'): number {
  let total = 0;
  for (const itemId of Object.values(player.equipment)) {
    if (!itemId) continue;
    total += getItem(itemId).bonuses?.[key] ?? 0;
  }
  return total;
}
