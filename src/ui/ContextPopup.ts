import { el } from './dom';

let popupEl: HTMLElement | null = null;

export function initContextPopup(root: HTMLElement) {
  popupEl = el('div', { attrs: { id: 'context-popup' }, className: 'hidden clickable' });
  root.append(popupEl);
  document.addEventListener('click', (e) => {
    if (popupEl && !popupEl.contains(e.target as Node)) hideContextPopup();
  });
}

export function showContextPopup(x: number, y: number, items: { label: string; onClick: () => void }[]) {
  if (!popupEl) return;
  popupEl.innerHTML = '';
  for (const item of items) {
    const btn = el('button', { text: item.label });
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
}

export function hideContextPopup() {
  popupEl?.classList.add('hidden');
}
