import { TILE_SIZE } from './constants';
import type { Player } from '../entities/Player';
import type { World } from '../world/World';

/**
 * Lightweight top-down height cues drawn after the main renderer. We deliberately
 * avoid turning the game into pseudo-3D: only true 2+ level cliffs receive a
 * strong edge/shadow, while cave/stair/ladder links get a small cyan symbol.
 */
export function drawElevationAndLinks(canvas: HTMLCanvasElement, world: World, player: Player): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const camX = player.x * TILE_SIZE - w / 2;
  const camY = player.y * TILE_SIZE - h / 2;
  const minTX = Math.floor(camX / TILE_SIZE) - 1;
  const maxTX = Math.floor((camX + w) / TILE_SIZE) + 1;
  const minTY = Math.floor(camY / TILE_SIZE) - 1;
  const maxTY = Math.floor((camY + h) / TILE_SIZE) + 1;

  ctx.save();
  ctx.lineCap = 'square';
  for (let ty = minTY; ty <= maxTY; ty++) {
    for (let tx = minTX; tx <= maxTX; tx++) {
      const sx = tx * TILE_SIZE - camX;
      const sy = ty * TILE_SIZE - camY;
      const here = world.getElevation(tx, ty);
      const east = world.getElevation(tx + 1, ty);
      const south = world.getElevation(tx, ty + 1);

      if (Math.abs(east - here) >= 2) {
        ctx.strokeStyle = 'rgba(18,14,10,.82)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx + TILE_SIZE, sy);
        ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(235,225,205,.35)';
        ctx.lineWidth = 1;
        const offset = here > east ? -2 : 2;
        ctx.beginPath();
        ctx.moveTo(sx + TILE_SIZE + offset, sy);
        ctx.lineTo(sx + TILE_SIZE + offset, sy + TILE_SIZE);
        ctx.stroke();
      }
      if (Math.abs(south - here) >= 2) {
        ctx.strokeStyle = 'rgba(18,14,10,.82)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy + TILE_SIZE);
        ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(235,225,205,.35)';
        ctx.lineWidth = 1;
        const offset = here > south ? -2 : 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy + TILE_SIZE + offset);
        ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE + offset);
        ctx.stroke();
      }

      const endpoint = world.getPlaneLink(tx, ty);
      if (endpoint) {
        const cx = sx + TILE_SIZE / 2;
        const cy = sy + TILE_SIZE / 2;
        ctx.fillStyle = 'rgba(75,225,255,.92)';
        ctx.strokeStyle = '#07171b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (endpoint.destination.plane < world.activePlane) {
          ctx.moveTo(cx, cy + 7); ctx.lineTo(cx + 7, cy - 5); ctx.lineTo(cx - 7, cy - 5);
        } else {
          ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 7, cy + 5); ctx.lineTo(cx - 7, cy + 5);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }
  ctx.restore();
}
