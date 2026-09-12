import { WORLD_SIZE } from '../world/AeldorData';

/**
 * Keyboard camera navigation for the world editor. The underlying V6 editor
 * keeps camera state private, so this adapter drives the existing coordinate
 * inputs + Go action instead of duplicating editor camera state.
 *
 * Movement is continuous while a key is held and scales with zoom so WASD feels
 * like screen-space panning at both detailed and macro-map scales. Right/middle
 * drag remains available as a secondary grab-pan control.
 */
export function installEditorCameraControls(root: HTMLElement): void {
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas')!;
  if (!toolbar || !canvas) return;

  const numberInputs = [...toolbar.querySelectorAll<HTMLInputElement>('input[type="number"]')];
  const xInput = numberInputs[0];
  const yInput = numberInputs[1];
  const goButton = [...toolbar.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.trim() === 'Go')!;
  const zoomSelect = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
    .find((select) => select.selectedOptions[0]?.textContent?.includes('px / tile'))!;
  if (!xInput || !yInput || !goButton || !zoomSelect) return;

  const help = root.querySelector<HTMLElement>('.editor-overlay-help');
  if (help && !help.textContent?.includes('WASD')) {
    help.textContent = (help.textContent ?? '').replace('right-drag pans', 'WASD / right-drag pans');
  }

  // Canvas normally is not focusable. Explicit focus is important because a
  // previously used select/input could otherwise keep receiving W/A/S/D while
  // the user is actively left-dragging structures on the map.
  canvas.tabIndex = 0;
  canvas.style.outline = 'none';
  canvas.addEventListener('mousedown', () => canvas.focus({ preventScroll: true }), { capture: true });

  const held = new Set<string>();
  let frame = 0;
  let lastTime = 0;
  let preciseX = Number(xInput.value) || WORLD_SIZE / 2;
  let preciseY = Number(yInput.value) || WORLD_SIZE / 2;

  function isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement;
  }

  function tilePixels(): number {
    const px = Number.parseFloat(zoomSelect.selectedOptions[0]?.textContent ?? '1');
    return Number.isFinite(px) && px > 0 ? px : 1;
  }

  function clamp(value: number): number {
    return Math.max(0, Math.min(WORLD_SIZE - 1, value));
  }

  function syncPreciseFromEditor(): void {
    preciseX = Number(xInput.value) || preciseX;
    preciseY = Number(yInput.value) || preciseY;
  }

  function direction(): { x: number; y: number } {
    const x = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
    const y = (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0);
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  }

  function tick(now: number): void {
    if (held.size === 0) {
      frame = 0;
      lastTime = 0;
      return;
    }

    const dt = lastTime === 0 ? 0 : Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const dir = direction();
    if (dt > 0 && (dir.x !== 0 || dir.y !== 0)) {
      const screenPixelsPerSecond = held.has('ShiftLeft') || held.has('ShiftRight') ? 1050 : 520;
      const tilesPerSecond = screenPixelsPerSecond / tilePixels();
      preciseX = clamp(preciseX + dir.x * tilesPerSecond * dt);
      preciseY = clamp(preciseY + dir.y * tilesPerSecond * dt);

      const nextX = Math.round(preciseX);
      const nextY = Math.round(preciseY);
      if (Number(xInput.value) !== nextX || Number(yInput.value) !== nextY) {
        xInput.value = String(nextX);
        yInput.value = String(nextY);
        goButton.click();
      }
    }
    frame = requestAnimationFrame(tick);
  }

  function ensureLoop(): void {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  // Capture navigation before object/spawn shortcut handlers. Only genuine form
  // editing suppresses WASD; map painting always leaves camera movement active.
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) return;

    if (event.code.startsWith('Key')) {
      event.preventDefault();
      if (held.size === 0) syncPreciseFromEditor();
    }
    held.add(event.code);
    ensureLoop();
  }, { capture: true });

  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  }, { capture: true });

  window.addEventListener('blur', () => {
    held.clear();
  });

  // Mouse panning, world-map jumps and coordinate Go operations can change the
  // editor camera without this module knowing. Re-sync before the next WASD move.
  canvas.addEventListener('mousedown', syncPreciseFromEditor);
  toolbar.addEventListener('click', () => {
    if (held.size === 0) queueMicrotask(syncPreciseFromEditor);
  });
}
