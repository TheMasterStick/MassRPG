import { TILE_SIZE } from './constants';
import type { Player } from '../entities/Player';
import { isHighElevationBarrier, type World } from '../world/World';

/**
 * Lightweight top-down height cues drawn after the main renderer. High authored
 * surface ground is shaded slightly, mountain-barrier boundaries receive a
 * strong edge/shadow, and cave/stair/ladder links get a small cyan symbol.
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
      const hereTile = world.getTile(tx, ty);
      const eastTile = world.getTile(tx + 1, ty);
      const southTile = world.getTile(tx, ty + 1);
      const here = world.getElevation(tx, ty);
      const east = world.getElevation(tx + 1, ty);
      const south = world.getElevation(tx, ty + 1);
      const hereBarrier = isHighElevationBarrier(here, hereTile, world.activePlane);
      const eastBarrier = isHighElevationBarrier(east, eastTile, world.activePlane);
      const southBarrier = isHighElevationBarrier(south, southTile, world.activePlane);

      // The terrain texture itself does not change with elevation, so a subtle
      // neutral shade keeps hills/mountains visible without pseudo-3D rendering.
      if (world.activePlane === 0 && here > 0) {
        const alpha = hereBarrier ? Math.min(0.16, 0.075 + Math.max(0, here - 2) * 0.02) : 0.035;
        ctx.fillStyle = `rgba(18,14,10,${alpha})`;
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      }

      const eastEdge = Math.abs(east - here) >= 2 || hereBarrier !== eastBarrier;
      if (eastEdge) {
        ctx.strokeStyle = 'rgba(18,14,10,.82)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx + TILE_SIZE, sy);
        ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(235,225,205,.35)';
        ctx.lineWidth = 1;
        const offset = here > east || hereBarrier ? -2 : 2;
        ctx.beginPath();
        ctx.moveTo(sx + TILE_SIZE + offset, sy);
        ctx.lineTo(sx + TILE_SIZE + offset, sy + TILE_SIZE);
        ctx.stroke();
      }

      const southEdge = Math.abs(south - here) >= 2 || hereBarrier !== southBarrier;
      if (southEdge) {
        ctx.strokeStyle = 'rgba(18,14,10,.82)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy + TILE_SIZE);
        ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(235,225,205,.35)';
        ctx.lineWidth = 1;
        const offset = here > south || hereBarrier ? -2 : 2;
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
