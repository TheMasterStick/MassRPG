import { el } from './dom';
import type { Game } from '../core/Game';
import type { Player } from '../entities/Player';
import { bus } from '../core/EventBus';

const STYLES: { id: Player['combatStyle']; label: string; hint: string }[] = [
  { id: 'melee', label: 'Melee', hint: 'Fight up close with a wielded weapon.' },
  { id: 'ranged', label: 'Ranged', hint: 'Needs a bow and arrows equipped/carried.' },
  { id: 'magic', label: 'Magic', hint: 'Channel raw magic - no equipment needed.' },
];

export function buildCombatStyleTab(root: HTMLElement, game: Game) {
  const { player } = game;
  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-combat' } });

  const combatLevelText = el('div', { className: 'combat-level-display' });
  panel.append(combatLevelText);

  const styleButtons: HTMLButtonElement[] = [];
  const styleList = el('div', { className: 'combat-style-list' });
  for (const s of STYLES) {
    const btn = el('button', { className: 'combat-style-btn' }, [
      el('div', { className: 'combat-style-label', text: s.label }),
      el('div', { className: 'combat-style-hint', text: s.hint }),
    ]);
    btn.addEventListener('click', () => {
      player.combatStyle = s.id;
      refreshStyleButtons();
    });
    styleButtons.push(btn);
    styleList.append(btn);
  }
  panel.append(styleList);

  const runRow = el('div', { className: 'run-toggle-row' });
  const runBtn = el('button', { className: 'icon-btn' });
  runBtn.addEventListener('click', () => {
    player.running = !player.running;
    refreshRunButton();
  });
  runRow.append(el('span', { text: 'Movement:' }), runBtn);
  panel.append(runRow);

  function refreshStyleButtons() {
    styleButtons.forEach((b, i) => b.classList.toggle('active', STYLES[i].id === player.combatStyle));
  }
  function refreshRunButton() {
    runBtn.textContent = player.running ? 'Running' : 'Walking';
    runBtn.classList.toggle('active', player.running);
  }
  function refreshCombatLevel() {
    combatLevelText.textContent = `Combat level: ${player.combatLevel()}`;
  }

  refreshStyleButtons();
  refreshRunButton();
  refreshCombatLevel();
  bus.on('skillsChanged', refreshCombatLevel);
  setInterval(refreshRunButton, 500);

  root.append(panel);
  return { panel };
}
