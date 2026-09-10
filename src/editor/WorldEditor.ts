import './editor.css';
import { MONSTERS } from '../data/monsters';
import { TILE_MAP_COLORS } from '../ui/mapColors';
import { WORLD_SIZE } from '../world/AeldorData';
import {
  cellKey, clearEditorWorld, loadEditorWorld, replaceEditorWorld, saveEditorWorld, terrainStrokeContains,
  type EditorCell, type EditorMarker, type EditorMarkerType,
  type TerrainStroke, type TerrainStrokeKind,
} from '../world/EditorWorld';
import type { ResourceType, StructureType, TileType } from '../world/types';
import { createEditorNavigator, type EditorNavigatorHandle } from './EditorNavigator';

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

const MARKER_TYPES: { id: EditorMarkerType; label: string }[] = [
  { id: 'settlement', label: 'Settlement' },
  { id: 'village', label: 'Village' },
  { id: 'town', label: 'Town' },
  { id: 'city', label: 'City' },
  { id: 'castle', label: 'Castle' },
  { id: 'mining_area', label: 'Mining Area' },
];

const TILE_SIZES = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 4, 8, 12, 16, 24, 32, 48];
const BRUSH_SIZES = [
  1, 3, 5, 9, 17, 33, 65, 129, 257, 513, 1025, 2049, 4097, 8193,
  16385, 32769, 65535,
];
const MACRO_BRUSH_THRESHOLD = 33;
const MAX_DETAILED_SHAPE_CELLS = 50000;
const MAX_COPY_SIDE = 256;
const MAX_COPY_CELLS = MAX_COPY_SIDE * MAX_COPY_SIDE;
const TREE_RESOURCES = new Set<ResourceType>([
  'tree_normal', 'tree_oak', 'tree_willow', 'tree_maple', 'tree_yew', 'tree_magic',
]);
const BASE_TILE: TileType = 'deep_water';

type PaletteCategory = 'terrain' | 'structures' | 'resources' | 'spawners' | 'markers' | 'erase';
type TreeMode = 'single' | 'scatter';
type ToolMode = 'brush' | 'line' | 'rect_fill' | 'rect_outline' | 'select' | 'stamp';
type Selection =
  | { kind: 'tile'; id: TileType }
  | { kind: 'structure'; id: StructureType }
  | { kind: 'resource'; id: ResourceType }
  | { kind: 'spawner'; id: string }
  | { kind: 'marker'; id: EditorMarkerType }
  | { kind: 'eraseMarker' }
  | { kind: 'eraseObjects' }
  | { kind: 'revertTile' }
  | { kind: 'revertAll' };

interface WorldPoint { x: number; y: number }
interface SelectionBox { left: number; top: number; right: number; bottom: number }
interface ClipboardRun { dy: number; startX: number; length: number; tile: TileType }
interface ClipboardCell { dx: number; dy: number; cell: EditorCell }
interface EditorClipboard {
  width: number;
  height: number;
  terrainRuns: ClipboardRun[];
  cells: ClipboardCell[];
}

interface HistoryEntry {
  beforeCells: Map<string, EditorCell | undefined>;
  afterCells: Map<string, EditorCell | undefined>;
  beforeStrokeLength: number;
  addedStrokes: TerrainStroke[];
  beforeMarkers: EditorMarker[];
  afterMarkers: EditorMarker[];
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

function cloneMarkers(markers: readonly EditorMarker[]): EditorMarker[] {
  return markers.map((marker) => ({ ...marker }));
}

function isFormTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function normalizeBox(a: WorldPoint, b: WorldPoint): SelectionBox {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

export function launchWorldEditor(root: HTMLElement): void {
  document.body.classList.add('editor-mode');
  root.innerHTML = '';

  let data = loadEditorWorld(WORLD_SIZE);
  let category: PaletteCategory = 'terrain';
  let selection: Selection = { kind: 'tile', id: 'grass' };
  let toolMode: ToolMode = 'brush';
  let treeMode: TreeMode = 'single';
  let treeDensity = 0.04;
  let markerName = '';
  let markerNotes = '';
  let centerX = Math.floor(WORLD_SIZE / 2);
  let centerY = Math.floor(WORLD_SIZE / 2);
  let zoomIndex = 13;
  let brushSize = 1;
  let isPainting = false;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panCenterX = 0;
  let panCenterY = 0;
  let strokeBefore = new Map<string, EditorCell | undefined>();
  let strokeTerrainStart = data.terrainStrokes.length;
  let strokeMarkersBefore = cloneMarkers(data.markers);
  let lastPaintPoint: WorldPoint | null = null;
  let dragStart: WorldPoint | null = null;
  let dragCurrent: WorldPoint | null = null;
  let selectedArea: SelectionBox | null = null;
  let clipboard: EditorClipboard | null = null;
  let hoverX = centerX;
  let hoverY = centerY;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  let navigator: EditorNavigatorHandle | null = null;

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
  const context = canvas.getContext('2d');
  if (!context) throw new Error('World editor requires Canvas 2D.');
  const ctx: CanvasRenderingContext2D = context;
  const help = document.createElement('div');
  help.className = 'editor-overlay-help';
  help.textContent = 'Blank 180k ocean · Brush/Line/Rectangle tools · Select then Copy/Paste Stamp · Right-drag pans · Wheel zooms · M world map · Ctrl+Z/Y undo/redo.';
  const status = document.createElement('div');
  status.className = 'editor-status';
  const statusLeft = document.createElement('span');
  const statusRight = document.createElement('span');
  status.append(statusLeft, statusRight);

  canvasWrap.append(canvas, help);
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
    if (!window.confirm('Clear the entire hand-authored world and return to a blank 180,000 × 180,000 ocean?')) return;
    data = clearEditorWorld(WORLD_SIZE);
    undoStack.length = 0;
    redoStack.length = 0;
    selectedArea = null;
    clipboard = null;
    refreshMarkerJumpSelect();
    navigator?.markEditsDirty();
    draw();
    updateStatus('World reset to blank ocean.');
  });
  const mapBtn = button('World Map (M)', () => navigator?.toggleLarge());

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importInput.style.display = 'none';
  importInput.addEventListener('change', () => void importJson(importInput.files?.[0]));

  const xInput = numberInput(centerX);
  const yInput = numberInput(centerY);
  const goBtn = button('Go', () => jumpCamera(Number(xInput.value), Number(yInput.value)));

  const markerJumpSelect = document.createElement('select');
  markerJumpSelect.title = 'Jump to a hand-authored reference marker';
  markerJumpSelect.addEventListener('change', () => {
    const marker = data.markers.find((item) => item.id === markerJumpSelect.value);
    markerJumpSelect.value = '';
    if (marker) jumpCamera(marker.x, marker.y);
  });

  const toolSelect = document.createElement('select');
  addOption(toolSelect, 'brush', 'Tool: Brush');
  addOption(toolSelect, 'line', 'Tool: Line / road / river');
  addOption(toolSelect, 'rect_fill', 'Tool: Filled rectangle');
  addOption(toolSelect, 'rect_outline', 'Tool: Rectangle outline');
  addOption(toolSelect, 'select', 'Tool: Select area');
  addOption(toolSelect, 'stamp', 'Tool: Paste stamp');
  toolSelect.value = toolMode;
  toolSelect.addEventListener('change', () => {
    toolMode = toolSelect.value as ToolMode;
    draw();
  });

  const brushSelect = document.createElement('select');
  for (const size of BRUSH_SIZES) addOption(brushSelect, String(size), `${size.toLocaleString()}×${size.toLocaleString()} brush`);
  brushSelect.value = String(brushSize);
  brushSelect.addEventListener('change', () => {
    brushSize = Number(brushSelect.value);
    draw();
  });

  const zoomSelect = document.createElement('select');
  TILE_SIZES.forEach((size, index) => addOption(zoomSelect, String(index), `${size}px / tile`));
  zoomSelect.value = String(zoomIndex);
  zoomSelect.addEventListener('change', () => {
    zoomIndex = Number(zoomSelect.value);
    draw();
  });

  const treeModeSelect = document.createElement('select');
  addOption(treeModeSelect, 'single', 'Trees: single');
  addOption(treeModeSelect, 'scatter', 'Trees: scatter grove');
  treeModeSelect.value = treeMode;
  treeModeSelect.addEventListener('change', () => {
    treeMode = treeModeSelect.value as TreeMode;
    draw();
  });

  const treeDensitySelect = document.createElement('select');
  addOption(treeDensitySelect, '0.015', 'Grove: sparse');
  addOption(treeDensitySelect, '0.04', 'Grove: normal');
  addOption(treeDensitySelect, '0.08', 'Grove: dense');
  treeDensitySelect.value = String(treeDensity);
  treeDensitySelect.addEventListener('change', () => { treeDensity = Number(treeDensitySelect.value); });

  const copyBtn = button('Copy selection', () => copySelection());
  const stampBtn = button('Paste/Stamp', () => {
    if (!clipboard) {
      updateStatus('Select an area and copy it first.', true);
      return;
    }
    toolMode = 'stamp';
    toolSelect.value = toolMode;
    draw();
  });
  const fillBtn = button('Fill selection', () => fillSelectedArea());
  const clearSelectionBtn = button('Clear selection', () => {
    selectedArea = null;
    draw();
  });

  const title = document.createElement('span');
  title.className = 'editor-title';
  title.textContent = 'Twin Lands World Editor';
  const xLabel = document.createElement('span');
  xLabel.textContent = 'X';
  const yLabel = document.createElement('span');
  yLabel.textContent = 'Y';
  toolbar.append(
    title, backBtn, saveBtn, exportBtn, importBtn, clearBtn, mapBtn,
    markerJumpSelect, toolSelect, brushSelect, zoomSelect,
    copyBtn, stampBtn, fillBtn, clearSelectionBtn,
    xLabel, xInput, yLabel, yInput, goBtn,
    treeModeSelect, treeDensitySelect, importInput,
  );

  navigator = createEditorNavigator({
    getData: () => data,
    getViewport: () => {
      const rect = canvas.getBoundingClientRect();
      const tilePx = TILE_SIZES[zoomIndex];
      return {
        centerX,
        centerY,
        visibleWidth: rect.width / tilePx,
        visibleHeight: rect.height / tilePx,
      };
    },
    onJump: (x, y) => jumpCamera(x, y),
  });
  main.append(palette, canvasWrap, navigator.element);

  refreshMarkerJumpSelect();
  renderPalette();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mouseleave', () => {
    if (!isPainting) draw();
  });
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
    const point = mouseWorld(e);

    if (toolMode === 'stamp') {
      beginHistory();
      pasteClipboardAt(point.x, point.y);
      finishStroke();
      scheduleSave();
      navigator?.markEditsDirty();
      draw();
      return;
    }

    isPainting = true;
    if (toolMode === 'select') {
      dragStart = point;
      dragCurrent = point;
      draw();
      return;
    }

    beginHistory();
    if (toolMode === 'brush') {
      lastPaintPoint = null;
      paintAtMouse(e, true);
    } else {
      dragStart = point;
      dragCurrent = point;
      draw();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 2 || e.button === 1) isPanning = false;
    if (e.button !== 0 || !isPainting) return;

    if (toolMode === 'brush') {
      finishStroke();
    } else if (toolMode === 'select') {
      if (dragStart && dragCurrent) selectedArea = normalizeBox(dragStart, dragCurrent);
    } else if (dragStart && dragCurrent) {
      commitDragShape(toolMode, dragStart, dragCurrent);
      finishStroke();
      scheduleSave();
      navigator?.markEditsDirty();
    }

    isPainting = false;
    lastPaintPoint = null;
    dragStart = null;
    dragCurrent = null;
    draw();
  });

  canvas.addEventListener('mousemove', (e) => {
    const p = mouseWorld(e);
    hoverX = p.x;
    hoverY = p.y;
    if (isPanning) {
      const tilePx = TILE_SIZES[zoomIndex];
      centerX = clampCoord(panCenterX - (e.clientX - panStartX) / tilePx);
      centerY = clampCoord(panCenterY - (e.clientY - panStartY) / tilePx);
      syncCoordInputs();
      draw();
    } else if (isPainting && toolMode === 'brush') {
      paintAtMouse(e, false);
    } else if (isPainting && dragStart) {
      dragCurrent = p;
      draw();
    } else {
      draw();
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
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 's') {
      e.preventDefault();
      persistNow();
    } else if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
      e.preventDefault();
      redo();
    } else if ((e.ctrlKey || e.metaKey) && key === 'c' && !isFormTarget(e.target)) {
      e.preventDefault();
      copySelection();
    } else if ((e.ctrlKey || e.metaKey) && key === 'v' && !isFormTarget(e.target)) {
      e.preventDefault();
      if (clipboard) {
        toolMode = 'stamp';
        toolSelect.value = toolMode;
        draw();
      }
    } else if (!e.ctrlKey && !e.metaKey && key === 'm' && !isFormTarget(e.target)) {
      e.preventDefault();
      navigator?.toggleLarge();
    }
  });

  function button(text: string, action: () => void): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = text;
    element.addEventListener('click', action);
    return element;
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

  function jumpCamera(x: number, y: number): void {
    centerX = clampCoord(x);
    centerY = clampCoord(y);
    hoverX = centerX;
    hoverY = centerY;
    syncCoordInputs();
    draw();
  }

  function syncCoordInputs(): void {
    xInput.value = String(centerX);
    yInput.value = String(centerY);
  }

  function refreshMarkerJumpSelect(): void {
    markerJumpSelect.innerHTML = '';
    addOption(markerJumpSelect, '', data.markers.length ? 'Jump to marker…' : 'No markers yet');
    const markers = [...data.markers].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    for (const marker of markers) addOption(markerJumpSelect, marker.id, `${displayName(marker.type)}: ${marker.name}`);
  }

  function resizeCanvas(): void {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
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
      { id: 'markers', label: 'Map Markers' }, { id: 'erase', label: 'Erase / Revert' },
    ];
    for (const c of categories) {
      const b = button(c.label, () => { category = c.id; renderPalette(); });
      if (category === c.id) b.classList.add('active');
      tabs.append(b);
    }
    palette.append(tabs);

    const note = document.createElement('div');
    note.className = 'editor-palette-note';
    if (category === 'terrain') note.textContent = 'Select Path/Water/Beach and use Line for roads, rivers and coastlines. Filled Rectangle and Fill Selection create huge areas as compact shapes rather than millions of cells.';
    else if (category === 'structures') note.textContent = 'Brush places single structures. Line and Rectangle Outline are useful for fences and city walls.';
    else if (category === 'resources') note.textContent = 'Trees can place one at a time or scatter a randomized grove. Ores are exact hand-authored nodes.';
    else if (category === 'spawners') note.textContent = 'Monster spawners are entirely hand-authored.';
    else if (category === 'markers') note.textContent = 'Markers export with type, name, notes and coordinates so they can later become canonical city/mine/castle references.';
    else if (category === 'erase') note.textContent = 'Revert terrain paints the blank ocean base over existing authored terrain. Erase objects removes placed resources/structures/spawners.';
    if (note.textContent) palette.append(note);

    if (category === 'markers') {
      const nameInput = document.createElement('input');
      nameInput.className = 'editor-marker-input';
      nameInput.placeholder = 'Marker name (e.g. Capital)';
      nameInput.value = markerName;
      nameInput.addEventListener('input', () => { markerName = nameInput.value; });
      const notesInput = document.createElement('textarea');
      notesInput.className = 'editor-marker-notes';
      notesInput.placeholder = 'Optional notes / intended role';
      notesInput.value = markerNotes;
      notesInput.addEventListener('input', () => { markerNotes = notesInput.value; });
      palette.append(nameInput, notesInput);
    }

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
    } else if (category === 'markers') {
      for (const markerType of MARKER_TYPES) grid.append(paletteButton({ kind: 'marker', id: markerType.id }, '', markerType.label));
      grid.append(paletteButton({ kind: 'eraseMarker' }, '', 'Delete nearest marker'));
    } else {
      grid.append(paletteButton({ kind: 'eraseObjects' }, '', 'Erase objects'));
      grid.append(paletteButton({ kind: 'revertTile' }, '', 'Revert terrain to ocean'));
      grid.append(paletteButton({ kind: 'revertAll' }, '', 'Clear detailed cell'));
    }
    palette.append(grid);

    if (category === 'markers' && data.markers.length > 0) {
      const heading = document.createElement('h3');
      heading.textContent = `Placed markers (${data.markers.length})`;
      palette.append(heading);
      const list = document.createElement('div');
      list.className = 'editor-marker-list';
      for (const marker of [...data.markers].sort((a, b) => a.name.localeCompare(b.name))) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'editor-marker-row';
        row.textContent = `${displayName(marker.type)} · ${marker.name} · ${marker.x}, ${marker.y}`;
        row.title = marker.notes || 'Click to jump';
        row.addEventListener('click', () => jumpCamera(marker.x, marker.y));
        list.append(row);
      }
      palette.append(list);
    }
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
      draw();
    });
    return b;
  }

  function sameSelection(a: Selection, b: Selection): boolean {
    if (a.kind !== b.kind) return false;
    if ('id' in a && 'id' in b) return a.id === b.id;
    return true;
  }

  function mouseWorld(e: MouseEvent | WheelEvent): WorldPoint {
    const rect = canvas.getBoundingClientRect();
    const tilePx = TILE_SIZES[zoomIndex];
    const x = centerX + (e.clientX - rect.left - rect.width / 2) / tilePx;
    const y = centerY + (e.clientY - rect.top - rect.height / 2) / tilePx;
    return { x: clampCoord(x), y: clampCoord(y) };
  }

  function effectiveBrushSize(): number {
    if (selection.kind === 'tile' || selection.kind === 'revertTile') return brushSize;
    if (selection.kind === 'eraseObjects' || selection.kind === 'revertAll') return Math.min(brushSize, 129);
    if (selection.kind === 'resource' && TREE_RESOURCES.has(selection.id) && treeMode === 'scatter') return brushSize;
    return 1;
  }

  function beginHistory(): void {
    strokeBefore = new Map();
    strokeTerrainStart = data.terrainStrokes.length;
    strokeMarkersBefore = cloneMarkers(data.markers);
  }

  function paintAtMouse(e: MouseEvent, force: boolean): void {
    const p = mouseWorld(e);
    if ((selection.kind === 'marker' || selection.kind === 'eraseMarker') && !force) return;

    const spacing = Math.max(1, Math.floor(effectiveBrushSize() * (selection.kind === 'resource' && treeMode === 'scatter' ? 0.65 : 0.32)));
    if (!lastPaintPoint || force) {
      paintPoint(p.x, p.y);
      lastPaintPoint = p;
    } else {
      const dx = p.x - lastPaintPoint.x;
      const dy = p.y - lastPaintPoint.y;
      const distance = Math.hypot(dx, dy);
      if (distance < spacing) return;
      const steps = Math.min(1000, Math.max(1, Math.ceil(distance / spacing)));
      for (let i = 1; i <= steps; i++) {
        paintPoint(
          clampCoord(lastPaintPoint.x + (dx * i) / steps),
          clampCoord(lastPaintPoint.y + (dy * i) / steps),
        );
      }
      lastPaintPoint = p;
    }

    scheduleSave();
    navigator?.markEditsDirty();
    draw();
  }

  function paintPoint(x: number, y: number): void {
    if (selection.kind === 'marker') {
      placeMarker(x, y, selection.id);
      return;
    }
    if (selection.kind === 'eraseMarker') {
      deleteNearestMarker(x, y);
      return;
    }
    if (selection.kind === 'resource' && TREE_RESOURCES.has(selection.id) && treeMode === 'scatter') {
      scatterTrees(x, y, selection.id);
      return;
    }
    if ((selection.kind === 'tile' || selection.kind === 'revertTile') && brushSize >= MACRO_BRUSH_THRESHOLD) {
      data.terrainStrokes.push({
        kind: 'square', x, y, size: brushSize,
        tile: selection.kind === 'tile' ? selection.id : null,
      });
      return;
    }

    const size = effectiveBrushSize();
    const half = Math.floor(size / 2);
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) applySelection(clampCoord(x + ox), clampCoord(y + oy));
    }
  }

  function commitDragShape(mode: ToolMode, start: WorldPoint, end: WorldPoint): void {
    if (mode !== 'line' && mode !== 'rect_fill' && mode !== 'rect_outline') return;
    const terrainTile = selectedTerrainTile();
    if (terrainTile !== undefined) {
      data.terrainStrokes.push({
        kind: mode,
        x: start.x,
        y: start.y,
        x2: end.x,
        y2: end.y,
        size: Math.max(1, brushSize),
        tile: terrainTile,
      });
      return;
    }

    if (selection.kind === 'marker' || selection.kind === 'eraseMarker') {
      updateStatus('Markers use the Brush tool so each marker has one exact coordinate.', true);
      return;
    }

    if (mode === 'line') rasterLine(start, end);
    else rasterRectangle(start, end, mode === 'rect_fill');
  }

  function selectedTerrainTile(): TileType | null | undefined {
    if (selection.kind === 'tile') return selection.id;
    if (selection.kind === 'revertTile') return null;
    return undefined;
  }

  function rasterLine(start: WorldPoint, end: WorldPoint): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps + 1 > MAX_DETAILED_SHAPE_CELLS) {
      updateStatus(`That detailed line would place ${(steps + 1).toLocaleString()} cells. Keep detailed lines below ${MAX_DETAILED_SHAPE_CELLS.toLocaleString()} cells.`, true);
      return;
    }
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      applySelection(clampCoord(start.x + dx * t), clampCoord(start.y + dy * t));
    }
  }

  function rasterRectangle(start: WorldPoint, end: WorldPoint, filled: boolean): void {
    const box = normalizeBox(start, end);
    const width = box.right - box.left + 1;
    const height = box.bottom - box.top + 1;
    const count = filled ? width * height : Math.max(1, width * 2 + height * 2 - 4);
    if (count > MAX_DETAILED_SHAPE_CELLS) {
      updateStatus(`That detailed rectangle would place ${count.toLocaleString()} cells. Use terrain shapes for very large areas.`, true);
      return;
    }
    for (let y = box.top; y <= box.bottom; y++) {
      for (let x = box.left; x <= box.right; x++) {
        if (filled || x === box.left || x === box.right || y === box.top || y === box.bottom) applySelection(x, y);
      }
    }
  }

  function fillSelectedArea(): void {
    if (!selectedArea) {
      updateStatus('Use Tool: Select area and drag a rectangle first.', true);
      return;
    }
    const tile = selectedTerrainTile();
    if (tile === undefined) {
      updateStatus('Fill Selection works with a terrain tile or Revert terrain selected.', true);
      return;
    }
    beginHistory();
    data.terrainStrokes.push({
      kind: 'rect_fill',
      x: selectedArea.left,
      y: selectedArea.top,
      x2: selectedArea.right,
      y2: selectedArea.bottom,
      size: 1,
      tile,
    });
    finishStroke();
    scheduleSave();
    navigator?.markEditsDirty();
    draw();
  }

  function copySelection(): void {
    if (!selectedArea) {
      updateStatus('Use Tool: Select area and drag around the area you want to copy.', true);
      return;
    }
    const width = selectedArea.right - selectedArea.left + 1;
    const height = selectedArea.bottom - selectedArea.top + 1;
    const area = width * height;
    if (width > MAX_COPY_SIDE || height > MAX_COPY_SIDE || area > MAX_COPY_CELLS) {
      updateStatus(`Copy/paste stamps are limited to ${MAX_COPY_SIDE}×${MAX_COPY_SIDE} tiles so city blocks stay fast.`, true);
      return;
    }

    const terrainRuns: ClipboardRun[] = [];
    const cells: ClipboardCell[] = [];
    for (let dy = 0; dy < height; dy++) {
      const y = selectedArea.top + dy;
      let runTile = effectiveTile(selectedArea.left, y);
      let runStart = 0;
      for (let dx = 0; dx <= width; dx++) {
        const nextTile = dx < width ? effectiveTile(selectedArea.left + dx, y) : null;
        if (dx === width || nextTile !== runTile) {
          terrainRuns.push({ dy, startX: runStart, length: dx - runStart, tile: runTile });
          if (dx < width && nextTile) {
            runTile = nextTile;
            runStart = dx;
          }
        }

        if (dx < width) {
          const source = data.cells[cellKey(selectedArea.left + dx, y)];
          if (source?.structure || source?.resource || source?.spawner) {
            const detail: EditorCell = {};
            if (source.structure) detail.structure = source.structure;
            if (source.resource) detail.resource = source.resource;
            if (source.spawner) detail.spawner = source.spawner;
            cells.push({ dx, dy, cell: detail });
          }
        }
      }
    }

    clipboard = { width, height, terrainRuns, cells };
    updateStatus(`Copied ${width}×${height} stamp with ${cells.length} detailed objects.`);
  }

  function pasteClipboardAt(cx: number, cy: number): void {
    if (!clipboard) {
      updateStatus('Nothing has been copied yet.', true);
      return;
    }
    const left = cx - Math.floor(clipboard.width / 2);
    const top = cy - Math.floor(clipboard.height / 2);

    for (const run of clipboard.terrainRuns) {
      const x1 = left + run.startX;
      const x2 = x1 + run.length - 1;
      const y = top + run.dy;
      if (y < 0 || y >= WORLD_SIZE || x2 < 0 || x1 >= WORLD_SIZE) continue;
      data.terrainStrokes.push({
        kind: 'rect_fill',
        x: clampCoord(x1), y,
        x2: clampCoord(x2), y2: y,
        size: 1,
        tile: run.tile,
      });
    }

    for (const item of clipboard.cells) {
      const x = left + item.dx;
      const y = top + item.dy;
      if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) continue;
      const key = cellKey(x, y);
      rememberBefore(key);
      const cell = ensureCell(key);
      if (item.cell.structure) {
        cell.structure = item.cell.structure;
        cell.resource = null;
        cell.spawner = null;
      } else if (item.cell.resource) {
        cell.resource = item.cell.resource;
        cell.structure = null;
        cell.spawner = null;
      } else if (item.cell.spawner) {
        cell.spawner = item.cell.spawner;
        cell.structure = null;
        cell.resource = null;
      }
      cleanupCell(key);
    }
    updateStatus(`Stamped ${clipboard.width}×${clipboard.height} selection at ${cx}, ${cy}.`);
  }

  function placeMarker(x: number, y: number, type: EditorMarkerType): void {
    const label = MARKER_TYPES.find((item) => item.id === type)?.label ?? displayName(type);
    const count = data.markers.filter((marker) => marker.type === type).length + 1;
    const name = markerName.trim() || `${label} ${count}`;
    data.markers.push({
      id: `marker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      name,
      x,
      y,
      ...(markerNotes.trim() ? { notes: markerNotes.trim() } : {}),
    });
    refreshMarkerJumpSelect();
    renderPalette();
  }

  function deleteNearestMarker(x: number, y: number): void {
    if (data.markers.length === 0) return;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < data.markers.length; i++) {
      const marker = data.markers[i];
      const d = Math.hypot(marker.x - x, marker.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    const tilePx = TILE_SIZES[zoomIndex];
    const tolerance = Math.max(8, 14 / tilePx);
    if (bestIndex >= 0 && bestDistance <= tolerance) {
      data.markers.splice(bestIndex, 1);
      refreshMarkerJumpSelect();
      renderPalette();
    }
  }

  function scatterTrees(cx: number, cy: number, resource: ResourceType): void {
    const size = Math.max(1, brushSize);
    const half = Math.floor(size / 2);
    const area = size * size;
    const target = Math.max(1, Math.min(800, Math.round(area * treeDensity)));
    const used = new Set<string>();
    let attempts = 0;
    while (used.size < target && attempts < target * 10) {
      attempts++;
      const x = clampCoord(cx + Math.floor(Math.random() * size) - half);
      const y = clampCoord(cy + Math.floor(Math.random() * size) - half);
      const key = cellKey(x, y);
      if (used.has(key)) continue;
      used.add(key);
      const previous = selection;
      selection = { kind: 'resource', id: resource };
      applySelection(x, y);
      selection = previous;
    }
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
    for (const field of Object.keys(cell) as (keyof EditorCell)[]) {
      if (cell[field] === undefined) delete cell[field];
    }
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
      cell.tile = selection.id;
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
      cell.tile = BASE_TILE;
    }
    cleanupCell(key);
  }

  function finishStroke(): void {
    const addedStrokes = data.terrainStrokes.slice(strokeTerrainStart).map((s) => ({ ...s }));
    const markersChanged = JSON.stringify(strokeMarkersBefore) !== JSON.stringify(data.markers);
    if (strokeBefore.size === 0 && addedStrokes.length === 0 && !markersChanged) return;
    const afterCells = new Map<string, EditorCell | undefined>();
    for (const key of strokeBefore.keys()) afterCells.set(key, cloneCell(data.cells[key]));
    undoStack.push({
      beforeCells: strokeBefore,
      afterCells,
      beforeStrokeLength: strokeTerrainStart,
      addedStrokes,
      beforeMarkers: cloneMarkers(strokeMarkersBefore),
      afterMarkers: cloneMarkers(data.markers),
    });
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
    strokeBefore = new Map();
    strokeTerrainStart = data.terrainStrokes.length;
    strokeMarkersBefore = cloneMarkers(data.markers);
  }

  function applyHistory(entry: HistoryEntry, after: boolean): void {
    const map = after ? entry.afterCells : entry.beforeCells;
    for (const [key, cell] of map) {
      if (cell) data.cells[key] = { ...cell };
      else delete data.cells[key];
    }
    data.terrainStrokes.splice(entry.beforeStrokeLength);
    if (after) data.terrainStrokes.push(...entry.addedStrokes.map((s) => ({ ...s })));
    data.markers = cloneMarkers(after ? entry.afterMarkers : entry.beforeMarkers);
    refreshMarkerJumpSelect();
    if (category === 'markers') renderPalette();
    navigator?.markEditsDirty();
    scheduleSave();
    draw();
  }

  function undo(): void {
    const entry = undoStack.pop();
    if (!entry) return;
    applyHistory(entry, false);
    redoStack.push(entry);
  }

  function redo(): void {
    const entry = redoStack.pop();
    if (!entry) return;
    applyHistory(entry, true);
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
      updateStatus('Local browser storage is full. Export JSON now; large hand-built worlds should be committed to Git.', true);
    }
  }

  function exportJson(): void {
    persistNow();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'twinlands-world.json';
    a.click();
    URL.revokeObjectURL(url);
    updateStatus(`Exported twinlands-world.json with ${data.markers.length} reference markers.`);
  }

  async function importJson(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        updatedAt?: unknown;
        cells?: unknown;
        terrainStrokes?: unknown;
        markers?: unknown;
      };
      if (!parsed || typeof parsed !== 'object' || !parsed.cells || typeof parsed.cells !== 'object') {
        throw new Error('Unsupported editor file');
      }
      const importedStrokes: TerrainStroke[] = Array.isArray(parsed.terrainStrokes)
        ? parsed.terrainStrokes.flatMap((raw): TerrainStroke[] => normalizeImportedStroke(raw))
        : [];
      data = {
        version: 4,
        worldSize: WORLD_SIZE,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        cells: { ...(parsed.cells as Record<string, EditorCell>) },
        terrainStrokes: importedStrokes,
        markers: Array.isArray(parsed.markers)
          ? (parsed.markers as EditorMarker[]).map((marker) => ({ ...marker }))
          : [],
      };
      replaceEditorWorld(data);
      undoStack.length = 0;
      redoStack.length = 0;
      selectedArea = null;
      clipboard = null;
      refreshMarkerJumpSelect();
      if (category === 'markers') renderPalette();
      navigator?.markEditsDirty();
      draw();
      updateStatus(`Imported ${Object.keys(data.cells).length.toLocaleString()} detailed cells, ${data.terrainStrokes.length.toLocaleString()} terrain shapes and ${data.markers.length} markers.`);
    } catch {
      updateStatus('Could not import that file. Expected a MassRPG world-editor JSON file.', true);
    } finally {
      importInput.value = '';
    }
  }

  function normalizeImportedStroke(raw: unknown): TerrainStroke[] {
    if (!raw || typeof raw !== 'object') return [];
    const stroke = raw as Partial<TerrainStroke>;
    if (!Number.isFinite(stroke.x) || !Number.isFinite(stroke.y) || !Number.isFinite(stroke.size)) return [];
    if (!(stroke.tile === null || typeof stroke.tile === 'string')) return [];
    const kind: TerrainStrokeKind = stroke.kind === 'line' || stroke.kind === 'rect_fill' || stroke.kind === 'rect_outline'
      ? stroke.kind
      : 'square';
    if (kind !== 'square' && (!Number.isFinite(stroke.x2) || !Number.isFinite(stroke.y2))) return [];
    return [{
      kind,
      x: Number(stroke.x), y: Number(stroke.y),
      ...(kind !== 'square' ? { x2: Number(stroke.x2), y2: Number(stroke.y2) } : {}),
      size: Math.max(1, Math.round(Number(stroke.size))),
      tile: stroke.tile as TileType | null,
    }];
  }

  function terrainStrokeAt(x: number, y: number): TerrainStroke | undefined {
    for (let i = data.terrainStrokes.length - 1; i >= 0; i--) {
      if (terrainStrokeContains(data.terrainStrokes[i], x, y)) return data.terrainStrokes[i];
    }
    return undefined;
  }

  function effectiveTile(x: number, y: number): TileType {
    const cell = data.cells[cellKey(x, y)];
    if (cell?.tile) return cell.tile;
    return terrainStrokeAt(x, y)?.tile ?? BASE_TILE;
  }

  function draw(): void {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const tilePx = TILE_SIZES[zoomIndex];
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    if (tilePx < 4) drawMacroTerrain(width, height, tilePx);
    else drawDetailedTerrain(width, height, tilePx);

    drawReferenceMarkers(width, height, tilePx);
    drawInteractionPreview(width, height, tilePx);
    updateStatus();
    navigator?.redraw();
  }

  function drawMacroTerrain(width: number, height: number, tilePx: number): void {
    ctx.fillStyle = TILE_MAP_COLORS[BASE_TILE];
    ctx.fillRect(0, 0, width, height);

    for (const stroke of data.terrainStrokes) drawTerrainStrokeOnEditor(stroke, width, height, tilePx);

    for (const [key, cell] of Object.entries(data.cells)) {
      if (!cell.tile) continue;
      const [x, y] = parseCellKey(key);
      const p = worldToScreen(x, y, width, height, tilePx);
      if (p.x < -2 || p.y < -2 || p.x > width + 2 || p.y > height + 2) continue;
      ctx.fillStyle = TILE_MAP_COLORS[cell.tile];
      ctx.fillRect(p.x, p.y, Math.max(1, tilePx), Math.max(1, tilePx));
    }
  }

  function drawTerrainStrokeOnEditor(stroke: TerrainStroke, width: number, height: number, tilePx: number): void {
    const color = stroke.tile ? TILE_MAP_COLORS[stroke.tile] : TILE_MAP_COLORS[BASE_TILE];
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (stroke.kind === 'line') {
      const a = worldToScreen(stroke.x, stroke.y, width, height, tilePx);
      const b = worldToScreen(stroke.x2 ?? stroke.x, stroke.y2 ?? stroke.y, width, height, tilePx);
      ctx.lineWidth = Math.max(1, stroke.size * tilePx);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      return;
    }

    if (stroke.kind === 'rect_fill' || stroke.kind === 'rect_outline') {
      const box = normalizeBox(
        { x: stroke.x, y: stroke.y },
        { x: stroke.x2 ?? stroke.x, y: stroke.y2 ?? stroke.y },
      );
      const a = worldToScreen(box.left, box.top, width, height, tilePx);
      const w = Math.max(1, (box.right - box.left + 1) * tilePx);
      const h = Math.max(1, (box.bottom - box.top + 1) * tilePx);
      if (stroke.kind === 'rect_fill') ctx.fillRect(a.x, a.y, w, h);
      else {
        ctx.lineWidth = Math.max(1, stroke.size * tilePx);
        ctx.strokeRect(a.x, a.y, w, h);
      }
      return;
    }

    const half = Math.floor(stroke.size / 2);
    const a = worldToScreen(stroke.x - half, stroke.y - half, width, height, tilePx);
    const sizePx = stroke.size * tilePx;
    if (a.x > width || a.y > height || a.x + sizePx < 0 || a.y + sizePx < 0) return;
    ctx.fillRect(a.x, a.y, Math.max(1, sizePx), Math.max(1, sizePx));
  }

  function drawDetailedTerrain(width: number, height: number, tilePx: number): void {
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

    if (tilePx >= 8) drawObjects(startX, startY, cols, rows, originX, originY, tilePx);

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
  }

  function drawObjects(startX: number, startY: number, cols: number, rows: number, originX: number, originY: number, tilePx: number): void {
    for (let row = 0; row < rows; row++) {
      const wy = startY + row;
      if (wy < 0 || wy >= WORLD_SIZE) continue;
      for (let col = 0; col < cols; col++) {
        const wx = startX + col;
        if (wx < 0 || wx >= WORLD_SIZE) continue;
        const edit = data.cells[cellKey(wx, wy)];
        if (!edit) continue;
        const sx = originX + col * tilePx;
        const sy = originY + row * tilePx;
        if (edit.structure) {
          drawSprite(`/sprites/structures/${edit.structure}.png`, sx, sy, tilePx, displayName(edit.structure), '#d8c9a1');
        } else if (edit.resource) {
          drawSprite(`/sprites/resources/${edit.resource}.png`, sx, sy, tilePx, displayName(edit.resource), edit.resource.startsWith('rock_') ? '#1a1a1a' : '#356c36');
        } else if (edit.spawner) {
          drawSprite(`/sprites/monsters/${edit.spawner}.png`, sx, sy, tilePx, displayName(edit.spawner), '#aa3030');
        }
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
    ctx.arc(sx + tilePx / 2, sy + tilePx / 2, Math.max(2, tilePx * 0.3), 0, Math.PI * 2);
    ctx.fill();
    if (tilePx >= 24) {
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(8, tilePx * 0.25)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label.slice(0, 3), sx + tilePx / 2, sy + tilePx / 2 + 3);
    }
  }

  function worldToScreen(wx: number, wy: number, width: number, height: number, tilePx: number): WorldPoint {
    return {
      x: width / 2 + (wx - centerX) * tilePx,
      y: height / 2 + (wy - centerY) * tilePx,
    };
  }

  function drawReferenceMarkers(width: number, height: number, tilePx: number): void {
    for (const marker of data.markers) {
      const p = worldToScreen(marker.x, marker.y, width, height, tilePx);
      if (p.x < -30 || p.y < -30 || p.x > width + 30 || p.y > height + 30) continue;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.fillStyle = marker.type === 'mining_area' ? '#ff8a32'
        : marker.type === 'castle' ? '#c391ff'
        : marker.type === 'city' ? '#ff7777'
        : marker.type === 'village' ? '#8ee28e'
        : marker.type === 'town' ? '#f1d56b'
        : '#f4f4f4';
      ctx.beginPath();
      ctx.arc(p.x, p.y, tilePx < 2 ? 4 : Math.max(4, Math.min(8, tilePx * 0.24)), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (tilePx >= 2) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(marker.name, p.x, p.y - 10);
        ctx.fillStyle = '#fff';
        ctx.fillText(marker.name, p.x, p.y - 10);
      }
    }
  }

  function drawInteractionPreview(width: number, height: number, tilePx: number): void {
    if (selectedArea) {
      drawBoxPreview(selectedArea, width, height, tilePx, 'rgba(80,190,255,0.10)', 'rgba(105,205,255,0.95)', 2);
    }

    if (isPainting && dragStart && dragCurrent) {
      if (toolMode === 'line') {
        const a = worldToScreen(dragStart.x, dragStart.y, width, height, tilePx);
        const b = worldToScreen(dragCurrent.x, dragCurrent.y, width, height, tilePx);
        ctx.strokeStyle = 'rgba(92,255,114,0.95)';
        ctx.lineWidth = Math.max(3, brushSize * tilePx);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        return;
      }
      const box = normalizeBox(dragStart, dragCurrent);
      if (toolMode === 'select') {
        drawBoxPreview(box, width, height, tilePx, 'rgba(80,190,255,0.12)', 'rgba(105,205,255,0.95)', 2);
        return;
      }
      if (toolMode === 'rect_fill') {
        drawBoxPreview(box, width, height, tilePx, 'rgba(72,255,103,0.18)', 'rgba(92,255,114,0.95)', 2);
        return;
      }
      if (toolMode === 'rect_outline') {
        drawBoxPreview(box, width, height, tilePx, 'rgba(72,255,103,0.04)', 'rgba(92,255,114,0.95)', Math.max(2, brushSize * tilePx));
        return;
      }
    }

    if (toolMode === 'stamp' && clipboard) {
      const halfW = Math.floor(clipboard.width / 2);
      const halfH = Math.floor(clipboard.height / 2);
      drawBoxPreview({
        left: hoverX - halfW,
        top: hoverY - halfH,
        right: hoverX - halfW + clipboard.width - 1,
        bottom: hoverY - halfH + clipboard.height - 1,
      }, width, height, tilePx, 'rgba(72,255,103,0.15)', 'rgba(92,255,114,0.95)', 2);
      return;
    }

    if (toolMode !== 'brush') return;
    if (selection.kind === 'marker' || selection.kind === 'eraseMarker') {
      const p = worldToScreen(hoverX, hoverY, width, height, tilePx);
      ctx.fillStyle = 'rgba(72,255,103,0.25)';
      ctx.strokeStyle = 'rgba(92,255,114,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      return;
    }

    const size = effectiveBrushSize();
    const half = Math.floor(size / 2);
    const topLeft = worldToScreen(hoverX - half, hoverY - half, width, height, tilePx);
    const rawSize = Math.max(tilePx, size * tilePx);
    const visualSize = Math.max(3, rawSize);
    const x = rawSize < 3 ? topLeft.x - (3 - rawSize) / 2 : topLeft.x;
    const y = rawSize < 3 ? topLeft.y - (3 - rawSize) / 2 : topLeft.y;
    ctx.fillStyle = 'rgba(72,255,103,0.18)';
    ctx.strokeStyle = 'rgba(92,255,114,0.95)';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, visualSize, visualSize);
    ctx.strokeRect(x, y, visualSize, visualSize);
  }

  function drawBoxPreview(box: SelectionBox, width: number, height: number, tilePx: number, fill: string, stroke: string, lineWidth: number): void {
    const a = worldToScreen(box.left, box.top, width, height, tilePx);
    const w = Math.max(3, (box.right - box.left + 1) * tilePx);
    const h = Math.max(3, (box.bottom - box.top + 1) * tilePx);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.fillRect(a.x, a.y, w, h);
    ctx.strokeRect(a.x, a.y, w, h);
  }

  function updateStatus(message?: string, warning = false): void {
    const selected = 'id' in selection ? `${selection.kind}: ${displayName(selection.id)}` : selection.kind;
    const areaText = selectedArea
      ? ` · selection ${selectedArea.right - selectedArea.left + 1}×${selectedArea.bottom - selectedArea.top + 1}`
      : '';
    const clipboardText = clipboard ? ` · stamp ${clipboard.width}×${clipboard.height}` : '';
    statusLeft.textContent = message ?? `Cursor ${hoverX}, ${hoverY} · Center ${centerX}, ${centerY} · ${toolMode} · ${selected}${areaText}${clipboardText}`;
    statusLeft.className = warning ? 'warn' : '';
    const cellCount = Object.keys(data.cells).length;
    statusRight.textContent = `${cellCount.toLocaleString()} detailed cells · ${data.terrainStrokes.length.toLocaleString()} terrain shapes · ${data.markers.length} markers · Undo ${undoStack.length}`;
  }

  function parseCellKey(key: string): [number, number] {
    const comma = key.indexOf(',');
    return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
  }

  draw();
}
