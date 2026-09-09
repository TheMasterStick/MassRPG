import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { SKILLS } from '../data/skills';
import { xpProgress } from '../data/skills';
import { bus } from '../core/EventBus';

export function buildSkillsPanel(root: HTMLElement, game: Game) {
  const { player } = game;
  const list = el('div', { attrs: { id: 'skills-list' } });
  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-skills' } }, [list]);
  root.append(panel);

  function render() {
    clear(list);
    for (const skill of SKILLS) {
      const p = xpProgress(player.skillsXp[skill.id]);
      const fill = el('div', { className: 'skill-bar-fill' });
      fill.style.width = `${p.pct * 100}%`;
      fill.style.background = skill.color;
      const row = el('div', { className: 'skill-row' }, [
        el('span', { className: 'skill-name', text: skill.name }),
        el('div', { className: 'skill-bar' }, [fill]),
        el('span', { className: 'skill-level', text: `${p.level}` }),
      ]);
      row.title = `${Math.floor(player.skillsXp[skill.id])} XP`;
      list.append(row);
    }
    list.append(el('div', { className: 'hud-row', text: `Combat level: ${player.combatLevel()}` }));
  }
  render();
  bus.on('skillsChanged', render);

  return { panel, toggle: () => panel.classList.toggle('hidden') };
}
