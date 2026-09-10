import { WORLD_SIZE } from '../world/AeldorData';
import type { EditorMarker, EditorMarkerType, EditorWorldData, TerrainStroke } from '../world/EditorWorld';
import { TILE_MAP_COLORS } from '../ui/mapColors';

interface ViewportState {
  centerX: number;
  centerY: number;
  visibleWidth: number;
  visibleHeight: number;
}

interface NavigatorOptions {
  getData: () => EditorWorldData;
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

interface StaticMapCache {
  revision: number;
  canvas: HTMLCanvasElement;
}

const MINI_SIZE = 220;
const LARGE_SIZE = 760;
const BASE_COLOR = TILE_MAP_COLORS.deep_water;

const MARKER_COLORS: Record<EditorMarkerType, string> = {
  settlement: '#f2f2f2',
  village: '#8ee28e',
  town: '#f1d56b',
  city: '#ff7777',
  castle: '#c391ff',
  mining_area: '#ff8a32',
};

export function createEditorNavigator(options: NavigatorOptions): EditorNavigatorHandle {
  const panel = document.createElement('aside');
  panel.className = 'editor-navigator';

  const header = document.createElement('div');
  header.className = 'editor-navigator-header';
  const title = document.createElement('strong');
  title.textContent = 'World Map';
  const expand = document.createElement('button');
  expand.type = 'button';
  expand.textContent = 'M / Expand';
  header.append(title, expand);

  const mini = document.createElement('canvas');
  mini.className = 'editor-minimap';
  mini.width = MINI_SIZE;
  mini.height = MINI_SIZE;
  mini.title = 'Click to move the editor camera';

  const legend = document.createElement('div');
  legend.className = 'editor-map-legend';
  legend.innerHTML = '<span>□ viewport</span><span class="town-dot">● settlements</span><span class="mine-dot">● mining</span><span class="edit-dot">● manual objects</span>';
  panel.append(header, mini, legend);

  const modal = document.createElement('div');
  modal.className = 'editor-map-modal hidden';
  const modalBox = document.createElement('div');
  modalBox.className = 'editor-map-modal-box';
  const modalHeader = document.createElement('div');
  modalHeader.className = 'editor-map-modal-header';
  const modalTitle = document.createElement('strong');
  modalTitle.textContent = 'Twin Lands — Hand-authored World Map';
  const modalHint = document.createElement('span');
  modalHint.textContent = 'Click anywhere to move the editor camera · M closes';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  modalHeader.append(modalTitle, modalHint, close);
  const large = document.createElement('canvas');
  large.className = 'editor-large-map';
  large.width = LARGE_SIZE;
  large.height = LARGE_SIZE;
  modalBox.append(modalHeader, large);
  modal.append(modalBox);
  document.body.append(modal);

  let editRevision = 0;
  let miniStatic: StaticMapCache | null = null;
  let largeStatic: StaticMapCache | null = null;
  let framePending = false;

  function staticMap(size: number, largeMode: boolean): HTMLCanvasElement {
    const existing = largeMode ? largeStatic : miniStatic;
    if (existing && existing.revision === editRevision) return existing.canvas;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Editor world map requires Canvas 2D.');
    const ctx: CanvasRenderingContext2D = context;
    ctx.fillStyle = BASE_COLOR;
    ctx.fillRect(0, 0, size, size);

    const data = options.getData();
    for (const stroke of data.terrainStrokes) drawTerrainStroke(ctx, stroke, size);

    for (const [key, cell] of Object.entries(data.cells)) {
      if (!cell.tile) continue;
      const [x, y] = parseKey(key);
      ctx.fillStyle = TILE_MAP_COLORS[cell.tile];
      const sx = (x / WORLD_SIZE) * size;
      const sy = (y / WORLD_SIZE) * size;
      const dot = largeMode ? 2 : 1;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), dot, dot);
    }

    for (const [key, cell] of Object.entries(data.cells)) {
      const [x, y] = parseKey(key);
      const sx = (x / WORLD_SIZE) * size;
      const sy = (y / WORLD_SIZE) * size;
      if (cell.resource) {
        ctx.fillStyle = cell.resource.startsWith('rock_') ? '#101010' : '#1f8c3f';
        mapDot(ctx, sx, sy, largeMode ? 2.4 : 1.4);
      } else if (cell.structure) {
        ctx.fillStyle = '#f1c15a';
        mapDot(ctx, sx, sy, largeMode ? 2.2 : 1.3);
      } else if (cell.spawner) {
        ctx.fillStyle = '#d84b4b';
        mapDot(ctx, sx, sy, largeMode ? 2.2 : 1.3);
      }
    }

    for (const marker of data.markers) drawMarker(ctx, marker, size, largeMode);

    const next = { revision: editRevision, canvas };
    if (largeMode) largeStatic = next;
    else miniStatic = next;
    return canvas;
  }

  function drawMap(canvas: HTMLCanvasElement, largeMode: boolean): void {
    const context = canvas.getContext('2d');
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticMap(canvas.width, largeMode), 0, 0);
    drawViewport(ctx, canvas.width, canvas.height);
  }

  function drawTerrainStroke(ctx: CanvasRenderingContext2D, stroke: TerrainStroke, size: number): void {
    const color = stroke.tile ? TILE_MAP_COLORS[stroke.tile] : BASE_COLOR;
    const scale = size / WORLD_SIZE;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (stroke.kind === 'line') {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, stroke.size * scale);
      ctx.beginPath();
      ctx.moveTo(stroke.x * scale, stroke.y * scale);
      ctx.lineTo((stroke.x2 ?? stroke.x) * scale, (stroke.y2 ?? stroke.y) * scale);
      ctx.stroke();
      return;
    }

    if (stroke.kind === 'rect_fill' || stroke.kind === 'rect_outline') {
      const x2 = stroke.x2 ?? stroke.x;
      const y2 = stroke.y2 ?? stroke.y;
      const left = Math.min(stroke.x, x2) * scale;
      const top = Math.min(stroke.y, y2) * scale;
      const width = Math.max(1, Math.abs(x2 - stroke.x) * scale);
      const height = Math.max(1, Math.abs(y2 - stroke.y) * scale);
      if (stroke.kind === 'rect_fill') ctx.fillRect(left, top, width, height);
      else {
        ctx.lineWidth = Math.max(1, stroke.size * scale);
        ctx.strokeRect(left, top, width, height);
      }
      return;
    }

    const half = Math.floor(stroke.size / 2);
    const left = Math.max(0, stroke.x - half);
    const top = Math.max(0, stroke.y - half);
    const right = Math.min(WORLD_SIZE, stroke.x + half + 1);
    const bottom = Math.min(WORLD_SIZE, stroke.y + half + 1);
    ctx.fillRect(
      left * scale,
      top * scale,
      Math.max(1, (right - left) * scale),
      Math.max(1, (bottom - top) * scale),
    );
  }

  function drawMarker(ctx: CanvasRenderingContext2D, marker: EditorMarker, size: number, largeMode: boolean): void {
    const x = (marker.x / WORLD_SIZE) * size;
    const y = (marker.y / WORLD_SIZE) * size;
    ctx.fillStyle = MARKER_COLORS[marker.type];
    ctx.strokeStyle = '#111';
    ctx.lineWidth = largeMode ? 1.5 : 1;
    const radius = marker.type === 'city' || marker.type === 'castle'
      ? (largeMode ? 4.3 : 2.7)
      : (largeMode ? 3.4 : 2.2);
    mapDot(ctx, x, y, radius);
    ctx.stroke();

    if (largeMode) {
      ctx.font = marker.type === 'city' ? 'bold 10px system-ui, sans-serif' : '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.strokeText(marker.name, x, y - radius - 4);
      ctx.fillText(marker.name, x, y - radius - 4);
    }
  }

  function drawViewport(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const viewport = options.getViewport();
    const vw = Math.max(2, (viewport.visibleWidth / WORLD_SIZE) * width);
    const vh = Math.max(2, (viewport.visibleHeight / WORLD_SIZE) * height);
    const x = (viewport.centerX / WORLD_SIZE) * width - vw / 2;
    const y = (viewport.centerY / WORLD_SIZE) * height - vh / 2;
    ctx.strokeStyle = '#5cff72';
    ctx.lineWidth = width > 300 ? 2 : 1;
    ctx.strokeRect(x, y, vw, vh);
    ctx.fillStyle = 'rgba(92,255,114,0.10)';
    ctx.fillRect(x, y, vw, vh);
  }

  function mapDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function jumpFromCanvas(event: MouseEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(((event.clientX - rect.left) / rect.width) * WORLD_SIZE)));
    const y = Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(((event.clientY - rect.top) / rect.height) * WORLD_SIZE)));
    options.onJump(x, y);
    redraw();
  }

  function redrawNow(): void {
    framePending = false;
    drawMap(mini, false);
    if (!modal.classList.contains('hidden')) drawMap(large, true);
  }

  function redraw(): void {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(redrawNow);
  }

  function markEditsDirty(): void {
    editRevision++;
    miniStatic = null;
    largeStatic = null;
  }

  function toggleLarge(): void {
    modal.classList.toggle('hidden');
    redraw();
  }

  function closeLarge(): void {
    modal.classList.add('hidden');
  }

  mini.addEventListener('click', (e) => jumpFromCanvas(e, mini));
  large.addEventListener('click', (e) => jumpFromCanvas(e, large));
  expand.addEventListener('click', toggleLarge);
  close.addEventListener('click', closeLarge);
  modal.addEventListener('mousedown', (e) => {
    if (e.target === modal) closeLarge();
  });

  redraw();
  return { element: panel, redraw, markEditsDirty, toggleLarge, closeLarge };
}

function parseKey(key: string): [number, number] {
  const comma = key.indexOf(',');
  return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
}
