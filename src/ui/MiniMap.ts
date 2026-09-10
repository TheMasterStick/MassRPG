import { el } from './dom';
import type { Game } from '../core/Game';
import { WORLD_SIZE } from '../world/AeldorData';
import { loadEditorWorld } from '../world/EditorWorld';
import { TILE_MAP_COLORS } from './mapColors';

const SIZE = 168;
const SCALE = 3;

export class MiniMap {
  private game: Game;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastDrawMs = 0;
  private lastX = NaN;
  private lastY = NaN;
  private lastPlane = NaN;

  constructor(container: HTMLElement, game: Game) {
    this.game = game;
    this.canvas = el('canvas', { className: 'minimap-canvas', attrs: { width: String(SIZE), height: String(SIZE) } }) as HTMLCanvasElement;
    const wrap = el('div', { className: 'minimap-wrap' }, [this.canvas]);
    container.append(wrap);
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Minimap canvas 2D context unavailable');
    this.ctx = context;
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  private handleClick(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const dx = (e.clientX - rect.left - SIZE / 2) / SCALE;
    const dy = (e.clientY - rect.top - SIZE / 2) / SCALE;
    const player = this.game.player;
    this.game.moveTo({ x: Math.round(player.x + dx), y: Math.round(player.y + dy) });
  }

  update(nowMs: number) {
    const player = this.game.player;
    const moved = Math.abs(player.x - this.lastX) >= 1 || Math.abs(player.y - this.lastY) >= 1 || player.plane !== this.lastPlane;
    if (nowMs - this.lastDrawMs < 400 && !moved) return;
    this.lastDrawMs = nowMs;
    this.lastX = player.x;
    this.lastY = player.y;
    this.lastPlane = player.plane;
    this.draw();
  }

  private draw() {
    const { world, player } = this.game;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const px = Math.round(player.x), py = Math.round(player.y);
    const radiusTiles = Math.ceil(SIZE / SCALE / 2) + 1;
    const oreDots: { x: number; y: number }[] = [];

    for (let ty = -radiusTiles; ty <= radiusTiles; ty++) {
      for (let tx = -radiusTiles; tx <= radiusTiles; tx++) {
        const wx = px + tx, wy = py + ty;
        const tile = world.getTile(wx, wy);
        const sx = SIZE / 2 + tx * SCALE, sy = SIZE / 2 + ty * SCALE;
        ctx.fillStyle = TILE_MAP_COLORS[tile] ?? '#000';
        ctx.fillRect(sx - SCALE / 2, sy - SCALE / 2, SCALE, SCALE);
        const resource = world.getResourceNode(wx, wy);
        if (resource?.startsWith('rock_')) oreDots.push({ x: sx, y: sy });

        const east = world.getElevation(wx + 1, wy);
        const south = world.getElevation(wx, wy + 1);
        const here = world.getElevation(wx, wy);
        ctx.strokeStyle = 'rgba(20,15,10,.75)';
        ctx.lineWidth = 1;
        if (Math.abs(east - here) >= 2) { ctx.beginPath(); ctx.moveTo(sx + SCALE / 2, sy - SCALE / 2); ctx.lineTo(sx + SCALE / 2, sy + SCALE / 2); ctx.stroke(); }
        if (Math.abs(south - here) >= 2) { ctx.beginPath(); ctx.moveTo(sx - SCALE / 2, sy + SCALE / 2); ctx.lineTo(sx + SCALE / 2, sy + SCALE / 2); ctx.stroke(); }
      }
    }

    ctx.fillStyle = '#000';
    for (const dot of oreDots) { ctx.beginPath(); ctx.arc(dot.x, dot.y, 1.7, 0, Math.PI * 2); ctx.fill(); }

    const data = loadEditorWorld(WORLD_SIZE);
    const worldRadius = SIZE / 2 / SCALE;
    for (const marker of data.markers) {
      if (marker.plane !== player.plane) continue;
      const dx = marker.x - px, dy = marker.y - py;
      if (Math.abs(dx) > worldRadius || Math.abs(dy) > worldRadius) continue;
      const sx = SIZE / 2 + dx * SCALE, sy = SIZE / 2 + dy * SCALE;
      ctx.fillStyle = marker.type === 'mining_area' ? '#ff8a32' : marker.type === 'castle' ? '#c391ff' : marker.type === 'city' ? '#ff7777' : '#fff';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, marker.type === 'city' || marker.type === 'castle' ? 3 : 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    for (const link of data.links) {
      for (const endpoint of [link.from, link.to]) {
        if (endpoint.plane !== player.plane) continue;
        const dx = endpoint.x - px, dy = endpoint.y - py;
        if (Math.abs(dx) > worldRadius || Math.abs(dy) > worldRadius) continue;
        const sx = SIZE / 2 + dx * SCALE, sy = SIZE / 2 + dy * SCALE;
        ctx.fillStyle = '#61e6ff';
        ctx.beginPath(); ctx.moveTo(sx, sy - 3); ctx.lineTo(sx + 3, sy + 3); ctx.lineTo(sx - 3, sy + 3); ctx.closePath(); ctx.fill();
      }
    }

    ctx.fillStyle = '#ff3030';
    for (const m of world.monsters) {
      if (!m.isAlive()) continue;
      const dx = m.x - px, dy = m.y - py;
      if (Math.abs(dx) > worldRadius || Math.abs(dy) > worldRadius) continue;
      const sx = SIZE / 2 + dx * SCALE, sy = SIZE / 2 + dy * SCALE;
      ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }

    ctx.fillStyle = '#ffee55'; ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(3, 3, 60, 14);
    ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(player.plane === 0 ? 'Surface' : `Plane ${player.plane}`, 6, 13);
  }
}
