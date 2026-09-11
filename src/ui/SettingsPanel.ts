import { el } from './dom';
import { GAMEPLAY_ZOOM_LEVELS, TILE_SIZE, setGameplayTileSize, type GameplayTileSize } from '../core/constants';

const ZOOM_STORAGE_KEY = 'massrpg-gameplay-zoom';

const ZOOM_LABELS: Record<GameplayTileSize, { name: string; hint: string }> = {
  24: { name: 'Wide', hint: 'Wider than the original view for seeing more of the surrounding world.' },
  32: { name: 'Original', hint: 'The original gameplay camera scale.' },
  40: { name: 'Current', hint: 'The current default balance between world visibility and sprite size.' },
  52: { name: 'Close', hint: 'A more immersive view with larger characters and scenery.' },
  64: { name: 'Detail', hint: 'Close enough to inspect sprite and pixel-art detail comfortably.' },
  80: { name: 'Very Close', hint: 'A strongly zoomed-in view focused on characters and nearby scenery.' },
  96: { name: 'Extra Close', hint: 'The closest view for inspecting pixel-art detail up close.' },
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
  const saved = storedZoom();
  if (saved !== null) setGameplayTileSize(saved);

  const title = el('div', { className: 'combat-style-label' });
  const hint = el('div', { className: 'combat-style-hint' });
  const value = el('div', { className: 'tooltip-desc' });

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(GAMEPLAY_ZOOM_LEVELS.length - 1);
  slider.step = '1';
  slider.value = String(Math.max(0, GAMEPLAY_ZOOM_LEVELS.indexOf(TILE_SIZE)));
  slider.style.width = '100%';
  slider.style.margin = '12px 0 8px';
  slider.setAttribute('aria-label', 'Gameplay zoom');

  const endpoints = document.createElement('div');
  endpoints.style.display = 'flex';
  endpoints.style.justifyContent = 'space-between';
  endpoints.style.fontSize = '10px';
  endpoints.style.color = '#888';
  endpoints.append(
    el('span', { text: 'Wide' }),
    el('span', { text: 'Extra Close' }),
  );

  const readout = el('div', { className: 'combat-style-btn active' }, [title, hint, value]);
  readout.style.cursor = 'default';

  const panel = el('div', { className: 'tab-panel hidden', attrs: { id: 'panel-settings' } }, [
    el('h3', { text: 'Settings' }),
    el('div', { className: 'tooltip-desc', text: 'Gameplay zoom' }),
    slider,
    endpoints,
    readout,
  ]);
  root.append(panel);

  function refreshReadout(size: GameplayTileSize) {
    const info = ZOOM_LABELS[size];
    title.textContent = info.name;
    hint.textContent = info.hint;
    value.textContent = `${size}px per tile · zoom level ${GAMEPLAY_ZOOM_LEVELS.indexOf(size) + 1}/${GAMEPLAY_ZOOM_LEVELS.length}`;
  }

  function chooseIndex(index: number) {
    const size = GAMEPLAY_ZOOM_LEVELS[Math.max(0, Math.min(GAMEPLAY_ZOOM_LEVELS.length - 1, index))];
    setGameplayTileSize(size);
    persistZoom(size);
    refreshReadout(size);
  }

  slider.addEventListener('input', () => chooseIndex(Number(slider.value)));
  refreshReadout(TILE_SIZE);

  return { panel, toggle: () => panel.classList.toggle('hidden') };
}
