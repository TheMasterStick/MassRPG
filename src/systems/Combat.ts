import type { Player } from '../entities/Player';
import type { World } from '../world/World';
import { Monster } from '../entities/Monster';
import { isAdjacent } from './Pathfinding';
import { equippedBonus, removeItem, addItem } from './Inventory';
import { addXp } from './Skills';
import * as CM from './CombatMath';
import { getItem, ITEMS } from '../data/items';
import { bus, log } from '../core/EventBus';
import { MONSTER_AGGRO_RANGE, MONSTER_LEASH_RANGE, MONSTER_AGGRO_COOLDOWN_TICKS } from '../core/constants';
import { facingFromDelta } from './Facing';

/** Monster art only has a left/right orientation - only re-mirror it when there's a clear horizontal side to face. */
function faceHorizontally(monster: Monster, dx: number) {
  if (dx > 0) monster.facing = 'right';
  else if (dx < 0) monster.facing = 'left';
}

function findBestArrow(player: Player): string | null {
  let best: string | null = null;
  let bestBonus = -1;
  for (const slot of player.inventory) {
    if (!slot) continue;
    const def = getItem(slot.itemId);
    const bonus = def.bonuses?.rangedStrength;
    if (bonus !== undefined && bonus > bestBonus) { bestBonus = bonus; best = slot.itemId; }
  }
  return best;
}

export function playerAttack(player: Player, monster: Monster) {
  if (player.combatTargetId === monster.instanceId) return; // already fighting it - clicking again is a no-op
  player.combatTargetId = monster.instanceId;
  player.path = [];
  log(`You attack the ${monster.def().name}.`, 'combat');
}

function stepToward(x: number, y: number, tx: number, ty: number, world: World): { x: number; y: number } {
  const dx = Math.sign(tx - x);
  const dy = Math.sign(ty - y);
  const candidates: [number, number][] = [[x + dx, y + dy], [x + dx, y], [x, y + dy]];
  for (const [nx, ny] of candidates) {
    if ((nx !== x || ny !== y) && world.canStep(x, y, nx, ny)) return { x: nx, y: ny };
  }
  return { x, y };
}

function styleAttackSpeed(style: Player['combatStyle']): number {
  if (style === 'ranged') return 5;
  if (style === 'magic') return 5;
  return 4;
}

function resolvePlayerHit(player: Player, monster: Monster) {
  const def = monster.def();
  let maxHit: number;
  let atkLevel: number;
  let atkBonus: number;
  if (player.combatStyle === 'ranged') {
    const arrow = findBestArrow(player);
    if (!player.equipment.weapon || !getItem(player.equipment.weapon).bonuses?.rangedAttack) {
      log(`You need a bow equipped to fight with Ranged.`, 'warning');
      player.combatStyle = 'melee';
      return resolvePlayerHit(player, monster);
    }
    if (!arrow) { log(`You have no arrows left!`, 'warning'); player.combatStyle = 'melee'; return; }
    removeItem(player, arrow, 1);
    atkLevel = player.level('ranged');
    atkBonus = equippedBonus(player, 'rangedAttack');
    maxHit = CM.maxHitRanged(atkLevel, equippedBonus(player, 'rangedStrength'));
  } else if (player.combatStyle === 'magic') {
    atkLevel = player.level('magic');
    atkBonus = equippedBonus(player, 'magic');
    maxHit = CM.maxHitMagic(atkLevel);
  } else {
    atkLevel = player.level('attack');
    atkBonus = equippedBonus(player, 'attack');
    maxHit = CM.maxHitMelee(player.level('strength'), equippedBonus(player, 'strength'));
  }

  // A passive creature only becomes hostile once the player actually performs
  // the first attack roll. A miss still counts as an attack; merely clicking it
  // while out of range does not.
  monster.targetId = 'player';

  const aRoll = CM.attackRoll(atkLevel, atkBonus);
  const dRoll = CM.defenceRoll(def.defence, def.defenceBonus);
  const chance = CM.hitChance(aRoll, dRoll);
  const dmg = CM.rollDamage(maxHit, chance, Math.random);

  monster.currentHp -= dmg;
  bus.emit('hit', { targetKind: 'monster', targetId: monster.instanceId, amount: dmg, x: monster.x, y: monster.y });
  if (dmg > 0) log(`You hit the ${def.name} for ${dmg}.`, 'combat');
  else log(`You miss the ${def.name}.`, 'combat');

  const skill = player.combatStyle === 'ranged' ? 'ranged' : player.combatStyle === 'magic' ? 'magic' : 'strength';
  if (dmg > 0) {
    addXp(player, skill, dmg * 1.33);
    addXp(player, 'hitpoints', dmg * 0.33);
  }
}

function resolveMonsterHit(player: Player, monster: Monster) {
  const def = monster.def();
  const aRoll = CM.attackRoll(def.attack, def.attackBonus);
  const dRoll = CM.defenceRoll(player.level('defence'), equippedBonus(player, 'defence'));
  const chance = CM.hitChance(aRoll, dRoll);
  const maxHit = CM.maxHitMelee(def.strength, def.strengthBonus);
  const dmg = CM.rollDamage(maxHit, chance, Math.random);

  player.currentHp -= dmg;
  bus.emit('hit', { targetKind: 'player', targetId: 'player', amount: dmg, x: player.x, y: player.y });
  if (dmg > 0) log(`The ${def.name} hits you for ${dmg}.`, 'combat');
  if (!player.combatTargetId) player.combatTargetId = monster.instanceId; // auto-retaliate
}

function grantLoot(player: Player, monster: Monster) {
  const def = monster.def();
  for (const drop of def.guaranteedDrops) {
    const qty = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
    addItem(player, drop.itemId, qty);
    log(`You receive: ${qty > 1 ? qty + 'x ' : ''}${getItem(drop.itemId).name}.`, 'loot');
  }
  if (Math.random() >= def.noDropChance && def.drops.length > 0) {
    const totalWeight = def.drops.reduce((s, d) => s + d.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const drop of def.drops) {
      roll -= drop.weight;
      if (roll <= 0) {
        const qty = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
        addItem(player, drop.itemId, qty);
        log(`You receive: ${qty > 1 ? qty + 'x ' : ''}${getItem(drop.itemId).name}.`, 'loot');
        break;
      }
    }
  }
}

export function combatTick(world: World, player: Player) {
  // Towns are a safe zone: monsters never aggro onto a player standing in one,
  // and immediately give up any chase the moment the player reaches one.
  const playerInVillage = player.isAlive() && world.gen.isVillage(Math.round(player.x), Math.round(player.y));

  // Aggro + leash + wander for monsters
  for (const monster of world.monsters) {
    if (!monster.isAlive()) continue;

    if (
      monster.targetId !== 'player' && monster.def().aggressive && player.isAlive() && !playerInVillage &&
      world.tick >= monster.aggroCooldownUntilTick
    ) {
      const dist = Math.max(Math.abs(monster.x - player.x), Math.abs(monster.y - player.y));
      if (dist <= MONSTER_AGGRO_RANGE) monster.targetId = 'player';
    }

    if (monster.targetId === 'player') {
      const leash = Math.max(Math.abs(monster.x - monster.spawnX), Math.abs(monster.y - monster.spawnY));
      if (!player.isAlive() || leash > MONSTER_LEASH_RANGE || playerInVillage) {
        monster.targetId = null;
        monster.aggroCooldownUntilTick = world.tick + MONSTER_AGGRO_COOLDOWN_TICKS;
        continue;
      }
      faceHorizontally(monster, player.x - monster.x);
      if (!isAdjacent({ x: monster.x, y: monster.y }, { x: player.x, y: player.y }) && monster.lastMoveTick !== world.tick) {
        const next = stepToward(monster.x, monster.y, Math.round(player.x), Math.round(player.y), world);
        // Never actually step into a town, even mid-chase - abandon the pursuit
        // right at the border instead of just leashing out one step too late.
        if (world.gen.isVillage(next.x, next.y)) {
          monster.targetId = null;
          monster.aggroCooldownUntilTick = world.tick + MONSTER_AGGRO_COOLDOWN_TICKS;
        } else {
          monster.x = next.x; monster.y = next.y;
          monster.lastMoveTick = world.tick;
        }
      } else if (isAdjacent({ x: monster.x, y: monster.y }, { x: Math.round(player.x), y: Math.round(player.y) })) {
        if (world.tick - monster.lastAttackTick >= monster.def().attackSpeedTicks) {
          resolveMonsterHit(player, monster);
          monster.lastAttackTick = world.tick;
        }
      }
    } else if (monster.lastMoveTick !== world.tick && (monster.x !== monster.spawnX || monster.y !== monster.spawnY)) {
      // Not in combat and away from home: amble back, one step every other tick.
      if (world.tick % 2 === 0) {
        const next = stepToward(monster.x, monster.y, monster.spawnX, monster.spawnY, world);
        faceHorizontally(monster, next.x - monster.x);
        monster.x = next.x; monster.y = next.y;
        monster.lastMoveTick = world.tick;
      }
    }
  }

  // Player's active combat follows the monster's live position instead of the
  // tile it occupied when the player first clicked it.
  if (player.combatTargetId) {
    const monster = world.monsters.find((m) => m.instanceId === player.combatTargetId);
    if (!monster || !monster.isAlive() || !player.isAlive()) {
      player.combatTargetId = null;
    } else {
      const ranged = player.combatStyle !== 'melee';
      const adjacent = isAdjacent({ x: player.x, y: player.y }, { x: monster.x, y: monster.y });
      const inRange = ranged ? Math.max(Math.abs(player.x - monster.x), Math.abs(player.y - monster.y)) <= 6 : adjacent;
      if (inRange && player.path.length === 0) {
        player.facing = facingFromDelta(monster.x - player.x, monster.y - player.y, player.facing);
      }
      if (!inRange && player.path.length === 0) {
        const next = stepToward(Math.round(player.x), Math.round(player.y), monster.x, monster.y, world);
        if (next.x !== Math.round(player.x) || next.y !== Math.round(player.y)) player.path = [next];
      } else if (inRange && world.tick - player.lastAttackTick >= styleAttackSpeed(player.combatStyle)) {
        resolvePlayerHit(player, monster);
        player.lastAttackTick = world.tick;
        if (monster.currentHp <= 0) {
          log(`You have defeated the ${monster.def().name}!`, 'combat');
          grantLoot(player, monster);
          world.killMonster(monster);
          player.combatTargetId = null;
        }
      }
    }
  }

  if (player.currentHp <= 0 && player.isAlive() === false) {
    handlePlayerDeath(player);
  }
}

function handlePlayerDeath(player: Player) {
  log(`You have died! You wake up back at camp.`, 'warning');
  player.currentHp = player.maxHp();
  player.x = player.respawnPoint.x;
  player.y = player.respawnPoint.y;
  player.path = [];
  player.action = null;
  player.combatTargetId = null;
  bus.emit('playerDied', undefined);
}

export function isMeleeArrowItem(itemId: string): boolean {
  return !!ITEMS[itemId]?.bonuses?.rangedStrength;
}
