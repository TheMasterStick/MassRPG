import { WORLD_SIZE } from '../world/AeldorData';
import {
  baseTileForPlane, getPlaneData, type EditorMarker, type EditorMarkerType,
  type EditorWorldData, type TerrainStroke,
} from '../world/EditorWorld';
import type { WorldPlane } from '../world/types';
import { TILE_MAP_COLORS } from '../ui/mapColors';

interface ViewportState { centerX: number; centerY: number; visibleWidth: number; visibleHeight: number }
interface NavigatorOptions {
  getData: () => EditorWorldData;
  getPlane: () => WorldPlane;
  getViewport: () => ViewportState;
  onJump: (x: number, y: number) => void;
}
export interface EditorNavigatorHandle {
  element: HTMLElement;
  redraw: () => void;
  markEditsDirty: () => void;
  toggleLarge: () => void;
  closeLarge: () => void;
}

const MINI_SIZE = 220;
const LARGE_SIZE = 760;
const MAP_EDIT_REFRESH_MS = 120;
const MARKER_COLORS: Record<EditorMarkerType, string> = {
  settlement: '#f2f2f2', village: '#8ee28e', town: '#f1d56b', city: '#ff7777', castle: '#c391ff', mining_area: '#ff8a32',
};

export function createEditorNavigatorV5(options: NavigatorOptions): EditorNavigatorHandle {
  const panel = document.createElement('aside');
  panel.className = 'editor-navigator';
  const header = document.createElement('div');
  header.className = 'editor-navigator-header';
  const title = document.createElement('strong');
  const expand = document.createElement('button');
  expand.type = 'button'; expand.textContent = 'M / Expand';
  header.append(title, expand);
  const mini = document.createElement('canvas');
  mini.className = 'editor-minimap'; mini.width = MINI_SIZE; mini.height = MINI_SIZE;
  mini.title = 'Click to move the editor camera on the current plane';
  const legend = document.createElement('div');
  legend.className = 'editor-map-legend';
  legend.innerHTML = '<span>□ viewport</span><span class="town-dot">● markers</span><span class="mine-dot">◆ links</span><span class="edit-dot">● objects</span>';
  panel.append(header, mini, legend);

  const modal = document.createElement('div');
  modal.className = 'editor-map-modal hidden';
  const box = document.createElement('div'); box.className = 'editor-map-modal-box';
  const mh = document.createElement('div'); mh.className = 'editor-map-modal-header';
  const mt = document.createElement('strong');
  const hint = document.createElement('span'); hint.textContent = 'Click anywhere to move camera · M closes';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '✕';
  mh.append(mt, hint, close);
  const large = document.createElement('canvas');
  large.className = 'editor-large-map'; large.width = LARGE_SIZE; large.height = LARGE_SIZE;
  box.append(mh, large); modal.append(box); document.body.append(modal);

  let revision = 0;
  let miniCache: { key: string; canvas: HTMLCanvasElement } | null = null;
  let largeCache: { key: string; canvas: HTMLCanvasElement } | null = null;
  let framePending = false;
  let dirtyPending = false;
  let dirtyTimer: ReturnType<typeof setTimeout> | null = null;

  function planeName(plane: WorldPlane): string {
    return plane === 0 ? 'Surface' : `Underground ${plane}`;
  }

  function staticMap(size: number, largeMode: boolean): HTMLCanvasElement {
    const plane = options.getPlane();
    const key = `${revision}:${plane}`;
    const old = largeMode ? largeCache : miniCache;
    if (old?.key === key) return old.canvas;
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Editor map requires Canvas 2D.');
    const data = options.getData(); const layer = getPlaneData(data, plane);
    ctx.fillStyle = TILE_MAP_COLORS[baseTileForPlane(plane)]; ctx.fillRect(0, 0, size, size);
    for (const stroke of layer.terrainStrokes) drawShape(ctx, stroke, size);
    for (const [keyCell, cell] of Object.entries(layer.cells)) {
      if (!cell.tile && !cell.resource && !cell.structure && !cell.spawner) continue;
      const [x, y] = parseKey(keyCell); const sx = x / WORLD_SIZE * size; const sy = y / WORLD_SIZE * size;
      if (cell.tile) { ctx.fillStyle = TILE_MAP_COLORS[cell.tile]; ctx.fillRect(Math.floor(sx), Math.floor(sy), largeMode ? 2 : 1, largeMode ? 2 : 1); }
      if (cell.resource || cell.structure || cell.spawner) {
        ctx.fillStyle = cell.resource?.startsWith('rock_') ? '#111' : cell.resource ? '#2b9f4b' : cell.structure ? '#f1c15a' : '#d84b4b';
        dot(ctx, sx, sy, largeMode ? 2.2 : 1.3);
      }
    }
    for (const marker of data.markers) if (marker.plane === plane) drawMarker(ctx, marker, size, largeMode);
    for (const link of data.links) {
      for (const endpoint of [link.from, link.to]) {
        if (endpoint.plane !== plane) continue;
        const x = endpoint.x / WORLD_SIZE * size; const y = endpoint.y / WORLD_SIZE * size;
        ctx.fillStyle = '#61e6ff'; ctx.strokeStyle = '#081417'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y - (largeMode ? 5 : 3)); ctx.lineTo(x + (largeMode ? 4 : 3), y + (largeMode ? 4 : 3)); ctx.lineTo(x - (largeMode ? 4 : 3), y + (largeMode ? 4 : 3)); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    const next = { key, canvas };
    if (largeMode) largeCache = next; else miniCache = next;
    return canvas;
  }

  function drawShape(ctx: CanvasRenderingContext2D, stroke: TerrainStroke, size: number) {
    const scale = size / WORLD_SIZE;
    ctx.fillStyle = stroke.tile ? TILE_MAP_COLORS[stroke.tile] : TILE_MAP_COLORS[baseTileForPlane(options.getPlane())];
    ctx.strokeStyle = ctx.fillStyle;
    if (stroke.kind === 'line') {
      ctx.lineWidth = Math.max(1, stroke.size * scale); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(stroke.x * scale, stroke.y * scale); ctx.lineTo((stroke.x2 ?? stroke.x) * scale, (stroke.y2 ?? stroke.y) * scale); ctx.stroke(); return;
    }
    if (stroke.kind === 'rect_fill' || stroke.kind === 'rect_outline') {
      const x2 = stroke.x2 ?? stroke.x, y2 = stroke.y2 ?? stroke.y;
      const left = Math.min(stroke.x, x2) * scale, top = Math.min(stroke.y, y2) * scale;
      const w = (Math.abs(x2 - stroke.x) + 1) * scale, h = (Math.abs(y2 - stroke.y) + 1) * scale;
      if (stroke.kind === 'rect_fill') ctx.fillRect(left, top, Math.max(1, w), Math.max(1, h));
      else { ctx.lineWidth = Math.max(1, stroke.size * scale); ctx.strokeRect(left, top, Math.max(1, w), Math.max(1, h)); }
      return;
    }
    const half = Math.floor(stroke.size / 2);
    ctx.fillRect((stroke.x - half) * scale, (stroke.y - half) * scale, Math.max(1, stroke.size * scale), Math.max(1, stroke.size * scale));
  }

  function drawMarker(ctx: CanvasRenderingContext2D, marker: EditorMarker, size: number, largeMode: boolean) {
    const x = marker.x / WORLD_SIZE * size, y = marker.y / WORLD_SIZE * size;
    ctx.fillStyle = MARKER_COLORS[marker.type]; ctx.strokeStyle = '#111'; ctx.lineWidth = largeMode ? 1.5 : 1;
    const r = marker.type === 'city' || marker.type === 'castle' ? (largeMode ? 4.3 : 2.7) : (largeMode ? 3.4 : 2.2);
    dot(ctx, x, y, r); ctx.stroke();
    if (largeMode) { ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.strokeText(marker.name, x, y-r-4); ctx.fillText(marker.name, x, y-r-4); }
  }

  function drawMap(canvas: HTMLCanvasElement, largeMode: boolean) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    title.textContent = `World Map · ${planeName(options.getPlane())}`; mt.textContent = `Twin Lands · ${planeName(options.getPlane())}`;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(staticMap(canvas.width, largeMode), 0, 0);
    const v = options.getViewport(); const vw = Math.max(2, v.visibleWidth / WORLD_SIZE * canvas.width); const vh = Math.max(2, v.visibleHeight / WORLD_SIZE * canvas.height);
    const x = v.centerX / WORLD_SIZE * canvas.width - vw/2, y = v.centerY / WORLD_SIZE * canvas.height - vh/2;
    ctx.strokeStyle = '#5cff72'; ctx.lineWidth = largeMode ? 2 : 1; ctx.strokeRect(x, y, vw, vh); ctx.fillStyle = 'rgba(92,255,114,.10)'; ctx.fillRect(x, y, vw, vh);
  }

  function redrawNow() { framePending = false; drawMap(mini, false); if (!modal.classList.contains('hidden')) drawMap(large, true); }
  function redraw() { if (framePending) return; framePending = true; requestAnimationFrame(redrawNow); }

  /**
   * Painting can generate many mouse events. Rebuilding the entire miniature map
   * on every event was the main editor hitch. Keep the existing cache while the
   * user is drawing and refresh it at most ~8 times/second instead.
   */
  function markEditsDirty() {
    dirtyPending = true;
    if (dirtyTimer) return;
    dirtyTimer = setTimeout(() => {
      dirtyTimer = null;
      if (!dirtyPending) return;
      dirtyPending = false;
      revision++;
      miniCache = null;
      largeCache = null;
      redraw();
    }, MAP_EDIT_REFRESH_MS);
  }

  function toggleLarge() {
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden') && dirtyPending) {
      dirtyPending = false;
      if (dirtyTimer) { clearTimeout(dirtyTimer); dirtyTimer = null; }
      revision++;
      miniCache = null;
      largeCache = null;
    }
    redraw();
  }
  function closeLarge() { modal.classList.add('hidden'); }
  function jump(e: MouseEvent, canvas: HTMLCanvasElement) { const r=canvas.getBoundingClientRect(); options.onJump(Math.round((e.clientX-r.left)/r.width*(WORLD_SIZE-1)), Math.round((e.clientY-r.top)/r.height*(WORLD_SIZE-1))); redraw(); }

  mini.addEventListener('click', e => jump(e, mini)); large.addEventListener('click', e => jump(e, large)); expand.addEventListener('click', toggleLarge); close.addEventListener('click', closeLarge); modal.addEventListener('mousedown', e => { if (e.target === modal) closeLarge(); });
  redraw();
  return { element: panel, redraw, markEditsDirty, toggleLarge, closeLarge };
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) { ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
function parseKey(key: string): [number, number] { const c=key.indexOf(','); return [Number(key.slice(0,c)), Number(key.slice(c+1))]; }
