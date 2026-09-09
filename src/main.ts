import './style.css';
import { World } from './world/World';
import { Player } from './entities/Player';
import { Game } from './core/Game';
import { initUI } from './ui/UI';
import { addItem, equip } from './systems/Inventory';
import { hasSave, loadGame, deleteSave } from './systems/Save';
import { el } from './ui/dom';

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

function newGame(seed: number) {
  const world = new World(seed);
  const player = new Player();
  player.x = 0;
  player.y = 0;
  giveStarterKit(player);
  launchGame(world, player);
}

function continueGame() {
  const result = loadGame();
  if (!result) { newGame(Date.now() >>> 0); return; }
  launchGame(result.world, result.player);
}

function buildStartScreen() {
  const seedInput = el('input', { attrs: { type: 'text', placeholder: 'Leave blank for random' } }) as HTMLInputElement;
  const newBtn = el('button', { text: 'Begin Adventure' });
  newBtn.addEventListener('click', () => {
    const raw = seedInput.value.trim();
    const seed = raw ? hashSeed(raw) : (Date.now() >>> 0);
    newGame(seed);
  });

  const box = el('div', { className: 'start-box' }, [
    el('h1', { text: 'MassRPG' }),
    el('p', { className: 'tagline', text: 'A procedurally generated world of exploration, skills and adventure.' }),
    el('label', { text: 'World seed' }),
    seedInput,
    newBtn,
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
    text: 'Click to move or interact. WASD/arrows to walk, hold Shift to run. I = Inventory, K = Skills, B = Build. Choose a combat style (Melee/Ranged/Magic) in the top-right before fighting.',
  }));

  startScreen.append(box);
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

buildStartScreen();
