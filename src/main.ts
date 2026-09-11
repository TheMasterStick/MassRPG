import './style.css';
import { World } from './world/World';
import { Player } from './entities/Player';
import { Game } from './core/Game';
import { initUI } from './ui/UI';
import { addItem, equip } from './systems/Inventory';
import { hasSave, loadGame, deleteSave } from './systems/Save';
import { el } from './ui/dom';
import { TWIN_LANDS_SEED, WORLD_SIZE } from './world/AeldorData';
import { getEditorMarkers, initializeEditorWorldStorage } from './world/EditorWorld';
import { ensureCanonicalWorldInstalled } from './world/CanonicalWorld';
import { launchWorldEditor } from './editor/WorldEditor';
import { registerUtilityTools } from './data/tools';

registerUtilityTools();

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

function placeNewPlayerAtAuthoredStart(player: Player) {
  const markers = getEditorMarkers(WORLD_SIZE, 0);
  const capital = markers.find((m) => m.name.trim().toLowerCase() === 'capital city')
    ?? markers.find((m) => m.type === 'city')
    ?? markers.find((m) => m.type === 'town')
    ?? markers[0];
  if (!capital) return;
  player.plane = 0;
  player.x = capital.x;
  player.y = capital.y;
  player.respawnPoint = { x: capital.x, y: capital.y, plane: 0 };
}

function newGame() {
  const world = new World(TWIN_LANDS_SEED);
  const player = new Player();
  placeNewPlayerAtAuthoredStart(player);
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
    el('p', { className: 'tagline', text: 'The Twin Lands: a 180,000x180,000 hand-authored RPG world.' }),
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
    text: 'The Git repository contains the canonical Twin Lands world. The World Editor keeps your browser edits as a local working copy; export JSON when you want ChatGPT or Claude to promote those edits back into the canonical world.',
  }));

  startScreen.append(box);
}

async function bootstrap() {
  await initializeEditorWorldStorage(WORLD_SIZE);
  const canonicalState = await ensureCanonicalWorldInstalled(WORLD_SIZE);
  if (canonicalState === 'missing') {
    console.error('MassRPG could not load its canonical Twin Lands world. The blank ocean fallback remains active.');
  }

  if (new URLSearchParams(window.location.search).get('editor') === '1') {
    app.innerHTML = '';
    launchWorldEditor(app);
  } else {
    buildStartScreen();
  }
}

void bootstrap();
