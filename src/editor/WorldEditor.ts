import { launchWorldEditor as launchWorldEditorV6 } from './WorldEditorV6';

/**
 * The editor does a substantial amount of canvas work per mousemove. Gaming mice
 * and forwarded Codespaces browsers can deliver hundreds of mousemove events per
 * second, which made macro-map painting feel much heavier than the actual world
 * data warranted. Gate those events before the editor's normal bubble listener:
 * ~30 fps at continental zoom, ~60 fps while doing close detail work.
 */
export function launchWorldEditor(root: HTMLElement): void {
  launchWorldEditorV6(root);
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas');
  if (!canvas) return;

  let lastAcceptedMove = 0;
  canvas.addEventListener('mousemove', (event) => {
    const now = performance.now();
    const zoomSelect = [...root.querySelectorAll<HTMLSelectElement>('.editor-toolbar select')]
      .find((select) => select.selectedOptions[0]?.textContent?.includes('px / tile'));
    const pxPerTile = Number.parseFloat(zoomSelect?.selectedOptions[0]?.textContent ?? '1');
    const interval = Number.isFinite(pxPerTile) && pxPerTile < 0.2 ? 32 : 16;
    if (now - lastAcceptedMove < interval) {
      event.stopImmediatePropagation();
      return;
    }
    lastAcceptedMove = now;
  }, { capture: true });
}
