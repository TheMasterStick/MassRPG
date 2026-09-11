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
      const xp = player.skillsXp[skill.id];
      const p = xpProgress(xp);
      const currentXp = Math.floor(xp);
      const remainingXp = p.level >= 99 ? 0 : Math.max(0, Math.ceil(p.next - xp));
      const fill = el('div', { className: 'skill-bar-fill' });
      fill.style.width = `${p.pct * 100}%`;
      fill.style.background = skill.color;

      const bar = el('div', { className: 'skill-bar' }, [fill]);
      const xpText = el('div', {
        text: p.level >= 99
          ? `${currentXp.toLocaleString()} XP · MAX`
          : `${currentXp.toLocaleString()} XP · ${remainingXp.toLocaleString()} to next`,
      });
      xpText.style.fontSize = '9px';
      xpText.style.color = '#aaa';
      xpText.style.marginTop = '2px';
      xpText.style.whiteSpace = 'nowrap';

      const progress = el('div', {}, [bar, xpText]);
      progress.style.flex = '1';
      progress.style.minWidth = '0';

      const row = el('div', { className: 'skill-row' }, [
        el('span', { className: 'skill-name', text: skill.name }),
        progress,
        el('span', { className: 'skill-level', text: `${p.level}` }),
      ]);
      row.title = p.level >= 99
        ? `${currentXp.toLocaleString()} XP · maximum level`
        : `${currentXp.toLocaleString()} XP · ${remainingXp.toLocaleString()} XP remaining`;
      list.append(row);
    }
    list.append(el('div', { className: 'hud-row', text: `Combat level: ${player.combatLevel()}` }));
  }
  render();
  bus.on('skillsChanged', render);

  return { panel, toggle: () => panel.classList.toggle('hidden') };
}
