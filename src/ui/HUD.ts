import { el } from './dom';
import type { Game } from '../core/Game';
import { bus } from '../core/EventBus';
import { getRecipe } from '../data/recipes';

export function buildHud(root: HTMLElement, game: Game) {
  const { player } = game;

  // ---- action bar (progress) ----
  const actionLabel = el('div', { attrs: { id: 'action-label' } });
  const progressFill = el('div', { attrs: { id: 'action-progress-fill' } });
  const progress = el('div', { attrs: { id: 'action-progress' } }, [progressFill]);
  const actionBar = el('div', { attrs: { id: 'action-bar' } }, [actionLabel, progress]);
  root.append(actionBar);

  setInterval(() => {
    const action = player.action;
    if (!action) {
      progress.style.display = 'none';
      actionLabel.textContent = '';
      return;
    }
    progress.style.display = 'block';
    if (action.type === 'gather') {
      actionLabel.textContent = 'Gathering...';
    } else if (action.type === 'produce') {
      const recipe = getRecipe(action.resourceOrRecipeId);
      actionLabel.textContent = `Making ${recipe.name}${action.qtyRemaining && action.qtyRemaining > 1 ? ` (${action.qtyRemaining} left)` : ''}...`;
    }
    const total = action.type === 'produce' ? getRecipe(action.resourceOrRecipeId).ticks : 3;
    const pct = 1 - action.ticksRemaining / total;
    progressFill.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
  }, 100);

  // ---- game log ----
  const logRoot = el('div', { attrs: { id: 'game-log' } });
  root.append(logRoot);
  bus.on('log', (e) => {
    if (!e.text) return;
    const line = el('div', { className: `log-${e.kind}`, text: e.text });
    logRoot.append(line);
    while (logRoot.children.length > 80) logRoot.removeChild(logRoot.firstChild!);
    logRoot.scrollTop = logRoot.scrollHeight;
  });

  // ---- death overlay ----
  const deathOverlay = el('div', { attrs: { id: 'death-overlay' } }, [el('span', { text: 'You have died...' })]);
  root.append(deathOverlay);
  bus.on('playerDied', () => {
    deathOverlay.classList.add('show');
    setTimeout(() => deathOverlay.classList.remove('show'), 1500);
  });
}
