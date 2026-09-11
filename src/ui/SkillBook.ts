import './SkillBook.css';
import { el, clear } from './dom';
import type { Game } from '../core/Game';
import { SKILLS, xpProgress, type SkillId } from '../data/skills';
import { RECIPES, STRUCTURES, type Recipe } from '../data/recipes';
import { CROP_TIERS, FISH_TIERS, HERB_TIERS, METAL_TIERS, TREE_TIERS, getItem } from '../data/items';
import { bus } from '../core/EventBus';

interface UnlockEntry {
  level: number;
  name: string;
  category: string;
  detail: string;
}

const WEAPON_SUFFIXES = ['_sword', '_dagger'];

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function recipeCategory(recipe: Recipe): string {
  if (recipe.skill === 'smithing') {
    if (recipe.category === 'smelting') return 'Smelting';
    if (recipe.category === 'smithing_misc') return 'Materials';
    if (recipe.category === 'smithing_ammo') return 'Ammunition';
    return WEAPON_SUFFIXES.some((suffix) => recipe.outputItem.endsWith(suffix)) ? 'Weapons' : 'Armour';
  }
  const labels: Record<string, string> = {
    cooking: 'Food',
    fletching_bows: 'Bows',
    fletching_arrows: 'Arrows',
    crafting_leather: 'Leather',
    crafting_gems: 'Gems',
    crafting_jewelry: 'Jewellery',
    crafting_misc: 'Materials',
    construction: 'Materials',
    herblore_clean: 'Herbs',
    herblore_potions: 'Potions',
  };
  return labels[recipe.category] ?? titleCase(recipe.category);
}

function recipeDetail(recipe: Recipe): string {
  const inputs = recipe.inputs.map((input) => `${input.qty}x ${getItem(input.item).name}`).join(', ');
  const extras: string[] = [];
  if (recipe.toolRequired) extras.push(`Tool: ${getItem(recipe.toolRequired).name}`);
  if (recipe.station !== 'none') extras.push(`Station: ${titleCase(recipe.station)}`);
  return [inputs || 'No materials', ...extras].join(' · ');
}

function recipeUnlocks(skillId: SkillId): UnlockEntry[] {
  const entries = RECIPES
    .filter((recipe) => recipe.skill === skillId)
    .map((recipe) => ({
      level: recipe.levelRequired,
      name: getItem(recipe.outputItem).name,
      category: recipeCategory(recipe),
      detail: recipeDetail(recipe),
    }));

  // Multiple valid assembly paths can produce the same unlock (for example,
  // completing arrows from either headless or pre-tipped shafts). The ledger
  // should advertise the unlock once rather than repeat implementation routes.
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.level}|${entry.category}|${entry.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function gatheringUnlocks(skillId: SkillId): UnlockEntry[] {
  if (skillId === 'woodcutting') {
    return TREE_TIERS.map((tree) => ({
      level: tree.level,
      name: `Cut ${tree.name}`,
      category: 'Trees',
      detail: `${tree.xp} XP per successful log`,
    }));
  }
  if (skillId === 'firemaking') {
    return TREE_TIERS.map((tree) => ({
      level: tree.level,
      name: `Burn ${tree.id === 'normal' ? '' : `${tree.name} `}logs`.trim(),
      category: 'Logs',
      detail: 'Requires a tinderbox and suitable ground.',
    }));
  }
  if (skillId === 'fishing') {
    return FISH_TIERS.map((fish) => ({
      level: fish.level,
      name: `Catch ${fish.name}`,
      category: 'Fish',
      detail: `Requires ${titleCase(fish.tool)} · ${fish.xp} XP`,
    }));
  }
  if (skillId === 'farming') {
    return [
      ...CROP_TIERS.map((crop) => ({
        level: crop.level,
        name: `Grow ${crop.name}`,
        category: 'Crops',
        detail: `${crop.xp} XP on harvest`,
      })),
      ...HERB_TIERS.map((herb) => ({
        level: herb.level,
        name: `Grow ${herb.name}`,
        category: 'Herbs',
        detail: `${herb.xp} XP on harvest`,
      })),
    ];
  }
  if (skillId === 'mining') {
    const metals = METAL_TIERS
      .filter((metal) => !['bronze', 'steel'].includes(metal.id))
      .map((metal) => ({
        level: metal.oreLevel,
        name: `Mine ${metal.name} ore`,
        category: 'Ores',
        detail: 'Requires a pickaxe.',
      }));
    return [
      { level: 1, name: 'Mine Copper ore', category: 'Ores', detail: 'Requires a pickaxe.' },
      { level: 1, name: 'Mine Tin ore', category: 'Ores', detail: 'Requires a pickaxe.' },
      { level: 20, name: 'Mine Silver ore', category: 'Ores', detail: 'Requires a pickaxe.' },
      { level: 30, name: 'Mine Coal', category: 'Ores', detail: 'Requires a pickaxe.' },
      { level: 40, name: 'Mine Gold ore', category: 'Ores', detail: 'Requires a pickaxe.' },
      { level: 40, name: 'Mine Gem rocks', category: 'Gems', detail: 'Produces a random cuttable gemstone.' },
      ...metals,
    ];
  }
  return [];
}

function structureUnlocks(skillId: SkillId): UnlockEntry[] {
  if (skillId !== 'construction') return [];
  return STRUCTURES.map((structure) => ({
    level: structure.levelRequired,
    name: `Build ${structure.name}`,
    category: 'Structures',
    detail: structure.inputs.map((input) => `${input.qty}x ${getItem(input.item).name}`).join(', '),
  }));
}

function unlocksForSkill(skillId: SkillId): UnlockEntry[] {
  return [...gatheringUnlocks(skillId), ...recipeUnlocks(skillId), ...structureUnlocks(skillId)]
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export function buildSkillBook(root: HTMLElement, game: Game) {
  const title = el('span', { text: 'Skillbook' });
  const meta = el('div', { className: 'skillbook-header-meta' });
  const index = el('div', { className: 'skillbook-index' });
  const page = el('div', { className: 'skillbook-page' });
  const body = el('div', { className: 'skillbook-body' }, [index, page]);
  const panel = el('div', { className: 'panel skillbook-panel hidden', attrs: { id: 'panel-skillbook' } }, [
    el('h2', {}, [title, el('span', { className: 'close-x', text: '✕', attrs: { id: 'skillbook-close' } })]),
    meta,
    body,
  ]);
  root.append(panel);
  panel.querySelector('#skillbook-close')!.addEventListener('click', () => panel.classList.add('hidden'));

  let currentSkill: SkillId = 'smithing';
  let currentCategory = 'All';

  function render() {
    const skill = SKILLS.find((entry) => entry.id === currentSkill)!;
    const xp = game.player.skillsXp[currentSkill];
    const progress = xpProgress(xp);
    const unlocks = unlocksForSkill(currentSkill);
    const categories = ['All', ...new Set(unlocks.map((entry) => entry.category))];
    if (!categories.includes(currentCategory)) currentCategory = 'All';

    title.textContent = `${skill.name} Skillbook`;
    meta.textContent = progress.level >= 99
      ? `Level ${progress.level} · ${Math.floor(xp).toLocaleString()} XP · maximum level`
      : `Level ${progress.level} · ${Math.floor(xp).toLocaleString()} XP · ${Math.ceil(progress.next - xp).toLocaleString()} XP to level ${progress.level + 1}`;

    clear(index);
    for (const category of categories) {
      const button = el('button', { className: `skillbook-category-btn ${category === currentCategory ? 'active' : ''}`, text: category });
      button.addEventListener('click', () => {
        currentCategory = category;
        render();
      });
      index.append(button);
    }

    clear(page);
    page.append(el('h3', { className: 'skillbook-page-title', text: currentCategory }));
    const visible = currentCategory === 'All' ? unlocks : unlocks.filter((entry) => entry.category === currentCategory);
    if (visible.length === 0) {
      page.append(el('div', {
        className: 'skillbook-empty',
        text: 'No level unlocks are recorded for this skill yet. The ledger is ready for them as the system is expanded.',
      }));
      return;
    }

    for (const entry of visible) {
      const locked = progress.level < entry.level;
      page.append(el('div', { className: `skillbook-unlock ${locked ? 'locked' : ''}` }, [
        el('div', { className: 'skillbook-unlock-level', text: `Lv. ${entry.level}` }),
        el('div', {}, [
          el('div', { className: 'skillbook-unlock-name', text: entry.name }),
          el('div', { className: 'skillbook-unlock-detail', text: entry.detail }),
        ]),
      ]));
    }
  }

  function open(skillId: SkillId) {
    currentSkill = skillId;
    currentCategory = 'All';
    render();
    panel.classList.remove('hidden');
  }

  bus.on('skillsChanged', () => { if (!panel.classList.contains('hidden')) render(); });

  return { panel, open };
}
