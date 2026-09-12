import { launchWorldEditor as launchWorldEditorV6 } from './WorldEditorV6';
import { WORLD_SIZE } from '../world/AeldorData';
import { cellKey, getPlaneData, loadEditorWorld, saveEditorWorld } from '../world/EditorWorld';
import {
  EDGE_TILE_DEFINITIONS,
  edgeTileDefinition,
  type DecoratedEditorCell,
  type DecorationRotation,
  type EditorDecoration,
} from '../world/ElevationDecorations';
import type { ResourceType, WorldPlane } from '../world/types';

type BlockerMode = 'off' | 'paint' | 'erase';
type ResourceAreaMode = 'off' | Extract<ResourceType,
  'flax_plant'
  | 'tree_normal' | 'tree_oak' | 'tree_willow' | 'tree_maple' | 'tree_yew' | 'tree_magic'
  | 'fishing_shrimp' | 'fishing_lobster' | 'fishing_swordfish'
>;
type EdgeMode = 'off' | 'erase' | string;

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
 * Adds RTS-editor style authoring layers on top of the V6 terrain editor:
 * invisible full-tile blockers, renewable resource regions, and transformed
 * cliff/crevice edge doodads with their own edge-band collision.
 */
export function launchWorldEditor(root: HTMLElement): void {
  launchWorldEditorV6(root);
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas');
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar');
  const canvasWrap = canvas?.parentElement;
  if (!canvas || !toolbar || !canvasWrap) return;

  let blockerMode: BlockerMode = 'off';
  let blockerPainting = false;
  let lastBlockerPoint: { x: number; y: number } | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let resourceAreaMode: ResourceAreaMode = 'off';
  let edgeMode: EdgeMode = 'off';
  let edgeRotation: DecorationRotation = 0;
  let edgeFlipX = false;
  let edgeFlipY = false;
  let hoverPoint: { x: number; y: number } | null = null;
  let overlayFrame = 0;

  // Separate editor-only overlay so transformed cliff art and invisible blockers
  // remain visible without modifying the V6 canvas renderer itself.
  const overlay = document.createElement('canvas');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '1';
  overlay.style.imageRendering = 'pixelated';
  canvasWrap.append(overlay);
  const help = canvasWrap.querySelector<HTMLElement>('.editor-overlay-help');
  if (help) help.style.zIndex = '2';
  const overlayCtx = overlay.getContext('2d');
  if (!overlayCtx) return;

  const imageCache = new Map<string, HTMLImageElement>();

  const blockerSelect = document.createElement('select');
  blockerSelect.title = 'Invisible full-tile collision blockers: shown red in the editor, hidden during gameplay.';
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
  resourceAreaSelect.title = 'Place an authored renewable-resource site. Exact resource nodes are still available in the Resources palette.';
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

  const edgeSelect = document.createElement('select');
  edgeSelect.title = 'Paint cliff/crevice edge tiles over the underlying terrain. Their rocky edge blocks crossing without making the whole cell solid.';
  const offOption = document.createElement('option');
  offOption.value = 'off';
  offOption.textContent = 'Edge tiles: Off';
  edgeSelect.append(offOption);
  const eraseOption = document.createElement('option');
  eraseOption.value = 'erase';
  eraseOption.textContent = 'Edge tiles: Erase';
  edgeSelect.append(eraseOption);
  for (const theme of ['grass', 'snow', 'desert'] as const) {
    const group = document.createElement('optgroup');
    group.label = `${theme[0].toUpperCase()}${theme.slice(1)} cliffs`;
    for (const definition of EDGE_TILE_DEFINITIONS.filter((entry) => entry.theme === theme)) {
      const option = document.createElement('option');
      option.value = definition.spriteId;
      option.textContent = definition.label;
      group.append(option);
    }
    edgeSelect.append(group);
  }

  const rotateBtn = document.createElement('button');
  rotateBtn.type = 'button';
  rotateBtn.title = 'Rotate selected edge tile 90° clockwise. Shortcut: R.';

  const flipXBtn = document.createElement('button');
  flipXBtn.type = 'button';
  flipXBtn.title = 'Mirror selected edge tile horizontally. Shortcut: X.';

  const flipYBtn = document.createElement('button');
  flipYBtn.type = 'button';
  flipYBtn.title = 'Mirror selected edge tile vertically. Shortcut: Y.';

  function refreshTransformButtons(): void {
    rotateBtn.textContent = `Rotate ${edgeRotation}°`;
    flipXBtn.textContent = `Flip X${edgeFlipX ? ' ✓' : ''}`;
    flipYBtn.textContent = `Flip Y${edgeFlipY ? ' ✓' : ''}`;
    flipXBtn.style.outline = edgeFlipX ? '2px solid #e5b84f' : '';
    flipYBtn.style.outline = edgeFlipY ? '2px solid #e5b84f' : '';
  }
  refreshTransformButtons();

  function syncExclusiveModes(active: 'blocker' | 'resource' | 'edge'): void {
    if (active !== 'blocker') {
      blockerMode = 'off';
      blockerSelect.value = 'off';
      blockerPainting = false;
      lastBlockerPoint = null;
    }
    if (active !== 'resource') {
      resourceAreaMode = 'off';
      resourceAreaSelect.value = 'off';
    }
    if (active !== 'edge') {
      edgeMode = 'off';
      edgeSelect.value = 'off';
    }
  }

  function syncCursor(): void {
    canvas.style.cursor = blockerMode === 'off' && resourceAreaMode === 'off' && edgeMode === 'off' ? '' : 'crosshair';
  }

  blockerSelect.addEventListener('change', () => {
    blockerMode = blockerSelect.value as BlockerMode;
    blockerPainting = false;
    lastBlockerPoint = null;
    if (blockerMode !== 'off') syncExclusiveModes('blocker');
    syncCursor();
    scheduleOverlayRedraw();
  });

  resourceAreaSelect.addEventListener('change', () => {
    resourceAreaMode = resourceAreaSelect.value as ResourceAreaMode;
    if (resourceAreaMode !== 'off') syncExclusiveModes('resource');
    syncCursor();
    scheduleOverlayRedraw();
  });

  edgeSelect.addEventListener('change', () => {
    edgeMode = edgeSelect.value;
    if (edgeMode !== 'off') syncExclusiveModes('edge');
    syncCursor();
    scheduleOverlayRedraw();
  });

  rotateBtn.addEventListener('click', () => {
    edgeRotation = ((edgeRotation + 90) % 360) as DecorationRotation;
    refreshTransformButtons();
    scheduleOverlayRedraw();
  });
  flipXBtn.addEventListener('click', () => {
    edgeFlipX = !edgeFlipX;
    refreshTransformButtons();
    scheduleOverlayRedraw();
  });
  flipYBtn.addEventListener('click', () => {
    edgeFlipY = !edgeFlipY;
    refreshTransformButtons();
    scheduleOverlayRedraw();
  });

  toolbar.append(
    blockerSelect,
    edgeSelect,
    rotateBtn,
    flipXBtn,
    flipYBtn,
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

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveEditorWorld(loadEditorWorld(WORLD_SIZE));
    }, 200);
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
    scheduleSave();
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

  function placeEdgeDecoration(point: { x: number; y: number }): void {
    if (edgeMode === 'off') return;
    const data = loadEditorWorld(WORLD_SIZE);
    const layer = getPlaneData(data, currentPlane());
    const key = cellKey(point.x, point.y);
    const cell = (layer.cells[key] ?? {}) as DecoratedEditorCell;

    if (edgeMode === 'erase') {
      delete cell.decoration;
    } else {
      const definition = edgeTileDefinition(edgeMode);
      if (!definition) return;
      const decoration: EditorDecoration = {
        kind: 'edge',
        theme: definition.theme,
        spriteId: definition.spriteId,
        rotation: edgeRotation,
        flipX: edgeFlipX,
        flipY: edgeFlipY,
      };
      cell.decoration = decoration;
    }

    if (Object.keys(cell).length === 0) delete layer.cells[key];
    else layer.cells[key] = cell;
    scheduleSave();
  }

  // Capture special authoring modes so the normal editor does not paint a second
  // terrain/object operation underneath the click.
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    if (blockerMode !== 'off') {
      event.preventDefault();
      event.stopImmediatePropagation();
      blockerPainting = true;
      lastBlockerPoint = null;
      paintBlockerSegment(eventWorldPoint(event));
      scheduleOverlayRedraw();
      return;
    }
    if (resourceAreaMode !== 'off') {
      event.preventDefault();
      event.stopImmediatePropagation();
      placeResourceArea(eventWorldPoint(event));
      scheduleOverlayRedraw();
      return;
    }
    if (edgeMode !== 'off') {
      event.preventDefault();
      event.stopImmediatePropagation();
      placeEdgeDecoration(eventWorldPoint(event));
      scheduleOverlayRedraw();
    }
  }, { capture: true });

  canvas.addEventListener('mousemove', (event) => {
    hoverPoint = eventWorldPoint(event);
    if (blockerMode !== 'off' && blockerPainting) paintBlockerSegment(hoverPoint);
    scheduleOverlayRedraw();
  }, { capture: true });

  canvas.addEventListener('mouseleave', () => {
    hoverPoint = null;
    scheduleOverlayRedraw();
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0 || !blockerPainting) return;
    blockerPainting = false;
    lastBlockerPoint = null;
    scheduleSave();
    scheduleOverlayRedraw();
  });

  canvas.addEventListener('wheel', () => scheduleOverlayRedraw(), { passive: true });
  toolbar.addEventListener('change', () => scheduleOverlayRedraw());
  toolbar.addEventListener('input', () => scheduleOverlayRedraw());
  toolbar.addEventListener('click', () => scheduleOverlayRedraw());
  window.addEventListener('resize', () => scheduleOverlayRedraw());

  window.addEventListener('keydown', (event) => {
    if (edgeMode === 'off' || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const key = event.key.toLowerCase();
    if (key === 'r') {
      edgeRotation = ((edgeRotation + 90) % 360) as DecorationRotation;
      refreshTransformButtons();
      scheduleOverlayRedraw();
    } else if (key === 'x') {
      edgeFlipX = !edgeFlipX;
      refreshTransformButtons();
      scheduleOverlayRedraw();
    } else if (key === 'y') {
      edgeFlipY = !edgeFlipY;
      refreshTransformButtons();
      scheduleOverlayRedraw();
    }
  });

  function scheduleOverlayRedraw(): void {
    if (overlayFrame) cancelAnimationFrame(overlayFrame);
    overlayFrame = requestAnimationFrame(() => {
      overlayFrame = 0;
      drawOverlay();
    });
  }

  function imageForDecoration(decoration: EditorDecoration): HTMLImageElement {
    const path = `/sprites/tiles/${decoration.theme}_cliffs/${decoration.spriteId}.png`;
    let image = imageCache.get(path);
    if (image) return image;
    image = new Image();
    image.src = path;
    image.onload = scheduleOverlayRedraw;
    imageCache.set(path, image);
    return image;
  }

  function drawDecoration(
    ctx: CanvasRenderingContext2D,
    decoration: EditorDecoration,
    sx: number,
    sy: number,
    size: number,
    alpha = 1,
  ): void {
    const image = imageForDecoration(decoration);
    if (!image.complete || image.naturalWidth <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(sx + size / 2, sy + size / 2);
    ctx.rotate(decoration.rotation * Math.PI / 180);
    ctx.scale(decoration.flipX ? -1 : 1, decoration.flipY ? -1 : 1);
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function parseResourceMarker(markerNotes: string | undefined): { radius: number; count: number } | null {
    if (!markerNotes) return null;
    const radius = Number(markerNotes.match(/radius\s*=\s*(\d+)/i)?.[1]);
    const count = Number(markerNotes.match(/count\s*=\s*(\d+)/i)?.[1]);
    if (!Number.isFinite(radius)) return null;
    return { radius, count: Number.isFinite(count) ? count : 0 };
  }

  function drawOverlay(): void {
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
    const center = currentCenter();
    const plane = currentPlane();
    const data = loadEditorWorld(WORLD_SIZE);
    const layer = getPlaneData(data, plane);

    const worldToScreen = (x: number, y: number) => ({
      x: width / 2 + (x - center.x) * tilePx,
      y: height / 2 + (y - center.y) * tilePx,
    });

    // Resource areas are editor regions: show their authored radius explicitly.
    overlayCtx.save();
    overlayCtx.setLineDash([6, 4]);
    for (const marker of data.markers) {
      if (marker.type !== 'resource_area' || marker.plane !== plane) continue;
      const config = parseResourceMarker(marker.notes);
      if (!config) continue;
      const p = worldToScreen(marker.x, marker.y);
      const radiusPx = config.radius * tilePx;
      if (p.x + radiusPx < 0 || p.y + radiusPx < 0 || p.x - radiusPx > width || p.y - radiusPx > height) continue;
      overlayCtx.strokeStyle = 'rgba(94,220,134,.88)';
      overlayCtx.fillStyle = 'rgba(94,220,134,.06)';
      overlayCtx.lineWidth = 2;
      overlayCtx.beginPath();
      overlayCtx.arc(p.x + tilePx / 2, p.y + tilePx / 2, Math.max(4, radiusPx), 0, Math.PI * 2);
      overlayCtx.fill();
      overlayCtx.stroke();
      if (tilePx >= 4) {
        overlayCtx.setLineDash([]);
        overlayCtx.fillStyle = '#d9ffe4';
        overlayCtx.strokeStyle = '#102418';
        overlayCtx.lineWidth = 3;
        overlayCtx.font = '11px sans-serif';
        overlayCtx.textAlign = 'center';
        const text = config.count > 0 ? `${marker.name} · ${config.count} nodes` : marker.name;
        overlayCtx.strokeText(text, p.x + tilePx / 2, p.y - 10);
        overlayCtx.fillText(text, p.x + tilePx / 2, p.y - 10);
        overlayCtx.setLineDash([6, 4]);
      }
    }
    overlayCtx.restore();

    if (tilePx >= 4) {
      const minX = Math.max(0, Math.floor(center.x - width / (2 * tilePx)) - 2);
      const maxX = Math.min(WORLD_SIZE - 1, Math.ceil(center.x + width / (2 * tilePx)) + 2);
      const minY = Math.max(0, Math.floor(center.y - height / (2 * tilePx)) - 2);
      const maxY = Math.min(WORLD_SIZE - 1, Math.ceil(center.y + height / (2 * tilePx)) + 2);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const cell = layer.cells[cellKey(x, y)] as DecoratedEditorCell | undefined;
          if (!cell) continue;
          const p = worldToScreen(x, y);
          if (cell.decoration) drawDecoration(overlayCtx, cell.decoration, p.x, p.y, tilePx);
          if (cell.structure === 'blocker') {
            overlayCtx.fillStyle = 'rgba(255,55,55,.24)';
            overlayCtx.strokeStyle = 'rgba(255,92,92,.9)';
            overlayCtx.lineWidth = Math.max(1, tilePx * 0.08);
            overlayCtx.fillRect(p.x, p.y, tilePx, tilePx);
            overlayCtx.strokeRect(p.x + 1, p.y + 1, Math.max(1, tilePx - 2), Math.max(1, tilePx - 2));
            overlayCtx.beginPath();
            overlayCtx.moveTo(p.x + 2, p.y + 2);
            overlayCtx.lineTo(p.x + tilePx - 2, p.y + tilePx - 2);
            overlayCtx.moveTo(p.x + tilePx - 2, p.y + 2);
            overlayCtx.lineTo(p.x + 2, p.y + tilePx - 2);
            overlayCtx.stroke();
          }
        }
      }
    }

    if (hoverPoint && edgeMode !== 'off') {
      const p = worldToScreen(hoverPoint.x, hoverPoint.y);
      if (edgeMode === 'erase') {
        overlayCtx.strokeStyle = 'rgba(255,80,80,.95)';
        overlayCtx.lineWidth = 2;
        overlayCtx.strokeRect(p.x + 1, p.y + 1, Math.max(2, tilePx - 2), Math.max(2, tilePx - 2));
      } else {
        const definition = edgeTileDefinition(edgeMode);
        if (definition) {
          drawDecoration(overlayCtx, {
            kind: 'edge',
            theme: definition.theme,
            spriteId: definition.spriteId,
            rotation: edgeRotation,
            flipX: edgeFlipX,
            flipY: edgeFlipY,
          }, p.x, p.y, tilePx, 0.62);
        }
      }
    }
  }

  // Keep the original mousemove throttling for the underlying V6 canvas work.
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

  scheduleOverlayRedraw();
}
