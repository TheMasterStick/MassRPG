import './editor.css';
import { MONSTERS } from '../data/monsters';
import { TILE_MAP_COLORS } from '../ui/mapColors';
import {
  CAPITAL, ORE_VEINS, TOWNS, TWIN_LANDS_SEED, WORLD_SIZE,
} from '../world/AeldorData';
import {
  cellKey, clearEditorWorld, loadEditorWorld, replaceEditorWorld, saveEditorWorld,
  type EditorCell, type EditorWorldData,
} from '../world/EditorWorld';
import { WorldGen } from '../world/WorldGen';
import type { ResourceType, StructureType, TileType } from '../world/types';

const TILE_IDS: TileType[] = [
  'deep_water', 'water', 'beach', 'grass', 'plains', 'forest', 'taiga',
  'mountain', 'snow', 'desert', 'swamp', 'path', 'rubble',
  'floor_wood', 'floor_brick', 'floor_cobble',
];

const STRUCTURE_IDS: StructureType[] = [
  'bank_chest', 'furnace', 'anvil', 'cooking_range', 'campfire', 'workbench',
  'fence', 'wall', 'wall_window', 'wall_brick', 'wall_stone', 'wall_cobble',
  'bed', 'storage_chest', 'tannery', 'loom', 'general_store',
];

const RESOURCE_IDS: ResourceType[] = [
  'tree_normal', 'tree_oak', 'tree_willow', 'tree_maple', 'tree_yew', 'tree_magic',
  'rock_copper', 'rock_tin', 'rock_iron', 'rock_coal', 'rock_silver', 'rock_gold',
  'rock_mithril', 'rock_adamant', 'rock_rune', 'rock_dragonite', 'rock_gem',
  'fishing_shrimp', 'fishing_lobster', 'fishing_swordfish',
  'farm_patch', 'herb_patch', 'flax_plant',
];

const TILE_SIZES = [8, 12, 16, 24, 32, 48];
type PaletteCategory = 'terrain' | 'structures' | 'resources' | 'spawners' | 'erase';
type Selection =
  | { kind: 'tile'; id: TileType }
  | { kind: 'structure'; id: StructureType }
  | { kind: 'resource'; id: ResourceType }
  | { kind: 'spawner'; id: string }
  | { kind: 'eraseObjects' }
  | { kind: 'revertTile' }
  | { kind: 'revertAll' };

interface HistoryEntry {
  before: Map<string, EditorCell | undefined>;
  after: Map<string, EditorCell | undefined>;
}

const imageCache = new Map<string, HTMLImageElement>();

function displayName(id: string): string {
  return id.replace(/^rock_/, '').replace(/^tree_/, '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function imageFor(path: string, onReady: () => void): HTMLImageElement {
  let img = imageCache.get(path);
  if (img) return img;
  img = new Image();
  imageCache.set(path, img);
  img.onload = onReady;
  img.onerror = onReady;
  img.src = path;
  return img;
}

function cloneCell(cell: EditorCell | undefined): EditorCell | undefined {
  return cell ? { ...cell } : undefined;
}

function validImportedWorld(value: unknown): value is EditorWorldData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EditorWorldData>;
  return candidate.version === 1 && typeof candidate.cells === 'object' && candidate.cells !== null;
}

export function launchWorldEditor(root: HTMLElement): void {
  document.body.classList.add('editor-mode');
  root.innerHTML = '';

  const gen = new WorldGen(TWIN_LANDS_SEED);
  let data = loadEditorWorld(WORLD_SIZE);
  let category: PaletteCategory = 'terrain';
  let selection: Selection = { kind: 'tile', id: 'grass' };
  let centerX = CAPITAL.x;
  let centerY = CAPITAL.y;
  let zoomIndex = 4;
  let brushSize = 1;
  let isPainting = false;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panCenterX = 0;
  let panCenterY = 0;
  let strokeBefore = new Map<string, EditorCell | undefined>();
  let hoverX = centerX;
  let hoverY = centerY;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];

  const editor = document.createElement('div');
  editor.className = 'world-editor';
  const toolbar = document.createElement('div');
  toolbar.className = 'editor-toolbar';
  const main = document.createElement('div');
  main.className = 'editor-main';
  const palette = document.createElement('aside');
  palette.className = 'editor-palette';
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'editor-canvas-wrap';
  const canvas = document.createElement('canvas');
  canvas.className = 'editor-canvas';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('World editor requires Canvas 2D.');
  const help = document.createElement('div');
  help.className = 'editor-overlay-help';
  help.textContent = 'Left-drag paints. Right-drag pans. Mouse wheel zooms. Ctrl+Z / Ctrl+Y undo and redo. Edits save locally and override procedural generation after returning to the game.';
  const status = document.createElement('div');
  status.className = 'editor-status';
  const statusLeft = document.createElement('span');
  const statusRight = document.createElement('span');
  status.append(statusLeft, statusRight);

  canvasWrap.append(canvas, help);
  main.append(palette, canvasWrap);
  editor.append(toolbar, main, status);
  root.append(editor);

  const backBtn = button('← Game', () => {
    persistNow();
    window.location.href = window.location.pathname;
  });
  const saveBtn = button('Save', () => persistNow());
  const exportBtn = button('Export JSON', () => exportJson());
  const importBtn = button('Import JSON', () => importInput.click());
  const clearBtn = button('Clear all edits', () => {
    if (!window.confirm('Clear every hand-authored editor override? This does not alter the procedural base world.')) return;
    data = clearEditorWorld(WORLD_SIZE);
    undoStack.length = 0;
    redoStack.length = 0;
    draw();
    updateStatus('All editor overrides cleared.');
  });
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importInput.style.display = 'none';
  importInput.addEventListener('change', () => void importJson(importInput.files?.[0]));

  const xInput = numberInput(centerX);
  const yInput = numberInput(centerY);
  const goBtn = button('Go', () => {
    centerX = clampCoord(Number(xInput.value));
    centerY = clampCoord(Number(yInput.value));
    syncCoordInputs();
    draw();
  });

  const locationSelect = document.createElement('select');
  locationSelect.title = 'Jump to a known settlement or mining site';
  addOption(locationSelect, '', 'Jump to location…');
  for (const t of TOWNS) addOption(locationSelect, `${t.x},${t.y}`, `Settlement: ${t.name}`);
  for (const v of ORE_VEINS) addOption(locationSelect, `${v.x},${v.y}`, `Mine: ${v.name}`);
  locationSelect.addEventListener('change', () => {
    if (!locationSelect.value) return;
    const [x, y] = locationSelect.value.split(',').map(Number);
    centerX = x;
    centerY = y;
    syncCoordInputs();
    locationSelect.value = '';
    draw();
  });

  const brushSelect = document.createElement('select');
  for (const size of [1, 3, 5, 9]) addOption(brushSelect, String(size), `${size}×${size} brush`);
  brushSelect.value = String(brushSize);
  brushSelect.addEventListener('change', () => { brushSize = Number(brushSelect.value); });

  const zoomSelect = document.createElement('select');
  TILE_SIZES.forEach((size, index) => addOption(zoomSelect, String(index), `${size}px / tile`));
  zoomSelect.value = String(zoomIndex);
  zoomSelect.addEventListener('change', () => {
    zoomIndex = Number(zoomSelect.value);
    draw();
  });

  const title = document.createElement('span');
  title.className = 'editor-title';
  title.textContent = 'Twin Lands World Editor';
  const xLabel = document.createElement('span');
  xLabel.textContent = 'X';
  const yLabel = document.createElement('span');
  yLabel.textContent = 'Y';
  toolbar.append(title, backBtn, saveBtn, exportBtn, importBtn, clearBtn, locationSelect, xLabel, xInput, yLabel, yInput, goBtn, brushSelect, zoomSelect, importInput);

  renderPalette();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2 || e.button === 1) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panCenterX = centerX;
      panCenterY = centerY;
      return;
    }
    if (e.button !== 0) return;
    isPainting = true;
    strokeBefore = new Map();
    paintAtMouse(e);
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2 || e.button === 1) isPanning = false;
    if (e.button === 0 && isPainting) finishStroke();
    isPainting = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const p = mouseWorld(e);
    hoverX = p.x;
    hoverY = p.y;
    updateStatus();
    if (isPanning) {
      const tilePx = TILE_SIZES[zoomIndex];
      centerX = clampCoord(Math.round(panCenterX - (e.clientX - panStartX) / tilePx));
      centerY = clampCoord(Math.round(panCenterY - (e.clientY - panStartY) / tilePx));
      syncCoordInputs();
      draw();
    } else if (isPainting) {
      paintAtMouse(e);
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const before = mouseWorld(e);
    zoomIndex = Math.max(0, Math.min(TILE_SIZES.length - 1, zoomIndex + (e.deltaY < 0 ? 1 : -1)));
    zoomSelect.value = String(zoomIndex);
    const after = mouseWorld(e);
    centerX = clampCoord(centerX + before.x - after.x);
    centerY = clampCoord(centerY + before.y - after.y);
    syncCoordInputs();
    draw();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      persistNow();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    }
  });

  function button(text: string, action: () => void): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = text;
    el.addEventListener('click', action);
    return el;
  }

  function numberInput(value: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(WORLD_SIZE - 1);
    input.value = String(value);
    return input;
  }

  function addOption(select: HTMLSelectElement, value: string, label: string): void {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }

  function clampCoord(value: number): number {
    return Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(Number.isFinite(value) ? value : 0)));
  }

  function syncCoordInputs(): void {
    xInput.value = String(centerX);
    yInput.value = String(centerY);
  }

  function resizeCanvas(): void {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function renderPalette(): void {
    palette.innerHTML = '';
    const tabs = document.createElement('div');
    tabs.className = 'editor-category-tabs';
    const categories: { id: PaletteCategory; label: string }[] = [
      { id: 'terrain', label: 'Terrain' }, { id: 'structures', label: 'Structures' },
      { id: 'resources', label: 'Trees / Ores' }, { id: 'spawners', label: 'Spawners' },
      { id: 'erase', label: 'Erase / Revert' },
    ];
    for (const c of categories) {
      const b = button(c.label, () => { category = c.id; renderPalette(); });
      if (category === c.id) b.classList.add('active');
      tabs.append(b);
    }
    palette.append(tabs);

    const grid = document.createElement('div');
    grid.className = 'editor-palette-grid';
    if (category === 'terrain') {
      for (const id of TILE_IDS) grid.append(paletteButton({ kind: 'tile', id }, `/sprites/tiles/${id}.png`, displayName(id)));
    } else if (category === 'structures') {
      for (const id of STRUCTURE_IDS) grid.append(paletteButton({ kind: 'structure', id }, `/sprites/structures/${id}.png`, displayName(id)));
    } else if (category === 'resources') {
      for (const id of RESOURCE_IDS) grid.append(paletteButton({ kind: 'resource', id }, `/sprites/resources/${id}.png`, displayName(id)));
    } else if (category === 'spawners') {
      for (const monster of MONSTERS) grid.append(paletteButton({ kind: 'spawner', id: monster.id }, `/sprites/monsters/${monster.id}.png`, `${monster.name} (${monster.level})`));
    } else {
      grid.append(paletteButton({ kind: 'eraseObjects' }, '', 'Erase objects'));
      grid.append(paletteButton({ kind: 'revertTile' }, '', 'Revert terrain'));
      grid.append(paletteButton({ kind: 'revertAll' }, '', 'Revert whole tile'));
    }
    palette.append(grid);
  }

  function paletteButton(next: Selection, src: string, label: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'editor-palette-button';
    if (sameSelection(selection, next)) b.classList.add('active');
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.onerror = () => { img.style.display = 'none'; };
      b.append(img);
    }
    const text = document.createElement('span');
    text.textContent = label;
    b.append(text);
    b.addEventListener('click', () => {
      selection = next;
      renderPalette();
      updateStatus();
    });
    return b;
  }

  function sameSelection(a: Selection, b: Selection): boolean {
    if (a.kind !== b.kind) return false;
    if ('id' in a && 'id' in b) return a.id === b.id;
    return true;
  }

  function mouseWorld(e: MouseEvent | WheelEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const tilePx = TILE_SIZES[zoomIndex];
    const x = centerX + (e.clientX - rect.left - rect.width / 2) / tilePx;
    const y = centerY + (e.clientY - rect.top - rect.height / 2) / tilePx;
    return { x: clampCoord(x), y: clampCoord(y) };
  }

  function paintAtMouse(e: MouseEvent): void {
    const p = mouseWorld(e);
    const size = selection.kind === 'tile' || selection.kind.startsWith('revert') ? brushSize : 1;
    const half = Math.floor(size / 2);
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) applySelection(clampCoord(p.x + ox), clampCoord(p.y + oy));
    }
    scheduleSave();
    draw();
  }

  function rememberBefore(key: string): void {
    if (!strokeBefore.has(key)) strokeBefore.set(key, cloneCell(data.cells[key]));
  }

  function ensureCell(key: string): EditorCell {
    return (data.cells[key] ??= {});
  }

  function cleanupCell(key: string): void {
    const cell = data.cells[key];
    if (!cell) return;
    if (Object.keys(cell).length === 0) delete data.cells[key];
  }

  function applySelection(x: number, y: number): void {
    const key = cellKey(x, y);
    rememberBefore(key);
    if (selection.kind === 'revertAll') {
      delete data.cells[key];
      return;
    }
    const cell = ensureCell(key);
    if (selection.kind === 'tile') {
      const generated = gen.tileAt(x, y);
      if (selection.id === generated) delete cell.tile;
      else cell.tile = selection.id;
    } else if (selection.kind === 'structure') {
      cell.structure = selection.id;
      cell.resource = null;
      cell.spawner = null;
    } else if (selection.kind === 'resource') {
      cell.resource = selection.id;
      cell.structure = null;
      cell.spawner = null;
    } else if (selection.kind === 'spawner') {
      cell.spawner = selection.id;
      cell.structure = null;
      cell.resource = null;
    } else if (selection.kind === 'eraseObjects') {
      cell.structure = null;
      cell.resource = null;
      cell.spawner = null;
    } else if (selection.kind === 'revertTile') {
      delete cell.tile;
    }
    cleanupCell(key);
  }

  function finishStroke(): void {
    if (strokeBefore.size === 0) return;
    const after = new Map<string, EditorCell | undefined>();
    for (const key of strokeBefore.keys()) after.set(key, cloneCell(data.cells[key]));
    undoStack.push({ before: strokeBefore, after });
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
    strokeBefore = new Map();
  }

  function restoreMap(map: Map<string, EditorCell | undefined>): void {
    for (const [key, cell] of map) {
      if (cell) data.cells[key] = { ...cell };
      else delete data.cells[key];
    }
    scheduleSave();
    draw();
  }

  function undo(): void {
    const entry = undoStack.pop();
    if (!entry) return;
    restoreMap(entry.before);
    redoStack.push(entry);
  }

  function redo(): void {
    const entry = redoStack.pop();
    if (!entry) return;
    restoreMap(entry.after);
    undoStack.push(entry);
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persistNow(), 350);
  }

  function persistNow(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    try {
      saveEditorWorld(data);
      updateStatus('Saved locally.');
    } catch {
      updateStatus('Local browser storage is full. Export JSON now; large hand-built areas should be committed to Git.', true);
    }
  }

  function exportJson(): void {
    persistNow();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'twinlands-world-edits.json';
    a.click();
    URL.revokeObjectURL(url);
    updateStatus('Exported twinlands-world-edits.json.');
  }

  async function importJson(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!validImportedWorld(parsed)) throw new Error('Unsupported editor file');
      data = { ...parsed, worldSize: WORLD_SIZE, cells: { ...parsed.cells } };
      replaceEditorWorld(data);
      undoStack.length = 0;
      redoStack.length = 0;
      draw();
      updateStatus(`Imported ${Object.keys(data.cells).length.toLocaleString()} edited tiles.`);
    } catch {
      updateStatus('Could not import that file. Expected a MassRPG editor world JSON file.', true);
    } finally {
      importInput.value = '';
    }
  }

  function effectiveTile(x: number, y: number): TileType {
    return data.cells[cellKey(x, y)]?.tile ?? gen.tileAt(x, y);
  }

  function draw(): void {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const tilePx = TILE_SIZES[zoomIndex];
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    const cols = Math.ceil(width / tilePx) + 2;
    const rows = Math.ceil(height / tilePx) + 2;
    const startX = Math.floor(centerX - cols / 2);
    const startY = Math.floor(centerY - rows / 2);
    const originX = width / 2 - (centerX - startX) * tilePx;
    const originY = height / 2 - (centerY - startY) * tilePx;

    for (let row = 0; row < rows; row++) {
      const wy = startY + row;
      if (wy < 0 || wy >= WORLD_SIZE) continue;
      for (let col = 0; col < cols; col++) {
        const wx = startX + col;
        if (wx < 0 || wx >= WORLD_SIZE) continue;
        const tile = effectiveTile(wx, wy);
        const sx = originX + col * tilePx;
        const sy = originY + row * tilePx;
        const img = imageFor(`/sprites/tiles/${tile}.png`, draw);
        if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, sx, sy, tilePx, tilePx);
        else {
          ctx.fillStyle = TILE_MAP_COLORS[tile];
          ctx.fillRect(sx, sy, tilePx, tilePx);
        }
      }
    }

    if (tilePx >= 16) drawObjects(startX, startY, cols, rows, originX, originY, tilePx);
    drawKnownMarkers(startX, startY, cols, rows, originX, originY, tilePx);

    if (tilePx >= 12) {
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let col = 0; col <= cols; col++) {
        const x = originX + col * tilePx;
        ctx.moveTo(x, 0); ctx.lineTo(x, height);
      }
      for (let row = 0; row <= rows; row++) {
        const y = originY + row * tilePx;
        ctx.moveTo(0, y); ctx.lineTo(width, y);
      }
      ctx.stroke();
    }
    updateStatus();
  }

  function drawObjects(startX: number, startY: number, cols: number, rows: number, originX: number, originY: number, tilePx: number): void {
    const getTile = (x: number, y: number) => effectiveTile(x, y);
    for (let row = 0; row < rows; row++) {
      const wy = startY + row;
      if (wy < 0 || wy >= WORLD_SIZE) continue;
      for (let col = 0; col < cols; col++) {
        const wx = startX + col;
        if (wx < 0 || wx >= WORLD_SIZE) continue;
        const key = cellKey(wx, wy);
        const edit = data.cells[key];
        const sx = originX + col * tilePx;
        const sy = originY + row * tilePx;

        const structure = Object.prototype.hasOwnProperty.call(edit ?? {}, 'structure')
          ? edit?.structure ?? null : gen.villageStructureAt(wx, wy);
        if (structure) {
          drawSprite(`/sprites/structures/${structure}.png`, sx, sy, tilePx, displayName(structure), '#d8c9a1');
          continue;
        }

        const resource = Object.prototype.hasOwnProperty.call(edit ?? {}, 'resource')
          ? edit?.resource ?? null : gen.resourceAt(wx, wy, getTile);
        if (resource) {
          drawSprite(`/sprites/resources/${resource}.png`, sx, sy, tilePx, displayName(resource), resource.startsWith('rock_') ? '#1a1a1a' : '#356c36');
          continue;
        }

        const spawner = Object.prototype.hasOwnProperty.call(edit ?? {}, 'spawner')
          ? edit?.spawner ?? null : null;
        if (spawner) drawSprite(`/sprites/monsters/${spawner}.png`, sx, sy, tilePx, displayName(spawner), '#aa3030');
      }
    }
  }

  function drawSprite(path: string, sx: number, sy: number, tilePx: number, label: string, fallback: string): void {
    const img = imageFor(path, draw);
    if (img.complete && img.naturalWidth > 0) {
      const ratio = img.naturalHeight / img.naturalWidth;
      const w = tilePx;
      const h = Math.max(tilePx, tilePx * ratio);
      ctx.drawImage(img, sx, sy + tilePx - h, w, h);
      return;
    }
    ctx.fillStyle = fallback;
    ctx.beginPath();
    ctx.arc(sx + tilePx / 2, sy + tilePx / 2, Math.max(3, tilePx * 0.3), 0, Math.PI * 2);
    ctx.fill();
    if (tilePx >= 24) {
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(8, tilePx * 0.25)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label.slice(0, 3), sx + tilePx / 2, sy + tilePx / 2 + 3);
    }
  }

  function drawKnownMarkers(startX: number, startY: number, cols: number, rows: number, originX: number, originY: number, tilePx: number): void {
    const endX = startX + cols;
    const endY = startY + rows;
    for (const t of TOWNS) {
      if (t.x < startX || t.x > endX || t.y < startY || t.y > endY) continue;
      marker(t.x, t.y, t.capital ? '#ffd84a' : '#f4f4f4', t.name);
    }
    for (const v of ORE_VEINS) {
      if (v.x < startX || v.x > endX || v.y < startY || v.y > endY) continue;
      marker(v.x, v.y, '#ff8a32', v.name);
    }

    function marker(wx: number, wy: number, color: string, label: string): void {
      const sx = originX + (wx - startX + 0.5) * tilePx;
      const sy = originY + (wy - startY + 0.5) * tilePx;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(3, Math.min(7, tilePx * 0.22)), 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (tilePx >= 16) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(label, sx, sy - 9);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, sx, sy - 9);
      }
    }
  }

  function updateStatus(message?: string, warning = false): void {
    const selected = 'id' in selection ? `${selection.kind}: ${displayName(selection.id)}` : selection.kind;
    statusLeft.textContent = message ?? `Cursor ${hoverX}, ${hoverY} · Center ${centerX}, ${centerY} · ${selected}`;
    statusLeft.className = warning ? 'warn' : '';
    const count = Object.keys(data.cells).length;
    statusRight.textContent = `${count.toLocaleString()} edited tiles · Undo ${undoStack.length}`;
  }

  draw();
}
