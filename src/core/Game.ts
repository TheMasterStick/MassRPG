import { World } from '../world/World';
import { Player } from '../entities/Player';
import { Renderer } from './Renderer';
import { TICK_MS, SIM_RADIUS_CHUNKS, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from './constants';
import { bfsPath, nearestAdjacentWalkable, isSameOrAdjacent, type Point } from '../systems/Pathfinding';
import { combatTick, playerAttack } from '../systems/Combat';
import { canGather, startGathering, processGatherTick, harvest } from '../systems/Gathering';
import { processProduceTick } from '../systems/Production';
import { bus, log } from '../core/EventBus';
import type { StructureType } from '../world/types';
import { startAutosave, saveGame } from '../systems/Save';
import { placeStructure } from '../systems/Construction';
import { facingFromDelta } from '../systems/Facing';

export type PendingInteraction =
  | { type: 'gather'; x: number; y: number }
  | { type: 'harvest'; x: number; y: number }
  | { type: 'plant_menu'; x: number; y: number }
  | { type: 'structure'; x: number; y: number; structureType: StructureType };

export class Game {
  world: World;
  player: Player;
  renderer: Renderer;
  private canvas: HTMLCanvasElement;
  private lastFrame = 0;
  private tickAccumulator = 0;
  hoverTile: Point | null = null;
  pendingInteraction: PendingInteraction | null = null;
  buildMode: StructureType | null = null;
  private keys = new Set<string>();
  private rafHandle = 0;
  paused = false;
  onFrame: ((nowMs: number) => void) | null = null;

  constructor(world: World, player: Player, canvas: HTMLCanvasElement) {
    this.world = world;
    this.player = player;
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.bindInput();
    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.resize();
    bus.on('hit', (e) => {
      const color = e.targetKind === 'player' ? '#ff5555' : e.amount === 0 ? '#aaaaaa' : '#ffee55';
      this.renderer.addFloatingText(e.x, e.y, e.amount === 0 ? 'miss' : `-${e.amount}`, color);
    });
    startAutosave(world, player);
  }

  start() {
    this.lastFrame = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.25, (t - this.lastFrame) / 1000);
      this.lastFrame = t;
      if (!this.paused) this.update(dt);
      this.renderer.render(this.world, this.player, this.world.monsters, this.hoverTile);
      this.onFrame?.(t);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.rafHandle);
  }

  manualSave() {
    saveGame(this.world, this.player);
  }

  private update(dt: number) {
    this.handleKeyboardMovement();
    this.updateMovement(dt);
    this.tickAccumulator += dt * 1000;
    let iterations = 0;
    while (this.tickAccumulator >= TICK_MS && iterations < 5) {
      this.tickAccumulator -= TICK_MS;
      this.tick();
      iterations++;
    }
  }

  private updateMovement(dt: number) {
    const player = this.player;
    if (player.action) return;
    if (player.path.length === 0) return;
    const speed = player.running ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
    let remaining = speed * dt;
    while (remaining > 0 && player.path.length > 0) {
      const target = player.path[0];
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= remaining || dist < 0.0001) {
        player.x = target.x;
        player.y = target.y;
        remaining -= dist;
        player.path.shift();
        this.updateFacing(dx, dy);
      } else {
        player.x += (dx / dist) * remaining;
        player.y += (dy / dist) * remaining;
        this.updateFacing(dx, dy);
        remaining = 0;
      }
    }
  }

  private updateFacing(dx: number, dy: number) {
    this.player.facing = facingFromDelta(dx, dy, this.player.facing);
  }

  private tick() {
    this.world.tick++;

    const roundedPos = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    const active = this.world.activeChunksAround(roundedPos, SIM_RADIUS_CHUNKS);
    this.world.ensureSpawns(active);

    combatTick(this.world, this.player);

    if (this.player.action) {
      this.player.action.ticksRemaining--;
      if (this.player.action.ticksRemaining <= 0) {
        if (this.player.action.type === 'gather') processGatherTick(this.world, this.player);
        else if (this.player.action.type === 'produce') processProduceTick(this.player);
      }
    }

    this.checkArrival();
  }

  private handleKeyboardMovement() {
    if (this.player.action) return;
    if (this.player.path.length > 0) return; // let the current queued step finish; refills next frame once empty
    let dx = 0, dy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
    if (dx === 0 && dy === 0) return;
    const cur = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    const next = { x: cur.x + dx, y: cur.y + dy };
    this.pendingInteraction = null;
    // Manually steering (even mid-fight) disengages auto-pursuit, same as clicking away - you can always run.
    this.player.combatTargetId = null;
    if (this.world.isWalkable(next.x, next.y)) {
      this.player.path = [next];
    } else if (dx !== 0 && this.world.isWalkable(cur.x + dx, cur.y)) {
      this.player.path = [{ x: cur.x + dx, y: cur.y }];
    } else if (dy !== 0 && this.world.isWalkable(cur.x, cur.y + dy)) {
      this.player.path = [{ x: cur.x, y: cur.y + dy }];
    }
  }

  private checkArrival() {
    if (!this.pendingInteraction) return;
    if (this.player.path.length > 0) return;
    const pi = this.pendingInteraction;
    const pos = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    if (!isSameOrAdjacent(pos, { x: pi.x, y: pi.y })) {
      this.pendingInteraction = null;
      return;
    }
    this.pendingInteraction = null;
    this.executeInteraction(pi);
  }

  private executeInteraction(pi: PendingInteraction) {
    const { world, player } = this;
    if (pi.type === 'gather') {
      const resource = world.getResourceNode(pi.x, pi.y);
      if (!resource || !world.isResourceAvailable(pi.x, pi.y)) { log('There is nothing left to gather there.', 'info'); return; }
      const check = canGather(player, resource);
      if (!check.ok) { log(check.reason ?? "You can't do that.", 'warning'); return; }
      startGathering(player, pi.x, pi.y, resource);
    } else if (pi.type === 'harvest') {
      harvest(world, player, pi.x, pi.y);
    } else if (pi.type === 'plant_menu') {
      this.onOpenPlantMenu?.(pi.x, pi.y);
    } else if (pi.type === 'structure') {
      this.onOpenStructure?.(pi.x, pi.y, pi.structureType);
    }
  }

  onOpenPlantMenu: ((x: number, y: number) => void) | null = null;
  onOpenStructure: ((x: number, y: number, type: StructureType) => void) | null = null;

  moveAdjacentThen(pi: PendingInteraction) {
    this.player.action = null;
    this.player.combatTargetId = null;
    const start = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    if (isSameOrAdjacent(start, { x: pi.x, y: pi.y })) {
      this.pendingInteraction = null;
      this.executeInteraction(pi);
      return;
    }
    const target = nearestAdjacentWalkable(this.world, start, { x: pi.x, y: pi.y });
    if (!target) { log("You can't reach that from here.", 'warning'); return; }
    const path = bfsPath(this.world, start, target);
    if (!path) { log("You can't find a path there.", 'warning'); return; }
    this.player.path = path;
    this.pendingInteraction = pi;
  }

  moveTo(target: Point) {
    this.player.action = null;
    this.player.combatTargetId = null;
    this.pendingInteraction = null;
    const start = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    const path = bfsPath(this.world, start, target);
    if (path) this.player.path = path;
  }

  private handleClick(screenX: number, screenY: number) {
    const tile = this.renderer.screenToWorldTile(screenX, screenY, this.player);

    if (this.buildMode) {
      placeStructure(this.world, this.player, this.buildMode, tile.x, tile.y);
      this.buildMode = null;
      return;
    }

    const monster = this.world.monsters.find(
      (m) => m.isAlive() && Math.round(m.x) === tile.x && Math.round(m.y) === tile.y,
    );
    if (monster) {
      this.player.action = null;
      const start = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
      if (!isSameOrAdjacent(start, tile)) {
        const target = nearestAdjacentWalkable(this.world, start, tile);
        if (target) { const path = bfsPath(this.world, start, target); if (path) this.player.path = path; }
      }
      playerAttack(this.player, monster);
      this.pendingInteraction = null;
      return;
    }

    const structure = this.world.getStructure(tile.x, tile.y);
    if (structure) { this.moveAdjacentThen({ type: 'structure', x: tile.x, y: tile.y, structureType: structure }); return; }

    if (this.world.isResourceAvailable(tile.x, tile.y)) {
      const res = this.world.getResourceNode(tile.x, tile.y)!;
      if (res === 'farm_patch' || res === 'herb_patch') {
        const crop = this.world.getCropState(tile.x, tile.y);
        if (crop && crop.ready) this.moveAdjacentThen({ type: 'harvest', x: tile.x, y: tile.y });
        else if (crop) log('This patch is still growing.', 'info');
        else this.moveAdjacentThen({ type: 'plant_menu', x: tile.x, y: tile.y });
      } else {
        this.moveAdjacentThen({ type: 'gather', x: tile.x, y: tile.y });
      }
      return;
    }

    this.moveTo(tile);
  }

  private bindInput() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.handleClick(e.clientX - rect.left, e.clientY - rect.top);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.hoverTile = this.renderer.screenToWorldTile(e.clientX - rect.left, e.clientY - rect.top, this.player);
    });
    this.canvas.addEventListener('mouseleave', () => { this.hoverTile = null; });

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys.add(key);
      if (key === 'shift') this.player.running = true;
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys.delete(key);
      if (key === 'shift') this.player.running = false;
    });
  }
}
