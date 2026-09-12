/**
 * High-frequency authoring shortcuts. These intentionally drive the existing V6
 * palette/tool UI so undo/history/save behavior stays inside the editor rather
 * than creating a second mutation path.
 *
 * B = Brush, L = Line, hold X = temporarily erase objects and restore the
 * previous palette selection on release.
 */
export function installEditorWorkflowShortcuts(root: HTMLElement): void {
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar')!;
  const palette = root.querySelector<HTMLElement>('.editor-palette')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas')!;
  if (!toolbar || !palette || !canvas) return;

  const help = root.querySelector<HTMLElement>('.editor-overlay-help');
  if (help && !help.textContent?.includes('hold X')) {
    help.textContent = `${help.textContent ?? ''} · B brush · L line · hold X quick erase`;
  }

  let quickErase = false;
  let previousCategory = '';
  let previousSelection = '';

  function isFormTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement;
  }

  function toolSelect(): HTMLSelectElement | undefined {
    return [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((select) => [...select.options].some((option) => option.value === 'line')
        && [...select.options].some((option) => option.value === 'brush'));
  }

  function setTool(value: 'brush' | 'line'): void {
    const select = toolSelect();
    if (!select) return;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function categoryButtons(): HTMLButtonElement[] {
    return [...palette.querySelectorAll<HTMLButtonElement>('.editor-category-tabs button')];
  }

  function activeCategoryLabel(): string {
    return categoryButtons().find((button) => button.classList.contains('active'))?.textContent?.trim() ?? '';
  }

  function activeSelectionLabel(): string {
    return palette.querySelector<HTMLButtonElement>('.editor-palette-button.active')?.textContent?.trim() ?? '';
  }

  function clickCategory(label: string): boolean {
    const button = categoryButtons().find((candidate) => candidate.textContent?.trim() === label);
    if (!button) return false;
    button.click();
    return true;
  }

  function clickPaletteChoice(label: string): boolean {
    const button = [...palette.querySelectorAll<HTMLButtonElement>('.editor-palette-button')]
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!button) return false;
    button.click();
    return true;
  }

  function beginQuickErase(): void {
    if (quickErase) return;
    previousCategory = activeCategoryLabel();
    previousSelection = activeSelectionLabel();
    if (!clickCategory('Erase')) return;
    if (!clickPaletteChoice('Erase objects')) return;
    quickErase = true;
    canvas.dataset.quickErase = '1';
    canvas.style.cursor = 'not-allowed';
  }

  function endQuickErase(): void {
    if (!quickErase) return;
    quickErase = false;
    delete canvas.dataset.quickErase;
    canvas.style.cursor = '';
    if (previousCategory) {
      clickCategory(previousCategory);
      if (previousSelection) clickPaletteChoice(previousSelection);
    }
    previousCategory = '';
    previousSelection = '';
    // Structure-transform previews are a separate canvas. Force all editor
    // overlays to repaint after an erase so stale transformed ghosts disappear.
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  // Capture X before the edge/object transform listeners, which historically
  // used X for mirroring. Flip remains available through its visible buttons;
  // X is much more valuable as the high-frequency correction key.
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isFormTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (key === 'x') {
      event.preventDefault();
      event.stopImmediatePropagation();
      beginQuickErase();
    } else if (key === 'l') {
      event.preventDefault();
      setTool('line');
    } else if (key === 'b') {
      event.preventDefault();
      setTool('brush');
    }
  }, { capture: true });

  window.addEventListener('keyup', (event) => {
    if (event.key.toLowerCase() !== 'x') return;
    event.preventDefault();
    endQuickErase();
  }, { capture: true });

  window.addEventListener('blur', endQuickErase);

  // Also clear any stale transform overlay after using the ordinary Erase tab.
  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0) return;
    if (quickErase || activeCategoryLabel() === 'Erase') {
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  });
}
