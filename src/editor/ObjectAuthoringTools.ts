import { WORLD_SIZE } from '../world/AeldorData';
import { cellKey, getPlaneData, loadEditorWorld, saveEditorWorld } from '../world/EditorWorld';
import {
  IDENTITY_OBJECT_TRANSFORM,
  type ObjectRotation,
  type ObjectTransform,
  type RoofPieceId,
  type TransformableEditorCell,
} from '../world/EditorObjects';
import type { StructureType, WorldPlane } from '../world/types';

type RoofMode = 'off' | 'erase' | RoofPieceId;

const ROOF_OPTIONS: { id: RoofMode; label: string }[] = [
  { id: 'off', label: 'Roofs: Off' },
  { id: 'erase', label: 'Roofs: Erase' },
  { id: 'tile_middle', label: 'Roof: Tile Middle' },
  { id: 'tile_side', label: 'Roof: Tile Side' },
  { id: 'tatch_middle', label: 'Roof: Thatch Middle' },
  { id: 'tatch_side', label: 'Roof: Thatch Side' },
];

/**
 * Doodad-style transforms for authored structures and roofs. The normal V6
 * structure palette remains the placement UI; these controls attach the active
 * rotation/mirror transform as structures are painted. Roof pieces are their own
 * visual layer. A transparent overlay previews both layers in editor space.
 */
export function installObjectAuthoringTools(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas')!;
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar')!;
  const wrap = canvas.parentElement!;
  if (!canvas || !toolbar || !wrap) return;

  let rotation: ObjectRotation = 0;
  let flipX = false;
  let flipY = false;
  let roofMode: RoofMode = 'off';
  let roofPainting = false;
  let lastRoofPoint: { x: number; y: number } | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let frame = 0;

  const rotateBtn = document.createElement('button');
  rotateBtn.type = 'button';
  rotateBtn.title = 'Rotate subsequently placed structures/roofs 90° clockwise. Shortcut: R.';
  const flipXBtn = document.createElement('button');
  flipXBtn.type = 'button';
  flipXBtn.title = 'Mirror subsequently placed structures/roofs horizontally. Shortcut: X.';
  const flipYBtn = document.createElement('button');
  flipYBtn.type = 'button';
  flipYBtn.title = 'Mirror subsequently placed structures/roofs vertically. Shortcut: Y.';

  const roofSelect = document.createElement('select');
  roofSelect.title = 'Paint authored roof pieces using the current rotation/mirror transform.';
  for (const optionDef of ROOF_OPTIONS) {
    const option = document.createElement('option');
    option.value = optionDef.id;
    option.textContent = optionDef.label;
    roofSelect.append(option);
  }

  function refreshButtons(): void {
    rotateBtn.textContent = `Object ${rotation}°`;
    flipXBtn.textContent = `Obj Flip X${flipX ? ' ✓' : ''}`;
    flipYBtn.textContent = `Obj Flip Y${flipY ? ' ✓' : ''}`;
    flipXBtn.style.outline = flipX ? '2px solid #e5b84f' : '';
    flipYBtn.style.outline = flipY ? '2px solid #e5b84f' : '';
  }
  refreshButtons();
  toolbar.append(rotateBtn, flipXBtn, flipYBtn, roofSelect);

  const overlay = document.createElement('canvas');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '1';
  overlay.style.imageRendering = 'pixelated';
  wrap.append(overlay);
  const overlayCtx = overlay.getContext('2d')!;
  if (!overlayCtx) return;
  const imageCache = new Map<string, HTMLImageElement>();

  function currentPlane(): WorldPlane {
    const planeSelect = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((select) => [...select.options].some((option) => option.textContent === 'Surface')
        && [...select.options].some((option) => option.value === '-1'));
    const value = Number(planeSelect?.value ?? 0);
    return value === -1 || value === -2 ? value : 0;
  }

  function currentZoom(): number {
    const zoomSelect = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((select) => select.selectedOptions[0]?.textContent?.includes('px / tile'));
    const px = Number.parseFloat(zoomSelect?.selectedOptions[0]?.textContent ?? '1');
    return Number.isFinite(px) && px > 0 ? px : 1;
  }

  function currentCenter(): { x: number; y: number } {
    const inputs = [...toolbar.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    return { x: Number(inputs[0]?.value ?? WORLD_SIZE / 2), y: Number(inputs[1]?.value ?? WORLD_SIZE / 2) };
  }

  function currentBrushSize(): number {
    const select = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((candidate) => candidate.selectedOptions[0]?.textContent?.includes('×')
        && candidate.selectedOptions[0]?.textContent?.includes('brush'));
    return Math.max(1, Number(select?.value ?? 1));
  }

  function edgeToolActive(): boolean {
    return [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .some((select) => select.selectedOptions[0]?.textContent?.startsWith('Edge tiles:') && select.value !== 'off');
  }

  function eventPoint(event: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const tilePx = currentZoom();
    const center = currentCenter();
    return {
      x: Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(center.x + (event.clientX - rect.left - rect.width / 2) / tilePx))),
      y: Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(center.y + (event.clientY - rect.top - rect.height / 2) / tilePx))),
    };
  }

  function transform(): ObjectTransform {
    return { rotation, flipX, flipY };
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveEditorWorld(loadEditorWorld(WORLD_SIZE));
    }, 180);
  }

  function applyTransformToStructure(point: { x: number; y: number }): void {
    if (roofMode !== 'off') return;
    const layer = getPlaneData(loadEditorWorld(WORLD_SIZE), currentPlane());
    const size = currentBrushSize();
    const half = Math.floor(size / 2);
    let changed = false;
    const radius = size > 129 ? 0 : half;
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        const key = cellKey(point.x + ox, point.y + oy);
        const cell = layer.cells[key] as TransformableEditorCell | undefined;
        if (!cell?.structure || cell.structure === 'blocker') continue;
        cell.structureTransform = transform();
        changed = true;
      }
    }
    if (changed) {
      scheduleSave();
      redraw();
    }
  }

  function paintRoof(point: { x: number; y: number }): void {
    if (roofMode === 'off') return;
    const layer = getPlaneData(loadEditorWorld(WORLD_SIZE), currentPlane());
    const key = cellKey(point.x, point.y);
    const cell = (layer.cells[key] ?? {}) as TransformableEditorCell;
    if (roofMode === 'erase') delete cell.roof;
    else cell.roof = { id: roofMode, transform: transform() };
    if (Object.keys(cell).length === 0) delete layer.cells[key];
    else layer.cells[key] = cell;
    scheduleSave();
    redraw();
  }

  function paintRoofSegment(point: { x: number; y: number }): void {
    if (!lastRoofPoint) {
      paintRoof(point);
      lastRoofPoint = point;
      return;
    }
    const dx = point.x - lastRoofPoint.x;
    const dy = point.y - lastRoofPoint.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 1; i <= Math.max(1, steps); i++) {
      paintRoof({
        x: Math.round(lastRoofPoint.x + dx * i / Math.max(1, steps)),
        y: Math.round(lastRoofPoint.y + dy * i / Math.max(1, steps)),
      });
    }
    lastRoofPoint = point;
  }

  rotateBtn.addEventListener('click', () => {
    rotation = ((rotation + 90) % 360) as ObjectRotation;
    refreshButtons();
    redraw();
  });
  flipXBtn.addEventListener('click', () => {
    flipX = !flipX;
    refreshButtons();
    redraw();
  });
  flipYBtn.addEventListener('click', () => {
    flipY = !flipY;
    refreshButtons();
    redraw();
  });
  roofSelect.addEventListener('change', () => {
    roofMode = roofSelect.value as RoofMode;
    canvas.style.cursor = roofMode === 'off' ? '' : 'crosshair';
    redraw();
  });

  canvas.addEventListener('mousedown', (event) => {
    if (roofMode === 'off' || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    roofPainting = true;
    lastRoofPoint = null;
    paintRoofSegment(eventPoint(event));
  }, { capture: true });
  canvas.addEventListener('mousemove', (event) => {
    if (roofMode === 'off' || !roofPainting) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    paintRoofSegment(eventPoint(event));
  }, { capture: true });
  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0 || !roofPainting) return;
    roofPainting = false;
    lastRoofPoint = null;
    scheduleSave();
    redraw();
  });

  // V6 paints the normal structure first; then this listener attaches transform metadata.
  canvas.addEventListener('mousedown', (event) => {
    if (roofMode !== 'off' || event.button !== 0) return;
    queueMicrotask(() => applyTransformToStructure(eventPoint(event)));
  });
  canvas.addEventListener('mousemove', (event) => {
    if (roofMode !== 'off' || (event.buttons & 1) === 0) return;
    queueMicrotask(() => applyTransformToStructure(eventPoint(event)));
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || edgeToolActive()) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const key = event.key.toLowerCase();
    if (key === 'r') {
      rotation = ((rotation + 90) % 360) as ObjectRotation;
      refreshButtons();
      redraw();
    } else if (key === 'x') {
      flipX = !flipX;
      refreshButtons();
      redraw();
    } else if (key === 'y') {
      flipY = !flipY;
      refreshButtons();
      redraw();
    } else if (key === '0') {
      rotation = IDENTITY_OBJECT_TRANSFORM.rotation;
      flipX = false;
      flipY = false;
      refreshButtons();
      redraw();
    }
  });

  function imageFor(path: string): HTMLImageElement {
    let image = imageCache.get(path);
    if (image) return image;
    image = new Image();
    image.src = path;
    image.onload = redraw;
    imageCache.set(path, image);
    return image;
  }

  function drawTransformedImage(
    image: HTMLImageElement,
    sx: number,
    sy: number,
    tilePx: number,
    objectTransform: ObjectTransform,
    preserveAspect: boolean,
  ): void {
    if (!image.complete || image.naturalWidth <= 0) return;
    const dw = tilePx;
    const dh = preserveAspect ? Math.max(tilePx, tilePx * image.naturalHeight / image.naturalWidth) : tilePx;
    overlayCtx.save();
    overlayCtx.imageSmoothingEnabled = false;
    overlayCtx.translate(sx + tilePx / 2, sy + tilePx - dh / 2);
    overlayCtx.rotate(objectTransform.rotation * Math.PI / 180);
    overlayCtx.scale(objectTransform.flipX ? -1 : 1, objectTransform.flipY ? -1 : 1);
    overlayCtx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
    overlayCtx.restore();
  }

  function isIdentity(value: ObjectTransform | undefined): boolean {
    return !value || (value.rotation === 0 && !value.flipX && !value.flipY);
  }

  function redraw(): void {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (overlay.width !== Math.round(width * dpr) || overlay.height !== Math.round(height * dpr)) {
        overlay.width = Math.round(width * dpr);
        overlay.height = Math.round(height * dpr);
      }
      overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      overlayCtx.clearRect(0, 0, width, height);

      const tilePx = currentZoom();
      if (tilePx < 4) return;
      const center = currentCenter();
      const plane = currentPlane();
      const layer = getPlaneData(loadEditorWorld(WORLD_SIZE), plane);
      const minX = Math.max(0, Math.floor(center.x - width / (2 * tilePx)) - 2);
      const maxX = Math.min(WORLD_SIZE - 1, Math.ceil(center.x + width / (2 * tilePx)) + 2);
      const minY = Math.max(0, Math.floor(center.y - height / (2 * tilePx)) - 2);
      const maxY = Math.min(WORLD_SIZE - 1, Math.ceil(center.y + height / (2 * tilePx)) + 2);
      const toScreen = (x: number, y: number) => ({ x: width / 2 + (x - center.x) * tilePx, y: height / 2 + (y - center.y) * tilePx });

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const cell = layer.cells[cellKey(x, y)] as TransformableEditorCell | undefined;
          if (!cell) continue;
          const p = toScreen(x, y);

          if (cell.structure && cell.structure !== 'blocker' && !isIdentity(cell.structureTransform)) {
            // V6 already drew the untransformed structure below. Dim that cell so
            // the authoritative transformed preview is visually unambiguous.
            overlayCtx.fillStyle = 'rgba(14,16,18,.54)';
            overlayCtx.fillRect(p.x, p.y, tilePx, tilePx);
            const image = imageFor(`/sprites/structures/${cell.structure as StructureType}.png`);
            drawTransformedImage(image, p.x, p.y, tilePx, cell.structureTransform!, true);
            overlayCtx.strokeStyle = 'rgba(238,195,76,.72)';
            overlayCtx.lineWidth = 1;
            overlayCtx.strokeRect(p.x + 1, p.y + 1, Math.max(1, tilePx - 2), Math.max(1, tilePx - 2));
          }

          if (cell.roof) {
            const image = imageFor(`/sprites/roof/${cell.roof.id}.png`);
            drawTransformedImage(image, p.x, p.y, tilePx, cell.roof.transform, false);
          }
        }
      }
    });
  }

  toolbar.addEventListener('change', redraw);
  toolbar.addEventListener('input', redraw);
  toolbar.addEventListener('click', redraw);
  canvas.addEventListener('wheel', redraw, { passive: true });
  window.addEventListener('resize', redraw);
  redraw();
}
