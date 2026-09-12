import { launchWorldEditor as launchWorldEditorV6 } from './WorldEditorV6';
import { WORLD_SIZE } from '../world/AeldorData';
import { cellKey, getPlaneData, loadEditorWorld, saveEditorWorld } from '../world/EditorWorld';
import type { ResourceType, WorldPlane } from '../world/types';

type BlockerMode = 'off' | 'paint' | 'erase';
type ResourceAreaMode = 'off' | Extract<ResourceType,
  'flax_plant'
  | 'tree_normal' | 'tree_oak' | 'tree_willow' | 'tree_maple' | 'tree_yew' | 'tree_magic'
  | 'fishing_shrimp' | 'fishing_lobster' | 'fishing_swordfish'
>;

const RESOURCE_AREA_OPTIONS: { id: ResourceAreaMode; label: string; name: string }[] = [
  { id: 'off', label: 'Resource areas: Off', name: '' },
  { id: 'flax_plant', label: 'Area: Flax', name: 'Flax Field' },
  { id: 'tree_normal', label: 'Area: Trees', name: 'Tree Grove' },
  { id: 'tree_oak', label: 'Area: Oak', name: 'Oak Grove' },
  { id: 'tree_willow', label: 'Area: Willow', name: 'Willow Grove' },
  { id: 'tree_maple', label: 'Area: Maple', name: 'Maple Grove' },
  { id: 'tree_yew', label: 'Area: Yew', name: 'Yew Grove' },
  { id: 'tree_magic', label: 'Area: Magic Tree', name: 'Magic Tree Grove' },
  { id: 'fishing_shrimp', label: 'Area: Small Fishing', name: 'Small Fishing Grounds' },
  { id: 'fishing_lobster', label: 'Area: Lobster', name: 'Lobster Grounds' },
  { id: 'fishing_swordfish', label: 'Area: Deep Fishing', name: 'Deep Fishing Grounds' },
];

/**
 * The editor does a substantial amount of canvas work per mousemove. Gaming mice
 * and forwarded Codespaces browsers can deliver hundreds of mousemove events per
 * second, which made macro-map painting feel much heavier than the actual world
 * data warranted. This wrapper also adds explicit invisible blockers and compact
 * authored renewable-resource areas without disturbing the V6 editor's normal
 * terrain/elevation tools.
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
  let resourceAreaMode: ResourceAreaMode = 'off';

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

  const resourceAreaSelect = document.createElement('select');
  resourceAreaSelect.title = 'Place an authored renewable-resource site. Surface only for now; runtime nodes are derived from this marker.';
  for (const optionDef of RESOURCE_AREA_OPTIONS) {
    const option = document.createElement('option');
    option.value = optionDef.id;
    option.textContent = optionDef.label;
    resourceAreaSelect.append(option);
  }

  const resourceRadiusInput = document.createElement('input');
  resourceRadiusInput.type = 'number';
  resourceRadiusInput.min = '3';
  resourceRadiusInput.max = '40';
  resourceRadiusInput.value = '10';
  resourceRadiusInput.title = 'Resource-area radius in tiles.';
  resourceRadiusInput.style.width = '54px';

  const resourceCountInput = document.createElement('input');
  resourceCountInput.type = 'number';
  resourceCountInput.min = '1';
  resourceCountInput.max = '24';
  resourceCountInput.value = '5';
  resourceCountInput.title = 'Number of live resource nodes derived from the site.';
  resourceCountInput.style.width = '48px';

  blockerSelect.addEventListener('change', () => {
    blockerMode = blockerSelect.value as BlockerMode;
    blockerPainting = false;
    lastBlockerPoint = null;
    if (blockerMode !== 'off') {
      resourceAreaMode = 'off';
      resourceAreaSelect.value = 'off';
    }
    canvas.style.cursor = blockerMode === 'off' && resourceAreaMode === 'off' ? '' : 'crosshair';
  });

  resourceAreaSelect.addEventListener('change', () => {
    resourceAreaMode = resourceAreaSelect.value as ResourceAreaMode;
    if (resourceAreaMode !== 'off') {
      blockerMode = 'off';
      blockerSelect.value = 'off';
      blockerPainting = false;
      lastBlockerPoint = null;
    }
    canvas.style.cursor = blockerMode === 'off' && resourceAreaMode === 'off' ? '' : 'crosshair';
  });

  toolbar.append(
    blockerSelect,
    resourceAreaSelect,
    document.createTextNode('R'),
    resourceRadiusInput,
    document.createTextNode('N'),
    resourceCountInput,
  );

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

  function placeResourceArea(point: { x: number; y: number }): void {
    if (resourceAreaMode === 'off' || currentPlane() !== 0) return;
    const data = loadEditorWorld(WORLD_SIZE);
    const definition = RESOURCE_AREA_OPTIONS.find((option) => option.id === resourceAreaMode);
    if (!definition) return;
    const radius = Math.max(3, Math.min(40, Math.round(Number(resourceRadiusInput.value) || 10)));
    const count = Math.max(1, Math.min(24, Math.round(Number(resourceCountInput.value) || 5)));
    const sameTypeCount = data.markers.filter((marker) => marker.type === 'resource_area' && marker.notes?.includes(`resource=${resourceAreaMode}`)).length + 1;
    data.markers.push({
      id: `resource-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'resource_area',
      name: `${definition.name} ${sameTypeCount}`,
      x: point.x,
      y: point.y,
      plane: 0,
      notes: `resource=${resourceAreaMode}; radius=${radius}; count=${count}`,
    });
    void saveEditorWorld(data);
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

  // Resource areas are single authored site markers. The runtime derives the
  // configured renewable nodes, so one click is enough regardless of brush size.
  canvas.addEventListener('mousedown', (event) => {
    if (resourceAreaMode === 'off' || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    placeResourceArea(eventWorldPoint(event));
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
