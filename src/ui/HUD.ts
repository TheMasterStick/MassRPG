import { el } from './dom';
import type { Game } from '../core/Game';
import { bus } from '../core/EventBus';
import { getRecipe } from '../data/recipes';

export interface PanelToggle {
  key: string;
  label: string;
  onToggle: () => void;
}

export function buildHud(root: HTMLElement, game: Game, toggles: PanelToggle[]) {
  const { player } = game;

  // ---- top-left stat readout ----
  const hpFill = el('div', { className: 'bar-fill hp' });
  const hpText = el('span', { text: '' });
  const coinsText = el('span', { text: '0' });
  const cbText = el('span', { text: '3' });
  const topLeft = el('div', { attrs: { id: 'hud-top-left' } }, [
    el('div', { className: 'hud-row' }, [el('span', { className: 'hud-label', text: 'HP' }), el('div', { className: 'bar-track' }, [hpFill]), hpText]),
    el('div', { className: 'hud-row' }, [el('span', { className: 'hud-label', text: 'Combat' }), cbText]),
    el('div', { className: 'hud-row' }, [el('span', { className: 'hud-label', text: 'Coins' }), coinsText]),
  ]);
  root.append(topLeft);

  function refreshStats() {
    const pct = Math.max(0, player.currentHp / player.maxHp());
    hpFill.style.width = `${pct * 100}%`;
    hpText.textContent = `${Math.max(0, Math.ceil(player.currentHp))}/${player.maxHp()}`;
    cbText.textContent = `${player.combatLevel()}`;
    coinsText.textContent = `${player.countItem('coins')}`;
  }
  refreshStats();
  bus.on('skillsChanged', refreshStats);
  bus.on('inventoryChanged', refreshStats);
  setInterval(refreshStats, 400);

  // ---- top-right buttons ----
  const topRight = el('div', { attrs: { id: 'hud-top-right' } });
  for (const t of toggles) {
    const btn = el('button', { className: 'icon-btn', text: t.label });
    btn.addEventListener('click', () => t.onToggle());
    topRight.append(btn);
  }
  const saveBtn = el('button', { className: 'icon-btn', text: '💾 Save' });
  saveBtn.addEventListener('click', () => game.manualSave());
  topRight.append(saveBtn);
  root.append(topRight);

  // ---- combat style selector ----
  const styles: { id: Game['player']['combatStyle']; label: string }[] = [
    { id: 'melee', label: 'Melee' }, { id: 'ranged', label: 'Ranged' }, { id: 'magic', label: 'Magic' },
  ];
  const styleRoot = el('div', { attrs: { id: 'style-selector' } });
  const styleButtons: HTMLButtonElement[] = [];
  for (const s of styles) {
    const btn = el('button', { className: 'style-btn', text: s.label });
    btn.addEventListener('click', () => {
      player.combatStyle = s.id;
      styleButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    if (s.id === player.combatStyle) btn.classList.add('active');
    styleButtons.push(btn);
    styleRoot.append(btn);
  }
  const runBtn = el('button', { className: 'style-btn', text: 'Run: Off' });
  runBtn.addEventListener('click', () => {
    player.running = !player.running;
    runBtn.textContent = `Run: ${player.running ? 'On' : 'Off'}`;
  });
  styleRoot.append(runBtn);
  root.append(styleRoot);

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

  return { refreshStats };
}
