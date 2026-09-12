/**
 * Keep the map dominant. The V6 editor and newer authoring adapters all attach
 * their controls to one toolbar; this organizer groups low-frequency controls
 * without changing their existing event listeners or behavior.
 */
export function installEditorToolbarPolish(root: HTMLElement): void {
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar');
  if (!toolbar) return;

  const styleDetails = (details: HTMLDetailsElement) => {
    details.style.display = 'inline-block';
    details.style.position = 'relative';
    details.style.alignSelf = 'center';
    details.style.border = '1px solid rgba(255,255,255,.14)';
    details.style.borderRadius = '4px';
    details.style.padding = '2px 5px';
    details.style.background = 'rgba(255,255,255,.035)';
  };

  const makeGroup = (label: string, title: string) => {
    const details = document.createElement('details');
    styleDetails(details);
    details.title = title;
    const summary = document.createElement('summary');
    summary.textContent = label;
    summary.style.cursor = 'pointer';
    summary.style.userSelect = 'none';
    summary.style.whiteSpace = 'nowrap';
    const content = document.createElement('span');
    content.style.display = 'flex';
    content.style.flexWrap = 'wrap';
    content.style.gap = '4px';
    content.style.alignItems = 'center';
    content.style.marginTop = '4px';
    details.append(summary, content);
    return { details, content };
  };

  // Everything appended by the blocker/edge/resource/object/spawn adapters starts
  // at Blockers. Collapse that large second toolbar row into one discoverable tray.
  let advancedDetails: HTMLDetailsElement | null = null;
  const blockerSelect = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
    .find((select) => [...select.options].some((option) => option.textContent?.startsWith('Blockers:')));
  if (blockerSelect) {
    const advanced = makeGroup(
      'World Layers',
      'Cliffs/pathing, object transforms, roofs, renewable resource areas and painted spawn zones.',
    );
    advancedDetails = advanced.details;
    const nodes: Node[] = [];
    let cursor: ChildNode | null = blockerSelect;
    while (cursor) {
      const next = cursor.nextSibling;
      nodes.push(cursor);
      cursor = next;
    }
    for (const node of nodes) advanced.content.append(node);
    toolbar.append(advanced.details);
  }

  // Move the useful but lower-frequency base controls behind one compact tray.
  const more = makeGroup('View / Selection', 'Selection, overlays, coordinates and tree-scatter controls.');
  let moved = 0;
  const move = (element: Element | undefined | null) => {
    if (!element || element.parentElement !== toolbar) return;
    more.content.append(element);
    moved++;
  };

  const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>(':scope > button')];
  for (const label of ['Clear all', 'Copy selection', 'Paste/Stamp', 'Fill selection', 'Clear selection', 'Go']) {
    move(buttons.find((button) => button.textContent?.trim() === label));
  }
  for (const label of [...toolbar.querySelectorAll<HTMLLabelElement>(':scope > label')]) move(label);

  const selects = [...toolbar.querySelectorAll<HTMLSelectElement>(':scope > select')];
  move(selects.find((select) => select.selectedOptions[0]?.textContent?.startsWith('Trees:')));
  move(selects.find((select) => select.selectedOptions[0]?.textContent?.startsWith('Grove:')));

  const numberInputs = [...toolbar.querySelectorAll<HTMLInputElement>(':scope > input[type="number"]')];
  const xInput = numberInputs[0];
  const yInput = numberInputs[1];
  if (xInput) {
    const label = document.createElement('span');
    label.textContent = 'X';
    more.content.append(label);
    move(xInput);
  }
  if (yInput) {
    const label = document.createElement('span');
    label.textContent = 'Y';
    more.content.append(label);
    move(yInput);
  }

  // Remove the now-orphaned literal X/Y text nodes from the original toolbar.
  for (const node of [...toolbar.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = node.textContent?.trim();
    if (text === 'X' || text === 'Y') node.remove();
  }

  // Keep X/Y inputs before the advanced group's numeric fields in DOM order.
  // Several legacy adapters intentionally discover the camera coordinates as the
  // first two numeric toolbar inputs.
  if (moved > 0) {
    if (advancedDetails) toolbar.insertBefore(more.details, advancedDetails);
    else toolbar.append(more.details);
  }

  // The primary tool selector is important enough to advertise its shortcuts.
  const tool = [...toolbar.querySelectorAll<HTMLSelectElement>(':scope > select')]
    .find((select) => [...select.options].some((option) => option.value === 'line')
      && [...select.options].some((option) => option.value === 'brush'));
  if (tool) tool.title = 'Brush/shape tool. B = Brush, L = Line. Lines work with structures such as walls and fences.';
}
