/**
 * The detailed editor redraw is intentionally rich (terrain sprites, elevation,
 * objects and several authoring overlays). At high px/tile, processing every raw
 * mousemove event can build an input backlog and feel delayed. Cap hover/brush
 * redraws to a responsive ~30-40 fps; the brush/line code interpolates world
 * coordinates, so this does not create gaps in painted lines.
 */
export function installEditorPerformanceGuard(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas');
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar');
  if (!canvas || !toolbar) return;

  let lastAccepted = 0;

  function tilePixels(): number {
    const zoom = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((select) => select.selectedOptions[0]?.textContent?.includes('px / tile'));
    const value = Number.parseFloat(zoom?.selectedOptions[0]?.textContent ?? '1');
    return Number.isFinite(value) ? value : 1;
  }

  canvas.addEventListener('mousemove', (event) => {
    const now = performance.now();
    const px = tilePixels();
    const interval = px >= 32 ? 30 : px >= 8 ? 24 : 16;
    if (now - lastAccepted < interval) {
      // Allow already-running capture helpers to finish, but prevent the costly
      // base V6 bubble redraw for this redundant high-frequency mouse sample.
      event.stopPropagation();
      return;
    }
    lastAccepted = now;
  }, { capture: true });
}
