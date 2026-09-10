import { ORE_VEINS, TOWNS, WORLD_SIZE } from '../world/AeldorData';
import type { EditorWorldData, TerrainStroke } from '../world/EditorWorld';
import type { WorldGen } from '../world/WorldGen';
import { TILE_MAP_COLORS } from '../ui/mapColors';

interface ViewportState {
  centerX: number;
  centerY: number;
  visibleWidth: number;
  visibleHeight: number;
}

interface NavigatorOptions {
  gen: WorldGen;
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

const BASE_SAMPLE = 256;
const MINI_SIZE = 220;
const LARGE_SIZE = 760;

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
  legend.innerHTML = '<span>□ viewport</span><span class="town-dot">● towns</span><span class="mine-dot">● mines</span><span class="edit-dot">● manual objects</span>';
  panel.append(header, mini, legend);

  const modal = document.createElement('div');
  modal.className = 'editor-map-modal hidden';
  const modalBox = document.createElement('div');
  modalBox.className = 'editor-map-modal-box';
  const modalHeader = document.createElement('div');
  modalHeader.className = 'editor-map-modal-header';
  const modalTitle = document.createElement('strong');
  modalTitle.textContent = 'Twin Lands — Editor World Map';
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

  let baseMap: HTMLCanvasElement | null = null;
  let editRevision = 0;
  let miniStatic: StaticMapCache | null = null;
  let largeStatic: StaticMapCache | null = null;

  function ensureBaseMap(): HTMLCanvasElement {
    if (baseMap) return baseMap;
    const c = document.createElement('canvas');
    c.width = BASE_SAMPLE;
    c.height = BASE_SAMPLE;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(BASE_SAMPLE, BASE_SAMPLE);
    for (let py = 0; py < BASE_SAMPLE; py++) {
      const wy = Math.round(((py + 0.5) / BASE_SAMPLE) * (WORLD_SIZE - 1));
      for (let px = 0; px < BASE_SAMPLE; px++) {
        const wx = Math.round(((px + 0.5) / BASE_SAMPLE) * (WORLD_SIZE - 1));
        const rgb = hexToRgb(TILE_MAP_COLORS[options.gen.tileAt(wx, wy)] ?? '#000000');
        const i = (py * BASE_SAMPLE + px) * 4;
        img.data[i] = rgb[0];
        img.data[i + 1] = rgb[1];
        img.data[i + 2] = rgb[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    baseMap = c;
    return c;
  }

  function staticMap(size: number, largeMode: boolean): HTMLCanvasElement {
    const existing = largeMode ? largeStatic : miniStatic;
    if (existing && existing.revision === editRevision) return existing.canvas;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const base = ensureBaseMap();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, 0, 0, size, size);

    const data = options.getData();
    for (const stroke of data.terrainStrokes) drawTerrainStroke(ctx, base, stroke, size, size);

    // Cell-level terrain edits sit above broad terrain strokes.
    for (const [key, cell] of Object.entries(data.cells)) {
      if (!cell.tile) continue;
      const [x, y] = parseKey(key);
      ctx.fillStyle = TILE_MAP_COLORS[cell.tile];
      const sx = (x / WORLD_SIZE) * size;
      const sy = (y / WORLD_SIZE) * size;
      const dot = largeMode ? 2 : 1;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), dot, dot);
    }

    // Hand-placed world objects remain visible even when their terrain edit is
    // too small to register at continental scale.
    for (const [key, cell] of Object.entries(data.cells)) {
      const [x, y] = parseKey(key);
      const sx = (x / WORLD_SIZE) * size;
      const sy = (y / WORLD_SIZE) * size;
      if (cell.resource) {
        ctx.fillStyle = cell.resource.startsWith('rock_') ? '#101010' : '#1f8c3f';
        mapDot(ctx, sx, sy, largeMode ? 2.4 : 1.5);
      } else if (cell.structure) {
        ctx.fillStyle = '#f1c15a';
        mapDot(ctx, sx, sy, largeMode ? 2.2 : 1.35);
      } else if (cell.spawner) {
        ctx.fillStyle = '#d84b4b';
        mapDot(ctx, sx, sy, largeMode ? 2.2 : 1.35);
      }
    }

    // Existing generated reference points are navigation aids, not secrets.
    for (const town of TOWNS) {
      const sx = (town.x / WORLD_SIZE) * size;
      const sy = (town.y / WORLD_SIZE) * size;
      ctx.fillStyle = town.capital ? '#ffe35a' : '#f5f5f5';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = largeMode ? 1.5 : 1;
      mapDot(ctx, sx, sy, town.capital ? (largeMode ? 4 : 2.7) : (largeMode ? 3 : 2));
      ctx.stroke();
      if (largeMode && size >= 600) {
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.strokeText(town.name, sx, sy - 7);
        ctx.fillText(town.name, sx, sy - 7);
      }
    }
    for (const mine of ORE_VEINS) {
      const sx = (mine.x / WORLD_SIZE) * size;
      const sy = (mine.y / WORLD_SIZE) * size;
      ctx.fillStyle = '#ff8a32';
      mapDot(ctx, sx, sy, largeMode ? 3.2 : 2.1);
    }

    const next = { revision: editRevision, canvas };
    if (largeMode) largeStatic = next;
    else miniStatic = next;
    return canvas;
  }

  function drawMap(canvas: HTMLCanvasElement, largeMode: boolean): void {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticMap(canvas.width, largeMode), 0, 0);
    drawViewport(ctx, canvas.width, canvas.height);
  }

  function drawTerrainStroke(
    ctx: CanvasRenderingContext2D,
    base: HTMLCanvasElement,
    stroke: TerrainStroke,
    width: number,
    height: number,
  ): void {
    const half = Math.floor(stroke.size / 2);
    const left = Math.max(0, stroke.x - half);
    const top = Math.max(0, stroke.y - half);
    const right = Math.min(WORLD_SIZE, stroke.x + half + 1);
    const bottom = Math.min(WORLD_SIZE, stroke.y + half + 1);
    const dx = (left / WORLD_SIZE) * width;
    const dy = (top / WORLD_SIZE) * height;
    const dw = Math.max(1, ((right - left) / WORLD_SIZE) * width);
    const dh = Math.max(1, ((bottom - top) / WORLD_SIZE) * height);

    if (stroke.tile === null) {
      const sx = (left / WORLD_SIZE) * base.width;
      const sy = (top / WORLD_SIZE) * base.height;
      const sw = Math.max(1, ((right - left) / WORLD_SIZE) * base.width);
      const sh = Math.max(1, ((bottom - top) / WORLD_SIZE) * base.height);
      ctx.drawImage(base, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = TILE_MAP_COLORS[stroke.tile];
      ctx.fillRect(dx, dy, dw, dh);
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

  function redraw(): void {
    drawMap(mini, false);
    if (!modal.classList.contains('hidden')) drawMap(large, true);
  }

  function markEditsDirty(): void {
    editRevision++;
    miniStatic = null;
    largeStatic = null;
  }

  function toggleLarge(): void {
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) drawMap(large, true);
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

  return { element: panel, redraw, markEditsDirty, toggleLarge, closeLarge };
}

function parseKey(key: string): [number, number] {
  const comma = key.indexOf(',');
  return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.startsWith('#') ? hex.slice(1) : hex;
  return [
    parseInt(value.slice(0, 2), 16) || 0,
    parseInt(value.slice(2, 4), 16) || 0,
    parseInt(value.slice(4, 6), 16) || 0,
  ];
}
