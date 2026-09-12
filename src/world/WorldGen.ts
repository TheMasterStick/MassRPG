import type { ElevationLevel, ResourceType, StructureType, TileType } from './types';
import { getEditorMarkers, type EditorMarker } from './EditorWorld';
import { WORLD_SIZE } from './AeldorData';

/**
 * Geography is entirely hand-authored. This class supplies only a deterministic
 * ambient dressing/population layer over that authored geography: scattered
 * trees, small camp POIs, marker-driven placeholder sites, gentle un-authored
 * relief, mining clusters, and restrained creatures. Exact editor cells always
 * win, and explicit null resource/structure/spawner fields suppress fallback.
 */
export class WorldGen {
  readonly seed: number;
  private readonly markers: readonly EditorMarker[];
  private readonly capital: EditorMarker | undefined;
  private readonly miningNodes = new Map<string, ResourceType>();

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.markers = [...getEditorMarkers(WORLD_SIZE, 0)];
    this.capital = this.markers.find((m) => m.name.trim().toLowerCase() === 'capital city');
    this.buildMiningNodes();
  }

  /**
   * Settlement markers suppress ambient monsters inside the settlement footprint
   * plus a modest breathing-space buffer. The previous radii were several times
   * larger than the actual town footprints, creating very large sterile zones.
   * Mining areas remain wild.
   */
  isVillage(x: number, y: number): boolean {
    for (const marker of this.markers) {
      if (marker.type === 'mining_area') continue;
      const radius = marker.name.trim().toLowerCase() === 'capital city' ? 64
        : marker.type === 'city' ? 48
        : marker.type === 'castle' ? 40
        : marker.type === 'town' ? 36
        : marker.type === 'village' ? 28
        : 22;
      if (Math.max(Math.abs(x - marker.x), Math.abs(y - marker.y)) <= radius) return true;
    }
    return false;
  }

  /**
   * Runtime placeholder ground for reference markers. This deliberately lives
   * above natural authored terrain but below explicit path/floor construction,
   * so existing editor work remains authoritative while unbuilt settlement and
   * mine markers are actually visible during play.
   */
  markerGroundAt(x: number, y: number, tile: TileType): TileType | null {
    if (
      tile === 'deep_water' || tile === 'water' || tile === 'beach' || tile === 'void'
      || tile === 'cave_floor' || tile === 'cave_wall' || tile === 'path' || tile === 'rubble'
      || tile === 'floor_wood' || tile === 'floor_brick' || tile === 'floor_cobble'
    ) return null;

    for (const marker of this.markers) {
      const capital = marker.name.trim().toLowerCase() === 'capital city';
      const radius = marker.type === 'mining_area' ? 12
        : capital ? 48
        : marker.type === 'city' ? 36
        : marker.type === 'castle' ? 28
        : marker.type === 'town' ? 26
        : marker.type === 'village' ? 20
        : 14;
      if (Math.max(Math.abs(x - marker.x), Math.abs(y - marker.y)) <= radius) return 'floor_cobble';
    }
    return null;
  }

  /** Marker-authored mine areas get compact deterministic ore clusters. */
  miningResourceAt(x: number, y: number): ResourceType | null {
    return this.miningNodes.get(`${x},${y}`) ?? null;
  }

  /**
   * Deterministic micro-POIs. One candidate is chosen per 56x56 world-cell:
   * common enough to break up a journey, but still separated by long stretches
   * of ordinary terrain instead of forming procedural clutter.
   */
  villageStructureAt(x: number, y: number, tile: TileType): StructureType | null {
    if (
      tile !== 'grass'
      && tile !== 'plains'
      && tile !== 'forest'
      && tile !== 'taiga'
      && tile !== 'swamp'
      && tile !== 'desert'
      && tile !== 'snow'
    ) return null;

    const cellSize = 56;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    const margin = 7;
    const usable = cellSize - margin * 2;
    const anchorX = cellX * cellSize + margin + Math.floor(this.roll(cellX, cellY, 61) * usable);
    const anchorY = cellY * cellSize + margin + Math.floor(this.roll(cellX, cellY, 62) * usable);
    if (x !== anchorX || y !== anchorY) return null;
    if (this.isVillage(x, y)) return null;
    return 'campfire';
  }

  roofCellAt(_x: number, _y: number): {
    roof: 'tile' | 'tatch';
    edge: 'top' | 'bottom' | 'left' | 'right' | 'none';
    originX: number;
    originY: number;
  } | null {
    return null;
  }

  buildingOriginAt(_x: number, _y: number): { originX: number; originY: number } | null {
    return null;
  }

  tileAt(_x: number, _y: number): TileType {
    return 'deep_water';
  }

  /**
   * Gentle low-frequency relief for surface tiles that have no authored
   * elevation. It can only produce -1/0/+1, so it adds rolling terrain without
   * creating random impassable cliffs or interfering with authored mountains.
   */
  ambientElevationAt(x: number, y: number, tile: TileType): ElevationLevel {
    if (
      tile !== 'grass' && tile !== 'plains' && tile !== 'forest' && tile !== 'taiga'
      && tile !== 'swamp' && tile !== 'desert' && tile !== 'snow' && tile !== 'mountain'
    ) return 0;

    const broad = this.valueNoise(x, y, 140, 71);
    const local = this.valueNoise(x, y, 58, 72);
    const value = broad * 0.72 + local * 0.28;
    if (value > 0.46) return 1;
    if (value < -0.52) return -1;
    return 0;
  }

  /**
   * Deterministic ambient trees. Grass and plains now carry enough isolated
   * trees to keep travel visually varied, while forest/taiga remain clearly
   * denser without becoming solid walls of resource nodes.
   */
  resourceAt(
    x: number,
    y: number,
    getTile: (x: number, y: number) => TileType,
  ): ResourceType | null {
    const tile = getTile(x, y);
    const chance = tile === 'forest' ? 0.045
      : tile === 'taiga' ? 0.036
      : tile === 'swamp' ? 0.018
      : tile === 'grass' ? 0.0090
      : tile === 'plains' ? 0.0075
      : 0;
    if (chance <= 0 || this.roll(x, y, 11) >= chance) return null;

    const pick = this.roll(x, y, 12);
    if (tile === 'forest') {
      if (pick < 0.50) return 'tree_normal';
      if (pick < 0.78) return 'tree_oak';
      if (pick < 0.90) return 'tree_willow';
      if (pick < 0.98) return 'tree_maple';
      return 'tree_yew';
    }
    if (tile === 'taiga') {
      if (pick < 0.62) return 'tree_normal';
      if (pick < 0.84) return 'tree_oak';
      if (pick < 0.97) return 'tree_maple';
      return 'tree_yew';
    }
    if (tile === 'swamp') return pick < 0.70 ? 'tree_willow' : 'tree_normal';
    if (tile === 'plains') return pick < 0.74 ? 'tree_normal' : 'tree_oak';
    return pick < 0.70 ? 'tree_normal' : pick < 0.92 ? 'tree_oak' : 'tree_willow';
  }

  /**
   * Sparse deterministic wildlife/enemy population. The active 9x9 chunk area
   * should normally contain several actors, while ordinary travel still has lots
   * of open space. Authored spawns remain the tool for deliberate hotspots and
   * exceptional encounters.
   */
  monsterSpawnAt(x: number, y: number, tile: TileType): string | null {
    let chance = 0;
    if (tile === 'grass' || tile === 'plains') chance = 1 / 3000;
    else if (tile === 'forest') chance = 1 / 2600;
    else if (tile === 'taiga') chance = 1 / 3200;
    else if (tile === 'swamp') chance = 1 / 2800;
    else if (tile === 'mountain') chance = 1 / 3400;
    else if (tile === 'snow') chance = 1 / 3800;
    else if (tile === 'desert') chance = 1 / 3300;
    else return null; // paths, settlements, beaches, water, rubble/floors stay quiet

    // Cheap hash rejection first; marker scanning only happens for candidates.
    if (this.roll(x, y, 31) >= chance) return null;
    if (this.isVillage(x, y)) return null;

    const pick = this.roll(x, y, 32);
    if (tile === 'grass' || tile === 'plains') {
      if (pick < 0.34) return 'chicken';
      if (pick < 0.61) return 'cow';
      if (pick < 0.84) return 'rat';
      if (pick < 0.95) return 'goblin';
      return 'bandit';
    }
    if (tile === 'forest') {
      if (pick < 0.33) return 'rat';
      if (pick < 0.60) return 'wolf';
      if (pick < 0.82) return 'giant_spider';
      if (pick < 0.96) return 'goblin';
      return 'moss_giant';
    }
    if (tile === 'taiga') {
      if (pick < 0.58) return 'wolf';
      if (pick < 0.94) return 'frost_wolf';
      return 'troll';
    }
    if (tile === 'swamp') {
      if (pick < 0.34) return 'rat';
      if (pick < 0.62) return 'giant_spider';
      if (pick < 0.82) return 'zombie';
      if (pick < 0.95) return 'dark_wizard';
      return 'moss_giant';
    }
    if (tile === 'mountain') {
      if (pick < 0.45) return 'skeleton';
      if (pick < 0.75) return 'hobgoblin';
      if (pick < 0.90) return 'hill_giant';
      if (pick < 0.98) return 'troll';
      return 'wyvern';
    }
    if (tile === 'snow') return pick < 0.82 ? 'frost_wolf' : 'ice_troll';
    if (pick < 0.48) return 'bandit';
    if (pick < 0.78) return 'skeleton';
    if (pick < 0.92) return 'fire_giant';
    if (pick < 0.985) return 'lesser_demon';
    return 'greater_demon';
  }

  private buildMiningNodes(): void {
    const occupied = new Set<string>();
    for (const marker of this.markers) {
      if (marker.type !== 'mining_area') continue;
      const ores = this.oresForMarker(marker);
      for (let oreIndex = 0; oreIndex < ores.length; oreIndex++) {
        const ore = ores[oreIndex];
        const count = 3 + Math.floor(this.roll(marker.x, marker.y, 201 + oreIndex) * 3);
        let placed = 0;
        for (let attempt = 0; attempt < 32 && placed < count; attempt++) {
          const angle = this.roll(marker.x + oreIndex * 17, marker.y + attempt * 13, 220 + attempt) * Math.PI * 2;
          const radius = 3 + Math.floor(this.roll(marker.x + attempt * 7, marker.y - oreIndex * 11, 260 + attempt) * 8);
          const nx = marker.x + Math.round(Math.cos(angle) * radius);
          const ny = marker.y + Math.round(Math.sin(angle) * radius);
          const key = `${nx},${ny}`;
          if (occupied.has(key)) continue;
          occupied.add(key);
          this.miningNodes.set(key, ore);
          placed++;
        }
      }
    }
  }

  private oresForMarker(marker: EditorMarker): ResourceType[] {
    const text = `${marker.name} ${marker.notes ?? ''}`.toLowerCase();
    const named: Array<[RegExp, ResourceType]> = [
      [/copper/, 'rock_copper'], [/\btin\b/, 'rock_tin'], [/\biron\b/, 'rock_iron'], [/coal/, 'rock_coal'],
      [/silver/, 'rock_silver'], [/gold/, 'rock_gold'], [/mithril/, 'rock_mithril'],
      [/adamant(?:ite)?/, 'rock_adamant'], [/runite|\brune\b/, 'rock_rune'], [/dragonite/, 'rock_dragonite'], [/gem/, 'rock_gem'],
    ];
    const explicit = named.filter(([pattern]) => pattern.test(text)).map(([, ore]) => ore);
    if (explicit.length > 0) return explicit;

    const capitalX = this.capital?.x ?? WORLD_SIZE / 2;
    const capitalY = this.capital?.y ?? WORLD_SIZE / 2;
    const distance = Math.hypot(marker.x - capitalX, marker.y - capitalY);
    if (distance < 20000) return ['rock_copper', 'rock_tin'];
    if (distance < 40000) return ['rock_iron', 'rock_coal'];
    if (distance < 60000) return ['rock_coal', 'rock_silver'];
    if (distance < 80000) return ['rock_gold', 'rock_mithril'];
    if (distance < 100000) return ['rock_mithril', 'rock_adamant'];
    if (distance < 120000) return ['rock_adamant', 'rock_rune'];
    return ['rock_rune', 'rock_dragonite'];
  }

  private valueNoise(x: number, y: number, cellSize: number, salt: number): number {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    const tx = (x - gx * cellSize) / cellSize;
    const ty = (y - gy * cellSize) / cellSize;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const sample = (ix: number, iy: number) => this.roll(ix, iy, salt) * 2 - 1;
    const n00 = sample(gx, gy);
    const n10 = sample(gx + 1, gy);
    const n01 = sample(gx, gy + 1);
    const n11 = sample(gx + 1, gy + 1);
    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  }

  private roll(x: number, y: number, salt: number): number {
    let h = (this.seed ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x119de1f3) ^ Math.imul(salt, 0x27d4eb2d)) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
}
