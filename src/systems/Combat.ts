import type { Player } from '../entities/Player';
import type { World } from '../world/World';
import { Monster } from '../entities/Monster';
import { bfsPath, isAdjacent, type Point } from './Pathfinding';
import { equippedBonus, consumeEquippedAmmo, addItem } from './Inventory';
import { addXp } from './Skills';
import * as CM from './CombatMath';
import { getItem, ITEMS } from '../data/items';
import { weaponProfile } from '../data/equipmentProgression';
import { bus, log } from '../core/EventBus';
import { MONSTER_AGGRO_RANGE, MONSTER_LEASH_RANGE, MONSTER_AGGRO_COOLDOWN_TICKS } from '../core/constants';
import { facingFromDelta } from './Facing';

/** Monster art only has a left/right orientation - only re-mirror it when there's a clear horizontal side to face. */
function faceHorizontally(monster: Monster, dx: number) {
  if (dx > 0) monster.facing = 'right';
  else if (dx < 0) monster.facing = 'left';
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

const APPROACH_OFFSETS: Point[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

/**
 * Build a complete walk path to a reachable tile next to the monster. Player
 * movement consumes the whole path continuously frame-by-frame, rather than
 * receiving one new tile each combat tick. Rebuilding is only needed when the
 * monster has moved far enough that the old path endpoint is no longer useful.
 */
function combatApproachPath(world: World, player: Player, monster: Monster): Point[] | null {
  const start = { x: Math.round(player.x), y: Math.round(player.y) };
  const target = { x: Math.round(monster.x), y: Math.round(monster.y) };
  const candidates = APPROACH_OFFSETS
    .map((offset) => ({ x: target.x + offset.x, y: target.y + offset.y }))
    .filter((candidate) => world.isWalkable(candidate.x, candidate.y))
    .sort((a, b) => {
      const ad = (a.x - start.x) ** 2 + (a.y - start.y) ** 2;
      const bd = (b.x - start.x) ** 2 + (b.y - start.y) ** 2;
      return ad - bd;
    });

  for (const candidate of candidates) {
    const path = bfsPath(world, start, candidate);
    if (path) return path;
  }
  return null;
}

function pathStillApproachesMonster(player: Player, monster: Monster): boolean {
  const endpoint = player.path[player.path.length - 1];
  if (!endpoint) return false;
  return isAdjacent(endpoint, { x: Math.round(monster.x), y: Math.round(monster.y) });
}

function playerAttackSpeed(player: Player): number {
  if (player.combatStyle === 'magic') return 5;
  const profile = weaponProfile(player.equipment.weapon);
  if (profile) return profile.speedTicks;
  return player.combatStyle === 'ranged' ? 5 : 4;
}

function stopInvalidRangedAttack(player: Player, message: string) {
  log(message, 'warning');
  player.combatTargetId = null;
  player.path = [];
}

function resolvePlayerHit(player: Player, monster: Monster): boolean {
  const def = monster.def();
  let maxHit: number;
  let atkLevel: number;
  let atkBonus: number;

  if (player.combatStyle === 'ranged') {
    const weaponId = player.equipment.weapon;
    if (!weaponId || getItem(weaponId).bonuses?.rangedAttack === undefined) {
      stopInvalidRangedAttack(player, `You need a bow equipped to fight with Ranged.`);
      return false;
    }

    const ammoId = player.equipment.ammo;
    if (!ammoId || player.equippedAmmoQty <= 0 || getItem(ammoId).bonuses?.rangedStrength === undefined) {
      stopInvalidRangedAttack(player, `You need arrows equipped to fight with Ranged.`);
      return false;
    }

    atkLevel = player.level('ranged');
    atkBonus = equippedBonus(player, 'rangedAttack');
    const rangedStrength = equippedBonus(player, 'rangedStrength');
    if (!consumeEquippedAmmo(player, 1)) {
      stopInvalidRangedAttack(player, `You need arrows equipped to fight with Ranged.`);
      return false;
    }
    maxHit = CM.maxHitRanged(atkLevel, rangedStrength);
  } else if (player.combatStyle === 'magic') {
    // Placeholder until the real spellbook/staff/reagent system is implemented.
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
  return true;
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

  // Player combat follows the monster's live position, but queues a complete
  // approach path so the renderer can interpolate movement continuously between
  // tiles. If the monster moves away from that endpoint, rebuild the remaining
  // path instead of finishing a route to an obsolete position.
  if (player.combatTargetId) {
    const monster = world.monsters.find((m) => m.instanceId === player.combatTargetId);
    if (!monster || !monster.isAlive() || !player.isAlive()) {
      player.combatTargetId = null;
      player.path = [];
    } else {
      const ranged = player.combatStyle !== 'melee';
      const adjacent = isAdjacent({ x: player.x, y: player.y }, { x: monster.x, y: monster.y });
      const inRange = ranged ? Math.max(Math.abs(player.x - monster.x), Math.abs(player.y - monster.y)) <= 6 : adjacent;

      if (!inRange && (player.path.length === 0 || !pathStillApproachesMonster(player, monster))) {
        const path = combatApproachPath(world, player, monster);
        if (path) player.path = path;
      }

      if (inRange && player.path.length === 0) {
        player.facing = facingFromDelta(monster.x - player.x, monster.y - player.y, player.facing);
      }
      if (inRange && world.tick - player.lastAttackTick >= playerAttackSpeed(player)) {
        const attacked = resolvePlayerHit(player, monster);
        if (attacked) player.lastAttackTick = world.tick;
        if (monster.currentHp <= 0) {
          log(`You have defeated the ${monster.def().name}!`, 'combat');
          grantLoot(player, monster);
          world.killMonster(monster);
          player.combatTargetId = null;
          player.path = [];
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
