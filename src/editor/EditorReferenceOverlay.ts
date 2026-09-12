import { WORLD_SIZE } from '../world/AeldorData';
import { loadEditorWorld } from '../world/EditorWorld';
import type { WorldPlane } from '../world/types';

const CAPITAL_GROUND_RADIUS = 48;
const CAPITAL_SAFE_RADIUS = 64;

/**
 * Draw reference-only runtime footprints which matter while authoring but are not
 * themselves baked terrain. In particular, the Capital City marker is also the
 * fresh-character spawn and currently drives a temporary cobblestone/service
 * footprint at runtime.
 */
export function installEditorReferenceOverlay(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas')!;
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar')!;
  const wrap = canvas.parentElement!;
  if (!canvas || !toolbar || !wrap) return;

  const overlay = document.createElement('canvas');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '1';
  wrap.append(overlay);
  const ctx = overlay.getContext('2d')!;
  if (!ctx) return;

  let frame = 0;

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

  function currentCenter(): { x: number; y: number } {
    const inputs = [...toolbar.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    return {
      x: Number(inputs[0]?.value ?? WORLD_SIZE / 2),
      y: Number(inputs[1]?.value ?? WORLD_SIZE / 2),
    };
  }

  function requestDraw(): void {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  function draw(): void {
    frame = 0;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (overlay.width !== Math.round(width * dpr) || overlay.height !== Math.round(height * dpr)) {
      overlay.width = Math.round(width * dpr);
      overlay.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (currentPlane() !== 0) return;

    const capital = loadEditorWorld(WORLD_SIZE).markers.find(
      (marker) => marker.plane === 0 && marker.name.trim().toLowerCase() === 'capital city',
    );
    if (!capital) return;

    const tilePx = currentZoom();
    const center = currentCenter();
    const sx = width / 2 + (capital.x - center.x) * tilePx + tilePx / 2;
    const sy = height / 2 + (capital.y - center.y) * tilePx + tilePx / 2;
    const groundPx = CAPITAL_GROUND_RADIUS * tilePx;
    const safePx = CAPITAL_SAFE_RADIUS * tilePx;
    if (sx + safePx < 0 || sy + safePx < 0 || sx - safePx > width || sy - safePx > height) return;

    // Temporary runtime cobblestone/service reference.
    ctx.save();
    ctx.fillStyle = 'rgba(225,186,92,.045)';
    ctx.strokeStyle = 'rgba(235,197,104,.72)';
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 6]);
    ctx.beginPath();
    ctx.rect(sx - groundPx, sy - groundPx, groundPx * 2, groundPx * 2);
    ctx.fill();
    ctx.stroke();

    // Ambient monster suppression around the capital.
    ctx.strokeStyle = 'rgba(110,205,255,.48)';
    ctx.setLineDash([3, 7]);
    ctx.strokeRect(sx - safePx, sy - safePx, safePx * 2, safePx * 2);

    // Exact new-character spawn.
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff9c4a';
    ctx.strokeStyle = '#1d1208';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(4, Math.min(8, tilePx * 0.18)), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (tilePx >= 8) {
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      const label = 'Capital spawn · runtime floor ±48 · safe ±64';
      const tx = sx - groundPx;
      const ty = sy - groundPx - 6;
      ctx.strokeStyle = 'rgba(16,16,16,.95)';
      ctx.strokeText(label, tx, ty);
      ctx.fillStyle = '#ffe0a4';
      ctx.fillText(label, tx, ty);
    }
    ctx.restore();
  }

  toolbar.addEventListener('change', requestDraw);
  toolbar.addEventListener('input', requestDraw);
  toolbar.addEventListener('click', requestDraw);
  canvas.addEventListener('wheel', requestDraw, { passive: true });
  canvas.addEventListener('mousemove', requestDraw, { passive: true });
  window.addEventListener('resize', requestDraw);
  requestDraw();
}
