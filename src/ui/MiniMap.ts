import { el } from './dom';
import type { Game } from '../core/Game';
import { TOWNS, RUINS } from '../world/AeldorData';
import { TILE_MAP_COLORS } from './mapColors';

const SIZE = 168;
const SCALE = 3; // minimap pixels per world tile

export class MiniMap {
  private game: Game;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastDrawMs = 0;
  private lastX = NaN;
  private lastY = NaN;

  constructor(container: HTMLElement, game: Game) {
    this.game = game;
    this.canvas = el('canvas', { className: 'minimap-canvas', attrs: { width: String(SIZE), height: String(SIZE) } }) as HTMLCanvasElement;
    const wrap = el('div', { className: 'minimap-wrap' }, [this.canvas]);
    container.append(wrap);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Minimap canvas 2D context unavailable');
    this.ctx = ctx;
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  private handleClick(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dx = (px - SIZE / 2) / SCALE;
    const dy = (py - SIZE / 2) / SCALE;
    const player = this.game.player;
    this.game.moveTo({ x: Math.round(player.x + dx), y: Math.round(player.y + dy) });
  }

  update(nowMs: number) {
    const player = this.game.player;
    const moved = Math.abs(player.x - this.lastX) >= 1 || Math.abs(player.y - this.lastY) >= 1;
    if (nowMs - this.lastDrawMs < 400 && !moved) return;
    this.lastDrawMs = nowMs;
    this.lastX = player.x;
    this.lastY = player.y;
    this.draw();
  }

  private draw() {
    const { world, player } = this.game;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    const px = Math.round(player.x);
    const py = Math.round(player.y);
    const radiusTiles = Math.ceil(SIZE / SCALE / 2) + 1;
    const oreDots: { x: number; y: number }[] = [];

    for (let ty = -radiusTiles; ty <= radiusTiles; ty++) {
      for (let tx = -radiusTiles; tx <= radiusTiles; tx++) {
        const wx = px + tx;
        const wy = py + ty;
        const tile = world.getTile(wx, wy);
        const sx = SIZE / 2 + tx * SCALE;
        const sy = SIZE / 2 + ty * SCALE;
        ctx.fillStyle = TILE_MAP_COLORS[tile] ?? '#000';
        ctx.fillRect(sx - SCALE / 2, sy - SCALE / 2, SCALE, SCALE);

        // Authored ore nodes are black dots on the local minimap. Depleted
        // rocks remain marked because the node itself still exists/respawns.
        const resource = world.getResourceNode(wx, wy);
        if (resource?.startsWith('rock_')) oreDots.push({ x: sx, y: sy });
      }
    }

    // Resources sit above terrain but below towns, creatures and the player.
    ctx.fillStyle = '#000000';
    for (const dot of oreDots) {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    const worldRadius = SIZE / 2 / SCALE;
    for (const t of TOWNS) {
      const dx = t.x - px;
      const dy = t.y - py;
      if (Math.abs(dx) > worldRadius || Math.abs(dy) > worldRadius) continue;
      const sx = SIZE / 2 + dx * SCALE;
      const sy = SIZE / 2 + dy * SCALE;
      ctx.fillStyle = t.capital ? '#ffd700' : '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, t.capital ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    for (const r of RUINS) {
      const dx = r.x - px;
      const dy = r.y - py;
      if (Math.abs(dx) > worldRadius || Math.abs(dy) > worldRadius) continue;
      const sx = SIZE / 2 + dx * SCALE;
      const sy = SIZE / 2 + dy * SCALE;
      ctx.fillStyle = '#c04040';
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ff3030';
    const monsterHalf = 1.5;
    for (const m of world.monsters) {
      if (!m.isAlive()) continue;
      const dx = m.x - px;
      const dy = m.y - py;
      if (Math.abs(dx) > worldRadius || Math.abs(dy) > worldRadius) continue;
      const sx = SIZE / 2 + dx * SCALE;
      const sy = SIZE / 2 + dy * SCALE;
      ctx.fillRect(sx - monsterHalf, sy - monsterHalf, monsterHalf * 2, monsterHalf * 2);
    }

    ctx.fillStyle = '#ffee55';
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
