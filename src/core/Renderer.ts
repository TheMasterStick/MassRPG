import { TILE_SIZE } from './constants';
import type { World } from '../world/World';
import type { Player } from '../entities/Player';
import type { Monster } from '../entities/Monster';
import { TILE_VISUALS } from '../world/types';
import { hash2D } from './Random';
import { RESOURCE_NAMES } from '../data/biomes';
import type { ResourceType, StructureType } from '../world/types';
import { getSprite, getPlayerSprite, preloadAllSprites } from './Sprites';

interface FloatingText { x: number; y: number; text: string; color: string; born: number; }

// How many tiles wide one repeat of a ground texture spans. Sprite art
// arrives at all kinds of resolutions (hand-drawn 32px pixel art, or a
// large detailed digital painting meant to tile); rather than squishing
// the whole image into a single 32px tile (which flattens detailed
// textures into near-nothing), it's tiled as a repeating pattern anchored
// to world space, so the same texture reads consistently across every
// tile of that type without swimming as the camera pans.
const TILE_TEXTURE_REPEAT_TILES = 6;

// Monsters render a bit bigger than their tile, and with a red outline, so
// they read clearly against busy ground textures instead of blending in.
const MONSTER_RENDER_SCALE = 1.25;
const MONSTER_OUTLINE_PX = 3;

// Drawn only as a fallback until a matching PNG exists in public/sprites/
// (see public/sprites/README.md for the exact filenames expected).
const RESOURCE_GLYPH: Record<ResourceType, { glyph: string; color: string }> = {
  tree_normal: { glyph: '♣', color: '#2e6b2b' },
  tree_oak: { glyph: '♣', color: '#3f7d34' },
  tree_willow: { glyph: '♣', color: '#4f8f52' },
  tree_maple: { glyph: '♣', color: '#7a9c3f' },
  tree_yew: { glyph: '♣', color: '#1f4d2e' },
  tree_magic: { glyph: '♣', color: '#5e3f9c' },
  rock_copper: { glyph: '◆', color: '#c67a3d' },
  rock_tin: { glyph: '◆', color: '#b7b7b7' },
  rock_iron: { glyph: '◆', color: '#8a6a56' },
  rock_coal: { glyph: '◆', color: '#2b2b2b' },
  rock_mithril: { glyph: '◆', color: '#4f6fc4' },
  rock_adamant: { glyph: '◆', color: '#3f8f5f' },
  rock_rune: { glyph: '◆', color: '#4fd0e0' },
  rock_gold: { glyph: '◆', color: '#e0c33f' },
  rock_silver: { glyph: '◆', color: '#d6d6e0' },
  rock_gem: { glyph: '◆', color: '#d060c0' },
  fishing_shrimp: { glyph: '≈', color: '#bfe4ff' },
  fishing_lobster: { glyph: '≈', color: '#7fd0ff' },
  fishing_swordfish: { glyph: '≈', color: '#4fb0ff' },
  farm_patch: { glyph: '☷', color: '#7a5a3a' },
  herb_patch: { glyph: '⚘', color: '#4a8a3a' },
  flax_plant: { glyph: '⚘', color: '#6a9a4a' },
};

const STRUCTURE_GLYPH: Record<StructureType, { glyph: string; color: string }> = {
  bank_chest: { glyph: '♜', color: '#d4af37' },
  furnace: { glyph: '▲', color: '#7a4a2a' },
  anvil: { glyph: '■', color: '#555' },
  cooking_range: { glyph: '■', color: '#8a5a3a' },
  campfire: { glyph: '♨', color: '#e0662a' },
  workbench: { glyph: '⬚', color: '#8a6a3a' },
  fence: { glyph: '▓', color: '#9a7a4a' },
  wall: { glyph: '█', color: '#888' },
  wall_window: { glyph: '▦', color: '#7fa8c9' },
  wall_brick: { glyph: '█', color: '#a04a3a' },
  wall_stone: { glyph: '█', color: '#8a8a8a' },
  wall_cobble: { glyph: '█', color: '#9a958a' },
  bed: { glyph: '▬', color: '#7a5a9a' },
  storage_chest: { glyph: '▣', color: '#a0763f' },
  tannery: { glyph: '■', color: '#6a4a2a' },
  loom: { glyph: '⬡', color: '#6a5a3a' },
  general_store: { glyph: '⚑', color: '#3a6ac0' },
};

// A y-sorted "world object" drawn after the ground plane, so tall sprites
// (a tree taller than one tile, a big monster) occlude correctly against
// whatever is a row above/below them instead of always drawing on top.
interface Drawable { sortY: number; draw: () => void }

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private floatingTexts: FloatingText[] = [];
  private patternCache = new Map<HTMLImageElement, CanvasPattern>();
  private outlineCache = new Map<string, HTMLCanvasElement>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    preloadAllSprites();
  }

  addFloatingText(x: number, y: number, text: string, color: string) {
    this.floatingTexts.push({ x, y, text, color, born: performance.now() });
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Sprite art here is large, detailed digital painting scaled down to
    // tile size, not native small pixel grids - smooth, high-quality
    // downscaling looks right for that; nearest-neighbour would alias badly.
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  screenToWorldTile(screenX: number, screenY: number, player: Player): { x: number; y: number } {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const camX = player.x * TILE_SIZE - w / 2;
    const camY = player.y * TILE_SIZE - h / 2;
    return { x: Math.floor((screenX + camX) / TILE_SIZE), y: Math.floor((screenY + camY) / TILE_SIZE) };
  }

  render(world: World, player: Player, monsters: Monster[], hoverTile: { x: number; y: number } | null) {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const camX = player.x * TILE_SIZE - w / 2;
    const camY = player.y * TILE_SIZE - h / 2;

    const minTX = Math.floor(camX / TILE_SIZE) - 1;
    const maxTX = Math.floor((camX + w) / TILE_SIZE) + 1;
    const minTY = Math.floor(camY / TILE_SIZE) - 1;
    const maxTY = Math.floor((camY + h) / TILE_SIZE) + 1;

    const objects: Drawable[] = [];
    const tilePatchGroups = new Map<HTMLImageElement, { sx: number; sy: number }[]>();

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        const sx = tx * TILE_SIZE - camX;
        const sy = ty * TILE_SIZE - camY;
        const tile = world.getTile(tx, ty);
        const variantIdx = Math.floor(hash2D(1337, tx, ty) * 3);
        const sprite = (variantIdx > 0 && getSprite('tiles', `${tile}_${variantIdx}`)) || getSprite('tiles', tile);
        if (sprite) {
          let group = tilePatchGroups.get(sprite);
          if (!group) { group = []; tilePatchGroups.set(sprite, group); }
          group.push({ sx, sy });
        } else {
          const visual = TILE_VISUALS[tile];
          ctx.fillStyle = visual.variants[variantIdx] ?? visual.base;
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        }

        const structure = world.getStructure(tx, ty);
        if (structure) {
          objects.push({ sortY: ty, draw: () => this.drawStructure(sx, sy, structure) });
        } else if (world.isResourceAvailable(tx, ty)) {
          const res = world.getResourceNode(tx, ty)!;
          objects.push({ sortY: ty, draw: () => this.drawResource(sx, sy, res, tx, ty, world) });
        }
      }
    }

    for (const [sprite, cells] of tilePatchGroups) this.paintTilePattern(sprite, cells, camX, camY);

    for (const m of monsters) {
      if (!m.isAlive()) continue;
      objects.push({ sortY: m.y, draw: () => this.drawMonster(m.x * TILE_SIZE - camX, m.y * TILE_SIZE - camY, m) });
    }
    objects.push({ sortY: player.y, draw: () => this.drawPlayer(player.x * TILE_SIZE - camX, player.y * TILE_SIZE - camY, player) });

    objects.sort((a, b) => a.sortY - b.sortY);
    for (const obj of objects) obj.draw();

    this.drawRoofs(world, player, camX, camY, minTX, maxTX, minTY, maxTY);

    if (hoverTile) {
      const sx = hoverTile.x * TILE_SIZE - camX;
      const sy = hoverTile.y * TILE_SIZE - camY;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }

    this.drawFloatingTexts(camX, camY);
  }

  /** Draws an image anchored to the bottom-center of a tile, preserving its aspect ratio at a fixed tile-width. Lets tall art (trees, big monsters) rise above their own tile without distortion. `flip` mirrors art that's only drawn facing right (monsters) so it can face left too. */
  private drawSpriteOnTile(img: HTMLImageElement, sx: number, sy: number, widthMul = 1, flip = false) {
    const dw = TILE_SIZE * widthMul;
    const dh = dw * (img.naturalHeight / img.naturalWidth);
    const dx = sx + TILE_SIZE / 2 - dw / 2;
    const dy = sy + TILE_SIZE - dh;
    if (!flip) { this.ctx.drawImage(img, dx, dy, dw, dh); return; }
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, dw, dh);
    ctx.restore();
  }

  // The eave-trimmed "side" roof piece is drawn facing outward on whichever edge
  // it's on (rotated so the trim always points away from the building's center),
  // wrapping the whole perimeter instead of just the front row.
  private static readonly ROOF_EDGE_ROTATION: Record<'top' | 'bottom' | 'left' | 'right', number> = {
    bottom: 0, top: Math.PI, left: Math.PI / 2, right: -Math.PI / 2,
  };

  /** Roofs draw as a final overlay above everything (walls, furniture, monsters, the player) so buildings read correctly from outside, but are skipped entirely for whichever single building the player is currently standing inside, so its interior is visible. Building footprints are tiny, so each tile is drawn individually (rather than pattern-tiled like ground textures) so the edge pieces can be rotated per side. */
  private drawRoofs(
    world: World, player: Player, camX: number, camY: number,
    minTX: number, maxTX: number, minTY: number, maxTY: number,
  ) {
    const ctx = this.ctx;
    const playerBuilding = world.gen.buildingOriginAt(Math.round(player.x), Math.round(player.y));

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        const roof = world.gen.roofCellAt(tx, ty);
        if (!roof) continue;
        if (playerBuilding && playerBuilding.originX === roof.originX && playerBuilding.originY === roof.originY) continue;
        const sx = tx * TILE_SIZE - camX;
        const sy = ty * TILE_SIZE - camY;
        if (roof.edge === 'none') {
          const sprite = getSprite('roof', `${roof.roof}_middle`);
          if (sprite) ctx.drawImage(sprite, sx, sy, TILE_SIZE, TILE_SIZE);
          continue;
        }
        const sprite = getSprite('roof', `${roof.roof}_side`);
        if (!sprite) continue;
        ctx.save();
        ctx.translate(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
        ctx.rotate(Renderer.ROOF_EDGE_ROTATION[roof.edge]);
        ctx.drawImage(sprite, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        ctx.restore();
      }
    }
  }

  private getTilePattern(img: HTMLImageElement): CanvasPattern {
    let pattern = this.patternCache.get(img);
    if (!pattern) {
      pattern = this.ctx.createPattern(img, 'repeat')!;
      this.patternCache.set(img, pattern);
    }
    return pattern;
  }

  /** Fills every cell using this ground texture as one continuous pattern anchored to world space, rather than squishing the whole image into each 32px tile individually. */
  private paintTilePattern(img: HTMLImageElement, cells: { sx: number; sy: number }[], camX: number, camY: number) {
    const ctx = this.ctx;
    const pattern = this.getTilePattern(img);
    const repeatWorldPx = TILE_SIZE * TILE_TEXTURE_REPEAT_TILES;
    const scale = repeatWorldPx / img.naturalWidth;
    pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, -camX, -camY]));

    ctx.save();
    ctx.beginPath();
    for (const c of cells) ctx.rect(c.sx, c.sy, TILE_SIZE, TILE_SIZE);
    ctx.clip();
    ctx.fillStyle = pattern;
    let minSx = Infinity, minSy = Infinity, maxSx = -Infinity, maxSy = -Infinity;
    for (const c of cells) {
      minSx = Math.min(minSx, c.sx); minSy = Math.min(minSy, c.sy);
      maxSx = Math.max(maxSx, c.sx); maxSy = Math.max(maxSy, c.sy);
    }
    ctx.fillRect(minSx, minSy, maxSx - minSx + TILE_SIZE, maxSy - minSy + TILE_SIZE);
    ctx.restore();
  }

  private drawResource(sx: number, sy: number, res: ResourceType, tx: number, ty: number, world: World) {
    const ctx = this.ctx;
    if (res === 'farm_patch' || res === 'herb_patch') {
      const crop = world.getCropState(tx, ty);
      const stageId = crop ? (crop.ready ? 'bloom' : 'sown') : 'empty';
      const sprite = (res === 'farm_patch' && getSprite('resources', `farm_patch_${stageId}`)) || getSprite('resources', res);
      if (sprite) ctx.drawImage(sprite, sx, sy, TILE_SIZE, TILE_SIZE);
      else { ctx.fillStyle = '#4a3323'; ctx.fillRect(sx + 3, sy + 3, TILE_SIZE - 6, TILE_SIZE - 6); }
      // Only needed as an overlay when no dedicated per-stage art exists for this patch type (e.g. herb_patch).
      if (crop && !(res === 'farm_patch' && getSprite('resources', `farm_patch_${stageId}`))) {
        ctx.fillStyle = crop.ready ? '#5fbf4a' : '#3f7f3a';
        const size = 4 + crop.progress * 10;
        ctx.beginPath();
        ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2, size, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    const sprite = getSprite('resources', res);
    if (sprite) { this.drawSpriteOnTile(sprite, sx, sy); return; }

    const info = RESOURCE_GLYPH[res];
    ctx.fillStyle = info.color;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.glyph, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2 + 1);
  }

  private drawStructure(sx: number, sy: number, type: StructureType) {
    const ctx = this.ctx;
    const sprite = getSprite('structures', type);
    if (sprite) { this.drawSpriteOnTile(sprite, sx, sy); return; }

    const info = STRUCTURE_GLYPH[type];
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.fillStyle = info.color;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.glyph, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2 + 1);
  }

  /** Builds (and caches) a red-outlined version of a monster sprite at a fixed draw size: the sprite drawn several times around its own edge and flattened to solid red, then the real art on top. Cached per image/flip/size since none of those change between frames for a given monster type. */
  private getOutlinedMonsterSprite(img: HTMLImageElement, flip: boolean, dw: number, dh: number): HTMLCanvasElement {
    const key = `${img.src}|${flip}|${Math.round(dw)}x${Math.round(dh)}`;
    const cached = this.outlineCache.get(key);
    if (cached) return cached;

    const pad = MONSTER_OUTLINE_PX;
    const canvas = document.createElement('canvas');
    canvas.width = dw + pad * 2;
    canvas.height = dh + pad * 2;
    const octx = canvas.getContext('2d')!;
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';

    const drawBase = (ox: number, oy: number) => {
      if (!flip) { octx.drawImage(img, ox, oy, dw, dh); return; }
      octx.save();
      octx.translate(ox + dw, oy);
      octx.scale(-1, 1);
      octx.drawImage(img, 0, 0, dw, dh);
      octx.restore();
    };

    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      drawBase(pad + Math.cos(angle) * pad, pad + Math.sin(angle) * pad);
    }
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = '#ff2222';
    octx.fillRect(0, 0, canvas.width, canvas.height);
    octx.globalCompositeOperation = 'source-over';

    drawBase(pad, pad);

    this.outlineCache.set(key, canvas);
    return canvas;
  }

  private drawMonster(sx: number, sy: number, m: Monster) {
    const ctx = this.ctx;
    const def = m.def();
    const sprite = getSprite('monsters', m.defId);
    if (sprite) {
      const dw = TILE_SIZE * def.size * MONSTER_RENDER_SCALE;
      const dh = dw * (sprite.naturalHeight / sprite.naturalWidth);
      const outlined = this.getOutlinedMonsterSprite(sprite, m.facing === 'left', dw, dh);
      const pad = MONSTER_OUTLINE_PX;
      ctx.drawImage(outlined, sx + TILE_SIZE / 2 - dw / 2 - pad, sy + TILE_SIZE - dh - pad);
    } else {
      const r = 8 * def.size * MONSTER_RENDER_SCALE;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff2222';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (m.currentHp < m.maxHp) {
      const barW = TILE_SIZE - 8;
      const pct = Math.max(0, m.currentHp / m.maxHp);
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(sx + 4, sy - 6, barW, 4);
      ctx.fillStyle = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#e53935';
      ctx.fillRect(sx + 4, sy - 6, barW * pct, 4);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${def.name} (${def.level})`, sx + TILE_SIZE / 2, sy - 9);
  }

  /** Picks the right player frame: mid-gather tool animation, walk cycle while moving, or idle facing sprite. */
  private resolvePlayerSprite(player: Player): HTMLImageElement | null {
    if (player.action?.type === 'gather') {
      const resource = player.action.resourceOrRecipeId;
      const tool = resource.startsWith('tree_') ? 'axe' : resource.startsWith('rock_') ? 'pickaxe' : null;
      if (tool) {
        const swinging = player.action.ticksRemaining <= 1;
        const frame = getSprite('player', `${tool}_${swinging ? 'swing' : 'prepare'}`);
        if (frame) return frame;
      }
    }
    if (player.path.length > 0) {
      const walkFrame = Math.floor(performance.now() / 220) % 2 === 0 ? '1' : '2';
      const walking = getSprite('player', `${player.facing}_walk${walkFrame}`);
      if (walking) return walking;
    }
    return getPlayerSprite(player.facing);
  }

  private drawPlayer(sx: number, sy: number, player: Player) {
    const ctx = this.ctx;
    const sprite = this.resolvePlayerSprite(player);
    if (sprite) {
      this.drawSpriteOnTile(sprite, sx, sy);
    } else {
      const cx = sx + TILE_SIZE / 2;
      const cy = sy + TILE_SIZE / 2;
      ctx.fillStyle = '#f2c078';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a4a1a';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#2255cc';
      const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.facing];
      ctx.beginPath();
      ctx.arc(cx + dir[0] * 6, cy + dir[1] * 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const barW = TILE_SIZE - 4;
    const pct = Math.max(0, player.currentHp / player.maxHp());
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(sx + 2, sy - 8, barW, 5);
    ctx.fillStyle = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#e53935';
    ctx.fillRect(sx + 2, sy - 8, barW * pct, 5);
  }

  private drawFloatingTexts(camX: number, camY: number) {
    const ctx = this.ctx;
    const now = performance.now();
    this.floatingTexts = this.floatingTexts.filter((t) => now - t.born < 900);
    for (const t of this.floatingTexts) {
      const age = (now - t.born) / 900;
      const sx = t.x * TILE_SIZE - camX + TILE_SIZE / 2;
      const sy = t.y * TILE_SIZE - camY - age * 20;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, sx, sy);
      ctx.globalAlpha = 1;
    }
  }

  static resourceName(res: ResourceType): string {
    return RESOURCE_NAMES[res];
  }
}
