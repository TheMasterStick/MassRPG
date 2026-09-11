import { el } from './dom';

let popupEl: HTMLElement | null = null;

export interface ContextPopupItem {
  label: string;
  onClick: () => void;
  levelText?: string;
  levelColor?: string;
}

export function initContextPopup(root: HTMLElement) {
  popupEl = el('div', { attrs: { id: 'context-popup' }, className: 'hidden clickable' });
  root.append(popupEl);
  document.addEventListener('click', (e) => {
    if (popupEl && !popupEl.contains(e.target as Node)) hideContextPopup();
  });
}

export function showContextPopup(x: number, y: number, items: ContextPopupItem[]) {
  if (!popupEl) return;
  popupEl.innerHTML = '';
  for (const item of items) {
    const btn = el('button');
    btn.append(document.createTextNode(item.label));
    if (item.levelText) {
      const level = document.createElement('span');
      level.textContent = item.levelText;
      if (item.levelColor) level.style.color = item.levelColor;
      btn.append(level);
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      item.onClick();
      hideContextPopup();
    });
    popupEl.append(btn);
  }

  popupEl.style.left = `${x}px`;
  popupEl.style.top = `${y}px`;
  popupEl.classList.remove('hidden');

  // Keep menus opened near the bottom/right edge fully on screen.
  const rect = popupEl.getBoundingClientRect();
  if (rect.right > window.innerWidth - 4) popupEl.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
  if (rect.bottom > window.innerHeight - 4) popupEl.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
}

export function hideContextPopup() {
  popupEl?.classList.add('hidden');
}
