import { el, clear } from './dom';
import { GAMEPLAY_ZOOM_LEVELS, TILE_SIZE, setGameplayTileSize, type GameplayTileSize } from '../core/constants';

const ZOOM_STORAGE_KEY = 'massrpg-gameplay-zoom';

const ZOOM_LABELS: Record<GameplayTileSize, { name: string; hint: string }> = {
  32: { name: 'Original', hint: 'The wider view used before the camera was brought closer.' },
  40: { name: 'Current', hint: 'The present default balance between world visibility and sprite size.' },
  52: { name: 'Close', hint: 'A more immersive view with larger characters and scenery.' },
  64: { name: 'Detail', hint: 'Closest view for inspecting sprite and pixel-art detail.' },
};

function storedZoom(): GameplayTileSize | null {
  try {
    const value = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    return GAMEPLAY_ZOOM_LEVELS.includes(value as GameplayTileSize) ? value as GameplayTileSize : null;
  } catch {
    return null;
  }
}

function persistZoom(size: GameplayTileSize) {
  try { localStorage.setItem(ZOOM_STORAGE_KEY, String(size)); } catch { /* preference persistence is optional */ }
}

export function buildSettingsPanel(root: HTMLElement) {
  const list = el('div', { className: 'combat-style-list' });
  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-settings' } }, [
    el('h3', { text: 'Settings' }),
    el('div', { className: 'tooltip-desc', text: 'Gameplay zoom' }),
    list,
  ]);
  root.append(panel);

  const saved = storedZoom();
  if (saved !== null) setGameplayTileSize(saved);

  function chooseZoom(size: GameplayTileSize) {
    setGameplayTileSize(size);
    persistZoom(size);
    render();
  }

  function render() {
    clear(list);
    for (const size of GAMEPLAY_ZOOM_LEVELS) {
      const info = ZOOM_LABELS[size];
      const button = el('button', {
        className: `combat-style-btn ${TILE_SIZE === size ? 'active' : ''}`,
        attrs: { title: info.hint },
      }, [
        el('div', { className: 'combat-style-label', text: `${info.name} · ${size}px` }),
        el('div', { className: 'combat-style-hint', text: info.hint }),
      ]);
      button.addEventListener('click', () => chooseZoom(size));
      list.append(button);
    }
  }

  render();
  return { panel, toggle: () => panel.classList.toggle('hidden') };
}
