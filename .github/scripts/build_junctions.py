from pathlib import Path

# 1) Structure type variants.
p = Path('src/world/types.ts')
s = p.read_text()
old = "  | 'fence' | 'wall' | 'wall_window' | 'wall_brick' | 'wall_stone' | 'wall_cobble'\n"
new = "  | 'fence' | 'fence_l' | 'fence_t' | 'fence_r'\n  | 'wall' | 'wall_l' | 'wall_t' | 'wall_r' | 'wall_window'\n  | 'wall_brick' | 'wall_brick_l' | 'wall_brick_t' | 'wall_brick_r'\n  | 'wall_stone' | 'wall_stone_l' | 'wall_stone_t' | 'wall_stone_r'\n  | 'wall_cobble' | 'wall_cobble_l' | 'wall_cobble_t' | 'wall_cobble_r'\n"
assert old in s, 'StructureType anchor missing'
p.write_text(s.replace(old, new, 1))

# 2) Shared runtime/editor compositor. It never invents colors or textures:
# it only clips and rotates the exact existing source sprite.
Path('src/world/StructureJunctions.ts').write_text(r'''import type { StructureType } from './types';

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
''')

# 3) Editor: palette entries and exact-source renderer.
p = Path('src/editor/WorldEditorV6.ts')
s = p.read_text()
anchor = "import type { ObjectTransform, TransformableEditorCell } from '../world/EditorObjects';\n"
insert = anchor + "import { drawStructureJunction, getStructureJunction, getStructureVisualBase } from '../world/StructureJunctions';\n"
assert anchor in s, 'editor import anchor missing'
s = s.replace(anchor, insert, 1)

old = "  'fence', 'wall', 'wall_window', 'wall_brick', 'wall_stone', 'wall_cobble',\n"
new = "  'fence', 'fence_l', 'fence_t', 'fence_r',\n  'wall', 'wall_l', 'wall_t', 'wall_r', 'wall_window',\n  'wall_brick', 'wall_brick_l', 'wall_brick_t', 'wall_brick_r',\n  'wall_stone', 'wall_stone_l', 'wall_stone_t', 'wall_stone_r',\n  'wall_cobble', 'wall_cobble_l', 'wall_cobble_t', 'wall_cobble_r',\n"
assert old in s, 'editor structure list anchor missing'
s = s.replace(old, new, 1)

old = "    } else if (category === 'structures') {\n      for (const id of STRUCTURE_IDS) grid.append(paletteButton({ kind: 'structure', id }, `/sprites/structures/${id}.png`, displayName(id)));\n"
new = "    } else if (category === 'structures') {\n      for (const id of STRUCTURE_IDS) {\n        const previewId = getStructureVisualBase(id);\n        grid.append(paletteButton({ kind: 'structure', id }, `/sprites/structures/${previewId}.png`, displayName(id)));\n      }\n"
assert old in s, 'editor palette anchor missing'
s = s.replace(old, new, 1)

old = "        if (cell.structure) drawSprite(`/sprites/structures/${cell.structure}.png`, sx, sy, tilePx, '#d8c9a1', cell.structureTransform);\n"
new = "        if (cell.structure) drawStructureSprite(cell.structure, sx, sy, tilePx, cell.structureTransform);\n"
assert old in s, 'editor object draw anchor missing'
s = s.replace(old, new, 1)

anchor = "  function drawSprite(\n"
helper = r'''  function drawStructureSprite(
    type: StructureType,
    sx: number,
    sy: number,
    tilePx: number,
    transform?: ObjectTransform,
  ): void {
    const junction = getStructureJunction(type);
    const baseType = getStructureVisualBase(type);
    const img = imageFor(`/sprites/structures/${baseType}.png`, draw);
    if (img.complete && img.naturalWidth > 0) {
      const h = Math.max(tilePx, tilePx * img.naturalHeight / img.naturalWidth);
      const localX = transform ? -tilePx / 2 : sx;
      const localY = transform ? -h / 2 : sy + tilePx - h;
      if (transform) {
        ctx.save();
        ctx.translate(sx + tilePx / 2, sy + tilePx - h / 2);
        ctx.rotate(transform.rotation * Math.PI / 180);
        ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
      }
      if (junction) drawStructureJunction(ctx, img, localX, localY, tilePx, h, junction.shape, junction.base === 'fence');
      else ctx.drawImage(img, localX, localY, tilePx, h);
      if (transform) ctx.restore();
      return;
    }
    ctx.fillStyle = '#d8c9a1';
    ctx.beginPath();
    ctx.arc(sx + tilePx / 2, sy + tilePx / 2, Math.max(2, tilePx * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }

'''
assert anchor in s, 'editor drawSprite anchor missing'
s = s.replace(anchor, helper + anchor, 1)
p.write_text(s)

# 4) Runtime renderer: resolve variants to the exact existing source sprite.
p = Path('src/core/Renderer.ts')
s = p.read_text()
anchor = "import { getEditorRoofAt, getEditorStructureTransformAt, type ObjectTransform } from '../world/EditorObjects';\n"
insert = anchor + "import { drawStructureJunction, getStructureJunction, getStructureVisualBase, type StructureJunctionShape } from '../world/StructureJunctions';\n"
assert anchor in s, 'renderer import anchor missing'
s = s.replace(anchor, insert, 1)

old = "  private drawStructureShadow(sx: number, sy: number, type: StructureType) {\n    if (type === 'blocker' || type === 'campfire') return;\n    const sprite = getSprite('structures', type);\n    if (sprite) {\n      this.drawGroundShadow(sx, sy, 0.64, 0.17, 0.13);\n      this.drawProjectedShadow(sprite, sx, sy, 1, 0.04, 0.11, 0.14);\n      return;\n    }\n    if (STRUCTURE_GLYPH[type]) this.drawGroundShadow(sx, sy, 0.58, 0.14, 0.10);\n  }\n"
new = "  private drawStructureShadow(sx: number, sy: number, type: StructureType) {\n    if (type === 'blocker' || type === 'campfire') return;\n    const baseType = getStructureVisualBase(type);\n    const sprite = getSprite('structures', baseType);\n    if (sprite) {\n      this.drawGroundShadow(sx, sy, 0.64, 0.17, 0.13);\n      this.drawProjectedShadow(sprite, sx, sy, 1, 0.04, 0.11, 0.14);\n      return;\n    }\n    if (STRUCTURE_GLYPH[baseType]) this.drawGroundShadow(sx, sy, 0.58, 0.14, 0.10);\n  }\n"
assert old in s, 'renderer shadow anchor missing'
s = s.replace(old, new, 1)

anchor = "  private drawDecoration(sx: number, sy: number, decoration: EditorDecoration) {\n"
helper = r'''  private drawJunctionStructureOnTile(
    img: HTMLImageElement,
    sx: number,
    sy: number,
    shape: StructureJunctionShape,
    fenceLike: boolean,
    transform?: ObjectTransform,
  ) {
    const dw = TILE_SIZE;
    const dh = dw * (img.naturalHeight / img.naturalWidth);
    const cx = sx + TILE_SIZE / 2;
    const cy = sy + TILE_SIZE - dh / 2;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    if (transform) {
      ctx.rotate(transform.rotation * Math.PI / 180);
      ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
    }
    drawStructureJunction(ctx, img, -dw / 2, -dh / 2, dw, dh, shape, fenceLike);
    ctx.restore();
  }

'''
assert anchor in s, 'renderer decoration anchor missing'
s = s.replace(anchor, helper + anchor, 1)

old = "  private drawStructure(sx: number, sy: number, type: StructureType, transform?: ObjectTransform) {\n    if (type === 'blocker') return;\n    const ctx = this.ctx;\n    const sprite = getSprite('structures', type);\n    if (sprite) {\n      if (transform) this.drawTransformedSpriteOnTile(sprite, sx, sy, transform);\n      else this.drawSpriteOnTile(sprite, sx, sy);\n      return;\n    }\n\n    const info = STRUCTURE_GLYPH[type];\n"
new = "  private drawStructure(sx: number, sy: number, type: StructureType, transform?: ObjectTransform) {\n    if (type === 'blocker') return;\n    const ctx = this.ctx;\n    const junction = getStructureJunction(type);\n    const baseType = getStructureVisualBase(type);\n    const sprite = getSprite('structures', baseType);\n    if (sprite) {\n      if (junction) this.drawJunctionStructureOnTile(sprite, sx, sy, junction.shape, junction.base === 'fence', transform);\n      else if (transform) this.drawTransformedSpriteOnTile(sprite, sx, sy, transform);\n      else this.drawSpriteOnTile(sprite, sx, sy);\n      return;\n    }\n\n    const info = STRUCTURE_GLYPH[baseType];\n"
assert old in s, 'renderer drawStructure anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)
