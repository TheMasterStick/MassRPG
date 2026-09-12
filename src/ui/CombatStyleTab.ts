import { el } from './dom';
import type { Game } from '../core/Game';
import type { Player, MeleeTrainingStyle } from '../entities/Player';
import { bus } from '../core/EventBus';

const STYLES: { id: Player['combatStyle']; label: string; hint: string }[] = [
  { id: 'melee', label: 'Melee', hint: 'Fight up close with a wielded weapon.' },
  { id: 'ranged', label: 'Ranged', hint: 'Requires a bow and equipped arrows.' },
  { id: 'magic', label: 'Magic', hint: 'Placeholder combat style until spellbooks, staves and reagents are implemented.' },
];

const MELEE_TRAINING: { id: MeleeTrainingStyle; label: string; hint: string }[] = [
  { id: 'accurate', label: 'Accurate', hint: 'Train Attack from melee damage.' },
  { id: 'aggressive', label: 'Aggressive', hint: 'Train Strength from melee damage.' },
  { id: 'defensive', label: 'Defensive', hint: 'Train Defence from melee damage.' },
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
      refreshMeleeTrainingButtons();
    });
    styleButtons.push(btn);
    styleList.append(btn);
  }
  panel.append(styleList);

  panel.append(el('div', { className: 'combat-level-display', text: 'Melee training' }));
  const meleeButtons: HTMLButtonElement[] = [];
  const meleeList = el('div', { className: 'combat-style-list' });
  for (const style of MELEE_TRAINING) {
    const btn = el('button', { className: 'combat-style-btn' }, [
      el('div', { className: 'combat-style-label', text: style.label }),
      el('div', { className: 'combat-style-hint', text: style.hint }),
    ]);
    btn.addEventListener('click', () => {
      player.meleeTrainingStyle = style.id;
      player.combatStyle = 'melee';
      refreshStyleButtons();
      refreshMeleeTrainingButtons();
    });
    meleeButtons.push(btn);
    meleeList.append(btn);
  }
  panel.append(meleeList);

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
  function refreshMeleeTrainingButtons() {
    meleeButtons.forEach((b, i) => {
      b.classList.toggle('active', player.combatStyle === 'melee' && MELEE_TRAINING[i].id === player.meleeTrainingStyle);
    });
  }
  function refreshRunButton() {
    runBtn.textContent = player.running ? 'Running' : 'Walking';
    runBtn.classList.toggle('active', player.running);
  }
  function refreshCombatLevel() {
    combatLevelText.textContent = `Combat level: ${player.combatLevel()}`;
  }

  refreshStyleButtons();
  refreshMeleeTrainingButtons();
  refreshRunButton();
  refreshCombatLevel();
  bus.on('skillsChanged', refreshCombatLevel);
  setInterval(refreshRunButton, 500);

  root.append(panel);
  return { panel };
}
