import { el } from './dom';
import type { Game } from '../core/Game';
import { TOWNS, RUINS, ORE_VEINS, RIVERS, WORLD_SIZE, type Town } from '../world/AeldorData';
import { TILE_MAP_COLORS } from './mapColors';
import { findNearestWalkable } from '../systems/Pathfinding';
import { log } from '../core/EventBus';

const CANVAS_SIZE = 560;
const ZOOM_SPANS = [WORLD_SIZE, WORLD_SIZE / 3, WORLD_SIZE / 9];

export function buildWorldMap(root: HTMLElement, game: Game) {
  const canvas = el('canvas', {
    className: 'worldmap-canvas',
    attrs: { width: String(CANVAS_SIZE), height: String(CANVAS_SIZE) },
  }) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  const zoomOutBtn = el('button', { className: 'worldmap-zoom-btn', text: '−', attrs: { title: 'Zoom out' } });
  const zoomInBtn = el('button', { className: 'worldmap-zoom-btn', text: '+', attrs: { title: 'Zoom in' } });
  const zoomLabel = el('span', { className: 'worldmap-zoom-label', text: '' });
  const closeBtn = el('span', { className: 'close-x', text: '✕', attrs: { id: 'worldmap-close' } });

  const panel = el('div', { className: 'panel worldmap-panel hidden', attrs: { id: 'panel-worldmap' } }, [
    el('h2', {}, ['The Twin Lands - World Map', closeBtn]),
    el('div', { className: 'worldmap-canvas-wrap' }, [canvas]),
    el('div', { className: 'worldmap-controls' }, [
      zoomOutBtn, zoomLabel, zoomInBtn,
      el('span', { className: 'worldmap-hint', text: 'Click anywhere to travel there instantly · mining sites are public' }),
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
    const key = `${span}:${Math.round(c.x / 4)}:${Math.round(c.y / 4)}`;
    if (baseCache && baseCache.key === key) return baseCache.canvas;

    const sampleSize = CANVAS_SIZE / 2;
    const sample = document.createElement('canvas');
    sample.width = sampleSize;
    sample.height = sampleSize;
    const sctx = sample.getContext('2d')!;
    const startX = c.x - span / 2;
    const startY = c.y - span / 2;
    const stepWorld = span / sampleSize;
    const img = sctx.createImageData(sampleSize, sampleSize);

    for (let py = 0; py < sampleSize; py++) {
      const wy = Math.round(startY + py * stepWorld);
      for (let px = 0; px < sampleSize; px++) {
        const wx = Math.round(startX + px * stepWorld);
        const tile = wx < 0 || wy < 0 || wx >= WORLD_SIZE || wy >= WORLD_SIZE
          ? 'deep_water'
          : game.world.gen.tileAt(wx, wy);
        const hex = TILE_MAP_COLORS[tile] ?? '#000000';
        const i = (py * sampleSize + px) * 4;
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[i + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);

    const off = document.createElement('canvas');
    off.width = CANVAS_SIZE;
    off.height = CANVAS_SIZE;
    const octx = off.getContext('2d')!;
    octx.imageSmoothingEnabled = true;
    octx.drawImage(sample, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    baseCache = { key, canvas: off };
    return off;
  }

  function drawMiningMarker(sx: number, sy: number) {
    ctx.fillStyle = '#111111';
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#f3f3f3';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - 2.7, sy + 3.0);
    ctx.lineTo(sx + 2.5, sy - 2.7);
    ctx.moveTo(sx - 1.8, sy - 2.3);
    ctx.quadraticCurveTo(sx + 0.8, sy - 4.2, sx + 3.6, sy - 1.7);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function settlementRadius(town: Town): number {
    switch (town.kind) {
      case 'capital': return 5;
      case 'city': return 4;
      case 'town': return 3.2;
      case 'village': return 2.6;
      case 'hamlet': return 2.1;
      default: return 1.7;
    }
  }

  function shouldLabelTown(town: Town): boolean {
    if (town.kind === 'capital' || town.kind === 'city') return true;
    if (zoomIndex >= 1 && town.kind === 'town') return true;
    return zoomIndex >= 2 && (town.kind === 'village' || town.kind === 'hamlet');
  }

  function draw() {
    const c = center();
    const span = ZOOM_SPANS[zoomIndex];
    ctx.drawImage(renderBaseTerrain(c, span), 0, 0);

    function marker(wx: number, wy: number, paint: (sx: number, sy: number) => void) {
      const { x: sx, y: sy } = worldToCanvas(wx, wy, c, span);
      if (sx < -10 || sx > CANVAS_SIZE + 10 || sy < -10 || sy > CANVAS_SIZE + 10) return;
      paint(sx, sy);
    }

    // Rivers are only a handful of tiles wide in the local world; draw their
    // authored courses over the continental map so they remain useful landmarks.
    ctx.save();
    ctx.strokeStyle = '#2d7fbe';
    ctx.lineWidth = zoomIndex === 0 ? 1.1 : 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const river of RIVERS) {
      ctx.beginPath();
      river.points.forEach((p, i) => {
        const s = worldToCanvas(p.x, p.y, c, span);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
    }
    ctx.restore();

    for (const vein of ORE_VEINS) {
      marker(vein.x, vein.y, (sx, sy) => {
        drawMiningMarker(sx, sy);
        if (zoomIndex >= 2) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeText(vein.name, sx, sy - 9);
          ctx.fillText(vein.name, sx, sy - 9);
        }
      });
    }

    for (const r of RUINS) {
      marker(r.x, r.y, (sx, sy) => {
        ctx.fillStyle = '#c04040';
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    for (const t of TOWNS) {
      marker(t.x, t.y, (sx, sy) => {
        const radius = settlementRadius(t);
        ctx.fillStyle = t.capital ? '#ffd700' : '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (shouldLabelTown(t)) {
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.font = t.capital ? 'bold 11px sans-serif' : '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeText(t.name, sx, sy - radius - 4);
          ctx.fillText(t.name, sx, sy - radius - 4);
        }
      });
    }

    marker(game.player.x, game.player.y, (sx, sy) => {
      ctx.fillStyle = '#ffee55';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

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
      log("You can't find solid ground to travel to there.", 'warning');
      return;
    }
    const player = game.player;
    player.action = null;
    player.combatTargetId = null;
    player.path = [];
    player.x = dest.x;
    player.y = dest.y;
    log('You travel across the map to your destination.', 'info');
    close();
  });

  zoomInBtn.addEventListener('click', () => {
    zoomIndex = Math.min(ZOOM_SPANS.length - 1, zoomIndex + 1);
    draw();
  });
  zoomOutBtn.addEventListener('click', () => {
    zoomIndex = Math.max(0, zoomIndex - 1);
    draw();
  });
  closeBtn.addEventListener('click', () => close());

  function open() {
    zoomIndex = 0;
    panel.classList.remove('hidden');
    draw();
  }

  function close() {
    panel.classList.add('hidden');
  }

  return { panel, open, close };
}
