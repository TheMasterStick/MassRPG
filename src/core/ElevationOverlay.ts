import { TILE_SIZE } from './constants';
import type { Player } from '../entities/Player';
import { isHighElevationBarrier, type World } from '../world/World';
import type { TileType } from '../world/types';
import { getElevationSprite, type ElevationTheme } from './Sprites';

interface ElevationArt {
  suffix: string;
  flipX?: boolean;
}

function elevationTheme(tile: TileType): ElevationTheme | null {
  if (tile === 'grass' || tile === 'plains') return 'grass';
  if (tile === 'snow') return 'snow';
  if (tile === 'desert') return 'desert';
  return null;
}

/**
 * Match the approved sprite catalogue: crevice art lives on the lower tile when
 * the high ground is north/east/west, while cliff art lives on the high tile
 * when the drop is south/east/west. East/west-only missing orientations are
 * mirrored from their approved canonical counterpart.
 */
function chooseElevationArt(
  here: number,
  north: number,
  east: number,
  south: number,
  west: number,
): ElevationArt | null {
  const northHigher = north - here >= 2;
  const eastHigher = east - here >= 2;
  const westHigher = west - here >= 2;
  const southLower = here - south >= 2;
  const eastLower = here - east >= 2;
  const westLower = here - west >= 2;

  if (northHigher && eastHigher) return { suffix: 'crevice_north_east' };
  if (northHigher && westHigher) return { suffix: 'crevice_north_west' };
  if (southLower && eastLower) return { suffix: 'cliff_south_east' };
  if (southLower && westLower) return { suffix: 'cliff_south_west' };
  if (northHigher) return { suffix: 'crevice_north' };
  if (southLower) return { suffix: 'cliff_south' };
  if (eastHigher) return { suffix: 'crevice_east' };
  if (westHigher) return { suffix: 'crevice_east', flipX: true };
  if (westLower) return { suffix: 'cliff_west' };
  if (eastLower) return { suffix: 'cliff_west', flipX: true };
  return null;
}

function drawElevationSprite(
  ctx: CanvasRenderingContext2D,
  theme: ElevationTheme,
  art: ElevationArt,
  sx: number,
  sy: number,
): boolean {
  const img = getElevationSprite(theme, `${theme}_${art.suffix}`);
  if (!img) return false;
  if (art.flipX) {
    ctx.save();
    ctx.translate(sx + TILE_SIZE, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE);
    ctx.restore();
  } else {
    ctx.drawImage(img, sx, sy, TILE_SIZE, TILE_SIZE);
  }
  return true;
}

/**
 * Height cues drawn after the main renderer. Authored mountain boundaries use
 * the approved grass/snow/desert cliff artwork where available, with the older
 * dark edge treatment retained as a fallback for unsupported terrain. Gentle
 * +/-1 ambient relief only receives subtle shading and never becomes a cliff.
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
  ctx.imageSmoothingEnabled = false;
  ctx.lineCap = 'square';
  for (let ty = minTY; ty <= maxTY; ty++) {
    for (let tx = minTX; tx <= maxTX; tx++) {
      const sx = tx * TILE_SIZE - camX;
      const sy = ty * TILE_SIZE - camY;
      const hereTile = world.getTile(tx, ty);
      const northTile = world.getTile(tx, ty - 1);
      const eastTile = world.getTile(tx + 1, ty);
      const southTile = world.getTile(tx, ty + 1);
      const westTile = world.getTile(tx - 1, ty);
      const here = world.getElevation(tx, ty);
      const north = world.getElevation(tx, ty - 1);
      const east = world.getElevation(tx + 1, ty);
      const south = world.getElevation(tx, ty + 1);
      const west = world.getElevation(tx - 1, ty);
      const hereBarrier = isHighElevationBarrier(here, hereTile, world.activePlane);
      const eastBarrier = isHighElevationBarrier(east, eastTile, world.activePlane);
      const southBarrier = isHighElevationBarrier(south, southTile, world.activePlane);

      if (world.activePlane === 0 && here > 0) {
        const alpha = hereBarrier ? Math.min(0.16, 0.075 + Math.max(0, here - 2) * 0.02) : 0.035;
        ctx.fillStyle = `rgba(18,14,10,${alpha})`;
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      } else if (world.activePlane === 0 && here < 0) {
        ctx.fillStyle = 'rgba(235,242,245,.035)';
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      }

      let usedSprite = false;
      if (world.activePlane === 0) {
        const theme = elevationTheme(hereTile);
        const art = chooseElevationArt(here, north, east, south, west);
        if (theme && art) usedSprite = drawElevationSprite(ctx, theme, art, sx, sy);
      }

      // Keep the old edge treatment for terrain that does not yet have approved
      // cliff art, for loading/missing images, and for authored pass/barrier
      // transitions that are not caused by a >=2 raw elevation difference.
      if (!usedSprite) {
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
