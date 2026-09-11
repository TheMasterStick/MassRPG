import './SkillsPanel.css';
import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { SKILLS, type SkillCategory, type SkillId, xpProgress } from '../data/skills';
import { bus } from '../core/EventBus';

const SKILL_ICONS: Record<SkillId, string> = {
  hitpoints: '❤', attack: '⚔', strength: '✦', defence: '🛡', ranged: '➶', magic: '✧',
  woodcutting: '🪓', mining: '⛏', fishing: '🎣', farming: '🌾',
  cooking: '🍲', firemaking: '🔥', smithing: '⚒', crafting: '✂', fletching: '🏹', herblore: '⚗',
  construction: '🔨', agility: '↯',
};

const FILTERS: { id: 'all' | SkillCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'combat', label: 'Combat' },
  { id: 'gathering', label: 'Gathering' },
  { id: 'production', label: 'Production' },
  { id: 'support', label: 'Support' },
];

export function buildSkillsPanel(root: HTMLElement, game: Game) {
  const { player } = game;
  const filters = el('div', { className: 'skills-filter-row' });
  const grid = el('div', { className: 'skills-grid' });
  const combatLevel = el('div', { className: 'skills-combat-level' });
  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-skills' } }, [filters, grid, combatLevel]);
  root.append(panel);

  let activeFilter: 'all' | SkillCategory = 'all';
  const filterButtons = new Map<'all' | SkillCategory, HTMLButtonElement>();

  for (const filter of FILTERS) {
    const button = el('button', { className: 'skills-filter-btn', text: filter.label });
    button.addEventListener('click', () => {
      activeFilter = filter.id;
      render();
    });
    filterButtons.set(filter.id, button);
    filters.append(button);
  }

  function render() {
    clear(grid);
    for (const [id, button] of filterButtons) button.classList.toggle('active', id === activeFilter);

    for (const skill of SKILLS) {
      if (activeFilter !== 'all' && skill.category !== activeFilter) continue;
      const xp = player.skillsXp[skill.id];
      const p = xpProgress(xp);
      const currentXp = Math.floor(xp);
      const remainingXp = p.level >= 99 ? 0 : Math.max(0, Math.ceil(p.next - xp));
      const nextRequired = p.level >= 99 ? currentXp : Math.ceil(p.next);

      const fill = el('div', { className: 'skill-card-progress-fill' });
      fill.style.width = `${p.pct * 100}%`;
      fill.style.background = skill.color;

      const card = el('button', { className: 'skill-card' }, [
        el('span', { className: 'skill-card-icon', text: SKILL_ICONS[skill.id] }),
        el('span', { className: 'skill-card-name', text: skill.name }),
        el('span', { className: 'skill-card-level', text: `${p.level}` }),
        el('div', { className: 'skill-card-progress' }, [fill]),
      ]);
      card.title = p.level >= 99
        ? `${skill.name} ${p.level}\n${currentXp.toLocaleString()} XP · maximum level`
        : `${skill.name} ${p.level}\n${currentXp.toLocaleString()} XP\n${nextRequired.toLocaleString()} XP required for level ${p.level + 1}\n${remainingXp.toLocaleString()} XP remaining`;
      card.addEventListener('click', () => game.onOpenSkillBook?.(skill.id));
      grid.append(card);
    }

    combatLevel.textContent = `Combat level: ${player.combatLevel()}`;
  }

  render();
  bus.on('skillsChanged', render);

  return { panel, toggle: () => panel.classList.toggle('hidden') };
}
