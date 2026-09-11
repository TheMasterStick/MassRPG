import { launchWorldEditor as launchWorldEditorV6 } from './WorldEditorV6';
import { WORLD_SIZE } from '../world/AeldorData';
import { cellKey, getPlaneData, loadEditorWorld, saveEditorWorld } from '../world/EditorWorld';
import type { WorldPlane } from '../world/types';

type BlockerMode = 'off' | 'paint' | 'erase';

/**
 * The editor does a substantial amount of canvas work per mousemove. Gaming mice
 * and forwarded Codespaces browsers can deliver hundreds of mousemove events per
 * second, which made macro-map painting feel much heavier than the actual world
 * data warranted. This wrapper also adds an explicit invisible-in-game blocker
 * authoring mode without disturbing the V6 editor's normal terrain/elevation tools.
 */
export function launchWorldEditor(root: HTMLElement): void {
  launchWorldEditorV6(root);
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas');
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar');
  if (!canvas || !toolbar) return;

  let blockerMode: BlockerMode = 'off';
  let blockerPainting = false;
  let lastBlockerPoint: { x: number; y: number } | null = null;
  let blockerSaveTimer: ReturnType<typeof setTimeout> | null = null;

  const blockerSelect = document.createElement('select');
  blockerSelect.title = 'Invisible collision blockers: visible in the editor, hidden during gameplay.';
  for (const [value, label] of [
    ['off', 'Blockers: Off'],
    ['paint', 'Blockers: Paint'],
    ['erase', 'Blockers: Erase'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    blockerSelect.append(option);
  }
  blockerSelect.addEventListener('change', () => {
    blockerMode = blockerSelect.value as BlockerMode;
    blockerPainting = false;
    lastBlockerPoint = null;
    canvas.style.cursor = blockerMode === 'off' ? '' : 'crosshair';
  });
  toolbar.append(blockerSelect);

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
    return {
      x: Number(inputs[0]?.value ?? WORLD_SIZE / 2),
      y: Number(inputs[1]?.value ?? WORLD_SIZE / 2),
    };
  }

  function eventWorldPoint(event: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const tilePx = currentZoom();
    const center = currentCenter();
    return {
      x: Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(center.x + (event.clientX - rect.left - rect.width / 2) / tilePx))),
      y: Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(center.y + (event.clientY - rect.top - rect.height / 2) / tilePx))),
    };
  }

  function scheduleBlockerSave(): void {
    if (blockerSaveTimer) clearTimeout(blockerSaveTimer);
    blockerSaveTimer = setTimeout(() => {
      blockerSaveTimer = null;
      void saveEditorWorld(loadEditorWorld(WORLD_SIZE));
    }, 250);
  }

  function applyBlocker(x: number, y: number): void {
    if (blockerMode === 'off') return;
    const data = loadEditorWorld(WORLD_SIZE);
    const layer = getPlaneData(data, currentPlane());
    const key = cellKey(x, y);
    const existing = layer.cells[key];

    if (blockerMode === 'paint') {
      const cell = existing ?? {};
      cell.structure = 'blocker';
      layer.cells[key] = cell;
    } else if (existing?.structure === 'blocker') {
      delete existing.structure;
      if (Object.keys(existing).length === 0) delete layer.cells[key];
    }
    scheduleBlockerSave();
  }

  function paintBlockerSegment(point: { x: number; y: number }): void {
    if (!lastBlockerPoint) {
      applyBlocker(point.x, point.y);
      lastBlockerPoint = point;
      return;
    }
    const dx = point.x - lastBlockerPoint.x;
    const dy = point.y - lastBlockerPoint.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 1; i <= Math.max(1, steps); i++) {
      applyBlocker(
        Math.round(lastBlockerPoint.x + dx * i / Math.max(1, steps)),
        Math.round(lastBlockerPoint.y + dy * i / Math.max(1, steps)),
      );
    }
    lastBlockerPoint = point;
  }

  // Capture left-clicks while blocker mode is active so the normal editor does
  // not simultaneously paint terrain/objects underneath the collision line.
  canvas.addEventListener('mousedown', (event) => {
    if (blockerMode === 'off' || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    blockerPainting = true;
    lastBlockerPoint = null;
    paintBlockerSegment(eventWorldPoint(event));
  }, { capture: true });

  canvas.addEventListener('mousemove', (event) => {
    if (blockerMode !== 'off' && blockerPainting) paintBlockerSegment(eventWorldPoint(event));
  }, { capture: true });

  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0 || !blockerPainting) return;
    blockerPainting = false;
    lastBlockerPoint = null;
    scheduleBlockerSave();
  });

  let lastAcceptedMove = 0;
  canvas.addEventListener('mousemove', (event) => {
    const now = performance.now();
    const pxPerTile = currentZoom();
    const interval = Number.isFinite(pxPerTile) && pxPerTile < 0.2 ? 32 : 16;
    if (now - lastAcceptedMove < interval) {
      event.stopImmediatePropagation();
      return;
    }
    lastAcceptedMove = now;
  }, { capture: true });
}
