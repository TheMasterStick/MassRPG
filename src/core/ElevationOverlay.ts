import { TILE_SIZE } from './constants';
import type { Player } from '../entities/Player';
import { isHighElevationBarrier, type World } from '../world/World';
import type { TileType } from '../world/types';
import { getElevationSprite, type ElevationTheme } from './Sprites';

interface ElevationArt {
  suffix: string;
  flipX?: boolean;
}

function directElevationTheme(tile: TileType): ElevationTheme | null {
  if (tile === 'grass' || tile === 'plains' || tile === 'forest' || tile === 'swamp') return 'grass';
  if (tile === 'snow' || tile === 'taiga') return 'snow';
  if (tile === 'desert') return 'desert';
  return null;
}

/** Mountain tiles borrow the dominant surrounding biome's approved cliff set. */
function elevationTheme(tile: TileType, neighbours: TileType[]): ElevationTheme | null {
  const direct = directElevationTheme(tile);
  if (direct) return direct;
  if (tile !== 'mountain') return null;

  const counts: Record<ElevationTheme, number> = { grass: 0, snow: 0, desert: 0 };
  for (const neighbour of neighbours) {
    const theme = directElevationTheme(neighbour);
    if (theme) counts[theme]++;
  }
  if (counts.snow > counts.grass && counts.snow >= counts.desert) return 'snow';
  if (counts.desert > counts.grass && counts.desert > counts.snow) return 'desert';
  return counts.grass > 0 ? 'grass' : null;
}

/**
 * Match the approved sprite catalogue. Besides raw two-level drops, a +1 -> +2
 * transition is also a true cliff because +2 is where mountain-barrier terrain
 * begins. Same-height path-vs-barrier transitions stay on the simple fallback
 * line so mountain passes do not get painted over by misleading cliff faces.
 */
function chooseElevationArt(
  here: number,
  north: number,
  east: number,
  south: number,
  west: number,
  hereBarrier: boolean,
  northBarrier: boolean,
  eastBarrier: boolean,
  southBarrier: boolean,
  westBarrier: boolean,
): ElevationArt | null {
  const higher = (other: number, otherBarrier: boolean) =>
    other - here >= 2 || (other - here >= 1 && otherBarrier && !hereBarrier);
  const lower = (other: number, otherBarrier: boolean) =>
    here - other >= 2 || (here - other >= 1 && hereBarrier && !otherBarrier);

  const northHigher = higher(north, northBarrier);
  const eastHigher = higher(east, eastBarrier);
  const westHigher = higher(west, westBarrier);
  const southLower = lower(south, southBarrier);
  const eastLower = lower(east, eastBarrier);
  const westLower = lower(west, westBarrier);

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
      const northBarrier = isHighElevationBarrier(north, northTile, world.activePlane);
      const eastBarrier = isHighElevationBarrier(east, eastTile, world.activePlane);
      const southBarrier = isHighElevationBarrier(south, southTile, world.activePlane);
      const westBarrier = isHighElevationBarrier(west, westTile, world.activePlane);

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
        const theme = elevationTheme(hereTile, [northTile, eastTile, southTile, westTile]);
        const art = chooseElevationArt(
          here, north, east, south, west,
          hereBarrier, northBarrier, eastBarrier, southBarrier, westBarrier,
        );
        if (theme && art) usedSprite = drawElevationSprite(ctx, theme, art, sx, sy);
      }

      // Keep the old edge treatment for terrain that does not yet have approved
      // cliff art, for loading/missing images, and for authored pass/barrier
      // transitions that are not caused by a real height step.
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
