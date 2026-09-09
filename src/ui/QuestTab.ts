import { el } from './dom';

export function buildQuestTab(root: HTMLElement) {
  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-quest' } }, [
    el('h3', { text: 'Quest Journal' }),
    el('p', { className: 'tooltip-desc', text: 'No quests yet - this is a placeholder for a future quest log.' }),
  ]);
  root.append(panel);
  return { panel };
}
