import { World } from '../world/World';
import { Player } from '../entities/Player';
import { Renderer } from './Renderer';
import { drawElevationAndLinks } from './ElevationOverlay';
import { TICK_MS, SIM_RADIUS_CHUNKS, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED } from './constants';
import { bfsPath, nearestAdjacentWalkable, isSameOrAdjacent, type Point } from '../systems/Pathfinding';
import { combatTick, playerAttack } from '../systems/Combat';
import { canGather, startGathering, processGatherTick, harvest, resourceLabel } from '../systems/Gathering';
import { processProduceTick } from '../systems/Production';
import { bus, log } from '../core/EventBus';
import { TILE_VISUALS, type ResourceType, type StructureType } from '../world/types';
import { startAutosave, saveGame } from '../systems/Save';
import { placeStructure } from '../systems/Construction';
import { facingFromDelta } from '../systems/Facing';
import type { Monster } from '../entities/Monster';

export type PendingInteraction =
  | { type: 'gather'; x: number; y: number }
  | { type: 'harvest'; x: number; y: number }
  | { type: 'plant_menu'; x: number; y: number }
  | { type: 'structure'; x: number; y: number; structureType: StructureType }
  | { type: 'plane_link'; x: number; y: number };

export interface GameContextMenuItem {
  label: string;
  onClick: () => void;
  levelText?: string;
  levelColor?: string;
}

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
    this.world.setActivePlane(player.plane);
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
      drawElevationAndLinks(this.canvas, this.world, this.player);
      this.onFrame?.(t);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop() { cancelAnimationFrame(this.rafHandle); }
  manualSave() { saveGame(this.world, this.player); }

  private update(dt: number) {
    this.handleKeyboardMovement();
    this.updateMovement(dt);
    this.checkArrival();
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
    if (player.action || player.path.length === 0) return;
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
  }

  private handleKeyboardMovement() {
    let dx = 0, dy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
    if (dx === 0 && dy === 0) return;

    this.player.action = null;
    this.player.path = [];
    this.pendingInteraction = null;
    this.player.combatTargetId = null;

    const cur = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    const next = { x: cur.x + dx, y: cur.y + dy };
    if (this.world.canStep(cur.x, cur.y, next.x, next.y)) {
      this.player.path = [next];
    } else if (dx !== 0 && this.world.canStep(cur.x, cur.y, cur.x + dx, cur.y)) {
      this.player.path = [{ x: cur.x + dx, y: cur.y }];
    } else if (dy !== 0 && this.world.canStep(cur.x, cur.y, cur.x, cur.y + dy)) {
      this.player.path = [{ x: cur.x, y: cur.y + dy }];
    }
  }

  private checkArrival() {
    if (!this.pendingInteraction || this.player.path.length > 0) return;
    const pi = this.pendingInteraction;
    const pos = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    if (!isSameOrAdjacent(pos, { x: pi.x, y: pi.y })) {
      this.pendingInteraction = null;
      return;
    }
    this.pendingInteraction = null;
    this.executeInteraction(pi);
  }

  private faceGatheringTarget(x: number, _y: number) {
    const dx = x - this.player.x;
    if (dx < 0) this.player.facing = 'left';
    else if (dx > 0) this.player.facing = 'right';
    else if (this.player.facing !== 'left' && this.player.facing !== 'right') this.player.facing = 'right';
  }

  private executeInteraction(pi: PendingInteraction) {
    const { world, player } = this;
    if (pi.type === 'gather') this.faceGatheringTarget(pi.x, pi.y);
    else player.facing = facingFromDelta(pi.x - player.x, pi.y - player.y, player.facing);

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
    } else if (pi.type === 'plane_link') {
      this.usePlaneLink(pi.x, pi.y);
    }
  }

  private usePlaneLink(x: number, y: number) {
    const endpoint = this.world.getPlaneLink(x, y);
    if (!endpoint) return;
    const { destination, link } = endpoint;
    const destinationTile = this.world.getTile(destination.x, destination.y, destination.plane);
    if (!TILE_VISUALS[destinationTile].walkable) {
      log(`The ${link.kind.replace('_', ' ')} has no walkable destination yet.`, 'warning');
      return;
    }
    this.player.action = null;
    this.player.path = [];
    this.player.combatTargetId = null;
    this.player.plane = destination.plane;
    this.world.setActivePlane(destination.plane);
    this.player.x = destination.x;
    this.player.y = destination.y;
    log(destination.plane === 0 ? 'You return to the surface.' : `You enter underground plane ${destination.plane}.`, 'info');
  }

  onOpenPlantMenu: ((x: number, y: number) => void) | null = null;
  onOpenStructure: ((x: number, y: number, type: StructureType) => void) | null = null;
  onToggleWorldMap: (() => void) | null = null;
  onOpenContextMenu: ((x: number, y: number, items: GameContextMenuItem[]) => void) | null = null;

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

  private walkHere(target: Point, occupied: boolean) {
    this.player.action = null;
    this.player.combatTargetId = null;
    this.pendingInteraction = null;
    this.player.path = [];
    const start = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    const destination = occupied ? nearestAdjacentWalkable(this.world, start, target) : target;
    if (!destination) { log("You can't reach that spot.", 'warning'); return; }
    const path = bfsPath(this.world, start, destination);
    if (path) this.player.path = path;
    else log("You can't find a path there.", 'warning');
  }

  private monsterAt(tile: Point): Monster | undefined {
    return this.world.monsters.find((m) => m.isAlive() && Math.round(m.x) === tile.x && Math.round(m.y) === tile.y);
  }

  private activateResource(tile: Point, resource: ResourceType) {
    if (!this.world.isResourceAvailable(tile.x, tile.y)) {
      log(`The ${resourceLabel(resource)} is exhausted.`, 'info');
      return;
    }
    if (resource === 'farm_patch' || resource === 'herb_patch') {
      const crop = this.world.getCropState(tile.x, tile.y);
      if (crop && crop.ready) this.moveAdjacentThen({ type: 'harvest', x: tile.x, y: tile.y });
      else if (crop) log('This patch is still growing.', 'info');
      else this.moveAdjacentThen({ type: 'plant_menu', x: tile.x, y: tile.y });
    } else {
      this.moveAdjacentThen({ type: 'gather', x: tile.x, y: tile.y });
    }
  }

  private handleTileClick(tile: Point) {
    if (this.buildMode) {
      placeStructure(this.world, this.player, this.buildMode, tile.x, tile.y);
      this.buildMode = null;
      return;
    }

    const link = this.world.getPlaneLink(tile.x, tile.y);
    if (link) {
      this.moveAdjacentThen({ type: 'plane_link', x: tile.x, y: tile.y });
      return;
    }

    const monster = this.monsterAt(tile);
    if (monster) {
      this.player.action = null;
      this.player.path = [];
      this.pendingInteraction = null;
      playerAttack(this.player, monster);
      return;
    }

    const structure = this.world.getStructure(tile.x, tile.y);
    if (structure && structure !== 'blocker') {
      this.moveAdjacentThen({ type: 'structure', x: tile.x, y: tile.y, structureType: structure });
      return;
    }

    const resource = this.world.getResourceNode(tile.x, tile.y);
    if (resource && this.world.isResourceAvailable(tile.x, tile.y)) {
      this.activateResource(tile, resource);
      return;
    }
    this.moveTo(tile);
  }

  private resourceActionLabel(resource: ResourceType, tile: Point): string {
    if (resource.startsWith('tree_')) {
      const name = resourceLabel(resource).replace(/ tree$/i, '');
      return `Cut ${name}`;
    }
    if (resource.startsWith('rock_')) {
      const name = resourceLabel(resource).replace(/ rock$/i, '');
      return `Mine ${name}`;
    }
    if (resource.startsWith('fishing_')) return 'Fish';
    if (resource === 'flax_plant') return 'Pick Flax';
    if (resource === 'farm_patch' || resource === 'herb_patch') {
      const crop = this.world.getCropState(tile.x, tile.y);
      return crop?.ready ? 'Harvest' : `Use ${resourceLabel(resource)}`;
    }
    return `Gather ${resourceLabel(resource)}`;
  }

  private structureName(structure: StructureType): string {
    return structure.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private structureActionLabel(structure: StructureType): string {
    const name = this.structureName(structure);
    if (structure === 'bank_chest' || structure === 'storage_chest') return `Open ${name}`;
    if (structure === 'general_store') return `Trade ${name}`;
    if (structure === 'bed') return 'Rest';
    return `Use ${name}`;
  }

  private attackLevelColor(monsterLevel: number): string | undefined {
    const difference = Math.abs(monsterLevel - this.player.combatLevel());
    if (difference <= 5) return '#55d86b';
    if (difference > 30) return '#e85a5a';
    if (difference > 10) return '#f2d35c';
    return undefined;
  }

  private contextMenuForTile(tile: Point): GameContextMenuItem[] {
    const monster = this.monsterAt(tile);
    const structure = this.world.getStructure(tile.x, tile.y);
    const resource = this.world.getResourceNode(tile.x, tile.y);
    const link = this.world.getPlaneLink(tile.x, tile.y);
    const items: GameContextMenuItem[] = [];

    if (monster) {
      const def = monster.def();
      items.push({
        label: `Attack ${def.name} - Level `,
        levelText: String(def.level),
        levelColor: this.attackLevelColor(def.level),
        onClick: () => {
          this.player.action = null;
          this.player.path = [];
          this.pendingInteraction = null;
          playerAttack(this.player, monster);
        },
      });
    } else if (link) {
      items.push({ label: `Use ${link.link.kind.replace(/_/g, ' ')}`, onClick: () => this.moveAdjacentThen({ type: 'plane_link', x: tile.x, y: tile.y }) });
    } else if (structure && structure !== 'blocker') {
      items.push({
        label: this.structureActionLabel(structure),
        onClick: () => this.moveAdjacentThen({ type: 'structure', x: tile.x, y: tile.y, structureType: structure }),
      });
    } else if (resource) {
      items.push({ label: this.resourceActionLabel(resource, tile), onClick: () => this.activateResource(tile, resource) });
    }

    const occupied = !!monster || !!structure || (!!resource && this.world.isResourceAvailable(tile.x, tile.y));
    items.push({ label: 'Walk here', onClick: () => this.walkHere(tile, occupied) });

    if (monster) {
      const def = monster.def();
      items.push({
        label: 'Examine',
        onClick: () => log(`${def.name}, combat level ${def.level}. ${def.aggressive ? 'It looks hostile.' : 'It does not attack unless provoked.'}`, 'info'),
      });
    } else if (structure && structure !== 'blocker') {
      items.push({ label: 'Examine', onClick: () => log(`You examine the ${this.structureName(structure).toLowerCase()}.`, 'info') });
    } else if (resource) {
      items.push({ label: 'Examine', onClick: () => log(`You examine the ${resourceLabel(resource).toLowerCase()}.`, 'info') });
    } else {
      const tileType = this.world.getTile(tile.x, tile.y);
      const name = tileType.replace(/_/g, ' ');
      items.push({ label: 'Examine', onClick: () => log(`It's ${name}.`, 'info') });
    }

    items.push({ label: 'Cancel', onClick: () => {} });
    return items;
  }

  private handleClick(screenX: number, screenY: number) {
    const tile = this.renderer.screenToWorldTile(screenX, screenY, this.player);
    this.handleTileClick(tile);
  }

  private bindInput() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.handleClick(e.clientX - rect.left, e.clientY - rect.top);
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const tile = this.renderer.screenToWorldTile(e.clientX - rect.left, e.clientY - rect.top, this.player);
      this.onOpenContextMenu?.(e.clientX, e.clientY, this.contextMenuForTile(tile));
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
