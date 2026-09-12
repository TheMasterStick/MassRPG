import './editor.css';
import { MONSTERS } from '../data/monsters';
import { TILE_MAP_COLORS } from '../ui/mapColors';
import { WORLD_SIZE } from '../world/AeldorData';
import {
  baseTileForPlane,
  cellKey,
  clampElevation,
  clearEditorWorld,
  getPlaneData,
  loadEditorWorld,
  replaceEditorWorld,
  saveEditorWorld,
  shapeContains,
  type EditorCell,
  type EditorMarker,
  type EditorMarkerType,
  type EditorPlaneLink,
  type EditorWorldData,
  type ElevationStroke,
  type PlaneEndpoint,
  type PlaneLinkKind,
  type TerrainStroke,
  type TerrainStrokeKind,
} from '../world/EditorWorld';
import type { ResourceType, StructureType, TileType, WorldPlane } from '../world/types';
import type { ObjectTransform, TransformableEditorCell } from '../world/EditorObjects';
import { drawStructureJunction, getStructureJunction, getStructureVisualBase } from '../world/StructureJunctions';
import { createEditorNavigatorV5, type EditorNavigatorHandle } from './EditorNavigatorV5';

const SURFACE_TILES: TileType[] = [
  'deep_water', 'water', 'beach', 'grass', 'plains', 'forest', 'taiga',
  'mountain', 'snow', 'desert', 'swamp', 'path', 'rubble',
  'floor_wood', 'floor_brick', 'floor_cobble',
];

const UNDERGROUND_TILES: TileType[] = [
  'void', 'cave_wall', 'cave_floor', 'water', 'deep_water', 'rubble', 'path',
  'floor_wood', 'floor_brick', 'floor_cobble', 'mountain',
];

const STRUCTURE_IDS: StructureType[] = [
  'bank_chest', 'furnace', 'anvil', 'cooking_range', 'campfire', 'workbench',
  'fence', 'fence_l', 'fence_t', 'fence_r',
  'wall', 'wall_l', 'wall_t', 'wall_r', 'wall_window',
  'wall_brick', 'wall_brick_l', 'wall_brick_t', 'wall_brick_r',
  'wall_stone', 'wall_stone_l', 'wall_stone_t', 'wall_stone_r',
  'wall_cobble', 'wall_cobble_l', 'wall_cobble_t', 'wall_cobble_r',
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

const LINK_TYPES: { id: PlaneLinkKind; label: string }[] = [
  { id: 'cave_entrance', label: 'Cave Entrance' },
  { id: 'stairs', label: 'Stairs' },
  { id: 'ladder', label: 'Ladder' },
];

const TILE_SIZES = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 4, 8, 12, 16, 24, 32, 48];
const BRUSH_SIZES = [1, 3, 5, 9, 17, 33, 65, 129, 257, 513, 1025, 2049, 4097, 8193, 16385, 32769, 65535];
const MACRO_BRUSH_THRESHOLD = 9;
const DETAILED_RENDER_MIN_TILE_PX = 16;
const MAX_DETAILED_SHAPE_CELLS = 50000;
const MAX_COPY_SIDE = 256;
const PLANES: WorldPlane[] = [0, -1, -2];
const TREE_RESOURCES = new Set<ResourceType>([
  'tree_normal', 'tree_oak', 'tree_willow', 'tree_maple', 'tree_yew', 'tree_magic',
]);

const ELEVATION_COLORS: Record<number, string> = {
  [-2]: 'rgba(32,72,145,.42)',
  [-1]: 'rgba(65,120,160,.32)',
  0: 'rgba(0,0,0,0)',
  1: 'rgba(105,165,92,.22)',
  2: 'rgba(173,157,91,.28)',
  3: 'rgba(181,116,75,.33)',
  4: 'rgba(187,75,60,.38)',
  5: 'rgba(235,230,218,.46)',
};

type PaletteCategory = 'terrain' | 'elevation' | 'structures' | 'resources' | 'spawners' | 'markers' | 'links' | 'erase';
type ToolMode = 'brush' | 'line' | 'rect_fill' | 'rect_outline' | 'select' | 'stamp';
type TreeMode = 'single' | 'scatter';

type Selection =
  | { kind: 'tile'; id: TileType }
  | { kind: 'elevation_set'; value: number }
  | { kind: 'elevation_delta'; value: number }
  | { kind: 'structure'; id: StructureType }
  | { kind: 'resource'; id: ResourceType }
  | { kind: 'spawner'; id: string }
  | { kind: 'marker'; id: EditorMarkerType }
  | { kind: 'link'; id: PlaneLinkKind }
  | { kind: 'eraseLink' }
  | { kind: 'eraseMarker' }
  | { kind: 'eraseObjects' }
  | { kind: 'revertTile' }
  | { kind: 'revertAll' };

interface WorldPoint { x: number; y: number }
interface SelectionBox { left: number; top: number; right: number; bottom: number }
interface ClipboardRun<T> { dy: number; startX: number; length: number; value: T }
interface ClipboardCell { dx: number; dy: number; cell: EditorCell }
interface EditorClipboard {
  width: number;
  height: number;
  terrainRuns: ClipboardRun<TileType>[];
  elevationRuns: ClipboardRun<number>[];
  cells: ClipboardCell[];
}

interface HistoryEntry {
  plane: WorldPlane;
  beforeCells: Map<string, EditorCell | undefined>;
  afterCells: Map<string, EditorCell | undefined>;
  beforeTerrainLength: number;
  addedTerrain: TerrainStroke[];
  beforeElevationLength: number;
  addedElevation: ElevationStroke[];
  beforeMarkers: EditorMarker[];
  afterMarkers: EditorMarker[];
  beforeLinks: EditorPlaneLink[];
  afterLinks: EditorPlaneLink[];
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

function cloneMarkers(items: readonly EditorMarker[]): EditorMarker[] {
  return items.map((item) => ({ ...item }));
}

function cloneLinks(items: readonly EditorPlaneLink[]): EditorPlaneLink[] {
  return items.map((item) => ({ ...item, from: { ...item.from }, to: { ...item.to } }));
}

function normalizeBox(a: WorldPoint, b: WorldPoint): SelectionBox {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

function isFormTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function planeName(plane: WorldPlane): string {
  return plane === 0 ? 'Surface' : `Underground ${plane}`;
}

export function launchWorldEditor(root: HTMLElement): void {
  document.body.classList.add('editor-mode');
  root.innerHTML = '';

  let data = loadEditorWorld(WORLD_SIZE);
  let plane: WorldPlane = 0;
  let category: PaletteCategory = 'terrain';
  let selection: Selection = { kind: 'tile', id: 'grass' };
  let toolMode: ToolMode = 'brush';
  let treeMode: TreeMode = 'single';
  let treeDensity = 0.04;
  let markerName = '';
  let markerNotes = '';
  let linkName = '';
  let pendingLinkStart: PlaneEndpoint | null = null;
  let elevationOverlay = true;
  let surfaceGhost = true;

  let centerX = Math.floor(WORLD_SIZE / 2);
  let centerY = Math.floor(WORLD_SIZE / 2);
  let zoomIndex = 13;
  let brushSize = 1;
  let hoverX = centerX;
  let hoverY = centerY;

  let isPainting = false;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panCenterX = 0;
  let panCenterY = 0;
  let lastPaintPoint: WorldPoint | null = null;
  let dragStart: WorldPoint | null = null;
  let dragCurrent: WorldPoint | null = null;
  let selectedArea: SelectionBox | null = null;
  let clipboard: EditorClipboard | null = null;

  let strokeBefore = new Map<string, EditorCell | undefined>();
  let beforeTerrainLength = 0;
  let beforeElevationLength = 0;
  let beforeMarkers = cloneMarkers(data.markers);
  let beforeLinks = cloneLinks(data.links);
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
  help.textContent = 'Surface elevation -2…+5 · a 2+ step is a cliff · underground planes -1/-2 · right-drag pans · wheel zooms · M world map.';
  const status = document.createElement('div');
  status.className = 'editor-status';
  const statusLeft = document.createElement('span');
  const statusRight = document.createElement('span');
  status.append(statusLeft, statusRight);
  canvasWrap.append(canvas, help);
  editor.append(toolbar, main, status);
  root.append(editor);

  function button(text: string, action: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', action);
    return b;
  }

  function addOption(select: HTMLSelectElement, value: string, label: string): void {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }

  function numberInput(value: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(WORLD_SIZE - 1);
    input.value = String(value);
    return input;
  }

  function clampCoord(value: number): number {
    return Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(Number.isFinite(value) ? value : 0)));
  }

  function currentLayer() {
    return getPlaneData(data, plane);
  }

  const backBtn = button('← Game', () => {
    persistNow();
    window.location.href = window.location.pathname;
  });
  const saveBtn = button('Save', persistNow);
  const exportBtn = button('Export JSON', exportJson);
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importInput.style.display = 'none';
  importInput.addEventListener('change', () => void importJson(importInput.files?.[0]));
  const importBtn = button('Import JSON', () => importInput.click());
  const clearBtn = button('Clear all', () => {
    if (!window.confirm('Clear all planes, elevation, markers and links?')) return;
    data = clearEditorWorld(WORLD_SIZE);
    undoStack.length = 0;
    redoStack.length = 0;
    selectedArea = null;
    clipboard = null;
    pendingLinkStart = null;
    refreshMarkerJump();
    navigator?.markEditsDirty();
    renderPalette();
    draw();
  });
  const mapBtn = button('World Map (M)', () => navigator?.toggleLarge());

  const planeSelect = document.createElement('select');
  for (const p of PLANES) addOption(planeSelect, String(p), planeName(p));
  planeSelect.value = '0';
  planeSelect.addEventListener('change', () => {
    plane = Number(planeSelect.value) as WorldPlane;
    selectedArea = null;
    dragStart = null;
    dragCurrent = null;
    refreshMarkerJump();
    renderPalette();
    navigator?.markEditsDirty();
    draw();
  });

  const markerJump = document.createElement('select');
  markerJump.addEventListener('change', () => {
    const marker = data.markers.find((item) => item.id === markerJump.value);
    markerJump.value = '';
    if (!marker) return;
    if (marker.plane !== plane) {
      plane = marker.plane;
      planeSelect.value = String(plane);
      navigator?.markEditsDirty();
    }
    jumpCamera(marker.x, marker.y);
    renderPalette();
  });

  const toolSelect = document.createElement('select');
  addOption(toolSelect, 'brush', 'Tool: Brush');
  addOption(toolSelect, 'line', 'Tool: Line');
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
  brushSelect.value = '1';
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

  const overlayToggle = document.createElement('input');
  overlayToggle.type = 'checkbox';
  overlayToggle.checked = elevationOverlay;
  overlayToggle.addEventListener('change', () => {
    elevationOverlay = overlayToggle.checked;
    draw();
  });
  const overlayLabel = document.createElement('label');
  overlayLabel.className = 'editor-check-label';
  overlayLabel.append(overlayToggle, document.createTextNode(' Elevation overlay'));

  const ghostToggle = document.createElement('input');
  ghostToggle.type = 'checkbox';
  ghostToggle.checked = surfaceGhost;
  ghostToggle.addEventListener('change', () => {
    surfaceGhost = ghostToggle.checked;
    draw();
  });
  const ghostLabel = document.createElement('label');
  ghostLabel.className = 'editor-check-label';
  ghostLabel.append(ghostToggle, document.createTextNode(' Surface ghost'));

  const xInput = numberInput(centerX);
  const yInput = numberInput(centerY);
  const goBtn = button('Go', () => jumpCamera(Number(xInput.value), Number(yInput.value)));

  const copyBtn = button('Copy selection', copySelection);
  const stampBtn = button('Paste/Stamp', () => {
    if (!clipboard) {
      updateStatus('Copy a selection first.', true);
      return;
    }
    toolMode = 'stamp';
    toolSelect.value = 'stamp';
    draw();
  });
  const fillBtn = button('Fill selection', fillSelectedArea);
  const clearSelectionBtn = button('Clear selection', () => {
    selectedArea = null;
    draw();
  });

  const treeModeSelect = document.createElement('select');
  addOption(treeModeSelect, 'single', 'Trees: single');
  addOption(treeModeSelect, 'scatter', 'Trees: scatter');
  treeModeSelect.value = treeMode;
  treeModeSelect.addEventListener('change', () => {
    treeMode = treeModeSelect.value as TreeMode;
  });

  const treeDensitySelect = document.createElement('select');
  addOption(treeDensitySelect, '0.015', 'Grove: sparse');
  addOption(treeDensitySelect, '0.04', 'Grove: normal');
  addOption(treeDensitySelect, '0.08', 'Grove: dense');
  treeDensitySelect.value = String(treeDensity);
  treeDensitySelect.addEventListener('change', () => {
    treeDensity = Number(treeDensitySelect.value);
  });

  const title = document.createElement('span');
  title.className = 'editor-title';
  title.textContent = 'Twin Lands World Editor';
  toolbar.append(
    title,
    backBtn,
    saveBtn,
    exportBtn,
    importBtn,
    clearBtn,
    mapBtn,
    planeSelect,
    markerJump,
    toolSelect,
    brushSelect,
    zoomSelect,
    copyBtn,
    stampBtn,
    fillBtn,
    clearSelectionBtn,
    overlayLabel,
    ghostLabel,
    document.createTextNode('X'),
    xInput,
    document.createTextNode('Y'),
    yInput,
    goBtn,
    treeModeSelect,
    treeDensitySelect,
    importInput,
  );

  navigator = createEditorNavigatorV5({
    getData: () => data,
    getPlane: () => plane,
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
    onJump: jumpCamera,
  });
  main.append(palette, canvasWrap, navigator.element);

  refreshMarkerJump();
  renderPalette();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('massrpg-editor-redraw', () => draw());
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 2 || event.button === 1) {
      isPanning = true;
      panStartX = event.clientX;
      panStartY = event.clientY;
      panCenterX = centerX;
      panCenterY = centerY;
      return;
    }
    if (event.button !== 0) return;
    const point = mouseWorld(event);

    if (toolMode === 'stamp') {
      beginHistory();
      pasteClipboardAt(point.x, point.y);
      finishHistory();
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
      paintAtMouse(event, true);
    } else {
      dragStart = point;
      dragCurrent = point;
      draw();
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 2 || event.button === 1) isPanning = false;
    if (event.button !== 0 || !isPainting) return;

    if (toolMode === 'brush') {
      finishHistory();
    } else if (toolMode === 'select') {
      if (dragStart && dragCurrent) selectedArea = normalizeBox(dragStart, dragCurrent);
    } else if (dragStart && dragCurrent) {
      commitDragShape(toolMode, dragStart, dragCurrent);
      finishHistory();
      scheduleSave();
      navigator?.markEditsDirty();
    }

    isPainting = false;
    lastPaintPoint = null;
    dragStart = null;
    dragCurrent = null;
    draw();
  });

  canvas.addEventListener('mousemove', (event) => {
    const point = mouseWorld(event);
    hoverX = point.x;
    hoverY = point.y;
    if (isPanning) {
      const tilePx = TILE_SIZES[zoomIndex];
      centerX = clampCoord(panCenterX - (event.clientX - panStartX) / tilePx);
      centerY = clampCoord(panCenterY - (event.clientY - panStartY) / tilePx);
      syncCoords();
      draw();
    } else if (isPainting && toolMode === 'brush') {
      paintAtMouse(event, false);
    } else if (isPainting && dragStart) {
      dragCurrent = point;
      draw();
    } else {
      draw();
    }
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const before = mouseWorld(event);
    zoomIndex = Math.max(0, Math.min(TILE_SIZES.length - 1, zoomIndex + (event.deltaY < 0 ? 1 : -1)));
    zoomSelect.value = String(zoomIndex);
    const after = mouseWorld(event);
    centerX = clampCoord(centerX + before.x - after.x);
    centerY = clampCoord(centerY + before.y - after.y);
    syncCoords();
    draw();
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault();
      persistNow();
    } else if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      undo();
    } else if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      redo();
    } else if ((event.ctrlKey || event.metaKey) && key === 'c' && !isFormTarget(event.target)) {
      event.preventDefault();
      copySelection();
    } else if ((event.ctrlKey || event.metaKey) && key === 'v' && !isFormTarget(event.target)) {
      event.preventDefault();
      if (clipboard) {
        toolMode = 'stamp';
        toolSelect.value = 'stamp';
        draw();
      }
    } else if (!event.ctrlKey && !event.metaKey && key === 'm' && !isFormTarget(event.target)) {
      event.preventDefault();
      navigator?.toggleLarge();
    }
  });

  function jumpCamera(x: number, y: number): void {
    centerX = clampCoord(x);
    centerY = clampCoord(y);
    hoverX = centerX;
    hoverY = centerY;
    syncCoords();
    draw();
  }

  function syncCoords(): void {
    xInput.value = String(centerX);
    yInput.value = String(centerY);
  }

  function mouseWorld(event: MouseEvent | WheelEvent): WorldPoint {
    const rect = canvas.getBoundingClientRect();
    const tilePx = TILE_SIZES[zoomIndex];
    return {
      x: clampCoord(centerX + (event.clientX - rect.left - rect.width / 2) / tilePx),
      y: clampCoord(centerY + (event.clientY - rect.top - rect.height / 2) / tilePx),
    };
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

  function refreshMarkerJump(): void {
    markerJump.innerHTML = '';
    addOption(markerJump, '', data.markers.length ? 'Jump to marker…' : 'No markers yet');
    for (const marker of [...data.markers].sort((a, b) => a.name.localeCompare(b.name))) {
      addOption(markerJump, marker.id, `${planeName(marker.plane)} · ${displayName(marker.type)} · ${marker.name}`);
    }
  }

  function renderPalette(): void {
    palette.innerHTML = '';
    const tabs = document.createElement('div');
    tabs.className = 'editor-category-tabs';
    const categories: PaletteCategory[] = ['terrain', 'elevation', 'structures', 'resources', 'spawners', 'markers', 'links', 'erase'];
    for (const item of categories) {
      const b = button(displayName(item), () => {
        category = item;
        renderPalette();
      });
      if (category === item) b.classList.add('active');
      tabs.append(b);
    }
    palette.append(tabs);

    const note = document.createElement('div');
    note.className = 'editor-palette-note';
    if (category === 'elevation') {
      note.textContent = 'Elevation is separate from underground planes. Normal movement can climb/drop 1 level; a 2+ level edge becomes an impassable cliff. Raise/Lower are cumulative and clamped to -2…+5.';
    } else if (category === 'links') {
      note.textContent = 'Choose Cave Entrance, Stairs or Ladder. Click the first endpoint, switch plane if needed, then click the destination. Links are bidirectional.';
    } else if (category === 'terrain') {
      note.textContent = plane === 0 ? 'Paint the surface over the blank ocean.' : 'Paint cave floor and walls over the blank underground void.';
    } else if (category === 'markers') {
      note.textContent = 'Markers remember plane, name, notes and exact coordinates for later world references.';
    } else if (category === 'resources') {
      note.textContent = 'Trees can place individually or as randomized groves; ores remain exact authored nodes.';
    } else if (category === 'erase') {
      note.textContent = 'Revert Terrain returns to the current plane base. Use Elevation → Set 0 to flatten an area.';
    } else {
      note.textContent = 'Objects are authored only on the currently selected plane.';
    }
    palette.append(note);

    if (category === 'markers') {
      const nameInput = document.createElement('input');
      nameInput.className = 'editor-marker-input';
      nameInput.placeholder = 'Marker name';
      nameInput.value = markerName;
      nameInput.addEventListener('input', () => { markerName = nameInput.value; });
      const notesInput = document.createElement('textarea');
      notesInput.className = 'editor-marker-notes';
      notesInput.placeholder = 'Optional notes';
      notesInput.value = markerNotes;
      notesInput.addEventListener('input', () => { markerNotes = notesInput.value; });
      palette.append(nameInput, notesInput);
    }

    if (category === 'links') {
      const nameInput = document.createElement('input');
      nameInput.className = 'editor-marker-input';
      nameInput.placeholder = 'Optional link name';
      nameInput.value = linkName;
      nameInput.addEventListener('input', () => { linkName = nameInput.value; });
      palette.append(nameInput);
      if (pendingLinkStart) {
        const pending = document.createElement('div');
        pending.className = 'editor-palette-note';
        pending.textContent = `Start: ${planeName(pendingLinkStart.plane)} ${pendingLinkStart.x}, ${pendingLinkStart.y}. Switch plane and click the destination.`;
        palette.append(pending, button('Cancel pending link', () => {
          pendingLinkStart = null;
          renderPalette();
          draw();
        }));
      }
    }

    const grid = document.createElement('div');
    grid.className = 'editor-palette-grid';
    if (category === 'terrain') {
      const tiles = plane === 0 ? SURFACE_TILES : UNDERGROUND_TILES;
      for (const id of tiles) grid.append(paletteButton({ kind: 'tile', id }, `/sprites/tiles/${id}.png`, displayName(id)));
    } else if (category === 'elevation') {
      for (let value = -2; value <= 5; value++) grid.append(paletteButton({ kind: 'elevation_set', value }, '', `Set ${value > 0 ? '+' : ''}${value}`));
      grid.append(paletteButton({ kind: 'elevation_delta', value: 1 }, '', 'Raise +1'));
      grid.append(paletteButton({ kind: 'elevation_delta', value: -1 }, '', 'Lower -1'));
    } else if (category === 'structures') {
      for (const id of STRUCTURE_IDS) {
        const previewId = getStructureVisualBase(id);
        grid.append(paletteButton({ kind: 'structure', id }, `/sprites/structures/${previewId}.png`, displayName(id)));
      }
    } else if (category === 'resources') {
      for (const id of RESOURCE_IDS) grid.append(paletteButton({ kind: 'resource', id }, `/sprites/resources/${id}.png`, displayName(id)));
    } else if (category === 'spawners') {
      for (const monster of MONSTERS) grid.append(paletteButton({ kind: 'spawner', id: monster.id }, `/sprites/monsters/${monster.id}.png`, `${monster.name} (${monster.level})`));
    } else if (category === 'markers') {
      for (const marker of MARKER_TYPES) grid.append(paletteButton({ kind: 'marker', id: marker.id }, '', marker.label));
      grid.append(paletteButton({ kind: 'eraseMarker' }, '', 'Delete nearest marker'));
    } else if (category === 'links') {
      for (const link of LINK_TYPES) grid.append(paletteButton({ kind: 'link', id: link.id }, '', link.label));
      grid.append(paletteButton({ kind: 'eraseLink' }, '', 'Delete nearest link'));
    } else {
      grid.append(paletteButton({ kind: 'eraseObjects' }, '', 'Erase objects'));
      grid.append(paletteButton({ kind: 'revertTile' }, '', 'Revert terrain'));
      grid.append(paletteButton({ kind: 'revertAll' }, '', 'Clear detailed cell'));
    }
    palette.append(grid);

    if (category === 'markers') {
      const markers = data.markers.filter((item) => item.plane === plane);
      if (markers.length) {
        const heading = document.createElement('h3');
        heading.textContent = `Markers on ${planeName(plane)} (${markers.length})`;
        palette.append(heading);
        for (const marker of markers) {
          const row = button(`${displayName(marker.type)} · ${marker.name} · ${marker.x},${marker.y}`, () => jumpCamera(marker.x, marker.y));
          row.className = 'editor-marker-row';
          row.title = marker.notes ?? '';
          palette.append(row);
        }
      }
    }

    if (category === 'links') {
      const links = data.links.filter((item) => item.from.plane === plane || item.to.plane === plane);
      if (links.length) {
        const heading = document.createElement('h3');
        heading.textContent = `Links touching ${planeName(plane)} (${links.length})`;
        palette.append(heading);
        for (const link of links) {
          const endpoint = link.from.plane === plane ? link.from : link.to;
          const destination = link.from.plane === plane ? link.to : link.from;
          const row = button(`${displayName(link.kind)} · ${link.name ?? 'unnamed'} → ${planeName(destination.plane)}`, () => jumpCamera(endpoint.x, endpoint.y));
          row.className = 'editor-marker-row';
          palette.append(row);
        }
      }
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
    if ('value' in a && 'value' in b) return a.value === b.value;
    return true;
  }

  function effectiveBrushSize(): number {
    if (selection.kind === 'tile' || selection.kind === 'revertTile' || selection.kind === 'elevation_set' || selection.kind === 'elevation_delta') return brushSize;
    if (selection.kind === 'eraseObjects' || selection.kind === 'revertAll') return Math.min(brushSize, 129);
    if (selection.kind === 'resource' && TREE_RESOURCES.has(selection.id) && treeMode === 'scatter') return brushSize;
    return 1;
  }

  function beginHistory(): void {
    const layer = currentLayer();
    strokeBefore = new Map();
    beforeTerrainLength = layer.terrainStrokes.length;
    beforeElevationLength = layer.elevationStrokes.length;
    beforeMarkers = cloneMarkers(data.markers);
    beforeLinks = cloneLinks(data.links);
  }

  function finishHistory(): void {
    const layer = currentLayer();
    const addedTerrain = layer.terrainStrokes.slice(beforeTerrainLength).map((item) => ({ ...item }));
    const addedElevation = layer.elevationStrokes.slice(beforeElevationLength).map((item) => ({ ...item }));
    const markersChanged = JSON.stringify(beforeMarkers) !== JSON.stringify(data.markers);
    const linksChanged = JSON.stringify(beforeLinks) !== JSON.stringify(data.links);
    if (!strokeBefore.size && !addedTerrain.length && !addedElevation.length && !markersChanged && !linksChanged) return;

    const afterCells = new Map<string, EditorCell | undefined>();
    for (const key of strokeBefore.keys()) afterCells.set(key, cloneCell(layer.cells[key]));
    undoStack.push({
      plane,
      beforeCells: strokeBefore,
      afterCells,
      beforeTerrainLength,
      addedTerrain,
      beforeElevationLength,
      addedElevation,
      beforeMarkers: cloneMarkers(beforeMarkers),
      afterMarkers: cloneMarkers(data.markers),
      beforeLinks: cloneLinks(beforeLinks),
      afterLinks: cloneLinks(data.links),
    });
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  }

  function rememberBefore(key: string): void {
    if (!strokeBefore.has(key)) strokeBefore.set(key, cloneCell(currentLayer().cells[key]));
  }

  function ensureCell(key: string): EditorCell {
    const layer = currentLayer();
    if (!layer.cells[key]) layer.cells[key] = {};
    return layer.cells[key];
  }

  function cleanupCell(key: string): void {
    const cell = currentLayer().cells[key];
    if (!cell) return;
    for (const field of Object.keys(cell) as (keyof EditorCell)[]) {
      if (cell[field] === undefined) delete cell[field];
    }
    if (Object.keys(cell).length === 0) delete currentLayer().cells[key];
  }

  function paintAtMouse(event: MouseEvent, force: boolean): void {
    const point = mouseWorld(event);
    const oneClickOnly = selection.kind === 'marker' || selection.kind === 'eraseMarker' || selection.kind === 'link' || selection.kind === 'eraseLink';
    if (oneClickOnly && !force) return;

    const scatterSpacing = selection.kind === 'resource' && treeMode === 'scatter' ? 0.65 : 0.32;
    const spacing = Math.max(1, Math.floor(effectiveBrushSize() * scatterSpacing));
    if (!lastPaintPoint || force) {
      paintPoint(point.x, point.y);
      lastPaintPoint = point;
    } else {
      const dx = point.x - lastPaintPoint.x;
      const dy = point.y - lastPaintPoint.y;
      const distance = Math.hypot(dx, dy);
      if (distance < spacing) return;
      const steps = Math.min(1000, Math.max(1, Math.ceil(distance / spacing)));
      for (let i = 1; i <= steps; i++) {
        paintPoint(
          clampCoord(lastPaintPoint.x + dx * i / steps),
          clampCoord(lastPaintPoint.y + dy * i / steps),
        );
      }
      lastPaintPoint = point;
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
    if (selection.kind === 'link') {
      placeLinkEndpoint(x, y, selection.id);
      return;
    }
    if (selection.kind === 'eraseLink') {
      deleteNearestLink(x, y);
      return;
    }
    if (selection.kind === 'resource' && TREE_RESOURCES.has(selection.id) && treeMode === 'scatter') {
      scatterTrees(x, y, selection.id);
      return;
    }
    if (selection.kind === 'elevation_set' || selection.kind === 'elevation_delta') {
      currentLayer().elevationStrokes.push({
        kind: 'square',
        x,
        y,
        size: brushSize,
        mode: selection.kind === 'elevation_set' ? 'set' : 'delta',
        value: selection.value,
      });
      return;
    }
    if ((selection.kind === 'tile' || selection.kind === 'revertTile') && brushSize >= MACRO_BRUSH_THRESHOLD) {
      currentLayer().terrainStrokes.push({
        kind: 'square',
        x,
        y,
        size: brushSize,
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

  function applySelection(x: number, y: number): void {
    const key = cellKey(x, y);
    rememberBefore(key);
    if (selection.kind === 'revertAll') {
      delete currentLayer().cells[key];
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
      cell.tile = baseTileForPlane(plane);
    }
    cleanupCell(key);
  }

  function scatterTrees(cx: number, cy: number, resource: ResourceType): void {
    const size = Math.max(1, brushSize);
    const half = Math.floor(size / 2);
    const target = Math.max(1, Math.min(800, Math.round(size * size * treeDensity)));
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

  function commitDragShape(mode: ToolMode, start: WorldPoint, end: WorldPoint): void {
    if (mode !== 'line' && mode !== 'rect_fill' && mode !== 'rect_outline') return;
    const kind = mode as TerrainStrokeKind;
    if (selection.kind === 'tile' || selection.kind === 'revertTile') {
      currentLayer().terrainStrokes.push({
        kind,
        x: start.x,
        y: start.y,
        x2: end.x,
        y2: end.y,
        size: Math.max(1, brushSize),
        tile: selection.kind === 'tile' ? selection.id : null,
      });
      return;
    }
    if (selection.kind === 'elevation_set' || selection.kind === 'elevation_delta') {
      currentLayer().elevationStrokes.push({
        kind,
        x: start.x,
        y: start.y,
        x2: end.x,
        y2: end.y,
        size: Math.max(1, brushSize),
        mode: selection.kind === 'elevation_set' ? 'set' : 'delta',
        value: selection.value,
      });
      return;
    }
    if (selection.kind === 'marker' || selection.kind === 'eraseMarker' || selection.kind === 'link' || selection.kind === 'eraseLink') {
      updateStatus('Markers and plane links use the Brush tool.', true);
      return;
    }
    if (mode === 'line') rasterLine(start, end);
    else rasterRectangle(start, end, mode === 'rect_fill');
  }

  function rasterLine(start: WorldPoint, end: WorldPoint): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps + 1 > MAX_DETAILED_SHAPE_CELLS) {
      updateStatus('Detailed object line is too large; use terrain/elevation shapes for macro work.', true);
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
      updateStatus('Detailed object rectangle is too large.', true);
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
      updateStatus('Select an area first.', true);
      return;
    }
    beginHistory();
    if (selection.kind === 'tile' || selection.kind === 'revertTile') {
      currentLayer().terrainStrokes.push({
        kind: 'rect_fill',
        x: selectedArea.left,
        y: selectedArea.top,
        x2: selectedArea.right,
        y2: selectedArea.bottom,
        size: 1,
        tile: selection.kind === 'tile' ? selection.id : null,
      });
    } else if (selection.kind === 'elevation_set' || selection.kind === 'elevation_delta') {
      currentLayer().elevationStrokes.push({
        kind: 'rect_fill',
        x: selectedArea.left,
        y: selectedArea.top,
        x2: selectedArea.right,
        y2: selectedArea.bottom,
        size: 1,
        mode: selection.kind === 'elevation_set' ? 'set' : 'delta',
        value: selection.value,
      });
    } else {
      updateStatus('Fill Selection works with terrain or elevation.', true);
      return;
    }
    finishHistory();
    scheduleSave();
    navigator?.markEditsDirty();
    draw();
  }

  function terrainStrokeAt(x: number, y: number): TerrainStroke | undefined {
    const strokes = currentLayer().terrainStrokes;
    for (let i = strokes.length - 1; i >= 0; i--) if (shapeContains(strokes[i], x, y)) return strokes[i];
    return undefined;
  }

  function effectiveTile(x: number, y: number): TileType {
    return currentLayer().cells[cellKey(x, y)]?.tile ?? terrainStrokeAt(x, y)?.tile ?? baseTileForPlane(plane);
  }

  function effectiveElevation(x: number, y: number): number {
    let elevation = 0;
    for (const stroke of currentLayer().elevationStrokes) {
      if (!shapeContains(stroke, x, y)) continue;
      elevation = stroke.mode === 'set' ? clampElevation(stroke.value) : clampElevation(elevation + stroke.value);
    }
    return elevation;
  }

  function copySelection(): void {
    if (!selectedArea) {
      updateStatus('Select an area first.', true);
      return;
    }
    const width = selectedArea.right - selectedArea.left + 1;
    const height = selectedArea.bottom - selectedArea.top + 1;
    if (width > MAX_COPY_SIDE || height > MAX_COPY_SIDE) {
      updateStatus(`Stamp copy is limited to ${MAX_COPY_SIDE}×${MAX_COPY_SIDE}.`, true);
      return;
    }

    const terrainRuns: ClipboardRun<TileType>[] = [];
    const elevationRuns: ClipboardRun<number>[] = [];
    const cells: ClipboardCell[] = [];
    for (let dy = 0; dy < height; dy++) {
      const y = selectedArea.top + dy;
      let terrainValue = effectiveTile(selectedArea.left, y);
      let elevationValue = effectiveElevation(selectedArea.left, y);
      let terrainStart = 0;
      let elevationStart = 0;

      for (let dx = 0; dx <= width; dx++) {
        const x = selectedArea.left + dx;
        const nextTerrain = dx < width ? effectiveTile(x, y) : null;
        const nextElevation = dx < width ? effectiveElevation(x, y) : Number.NaN;

        if (dx === width || nextTerrain !== terrainValue) {
          terrainRuns.push({ dy, startX: terrainStart, length: dx - terrainStart, value: terrainValue });
          if (dx < width && nextTerrain) {
            terrainValue = nextTerrain;
            terrainStart = dx;
          }
        }
        if (dx === width || nextElevation !== elevationValue) {
          elevationRuns.push({ dy, startX: elevationStart, length: dx - elevationStart, value: elevationValue });
          if (dx < width) {
            elevationValue = nextElevation;
            elevationStart = dx;
          }
        }

        if (dx < width) {
          const source = currentLayer().cells[cellKey(x, y)];
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
    clipboard = { width, height, terrainRuns, elevationRuns, cells };
    updateStatus(`Copied ${width}×${height} stamp with terrain, elevation and ${cells.length} objects.`);
  }

  function pasteClipboardAt(cx: number, cy: number): void {
    if (!clipboard) {
      updateStatus('Nothing copied.', true);
      return;
    }
    const left = cx - Math.floor(clipboard.width / 2);
    const top = cy - Math.floor(clipboard.height / 2);
    for (const run of clipboard.terrainRuns) {
      const y = top + run.dy;
      if (y < 0 || y >= WORLD_SIZE) continue;
      currentLayer().terrainStrokes.push({
        kind: 'rect_fill',
        x: clampCoord(left + run.startX),
        y,
        x2: clampCoord(left + run.startX + run.length - 1),
        y2: y,
        size: 1,
        tile: run.value,
      });
    }
    for (const run of clipboard.elevationRuns) {
      const y = top + run.dy;
      if (y < 0 || y >= WORLD_SIZE) continue;
      currentLayer().elevationStrokes.push({
        kind: 'rect_fill',
        x: clampCoord(left + run.startX),
        y,
        x2: clampCoord(left + run.startX + run.length - 1),
        y2: y,
        size: 1,
        mode: 'set',
        value: run.value,
      });
    }
    for (const item of clipboard.cells) {
      const x = left + item.dx;
      const y = top + item.dy;
      if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) continue;
      const key = cellKey(x, y);
      rememberBefore(key);
      Object.assign(ensureCell(key), item.cell);
      cleanupCell(key);
    }
    updateStatus(`Stamped ${clipboard.width}×${clipboard.height} at ${cx},${cy}.`);
  }

  function placeMarker(x: number, y: number, type: EditorMarkerType): void {
    const label = MARKER_TYPES.find((item) => item.id === type)?.label ?? displayName(type);
    const count = data.markers.filter((item) => item.type === type && item.plane === plane).length + 1;
    data.markers.push({
      id: `marker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      name: markerName.trim() || `${label} ${count}`,
      x,
      y,
      plane,
      ...(markerNotes.trim() ? { notes: markerNotes.trim() } : {}),
    });
    refreshMarkerJump();
    renderPalette();
  }

  function deleteNearestMarker(x: number, y: number): void {
    let bestIndex = -1;
    let bestDistance = Infinity;
    data.markers.forEach((marker, index) => {
      if (marker.plane !== plane) return;
      const distance = Math.hypot(marker.x - x, marker.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0 && bestDistance <= Math.max(8, 14 / TILE_SIZES[zoomIndex])) {
      data.markers.splice(bestIndex, 1);
      refreshMarkerJump();
      renderPalette();
    }
  }

  function placeLinkEndpoint(x: number, y: number, kind: PlaneLinkKind): void {
    const endpoint: PlaneEndpoint = { plane, x, y };
    if (!pendingLinkStart) {
      pendingLinkStart = endpoint;
      updateStatus(`Link start set at ${planeName(plane)} ${x},${y}. Switch plane and click the destination.`);
      renderPalette();
      return;
    }
    if (pendingLinkStart.plane === endpoint.plane && pendingLinkStart.x === endpoint.x && pendingLinkStart.y === endpoint.y) {
      updateStatus('Destination must differ from the start.', true);
      return;
    }
    data.links.push({
      id: `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      ...(linkName.trim() ? { name: linkName.trim() } : {}),
      from: { ...pendingLinkStart },
      to: endpoint,
      bidirectional: true,
    });
    pendingLinkStart = null;
    renderPalette();
  }

  function deleteNearestLink(x: number, y: number): void {
    let bestIndex = -1;
    let bestDistance = Infinity;
    data.links.forEach((link, index) => {
      for (const endpoint of [link.from, link.to]) {
        if (endpoint.plane !== plane) continue;
        const distance = Math.hypot(endpoint.x - x, endpoint.y - y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
    });
    if (bestIndex >= 0 && bestDistance <= Math.max(8, 14 / TILE_SIZES[zoomIndex])) {
      data.links.splice(bestIndex, 1);
      renderPalette();
    }
  }

  function applyHistory(entry: HistoryEntry, after: boolean): void {
    const targetLayer = getPlaneData(data, entry.plane);
    const cells = after ? entry.afterCells : entry.beforeCells;
    for (const [key, cell] of cells) {
      if (cell) targetLayer.cells[key] = { ...cell };
      else delete targetLayer.cells[key];
    }
    targetLayer.terrainStrokes.splice(entry.beforeTerrainLength);
    if (after) targetLayer.terrainStrokes.push(...entry.addedTerrain.map((item) => ({ ...item })));
    targetLayer.elevationStrokes.splice(entry.beforeElevationLength);
    if (after) targetLayer.elevationStrokes.push(...entry.addedElevation.map((item) => ({ ...item })));
    data.markers = cloneMarkers(after ? entry.afterMarkers : entry.beforeMarkers);
    data.links = cloneLinks(after ? entry.afterLinks : entry.beforeLinks);
    refreshMarkerJump();
    renderPalette();
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
    saveTimer = setTimeout(persistNow, 350);
  }

  function persistNow(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    try {
      saveEditorWorld(data);
      updateStatus('Saved locally.');
    } catch {
      updateStatus('Local storage is full; export JSON now.', true);
    }
  }

  function exportJson(): void {
    persistNow();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'twinlands-world.json';
    anchor.click();
    URL.revokeObjectURL(url);
    updateStatus(`Exported v5 world with ${data.markers.length} markers and ${data.links.length} plane links.`);
  }

  async function importJson(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as EditorWorldData;
      if (parsed.version !== 5 || !parsed.cells || !parsed.planes || !parsed.markers || !parsed.links) throw new Error('Not v5');
      replaceEditorWorld(parsed);
      data = loadEditorWorld(WORLD_SIZE);
      plane = 0;
      planeSelect.value = '0';
      selectedArea = null;
      clipboard = null;
      pendingLinkStart = null;
      undoStack.length = 0;
      redoStack.length = 0;
      refreshMarkerJump();
      renderPalette();
      navigator?.markEditsDirty();
      draw();
      updateStatus('Imported v5 authored world.');
    } catch {
      updateStatus('Import expects a current v5 twinlands-world.json. Older browser data migrates automatically on normal load.', true);
    } finally {
      importInput.value = '';
    }
  }

  function draw(): void {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const tilePx = TILE_SIZES[zoomIndex];
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    // Once zoomed out far enough, use the map-style renderer instead of
    // drawing thousands of individual tile/object sprites every mouse sample.
    if (tilePx < DETAILED_RENDER_MIN_TILE_PX) drawMacro(width, height, tilePx);
    else drawDetailed(width, height, tilePx);
    drawMarkersAndLinks(width, height, tilePx);
    drawPreview(width, height, tilePx);
    updateStatus();
    navigator?.redraw();
  }

  function drawMacro(width: number, height: number, tilePx: number): void {
    ctx.fillStyle = TILE_MAP_COLORS[baseTileForPlane(plane)];
    ctx.fillRect(0, 0, width, height);
    if (plane !== 0 && surfaceGhost) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      drawLayerShapes(getPlaneData(data, 0), width, height, tilePx, 0);
      ctx.restore();
    }
    drawLayerShapes(currentLayer(), width, height, tilePx, plane);
    if (elevationOverlay) {
      for (const stroke of currentLayer().elevationStrokes) drawElevationShape(stroke, width, height, tilePx);
    }
  }

  function drawLayerShapes(layer: ReturnType<typeof getPlaneData>, width: number, height: number, tilePx: number, targetPlane: WorldPlane): void {
    for (const stroke of layer.terrainStrokes) drawTerrainShape(stroke, width, height, tilePx, targetPlane);
    for (const [key, cell] of Object.entries(layer.cells)) {
      if (!cell.tile) continue;
      const [x, y] = parseKey(key);
      const p = worldToScreen(x, y, width, height, tilePx);
      if (p.x < -2 || p.y < -2 || p.x > width + 2 || p.y > height + 2) continue;
      ctx.fillStyle = TILE_MAP_COLORS[cell.tile];
      ctx.fillRect(p.x, p.y, Math.max(1, tilePx), Math.max(1, tilePx));
    }
  }

  function drawTerrainShape(stroke: TerrainStroke, width: number, height: number, tilePx: number, targetPlane: WorldPlane): void {
    const color = stroke.tile ? TILE_MAP_COLORS[stroke.tile] : TILE_MAP_COLORS[baseTileForPlane(targetPlane)];
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    drawGenericShape(stroke, width, height, tilePx, false);
  }

  function drawElevationShape(stroke: ElevationStroke, width: number, height: number, tilePx: number): void {
    const displayValue = stroke.mode === 'set' ? clampElevation(stroke.value) : (stroke.value > 0 ? 3 : -1);
    ctx.fillStyle = ELEVATION_COLORS[displayValue] ?? 'rgba(255,255,255,.2)';
    ctx.strokeStyle = ctx.fillStyle;
    drawGenericShape(stroke, width, height, tilePx, stroke.kind === 'rect_outline');
  }

  function drawGenericShape(
    stroke: { kind: TerrainStrokeKind; x: number; y: number; x2?: number; y2?: number; size: number },
    width: number,
    height: number,
    tilePx: number,
    forceOutline: boolean,
  ): void {
    if (stroke.kind === 'line') {
      const a = worldToScreen(stroke.x, stroke.y, width, height, tilePx);
      const b = worldToScreen(stroke.x2 ?? stroke.x, stroke.y2 ?? stroke.y, width, height, tilePx);
      ctx.lineWidth = Math.max(1, stroke.size * tilePx);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      return;
    }
    if (stroke.kind === 'rect_fill' || stroke.kind === 'rect_outline') {
      const box = normalizeBox({ x: stroke.x, y: stroke.y }, { x: stroke.x2 ?? stroke.x, y: stroke.y2 ?? stroke.y });
      const a = worldToScreen(box.left, box.top, width, height, tilePx);
      const rectWidth = Math.max(1, (box.right - box.left + 1) * tilePx);
      const rectHeight = Math.max(1, (box.bottom - box.top + 1) * tilePx);
      if (stroke.kind === 'rect_fill' && !forceOutline) {
        ctx.fillRect(a.x, a.y, rectWidth, rectHeight);
      } else {
        ctx.lineWidth = Math.max(1, stroke.size * tilePx);
        ctx.strokeRect(a.x, a.y, rectWidth, rectHeight);
      }
      return;
    }
    const half = Math.floor(stroke.size / 2);
    const a = worldToScreen(stroke.x - half, stroke.y - half, width, height, tilePx);
    ctx.fillRect(a.x, a.y, Math.max(1, stroke.size * tilePx), Math.max(1, stroke.size * tilePx));
  }

  function drawDetailed(width: number, height: number, tilePx: number): void {
    const cols = Math.ceil(width / tilePx) + 2;
    const rows = Math.ceil(height / tilePx) + 2;
    const startX = Math.floor(centerX - cols / 2);
    const startY = Math.floor(centerY - rows / 2);
    const originX = width / 2 - (centerX - startX) * tilePx;
    const originY = height / 2 - (centerY - startY) * tilePx;

    for (let row = 0; row < rows; row++) {
      const y = startY + row;
      if (y < 0 || y >= WORLD_SIZE) continue;
      for (let col = 0; col < cols; col++) {
        const x = startX + col;
        if (x < 0 || x >= WORLD_SIZE) continue;
        const tile = effectiveTile(x, y);
        const sx = originX + col * tilePx;
        const sy = originY + row * tilePx;
        const img = imageFor(`/sprites/tiles/${tile}.png`, draw);
        if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, sx, sy, tilePx, tilePx);
        else {
          ctx.fillStyle = TILE_MAP_COLORS[tile];
          ctx.fillRect(sx, sy, tilePx, tilePx);
        }

        const elevation = effectiveElevation(x, y);
        if (elevationOverlay && elevation !== 0) {
          ctx.fillStyle = ELEVATION_COLORS[elevation];
          ctx.fillRect(sx, sy, tilePx, tilePx);
          if (tilePx >= 16) {
            const label = `${elevation > 0 ? '+' : ''}${elevation}`;
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.strokeText(label, sx + tilePx / 2, sy + tilePx / 2 + 3);
            ctx.fillText(label, sx + tilePx / 2, sy + tilePx / 2 + 3);
          }
        }

        if (Math.abs(effectiveElevation(x + 1, y) - elevation) >= 2) {
          ctx.strokeStyle = 'rgba(20,15,10,.85)';
          ctx.lineWidth = Math.max(2, tilePx * 0.12);
          ctx.beginPath();
          ctx.moveTo(sx + tilePx, sy);
          ctx.lineTo(sx + tilePx, sy + tilePx);
          ctx.stroke();
        }
        if (Math.abs(effectiveElevation(x, y + 1) - elevation) >= 2) {
          ctx.strokeStyle = 'rgba(20,15,10,.85)';
          ctx.lineWidth = Math.max(2, tilePx * 0.12);
          ctx.beginPath();
          ctx.moveTo(sx, sy + tilePx);
          ctx.lineTo(sx + tilePx, sy + tilePx);
          ctx.stroke();
        }
      }
    }
    if (tilePx >= 8) drawObjects(startX, startY, cols, rows, originX, originY, tilePx);
  }

  function drawObjects(startX: number, startY: number, cols: number, rows: number, originX: number, originY: number, tilePx: number): void {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col;
        const y = startY + row;
        const cell = currentLayer().cells[cellKey(x, y)] as TransformableEditorCell | undefined;
        if (!cell) continue;
        const sx = originX + col * tilePx;
        const sy = originY + row * tilePx;
        if (cell.structure) drawStructureSprite(cell.structure, sx, sy, tilePx, cell.structureTransform);
        else if (cell.resource) drawSprite(`/sprites/resources/${cell.resource}.png`, sx, sy, tilePx, cell.resource.startsWith('rock_') ? '#222' : '#356c36');
        else if (cell.spawner) drawSprite(`/sprites/monsters/${cell.spawner}.png`, sx, sy, tilePx, '#aa3030');
      }
    }

    // Authored roofs belong to the same authoritative camera/render pass as the
    // terrain and structures. They can be hidden while furnishing interiors.
    if (window.localStorage.getItem('massrpg.editor.roofsVisible') === 'false') return;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col;
        const y = startY + row;
        const cell = currentLayer().cells[cellKey(x, y)] as TransformableEditorCell | undefined;
        if (!cell?.roof) continue;
        const sx = originX + col * tilePx;
        const sy = originY + row * tilePx;
        drawSprite(`/sprites/roof/${cell.roof.id}.png`, sx, sy, tilePx, '#8d6b46', cell.roof.transform);
      }
    }
  }

  function drawStructureSprite(
    type: StructureType,
    sx: number,
    sy: number,
    tilePx: number,
    transform?: ObjectTransform,
  ): void {
    const junction = getStructureJunction(type);
    const baseType = getStructureVisualBase(type);
    const img = imageFor(`/sprites/structures/${baseType}.png`, draw);
    if (img.complete && img.naturalWidth > 0) {
      const h = Math.max(tilePx, tilePx * img.naturalHeight / img.naturalWidth);
      const localX = transform ? -tilePx / 2 : sx;
      const localY = transform ? -h / 2 : sy + tilePx - h;
      if (transform) {
        ctx.save();
        ctx.translate(sx + tilePx / 2, sy + tilePx - h / 2);
        ctx.rotate(transform.rotation * Math.PI / 180);
        ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
      }
      if (junction) drawStructureJunction(ctx, img, localX, localY, tilePx, h, junction.shape, junction.base === 'fence');
      else ctx.drawImage(img, localX, localY, tilePx, h);
      if (transform) ctx.restore();
      return;
    }
    ctx.fillStyle = '#d8c9a1';
    ctx.beginPath();
    ctx.arc(sx + tilePx / 2, sy + tilePx / 2, Math.max(2, tilePx * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSprite(
    path: string,
    sx: number,
    sy: number,
    tilePx: number,
    fallback: string,
    transform?: ObjectTransform,
  ): void {
    const img = imageFor(path, draw);
    if (img.complete && img.naturalWidth > 0) {
      const h = Math.max(tilePx, tilePx * img.naturalHeight / img.naturalWidth);
      if (transform) {
        ctx.save();
        ctx.translate(sx + tilePx / 2, sy + tilePx - h / 2);
        ctx.rotate(transform.rotation * Math.PI / 180);
        ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
        ctx.drawImage(img, -tilePx / 2, -h / 2, tilePx, h);
        ctx.restore();
      } else {
        ctx.drawImage(img, sx, sy + tilePx - h, tilePx, h);
      }
    } else {
      ctx.fillStyle = fallback;
      ctx.beginPath();
      ctx.arc(sx + tilePx / 2, sy + tilePx / 2, Math.max(2, tilePx * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function worldToScreen(x: number, y: number, width: number, height: number, tilePx: number): WorldPoint {
    return { x: width / 2 + (x - centerX) * tilePx, y: height / 2 + (y - centerY) * tilePx };
  }

  function drawMarkersAndLinks(width: number, height: number, tilePx: number): void {
    for (const marker of data.markers) {
      if (marker.plane !== plane) continue;
      const p = worldToScreen(marker.x, marker.y, width, height, tilePx);
      if (p.x < -30 || p.y < -30 || p.x > width + 30 || p.y > height + 30) continue;
      ctx.fillStyle = marker.type === 'mining_area' ? '#ff8a32'
        : marker.type === 'castle' ? '#c391ff'
        : marker.type === 'city' ? '#ff7777'
        : marker.type === 'village' ? '#8ee28e'
        : marker.type === 'town' ? '#f1d56b'
        : '#f4f4f4';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
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

    for (const link of data.links) {
      for (const endpoint of [link.from, link.to]) {
        if (endpoint.plane !== plane) continue;
        const p = worldToScreen(endpoint.x, endpoint.y, width, height, tilePx);
        ctx.fillStyle = '#61e6ff';
        ctx.strokeStyle = '#07171b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 7);
        ctx.lineTo(p.x + 6, p.y + 5);
        ctx.lineTo(p.x - 6, p.y + 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (tilePx >= 4 && link.name) {
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeText(link.name, p.x, p.y - 10);
          ctx.fillText(link.name, p.x, p.y - 10);
        }
      }
    }
  }

  function drawPreview(width: number, height: number, tilePx: number): void {
    if (selectedArea) drawBox(selectedArea, width, height, tilePx, 'rgba(80,190,255,.10)', 'rgba(105,205,255,.95)', 2);

    if (isPainting && dragStart && dragCurrent) {
      if (toolMode === 'line') {
        const a = worldToScreen(dragStart.x, dragStart.y, width, height, tilePx);
        const b = worldToScreen(dragCurrent.x, dragCurrent.y, width, height, tilePx);
        ctx.strokeStyle = 'rgba(92,255,114,.95)';
        ctx.lineWidth = Math.max(3, brushSize * tilePx);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        return;
      }
      const box = normalizeBox(dragStart, dragCurrent);
      const fill = toolMode === 'select' ? 'rgba(80,190,255,.12)' : 'rgba(72,255,103,.15)';
      const stroke = toolMode === 'select' ? 'rgba(105,205,255,.95)' : 'rgba(92,255,114,.95)';
      drawBox(box, width, height, tilePx, fill, stroke, toolMode === 'rect_outline' ? Math.max(2, brushSize * tilePx) : 2);
      return;
    }

    if (toolMode === 'stamp' && clipboard) {
      const halfW = Math.floor(clipboard.width / 2);
      const halfH = Math.floor(clipboard.height / 2);
      drawBox({
        left: hoverX - halfW,
        top: hoverY - halfH,
        right: hoverX - halfW + clipboard.width - 1,
        bottom: hoverY - halfH + clipboard.height - 1,
      }, width, height, tilePx, 'rgba(72,255,103,.15)', 'rgba(92,255,114,.95)', 2);
      return;
    }

    if (toolMode !== 'brush') return;
    const size = effectiveBrushSize();
    const half = Math.floor(size / 2);
    const p = worldToScreen(hoverX - half, hoverY - half, width, height, tilePx);
    const rawSize = Math.max(tilePx, size * tilePx);
    const visualSize = Math.max(3, rawSize);
    ctx.fillStyle = 'rgba(72,255,103,.18)';
    ctx.strokeStyle = 'rgba(92,255,114,.95)';
    ctx.lineWidth = 2;
    ctx.fillRect(p.x, p.y, visualSize, visualSize);
    ctx.strokeRect(p.x, p.y, visualSize, visualSize);
  }

  function drawBox(box: SelectionBox, width: number, height: number, tilePx: number, fill: string, stroke: string, lineWidth: number): void {
    const p = worldToScreen(box.left, box.top, width, height, tilePx);
    const w = Math.max(3, (box.right - box.left + 1) * tilePx);
    const h = Math.max(3, (box.bottom - box.top + 1) * tilePx);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.fillRect(p.x, p.y, w, h);
    ctx.strokeRect(p.x, p.y, w, h);
  }

  function updateStatus(message?: string, warning = false): void {
    const elevation = effectiveElevation(hoverX, hoverY);
    const selected = 'id' in selection
      ? `${selection.kind}: ${displayName(selection.id)}`
      : 'value' in selection
        ? `${selection.kind} ${selection.value}`
        : selection.kind;
    statusLeft.textContent = message ?? `${planeName(plane)} · Cursor ${hoverX},${hoverY} · elevation ${elevation > 0 ? '+' : ''}${elevation} · ${toolMode} · ${selected}`;
    statusLeft.className = warning ? 'warn' : '';
    const layer = currentLayer();
    statusRight.textContent = `${Object.keys(layer.cells).length.toLocaleString()} cells · ${layer.terrainStrokes.length} terrain · ${layer.elevationStrokes.length} elevation · ${data.markers.length} markers · ${data.links.length} links`;
  }

  function parseKey(key: string): [number, number] {
    const comma = key.indexOf(',');
    return [Number(key.slice(0, comma)), Number(key.slice(comma + 1))];
  }

  draw();
}
