import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { buildableStructures } from '../systems/Construction';
import { getItem } from '../data/items';
import { bus, log } from '../core/EventBus';

export function buildBuildPanel(root: HTMLElement, game: Game) {
  const { player } = game;
  const list = el('div', { attrs: { id: 'build-list' } });
  const hint = el('p', { className: 'tooltip-desc', text: 'Pick a structure, then click a nearby tile to place it.' });
  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-build' } }, [hint, list]);
  root.append(panel);

  function render() {
    clear(list);
    for (const entry of buildableStructures(player)) {
      const s = entry.structure;
      const costText = s.inputs.map((i) => `${i.qty}x ${getItem(i.item).name}`).join(', ');
      const btn = el('button', { text: game.buildMode === s.type ? 'Cancel' : 'Build' });
      btn.disabled = !entry.unlocked;
      btn.addEventListener('click', () => {
        if (game.buildMode === s.type) { game.buildMode = null; render(); return; }
        game.buildMode = s.type;
        log(`Click a tile near you to place the ${s.name}.`, 'info');
        render();
      });
      const row = el('div', { className: `build-row ${entry.unlocked ? '' : 'locked'}` }, [
        el('div', { className: 'recipe-meta' }, [
          el('div', { text: `${s.name} (Lv.${s.levelRequired})` }),
          el('div', { className: 'missing', text: costText }),
        ]),
        btn,
      ]);
      list.append(row);
    }
  }
  render();
  bus.on('inventoryChanged', render);
  bus.on('skillsChanged', render);

  return { panel, toggle: () => { panel.classList.toggle('hidden'); render(); } };
}
