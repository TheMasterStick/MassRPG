import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { recipesForPlayerAt, startProduction, type RecipeAvailability } from '../systems/Production';
import { getItem } from '../data/items';
import { bus } from '../core/EventBus';
import type { StructureType } from '../world/types';

const STATION_NAMES: Partial<Record<StructureType, string>> = {
  furnace: 'Furnace', anvil: 'Anvil', cooking_range: 'Cooking range', campfire: 'Campfire',
  tannery: 'Tannery', loom: 'Loom',
};

export function buildStationPanel(root: HTMLElement, game: Game) {
  const { player, world } = game;
  const list = el('div', { attrs: { id: 'station-list' } });
  const title = el('span', { text: 'Crafting' });
  const panel = el('div', { className: 'panel hidden', attrs: { id: 'panel-station' } }, [
    el('h2', {}, [title, el('span', { className: 'close-x', text: '✕', attrs: { id: 'station-close' } })]),
    list,
  ]);
  root.append(panel);
  panel.querySelector('#station-close')!.addEventListener('click', () => panel.classList.add('hidden'));

  let currentX = 0;
  let currentY = 0;

  function makeRow(entry: RecipeAvailability): HTMLElement {
    const r = entry.recipe;
    const qtyInput = el('input', { attrs: { type: 'text', value: '1' } }) as HTMLInputElement;
    const startBtn = el('button', { text: 'Make' });
    startBtn.disabled = !entry.unlocked || !entry.hasIngredients;
    startBtn.addEventListener('click', () => {
      const qty = Math.max(1, Math.min(999, parseInt(qtyInput.value, 10) || 1));
      startProduction(player, world, r.id, qty, currentX, currentY);
    });
    const costText = r.inputs.map((i) => `${i.qty}x ${getItem(i.item).name}`).join(', ');
    return el('div', { className: `recipe-row ${entry.unlocked ? '' : 'locked'}` }, [
      el('div', { className: 'recipe-meta' }, [
        el('div', { text: `${r.name} (Lv.${r.levelRequired}, +${r.xp}xp)` }),
        el('div', { className: 'missing', text: entry.missing.length ? `Need: ${entry.missing.join(', ')}` : costText }),
      ]),
      qtyInput,
      startBtn,
    ]);
  }

  function render() {
    clear(list);
    for (const entry of recipesForPlayerAt(player, world, currentX, currentY)) {
      list.append(makeRow(entry));
    }
  }

  function open(x: number, y: number, type: StructureType) {
    currentX = x; currentY = y;
    title.textContent = STATION_NAMES[type] ?? 'Crafting';
    render();
    panel.classList.remove('hidden');
  }

  bus.on('inventoryChanged', () => { if (!panel.classList.contains('hidden')) render(); });
  bus.on('skillsChanged', () => { if (!panel.classList.contains('hidden')) render(); });

  return { panel, open };
}
