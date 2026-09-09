import { getMonster } from '../data/monsters';

let nextId = 1;

export class Monster {
  readonly instanceId: string;
  readonly defId: string;
  x: number;
  y: number;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly spawnLocalKey: string;
  currentHp: number;
  maxHp: number;
  targetId: string | null = null; // 'player' when engaged
  lastAttackTick = 0;
  lastMoveTick = 0;
  aggroCooldownUntilTick = 0; // won't re-aggro before this tick, after giving up a chase

  constructor(defId: string, x: number, y: number, spawnLocalKey: string) {
    const def = getMonster(defId);
    this.instanceId = `m${nextId++}`;
    this.defId = defId;
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.spawnLocalKey = spawnLocalKey;
    this.maxHp = def.hp;
    this.currentHp = def.hp;
  }

  def() {
    return getMonster(this.defId);
  }

  isAlive(): boolean {
    return this.currentHp > 0;
  }
}
