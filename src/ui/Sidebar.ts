import { el } from './dom';
import type { Game } from '../core/Game';
import { bus } from '../core/EventBus';
import { MiniMap } from './MiniMap';
import { buildInventoryPanel } from './InventoryPanel';
import { buildSkillsPanel } from './SkillsPanel';
import { buildEquipmentPanel } from './EquipmentPanel';
import { buildBuildPanel } from './BuildPanel';
import { buildCombatStyleTab } from './CombatStyleTab';
import { buildQuestTab } from './QuestTab';
import { buildSettingsPanel } from './SettingsPanel';

interface Tab {
  id: string;
  icon: string;
  title: string;
  panel: HTMLElement;
}

export function buildSidebar(uiRoot: HTMLElement, game: Game) {
  const { player } = game;
  const sidebar = el('div', { className: 'clickable', attrs: { id: 'sidebar' } });
  uiRoot.append(sidebar);

  // ---- HP / coins strip, always visible regardless of active tab ----
  const hpFill = el('div', { className: 'bar-fill hp' });
  const hpText = el('span', { className: 'sidebar-hp-text', text: '' });
  const coinsText = el('span', { text: '0' });
  const statStrip = el('div', { attrs: { id: 'sidebar-stats' } }, [
    el('div', { className: 'hud-row' }, [el('span', { className: 'hud-label', text: 'HP' }), el('div', { className: 'bar-track' }, [hpFill]), hpText]),
    el('div', { className: 'hud-row' }, [el('span', { className: 'hud-label', text: 'Coins' }), coinsText]),
  ]);
  sidebar.append(statStrip);

  function refreshStats() {
    const pct = Math.max(0, player.currentHp / player.maxHp());
    hpFill.style.width = `${pct * 100}%`;
    hpText.textContent = `${Math.max(0, Math.ceil(player.currentHp))}/${player.maxHp()}`;
    coinsText.textContent = `${player.countItem('coins')}`;
  }
  refreshStats();
  bus.on('skillsChanged', refreshStats);
  bus.on('inventoryChanged', refreshStats);
  setInterval(refreshStats, 400);

  // ---- minimap + compass ----
  const minimapPanel = el('div', { attrs: { id: 'minimap-panel' } });
  const compass = el('div', { className: 'compass', text: 'N' });
  minimapPanel.append(compass);
  sidebar.append(minimapPanel);
  const minimap = new MiniMap(minimapPanel, game);
  game.onFrame = (t) => minimap.update(t);

  // ---- tab content mounts ----
  const tabContent = el('div', { attrs: { id: 'sidebar-tab-content' } });

  const combat = buildCombatStyleTab(tabContent, game);
  const skills = buildSkillsPanel(tabContent, game);
  const quest = buildQuestTab(tabContent);
  const inventory = buildInventoryPanel(tabContent, game);
  const equipment = buildEquipmentPanel(tabContent, game);
  const build = buildBuildPanel(tabContent, game);
  const settings = buildSettingsPanel(tabContent);

  const tabs: Tab[] = [
    { id: 'combat', icon: '⚔', title: 'Combat', panel: combat.panel },
    { id: 'skills', icon: '📊', title: 'Skills', panel: skills.panel },
    { id: 'quest', icon: '📜', title: 'Quests', panel: quest.panel },
    { id: 'inventory', icon: '🎒', title: 'Inventory', panel: inventory.panel },
    { id: 'equipment', icon: '🛡', title: 'Equipment', panel: equipment.panel },
    { id: 'build', icon: '🔨', title: 'Construction', panel: build.panel },
    { id: 'settings', icon: '⚙', title: 'Settings', panel: settings.panel },
  ];

  const tabBar = el('div', { attrs: { id: 'sidebar-tabs' } });
  const tabButtons = new Map<string, HTMLButtonElement>();
  let activeTab = 'inventory';

  function selectTab(id: string) {
    activeTab = id;
    for (const t of tabs) t.panel.classList.toggle('hidden', t.id !== id);
    for (const [tid, btn] of tabButtons) btn.classList.toggle('active', tid === id);
    game.buildMode = null;
  }

  for (const t of tabs) {
    if (t.id === 'settings') continue;
    const btn = el('button', { className: 'sidebar-tab-btn', text: t.icon, attrs: { title: t.title } });
    btn.addEventListener('click', () => selectTab(t.id));
    tabButtons.set(t.id, btn);
    tabBar.append(btn);
  }
  const mapBtn = el('button', { className: 'sidebar-tab-btn', text: '🗺', attrs: { title: 'World map (M)' } });
  mapBtn.addEventListener('click', () => game.onToggleWorldMap?.());
  tabBar.append(mapBtn);

  const saveBtn = el('button', { className: 'sidebar-tab-btn', text: '💾', attrs: { title: 'Save' } });
  saveBtn.addEventListener('click', () => game.manualSave());
  tabBar.append(saveBtn);

  const settingsBtn = el('button', { className: 'sidebar-tab-btn', text: '⚙', attrs: { title: 'Settings' } });
  settingsBtn.addEventListener('click', () => selectTab('settings'));
  tabButtons.set('settings', settingsBtn);
  tabBar.append(settingsBtn);

  sidebar.append(tabBar, tabContent);
  selectTab(activeTab);

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (key === 'i') selectTab('inventory');
    if (key === 'k') selectTab('skills');
    if (key === 'b') selectTab('build');
    if (key === 'escape') game.buildMode = null;
  });

  return { selectTab };
}
