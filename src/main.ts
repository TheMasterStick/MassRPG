import './style.css';
import { World } from './world/World';
import { Player } from './entities/Player';
import { Game } from './core/Game';
import { initUI } from './ui/UI';
import { addItem, equip } from './systems/Inventory';
import { hasSave, loadGame, deleteSave } from './systems/Save';
import { el } from './ui/dom';
import { TWIN_LANDS_SEED } from './world/AeldorData';
import { launchWorldEditor } from './editor/WorldEditor';

const app = document.getElementById('app')!;
const startScreen = document.getElementById('start-screen')!;
const uiRoot = document.getElementById('ui-root')!;
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

function giveStarterKit(player: Player) {
  addItem(player, 'bronze_hatchet', 1);
  addItem(player, 'bronze_pickaxe', 1);
  addItem(player, 'small_fishing_net', 1);
  addItem(player, 'tinderbox', 1);
  addItem(player, 'bronze_sword', 1);
  addItem(player, 'bronze_shield', 1);
  addItem(player, 'bread', 5);
  addItem(player, 'coins', 25);
  equip(player, player.inventory.findIndex((s) => s?.itemId === 'bronze_sword'));
  equip(player, player.inventory.findIndex((s) => s?.itemId === 'bronze_shield'));
}

function launchGame(world: World, player: Player) {
  startScreen.classList.add('hidden');
  const game = new Game(world, player, canvas);
  initUI(uiRoot, game);
  game.start();
  (window as unknown as { __game: Game }).__game = game;
}

function newGame() {
  const world = new World(TWIN_LANDS_SEED);
  const player = new Player();
  giveStarterKit(player);
  launchGame(world, player);
}

function continueGame() {
  const result = loadGame();
  if (!result) { newGame(); return; }
  launchGame(result.world, result.player);
}

function openEditor() {
  const url = new URL(window.location.href);
  url.searchParams.set('editor', '1');
  window.location.href = url.toString();
}

function buildStartScreen() {
  const newBtn = el('button', { text: 'Begin Adventure' });
  newBtn.addEventListener('click', () => newGame());
  const editorBtn = el('button', { className: 'secondary', text: 'World Editor' });
  editorBtn.addEventListener('click', () => openEditor());

  const box = el('div', { className: 'start-box' }, [
    el('h1', { text: 'MassRPG' }),
    el('p', { className: 'tagline', text: 'The Twin Lands: a hand-shaped 180,000x180,000 tile world of settlements, wilderness, skills and adventure.' }),
    newBtn,
    editorBtn,
  ]);

  if (hasSave()) {
    const continueBtn = el('button', { text: 'Continue' });
    continueBtn.addEventListener('click', () => continueGame());
    const resetBtn = el('button', { className: 'secondary', text: 'Delete save & start over' });
    resetBtn.addEventListener('click', () => { deleteSave(); resetBtn.remove(); continueBtn.remove(); });
    box.prepend(resetBtn);
    box.prepend(continueBtn);
  }

  box.append(el('div', {
    className: 'hint',
    text: 'You begin in Capital Town in central Westerland. Click to move or interact. WASD/arrows to walk, hold Shift to run. I = Inventory, K = Skills, B = Build. The World Editor lets you hand-place terrain, structures, resources and monster spawners.',
  }));

  startScreen.append(box);
}

if (new URLSearchParams(window.location.search).get('editor') === '1') {
  app.innerHTML = '';
  launchWorldEditor(app);
} else {
  buildStartScreen();
}
