import type { StructureType } from './types';

export type StructureJunctionShape = 'l' | 't' | 'r';
export type JunctionBaseStructure = 'fence' | 'wall' | 'wall_brick' | 'wall_stone' | 'wall_cobble';

export interface StructureJunctionInfo {
  base: JunctionBaseStructure;
  shape: StructureJunctionShape;
}

const JUNCTIONS: Partial<Record<StructureType, StructureJunctionInfo>> = {
  fence_l: { base: 'fence', shape: 'l' },
  fence_t: { base: 'fence', shape: 't' },
  fence_r: { base: 'fence', shape: 'r' },
  wall_l: { base: 'wall', shape: 'l' },
  wall_t: { base: 'wall', shape: 't' },
  wall_r: { base: 'wall', shape: 'r' },
  wall_brick_l: { base: 'wall_brick', shape: 'l' },
  wall_brick_t: { base: 'wall_brick', shape: 't' },
  wall_brick_r: { base: 'wall_brick', shape: 'r' },
  wall_stone_l: { base: 'wall_stone', shape: 'l' },
  wall_stone_t: { base: 'wall_stone', shape: 't' },
  wall_stone_r: { base: 'wall_stone', shape: 'r' },
  wall_cobble_l: { base: 'wall_cobble', shape: 'l' },
  wall_cobble_t: { base: 'wall_cobble', shape: 't' },
  wall_cobble_r: { base: 'wall_cobble', shape: 'r' },
};

export function getStructureJunction(type: StructureType): StructureJunctionInfo | undefined {
  return JUNCTIONS[type];
}

export function getStructureVisualBase(type: StructureType): StructureType {
  return JUNCTIONS[type]?.base ?? type;
}

function drawRotated90(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function clipped(
  ctx: CanvasRenderingContext2D,
  path: (ctx: CanvasRenderingContext2D) => void,
  draw: () => void,
): void {
  ctx.save();
  ctx.beginPath();
  path(ctx);
  ctx.closePath();
  ctx.clip();
  draw();
  ctx.restore();
}

/**
 * Draws an authored wall/fence junction using only the existing source sprite.
 * No generated palette, texture, lighting, or replacement art is introduced.
 * The outer object transform is applied by the caller, so one canonical L/T/r
 * junction can be rotated to every direction in both editor and game.
 */
export function drawStructureJunction(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  shape: StructureJunctionShape,
  fenceLike: boolean,
): void {
  if (fenceLike) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const overlap = Math.max(1, Math.min(width, height) * 0.06);

    const drawHorizontal = (left: number, top: number, right: number, bottom: number) => clipped(
      ctx,
      (c) => c.rect(left, top, right - left, bottom - top),
      () => ctx.drawImage(image, x, y, width, height),
    );
    const drawVertical = (left: number, top: number, right: number, bottom: number) => clipped(
      ctx,
      (c) => c.rect(left, top, right - left, bottom - top),
      () => drawRotated90(ctx, image, x, y, width, height),
    );

    if (shape === 'l') {
      drawHorizontal(x, y, cx + overlap, y + height);
      drawVertical(x, y, x + width, cy + overlap);
    } else if (shape === 'r') {
      drawHorizontal(cx - overlap, y, x + width, y + height);
      drawVertical(x, y, x + width, cy + overlap);
    } else {
      ctx.drawImage(image, x, y, width, height);
      drawVertical(x, y, x + width, cy + overlap);
    }
    return;
  }

  // Masonry wall sprites fill the whole tile. Keep the tile fully opaque and
  // bend the exact source courses through a clipped 90° section instead of
  // cutting away quarters (which would make the wall visually thinner).
  ctx.drawImage(image, x, y, width, height);
  if (shape === 'l') {
    clipped(ctx, (c) => {
      c.moveTo(x, y);
      c.lineTo(x + width, y);
      c.lineTo(x, y + height);
    }, () => drawRotated90(ctx, image, x, y, width, height));
  } else if (shape === 'r') {
    clipped(ctx, (c) => {
      c.moveTo(x, y);
      c.lineTo(x + width, y);
      c.lineTo(x + width, y + height);
    }, () => drawRotated90(ctx, image, x, y, width, height));
  } else {
    clipped(ctx, (c) => {
      c.moveTo(x, y);
      c.lineTo(x + width, y);
      c.lineTo(x + width * 0.5, y + height * 0.64);
    }, () => drawRotated90(ctx, image, x, y, width, height));
  }
}
