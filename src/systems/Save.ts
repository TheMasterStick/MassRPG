import { Player } from '../entities/Player';
import { World } from '../world/World';
import type { ChunkDiffs } from '../world/Chunk';
import { log } from '../core/EventBus';
import { CAPITAL, TWIN_LANDS_SEED, WORLD_REVISION } from '../world/AeldorData';

const SAVE_KEY = 'massrpg_save_v1';
const AUTOSAVE_MS = 20000;

interface SaveData {
  version: 1 | 2;
  worldRevision?: number;
  seed: number;
  tick: number;
  player: {
    name: string;
    x: number; y: number;
    skillsXp: Record<string, number>;
    currentHp: number;
    combatStyle: string;
    inventory: ({ itemId: string; qty: number } | null)[];
    equipment: Record<string, string>;
    respawnPoint: { x: number; y: number };
  };
  bank: ({ itemId: string; qty: number } | null)[];
  chunkDiffs: Record<string, ChunkDiffs>;
}

export function saveGame(world: World, player: Player) {
  const data: SaveData = {
    version: 2,
    worldRevision: WORLD_REVISION,
    seed: world.seed,
    tick: world.tick,
    player: {
      name: player.name,
      x: player.x, y: player.y,
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
    const migratedWorld = data.worldRevision !== WORLD_REVISION;
    const world = new World(migratedWorld ? TWIN_LANDS_SEED : data.seed);
    world.tick = data.tick;
    world.bank = data.bank ?? [];

    // Old 15k-world chunk coordinates do not describe the new Twin Lands.
    // Preserve the character/bank, but deliberately discard obsolete terrain
    // diffs rather than loading chopped trees/buildings into unrelated places.
    if (!migratedWorld) world.loadSavedDiffs(data.chunkDiffs ?? {});

    const player = new Player();
    player.name = data.player.name;
    player.skillsXp = { ...player.skillsXp, ...data.player.skillsXp };
    player.currentHp = data.player.currentHp;
    player.combatStyle = data.player.combatStyle as Player['combatStyle'];
    player.inventory = data.player.inventory;
    player.equipment = data.player.equipment as Player['equipment'];

    if (migratedWorld) {
      player.x = CAPITAL.x;
      player.y = CAPITAL.y;
      player.respawnPoint = { x: CAPITAL.x, y: CAPITAL.y };
      log('The world has expanded into the Twin Lands. Your character was moved safely to Capital Town.', 'info');
    } else {
      player.x = data.player.x;
      player.y = data.player.y;
      player.respawnPoint = data.player.respawnPoint;
    }

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
