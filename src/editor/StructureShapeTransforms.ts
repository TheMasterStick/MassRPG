import { WORLD_SIZE } from '../world/AeldorData';
import { cellKey, getPlaneData, loadEditorWorld, saveEditorWorld } from '../world/EditorWorld';
import type { ObjectRotation, TransformableEditorCell } from '../world/EditorObjects';
import type { WorldPlane } from '../world/types';

interface Point { x: number; y: number }

/**
 * V6 commits Line/Rectangle object shapes on mouseup, after the original
 * ObjectAuthoringTools brush listener has already run. This bridge applies the
 * current object rotation/mirror transform to structures created by those shape
 * tools as soon as V6 commits them.
 */
export function installStructureShapeTransforms(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas');
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar');
  if (!canvas || !toolbar) return;

  let start: Point | null = null;
  let end: Point | null = null;

  function currentPlane(): WorldPlane {
    const select = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((candidate) => [...candidate.options].some((option) => option.textContent === 'Surface')
        && [...candidate.options].some((option) => option.value === '-1'));
    const value = Number(select?.value ?? 0);
    return value === -1 || value === -2 ? value : 0;
  }

  function currentZoom(): number {
    const select = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((candidate) => candidate.selectedOptions[0]?.textContent?.includes('px / tile'));
    const px = Number.parseFloat(select?.selectedOptions[0]?.textContent ?? '1');
    return Number.isFinite(px) && px > 0 ? px : 1;
  }

  function currentCenter(): Point {
    const inputs = [...toolbar.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    return { x: Number(inputs[0]?.value ?? WORLD_SIZE / 2), y: Number(inputs[1]?.value ?? WORLD_SIZE / 2) };
  }

  function currentTool(): string {
    return [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((select) => [...select.options].some((option) => option.value === 'line')
        && [...select.options].some((option) => option.value === 'brush'))?.value ?? 'brush';
  }

  function eventPoint(event: MouseEvent): Point {
    const rect = canvas.getBoundingClientRect();
    const tilePx = currentZoom();
    const center = currentCenter();
    return {
      x: Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(center.x + (event.clientX - rect.left - rect.width / 2) / tilePx))),
      y: Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(center.y + (event.clientY - rect.top - rect.height / 2) / tilePx))),
    };
  }

  function currentTransform() {
    const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>('button')];
    const rotate = buttons.find((button) => button.textContent?.startsWith('Object '));
    const flipX = buttons.find((button) => button.textContent?.startsWith('Obj Flip X'));
    const flipY = buttons.find((button) => button.textContent?.startsWith('Obj Flip Y'));
    const angle = Number(rotate?.textContent?.match(/(0|90|180|270)/)?.[1] ?? 0) as ObjectRotation;
    return {
      rotation: angle,
      flipX: !!flipX?.textContent?.includes('✓'),
      flipY: !!flipY?.textContent?.includes('✓'),
    };
  }

  function transformCell(x: number, y: number): boolean {
    const layer = getPlaneData(loadEditorWorld(WORLD_SIZE), currentPlane());
    const cell = layer.cells[cellKey(x, y)] as TransformableEditorCell | undefined;
    if (!cell?.structure || cell.structure === 'blocker') return false;
    cell.structureTransform = currentTransform();
    return true;
  }

  function applyLine(a: Point, b: Point): boolean {
    let changed = false;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      changed = transformCell(Math.round(a.x + dx * t), Math.round(a.y + dy * t)) || changed;
    }
    return changed;
  }

  function applyRectangle(a: Point, b: Point, filled: boolean): boolean {
    let changed = false;
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        if (filled || x === left || x === right || y === top || y === bottom) {
          changed = transformCell(x, y) || changed;
        }
      }
    }
    return changed;
  }

  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const tool = currentTool();
    if (tool !== 'line' && tool !== 'rect_fill' && tool !== 'rect_outline') return;
    start = eventPoint(event);
    end = start;
  });

  canvas.addEventListener('mousemove', (event) => {
    if (!start || (event.buttons & 1) === 0) return;
    end = eventPoint(event);
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0 || !start || !end) return;
    const a = start;
    const b = end;
    const tool = currentTool();
    start = null;
    end = null;

    // V6's window mouseup handler was registered first and has now committed the
    // structure shape. Attach transform metadata to those authored cells.
    let changed = false;
    if (tool === 'line') changed = applyLine(a, b);
    else if (tool === 'rect_fill') changed = applyRectangle(a, b, true);
    else if (tool === 'rect_outline') changed = applyRectangle(a, b, false);
    if (!changed) return;
    void saveEditorWorld(loadEditorWorld(WORLD_SIZE));
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  });
}
