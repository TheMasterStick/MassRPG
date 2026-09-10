import { el } from './dom';
import type { Game } from '../core/Game';
import { WORLD_SIZE } from '../world/AeldorData';
import { loadEditorWorld, type EditorMarker, type EditorMarkerType, type TerrainStroke } from '../world/EditorWorld';
import { TILE_MAP_COLORS } from './mapColors';
import { findNearestWalkable } from '../systems/Pathfinding';
import { log } from '../core/EventBus';

const CANVAS_SIZE = 560;
const ZOOM_SPANS = [WORLD_SIZE, WORLD_SIZE / 3, WORLD_SIZE / 9];

const MARKER_COLORS: Record<EditorMarkerType, string> = {
  settlement: '#f2f2f2',
  village: '#8ee28e',
  town: '#f1d56b',
  city: '#ff7777',
  castle: '#c391ff',
  mining_area: '#ff8a32',
};

export function buildWorldMap(root: HTMLElement, game: Game) {
  const canvas = el('canvas', {
    className: 'worldmap-canvas',
    attrs: { width: String(CANVAS_SIZE), height: String(CANVAS_SIZE) },
  }) as HTMLCanvasElement;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('World map requires Canvas 2D.');
  const ctx: CanvasRenderingContext2D = context;

  const zoomOutBtn = el('button', { className: 'worldmap-zoom-btn', text: '−', attrs: { title: 'Zoom out' } });
  const zoomInBtn = el('button', { className: 'worldmap-zoom-btn', text: '+', attrs: { title: 'Zoom in' } });
  const zoomLabel = el('span', { className: 'worldmap-zoom-label', text: '' });
  const closeBtn = el('span', { className: 'close-x', text: '✕', attrs: { id: 'worldmap-close' } });

  const panel = el('div', { className: 'panel worldmap-panel hidden', attrs: { id: 'panel-worldmap' } }, [
    el('h2', {}, ['The Twin Lands - World Map', closeBtn]),
    el('div', { className: 'worldmap-canvas-wrap' }, [canvas]),
    el('div', { className: 'worldmap-controls' }, [
      zoomOutBtn, zoomLabel, zoomInBtn,
      el('span', { className: 'worldmap-hint', text: 'This map is built from your World Editor terrain and reference markers.' }),
    ]),
  ]);
  root.append(panel);

  let zoomIndex = 0;
  let baseCache: { key: string; canvas: HTMLCanvasElement } | null = null;

  function center(): { x: number; y: number } {
    if (zoomIndex === 0) return { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };
    return { x: game.player.x, y: game.player.y };
  }

  function worldToCanvas(wx: number, wy: number, c: { x: number; y: number }, span: number) {
    const scale = CANVAS_SIZE / span;
    return { x: (wx - c.x) * scale + CANVAS_SIZE / 2, y: (wy - c.y) * scale + CANVAS_SIZE / 2 };
  }

  function canvasToWorld(px: number, py: number, c: { x: number; y: number }, span: number) {
    const scale = CANVAS_SIZE / span;
    return { x: c.x + (px - CANVAS_SIZE / 2) / scale, y: c.y + (py - CANVAS_SIZE / 2) / scale };
  }

  function renderBaseTerrain(c: { x: number; y: number }, span: number): HTMLCanvasElement {
    const data = loadEditorWorld(WORLD_SIZE);
    const key = `${data.updatedAt}:${span}:${Math.round(c.x)}:${Math.round(c.y)}`;
    if (baseCache?.key === key) return baseCache.canvas;

    const off = document.createElement('canvas');
    off.width = CANVAS_SIZE;
    off.height = CANVAS_SIZE;
    const maybe = off.getContext('2d');
    if (!maybe) throw new Error('World map cache requires Canvas 2D.');
    const octx: CanvasRenderingContext2D = maybe;
    octx.fillStyle = TILE_MAP_COLORS.deep_water;
    octx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (const stroke of data.terrainStrokes) drawStroke(octx, stroke, c, span);
    for (const [keyCell, cell] of Object.entries(data.cells)) {
      if (!cell.tile) continue;
      const comma = keyCell.indexOf(',');
      const wx = Number(keyCell.slice(0, comma));
      const wy = Number(keyCell.slice(comma + 1));
      const p = worldToCanvas(wx, wy, c, span);
      if (p.x < -2 || p.y < -2 || p.x > CANVAS_SIZE + 2 || p.y > CANVAS_SIZE + 2) continue;
      octx.fillStyle = TILE_MAP_COLORS[cell.tile];
      octx.fillRect(Math.floor(p.x), Math.floor(p.y), zoomIndex === 0 ? 1 : 2, zoomIndex === 0 ? 1 : 2);
    }

    baseCache = { key, canvas: off };
    return off;
  }

  function drawStroke(octx: CanvasRenderingContext2D, stroke: TerrainStroke, c: { x: number; y: number }, span: number) {
    const scale = CANVAS_SIZE / span;
    const color = stroke.tile ? TILE_MAP_COLORS[stroke.tile] : TILE_MAP_COLORS.deep_water;
    octx.fillStyle = color;
    octx.strokeStyle = color;

    if (stroke.kind === 'line') {
      const a = worldToCanvas(stroke.x, stroke.y, c, span);
      const b = worldToCanvas(stroke.x2 ?? stroke.x, stroke.y2 ?? stroke.y, c, span);
      octx.lineCap = 'round';
      octx.lineJoin = 'round';
      octx.lineWidth = Math.max(1, stroke.size * scale);
      octx.beginPath();
      octx.moveTo(a.x, a.y);
      octx.lineTo(b.x, b.y);
      octx.stroke();
      return;
    }

    if (stroke.kind === 'rect_fill' || stroke.kind === 'rect_outline') {
      const x2 = stroke.x2 ?? stroke.x;
      const y2 = stroke.y2 ?? stroke.y;
      const left = Math.min(stroke.x, x2);
      const top = Math.min(stroke.y, y2);
      const right = Math.max(stroke.x, x2);
      const bottom = Math.max(stroke.y, y2);
      const p = worldToCanvas(left, top, c, span);
      const width = Math.max(1, (right - left + 1) * scale);
      const height = Math.max(1, (bottom - top + 1) * scale);
      if (stroke.kind === 'rect_fill') octx.fillRect(p.x, p.y, width, height);
      else {
        octx.lineWidth = Math.max(1, stroke.size * scale);
        octx.strokeRect(p.x, p.y, width, height);
      }
      return;
    }

    const half = Math.floor(stroke.size / 2);
    const topLeft = worldToCanvas(stroke.x - half, stroke.y - half, c, span);
    const sizePx = stroke.size * scale;
    if (topLeft.x > CANVAS_SIZE || topLeft.y > CANVAS_SIZE || topLeft.x + sizePx < 0 || topLeft.y + sizePx < 0) return;
    octx.fillRect(topLeft.x, topLeft.y, Math.max(1, sizePx), Math.max(1, sizePx));
  }

  function drawMarker(marker: EditorMarker, c: { x: number; y: number }, span: number) {
    const p = worldToCanvas(marker.x, marker.y, c, span);
    if (p.x < -12 || p.y < -12 || p.x > CANVAS_SIZE + 12 || p.y > CANVAS_SIZE + 12) return;
    const radius = marker.type === 'city' || marker.type === 'castle' ? 4.5 : 3.5;
    ctx.fillStyle = MARKER_COLORS[marker.type];
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const shouldLabel = zoomIndex > 0 || marker.type === 'city' || marker.type === 'castle';
    if (shouldLabel) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.font = marker.type === 'city' ? 'bold 10px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(marker.name, p.x, p.y - radius - 4);
      ctx.fillText(marker.name, p.x, p.y - radius - 4);
    }
  }

  function draw() {
    const c = center();
    const span = ZOOM_SPANS[zoomIndex];
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(renderBaseTerrain(c, span), 0, 0);

    const data = loadEditorWorld(WORLD_SIZE);
    for (const marker of data.markers) drawMarker(marker, c, span);

    const player = worldToCanvas(game.player.x, game.player.y, c, span);
    ctx.fillStyle = '#ffee55';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    zoomLabel.textContent = zoomIndex === 0 ? 'Whole Twin Lands' : `Zoom ${zoomIndex}/${ZOOM_SPANS.length - 1}`;
    zoomOutBtn.toggleAttribute('disabled', zoomIndex === 0);
    zoomInBtn.toggleAttribute('disabled', zoomIndex === ZOOM_SPANS.length - 1);
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE;
    const target = canvasToWorld(px, py, center(), ZOOM_SPANS[zoomIndex]);
    const tile = { x: Math.round(target.x), y: Math.round(target.y) };
    const dest = findNearestWalkable(game.world, tile);
    if (!dest) {
      log("You can't find authored land to travel to there.", 'warning');
      return;
    }
    game.player.action = null;
    game.player.combatTargetId = null;
    game.player.path = [];
    game.player.x = dest.x;
    game.player.y = dest.y;
    log('You travel across the map to your destination.', 'info');
    close();
  });

  zoomInBtn.addEventListener('click', () => { zoomIndex = Math.min(ZOOM_SPANS.length - 1, zoomIndex + 1); baseCache = null; draw(); });
  zoomOutBtn.addEventListener('click', () => { zoomIndex = Math.max(0, zoomIndex - 1); baseCache = null; draw(); });
  closeBtn.addEventListener('click', () => close());

  function open() {
    zoomIndex = 0;
    baseCache = null;
    panel.classList.remove('hidden');
    draw();
  }

  function close() {
    panel.classList.add('hidden');
  }

  return { panel, open, close };
}
