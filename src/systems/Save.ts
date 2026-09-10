import { Player } from '../entities/Player';
import { World } from '../world/World';
import type { ChunkDiffs } from '../world/Chunk';
import { log } from '../core/EventBus';
import { TWIN_LANDS_SEED, WORLD_SIZE } from '../world/AeldorData';
import type { WorldPlane } from '../world/types';

const SAVE_KEY = 'massrpg_save_v1';
const AUTOSAVE_MS = 20000;
const AUTHORED_WORLD_REVISION = 4;
const WORLD_CENTER = Math.floor(WORLD_SIZE / 2);

interface SaveData {
  version: 1 | 2 | 3;
  worldRevision?: number;
  seed: number;
  tick: number;
  player: {
    name: string;
    x: number; y: number;
    plane?: WorldPlane;
    skillsXp: Record<string, number>;
    currentHp: number;
    combatStyle: string;
    inventory: ({ itemId: string; qty: number } | null)[];
    equipment: Record<string, string>;
    respawnPoint: { x: number; y: number; plane?: WorldPlane };
  };
  bank: ({ itemId: string; qty: number } | null)[];
  chunkDiffs: Record<string, ChunkDiffs>;
}

export function saveGame(world: World, player: Player) {
  const data: SaveData = {
    version: 3,
    worldRevision: AUTHORED_WORLD_REVISION,
    seed: world.seed,
    tick: world.tick,
    player: {
      name: player.name,
      x: player.x, y: player.y, plane: player.plane,
      skillsXp: player.skillsXp,
      currentHp: player.currentHp,
      combatStyle: player.combatStyle,
      inventory: player.inventory,
      equipment: player.equipment as Record<string, string>,
      respawnPoint: player.respawnPoint,
    },
    bank: world.bank,
    chunkDiffs: world.serializeDiffs(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    log('Game saved.', 'info');
  } catch {
    log('Could not save the game (storage full?).', 'warning');
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function loadGame(): { world: World; player: Player } | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    const migratedWorld = data.worldRevision !== AUTHORED_WORLD_REVISION;
    const world = new World(migratedWorld ? TWIN_LANDS_SEED : data.seed);
    world.tick = data.tick;
    world.bank = data.bank ?? [];
    if (!migratedWorld) world.loadSavedDiffs(data.chunkDiffs ?? {});

    const player = new Player();
    player.name = data.player.name;
    player.skillsXp = { ...player.skillsXp, ...data.player.skillsXp };
    player.currentHp = data.player.currentHp;
    player.combatStyle = data.player.combatStyle as Player['combatStyle'];
    player.inventory = data.player.inventory;
    player.equipment = data.player.equipment as Player['equipment'];

    if (migratedWorld) {
      player.x = WORLD_CENTER;
      player.y = WORLD_CENTER;
      player.plane = 0;
      player.respawnPoint = { x: WORLD_CENTER, y: WORLD_CENTER, plane: 0 };
      log('World elevation and underground planes were introduced. Your character was moved safely to the surface centre.', 'info');
    } else {
      player.x = data.player.x;
      player.y = data.player.y;
      player.plane = data.player.plane === -1 || data.player.plane === -2 ? data.player.plane : 0;
      player.respawnPoint = {
        x: data.player.respawnPoint.x,
        y: data.player.respawnPoint.y,
        plane: data.player.respawnPoint.plane === -1 || data.player.respawnPoint.plane === -2 ? data.player.respawnPoint.plane : 0,
      };
    }
    world.setActivePlane(player.plane);

    return { world, player };
  } catch {
    log('Save file was corrupted and could not be loaded.', 'warning');
    return null;
  }
}

let autosaveTimer: ReturnType<typeof setInterval> | null = null;
export function startAutosave(world: World, player: Player) {
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = setInterval(() => saveGame(world, player), AUTOSAVE_MS);
}
