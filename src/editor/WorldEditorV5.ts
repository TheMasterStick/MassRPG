import './editor.css';
import { MONSTERS } from '../data/monsters';
import { TILE_MAP_COLORS } from '../ui/mapColors';
import { WORLD_SIZE } from '../world/AeldorData';
import {
  baseTileForPlane, cellKey, clampElevation, clearEditorWorld, getPlaneData,
  loadEditorWorld, replaceEditorWorld, saveEditorWorld, shapeContains,
  type EditorCell, type EditorMarker, type EditorMarkerType, type EditorPlaneLink,
  type EditorWorldData, type ElevationStroke, type PlaneEndpoint, type PlaneLinkKind,
  type TerrainStroke, type TerrainStrokeKind,
} from '../world/EditorWorld';
import type { ResourceType, StructureType, TileType, WorldPlane } from '../world/types';
import { createEditorNavigatorV5, type EditorNavigatorHandle } from './EditorNavigatorV5';

const SURFACE_TILES: TileType[] = [
  'deep_water', 'water', 'beach', 'grass', 'plains', 'forest', 'taiga', 'mountain',
  'snow', 'desert', 'swamp', 'path', 'rubble', 'floor_wood', 'floor_brick', 'floor_cobble',
];
const UNDERGROUND_TILES: TileType[] = [
  'void', 'cave_wall', 'cave_floor', 'water', 'deep_water', 'rubble', 'path',
  'floor_wood', 'floor_brick', 'floor_cobble', 'mountain',
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
  'fishing_shrimp', 'fishing_lobster', 'fishing_swordfish', 'farm_patch', 'herb_patch', 'flax_plant',
];
const MARKER_TYPES: { id: EditorMarkerType; label: string }[] = [
  { id: 'settlement', label: 'Settlement' }, { id: 'village', label: 'Village' },
  { id: 'town', label: 'Town' }, { id: 'city', label: 'City' },
  { id: 'castle', label: 'Castle' }, { id: 'mining_area', label: 'Mining Area' },
];
const LINK_TYPES: { id: PlaneLinkKind; label: string }[] = [
  { id: 'cave_entrance', label: 'Cave Entrance' }, { id: 'stairs', label: 'Stairs' }, { id: 'ladder', label: 'Ladder' },
];
const TILE_SIZES = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 4, 8, 12, 16, 24, 32, 48];
const BRUSH_SIZES = [1, 3, 5, 9, 17, 33, 65, 129, 257, 513, 1025, 2049, 4097, 8193, 16385, 32769, 65535];
const MACRO_BRUSH_THRESHOLD = 33;
const MAX_DETAILED_SHAPE_CELLS = 50000;
const MAX_COPY_SIDE = 256;
const TREE_RESOURCES = new Set<ResourceType>(['tree_normal','tree_oak','tree_willow','tree_maple','tree_yew','tree_magic']);
const PLANES: WorldPlane[] = [0, -1, -2];

const ELEVATION_COLORS: Record<number, string> = {
  [-2]: 'rgba(32,72,145,.42)', [-1]: 'rgba(65,120,160,.32)', 0: 'rgba(0,0,0,0)',
  1: 'rgba(105,165,92,.22)', 2: 'rgba(173,157,91,.28)', 3: 'rgba(181,116,75,.33)',
  4: 'rgba(187,75,60,.38)', 5: 'rgba(235,230,218,.46)',
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
  width: number; height: number;
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
function displayName(id: string): string { return id.replace(/^rock_/,'').replace(/^tree_/,'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()); }
function imageFor(path: string, onReady: () => void): HTMLImageElement {
  let img=imageCache.get(path); if (img) return img; img=new Image(); imageCache.set(path,img); img.onload=onReady; img.onerror=onReady; img.src=path; return img;
}
function cloneCell(cell: EditorCell | undefined): EditorCell | undefined { return cell ? { ...cell } : undefined; }
function cloneMarkers(items: readonly EditorMarker[]): EditorMarker[] { return items.map(v=>({...v})); }
function cloneLinks(items: readonly EditorPlaneLink[]): EditorPlaneLink[] { return items.map(v=>({...v,from:{...v.from},to:{...v.to}})); }
function normalizeBox(a: WorldPoint,b: WorldPoint): SelectionBox { return {left:Math.min(a.x,b.x),top:Math.min(a.y,b.y),right:Math.max(a.x,b.x),bottom:Math.max(a.y,b.y)}; }
function isFormTarget(t: EventTarget|null): boolean { return t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement; }
function planeName(p: WorldPlane): string { return p===0 ? 'Surface' : `Underground ${p}`; }

export function launchWorldEditor(root: HTMLElement): void {
  document.body.classList.add('editor-mode'); root.innerHTML='';
  let data=loadEditorWorld(WORLD_SIZE);
  let plane: WorldPlane=0;
  let category: PaletteCategory='terrain';
  let selection: Selection={kind:'tile',id:'grass'};
  let toolMode: ToolMode='brush';
  let treeMode: TreeMode='single'; let treeDensity=.04;
  let markerName=''; let markerNotes=''; let linkName='';
  let pendingLinkStart: PlaneEndpoint|null=null;
  let elevationOverlay=true; let surfaceGhost=true;
  let centerX=Math.floor(WORLD_SIZE/2), centerY=Math.floor(WORLD_SIZE/2), zoomIndex=13, brushSize=1;
  let isPainting=false,isPanning=false,panStartX=0,panStartY=0,panCenterX=0,panCenterY=0;
  let lastPaintPoint:WorldPoint|null=null,dragStart:WorldPoint|null=null,dragCurrent:WorldPoint|null=null,selectedArea:SelectionBox|null=null,clipboard:EditorClipboard|null=null;
  let hoverX=centerX,hoverY=centerY,saveTimer:ReturnType<typeof setTimeout>|null=null;
  let strokeBefore=new Map<string,EditorCell|undefined>(), beforeTerrainLength=0,beforeElevationLength=0;
  let beforeMarkers=cloneMarkers(data.markers),beforeLinks=cloneLinks(data.links);
  const undoStack:HistoryEntry[]=[],redoStack:HistoryEntry[]=[];
  let navigator:EditorNavigatorHandle|null=null;

  const editor=document.createElement('div'); editor.className='world-editor';
  const toolbar=document.createElement('div'); toolbar.className='editor-toolbar';
  const main=document.createElement('div'); main.className='editor-main';
  const palette=document.createElement('aside'); palette.className='editor-palette';
  const canvasWrap=document.createElement('div'); canvasWrap.className='editor-canvas-wrap';
  const canvas=document.createElement('canvas'); canvas.className='editor-canvas';
  const context=canvas.getContext('2d'); if(!context) throw new Error('World editor requires Canvas 2D.'); const ctx:CanvasRenderingContext2D=context;
  const help=document.createElement('div'); help.className='editor-overlay-help'; help.textContent='Surface elevation -2…+5 · cliffs are 2+ levels · underground planes -1/-2 · line/rectangle/select/stamp tools · M world map.';
  const status=document.createElement('div'); status.className='editor-status'; const statusLeft=document.createElement('span'),statusRight=document.createElement('span'); status.append(statusLeft,statusRight);
  canvasWrap.append(canvas,help); editor.append(toolbar,main,status); root.append(editor);

  const button=(text:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);return b;};
  const addOption=(s:HTMLSelectElement,v:string,l:string)=>{const o=document.createElement('option');o.value=v;o.textContent=l;s.append(o);};
  const numberInput=(v:number)=>{const i=document.createElement('input');i.type='number';i.min='0';i.max=String(WORLD_SIZE-1);i.value=String(v);return i;};
  const clampCoord=(v:number)=>Math.max(0,Math.min(WORLD_SIZE-1,Math.round(Number.isFinite(v)?v:0)));
  const layer=()=>getPlaneData(data,plane);

  const backBtn=button('← Game',()=>{persistNow();window.location.href=window.location.pathname;});
  const saveBtn=button('Save',persistNow),exportBtn=button('Export JSON',exportJson);
  const importInput=document.createElement('input'); importInput.type='file'; importInput.accept='.json,application/json'; importInput.style.display='none'; importInput.addEventListener('change',()=>void importJson(importInput.files?.[0]));
  const importBtn=button('Import JSON',()=>importInput.click());
  const clearBtn=button('Clear all',()=>{if(!confirm('Clear all planes, elevation, markers and links?'))return;data=clearEditorWorld(WORLD_SIZE);undoStack.length=0;redoStack.length=0;selectedArea=null;clipboard=null;pendingLinkStart=null;refreshMarkerJump();navigator?.markEditsDirty();renderPalette();draw();});
  const mapBtn=button('World Map (M)',()=>navigator?.toggleLarge());

  const planeSelect=document.createElement('select'); PLANES.forEach(p=>addOption(planeSelect,String(p),planeName(p))); planeSelect.value='0';
  planeSelect.addEventListener('change',()=>{plane=Number(planeSelect.value) as WorldPlane;selectedArea=null;dragStart=null;dragCurrent=null;refreshMarkerJump();renderPalette();navigator?.markEditsDirty();draw();});
  const toolSelect=document.createElement('select');
  [['brush','Tool: Brush'],['line','Tool: Line'],['rect_fill','Tool: Filled rectangle'],['rect_outline','Tool: Rectangle outline'],['select','Tool: Select area'],['stamp','Tool: Paste stamp']].forEach(([v,l])=>addOption(toolSelect,v,l));
  toolSelect.addEventListener('change',()=>{toolMode=toolSelect.value as ToolMode;draw();});
  const brushSelect=document.createElement('select'); BRUSH_SIZES.forEach(n=>addOption(brushSelect,String(n),`${n.toLocaleString()}×${n.toLocaleString()} brush`)); brushSelect.value='1'; brushSelect.addEventListener('change',()=>{brushSize=Number(brushSelect.value);draw();});
  const zoomSelect=document.createElement('select'); TILE_SIZES.forEach((n,i)=>addOption(zoomSelect,String(i),`${n}px / tile`)); zoomSelect.value=String(zoomIndex); zoomSelect.addEventListener('change',()=>{zoomIndex=Number(zoomSelect.value);draw();});
  const overlayToggle=document.createElement('input'); overlayToggle.type='checkbox'; overlayToggle.checked=elevationOverlay; overlayToggle.addEventListener('change',()=>{elevationOverlay=overlayToggle.checked;draw();});
  const overlayLabel=document.createElement('label'); overlayLabel.className='editor-check-label'; overlayLabel.append(overlayToggle,document.createTextNode(' Elevation overlay'));
  const ghostToggle=document.createElement('input'); ghostToggle.type='checkbox'; ghostToggle.checked=surfaceGhost; ghostToggle.addEventListener('change',()=>{surfaceGhost=ghostToggle.checked;draw();});
  const ghostLabel=document.createElement('label'); ghostLabel.className='editor-check-label'; ghostLabel.append(ghostToggle,document.createTextNode(' Surface ghost'));
  const xInput=numberInput(centerX),yInput=numberInput(centerY),goBtn=button('Go',()=>jumpCamera(Number(xInput.value),Number(yInput.value)));
  const markerJump=document.createElement('select'); markerJump.addEventListener('change',()=>{const m=data.markers.find(v=>v.id===markerJump.value);markerJump.value='';if(m){if(m.plane!==plane){plane=m.plane;planeSelect.value=String(plane);}jumpCamera(m.x,m.y);renderPalette();navigator?.markEditsDirty();}});
  const copyBtn=button('Copy selection',copySelection),stampBtn=button('Paste/Stamp',()=>{if(!clipboard){updateStatus('Copy a selection first.',true);return;}toolMode='stamp';toolSelect.value='stamp';draw();}),fillBtn=button('Fill selection',fillSelectedArea),clearSelectionBtn=button('Clear selection',()=>{selectedArea=null;draw();});
  const treeModeSelect=document.createElement('select');addOption(treeModeSelect,'single','Trees: single');addOption(treeModeSelect,'scatter','Trees: scatter');treeModeSelect.addEventListener('change',()=>{treeMode=treeModeSelect.value as TreeMode;});
  const treeDensitySelect=document.createElement('select');[['0.015','Grove: sparse'],['0.04','Grove: normal'],['0.08','Grove: dense']].forEach(([v,l])=>addOption(treeDensitySelect,v,l));treeDensitySelect.value='.04';treeDensitySelect.addEventListener('change',()=>treeDensity=Number(treeDensitySelect.value));
  const title=document.createElement('span');title.className='editor-title';title.textContent='Twin Lands World Editor';
  toolbar.append(title,backBtn,saveBtn,exportBtn,importBtn,clearBtn,mapBtn,planeSelect,markerJump,toolSelect,brushSelect,zoomSelect,copyBtn,stampBtn,fillBtn,clearSelectionBtn,overlayLabel,ghostLabel,document.createTextNode('X'),xInput,document.createTextNode('Y'),yInput,goBtn,treeModeSelect,treeDensitySelect,importInput);

  navigator=createEditorNavigatorV5({getData:()=>data,getPlane:()=>plane,getViewport:()=>{const r=canvas.getBoundingClientRect(),px=TILE_SIZES[zoomIndex];return{centerX,centerY,visibleWidth:r.width/px,visibleHeight:r.height/px};},onJump:jumpCamera});
  main.append(palette,canvasWrap,navigator.element); refreshMarkerJump(); renderPalette(); resizeCanvas(); window.addEventListener('resize',resizeCanvas);

  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('mousedown',e=>{
    if(e.button===2||e.button===1){isPanning=true;panStartX=e.clientX;panStartY=e.clientY;panCenterX=centerX;panCenterY=centerY;return;}
    if(e.button!==0)return;const p=mouseWorld(e);
    if(toolMode==='stamp'){beginHistory();pasteClipboardAt(p.x,p.y);finishHistory();scheduleSave();navigator?.markEditsDirty();draw();return;}
    isPainting=true;
    if(toolMode==='select'){dragStart=p;dragCurrent=p;draw();return;}
    beginHistory();
    if(toolMode==='brush'){lastPaintPoint=null;paintAtMouse(e,true);}else{dragStart=p;dragCurrent=p;draw();}
  });
  window.addEventListener('mouseup',e=>{
    if(e.button===2||e.button===1)isPanning=false;if(e.button!==0||!isPainting)return;
    if(toolMode==='brush')finishHistory();
    else if(toolMode==='select'){if(dragStart&&dragCurrent)selectedArea=normalizeBox(dragStart,dragCurrent);}
    else if(dragStart&&dragCurrent){commitDragShape(toolMode,dragStart,dragCurrent);finishHistory();scheduleSave();navigator?.markEditsDirty();}
    isPainting=false;lastPaintPoint=null;dragStart=null;dragCurrent=null;draw();
  });
  canvas.addEventListener('mousemove',e=>{const p=mouseWorld(e);hoverX=p.x;hoverY=p.y;if(isPanning){const px=TILE_SIZES[zoomIndex];centerX=clampCoord(panCenterX-(e.clientX-panStartX)/px);centerY=clampCoord(panCenterY-(e.clientY-panStartY)/px);syncCoords();draw();}else if(isPainting&&toolMode==='brush')paintAtMouse(e,false);else if(isPainting&&dragStart){dragCurrent=p;draw();}else draw();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();const before=mouseWorld(e);zoomIndex=Math.max(0,Math.min(TILE_SIZES.length-1,zoomIndex+(e.deltaY<0?1:-1)));zoomSelect.value=String(zoomIndex);const after=mouseWorld(e);centerX=clampCoord(centerX+before.x-after.x);centerY=clampCoord(centerY+before.y-after.y);syncCoords();draw();},{passive:false});
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&k==='s'){e.preventDefault();persistNow();}else if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();undo();}else if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();redo();}else if((e.ctrlKey||e.metaKey)&&k==='c'&&!isFormTarget(e.target)){e.preventDefault();copySelection();}else if((e.ctrlKey||e.metaKey)&&k==='v'&&!isFormTarget(e.target)){e.preventDefault();if(clipboard){toolMode='stamp';toolSelect.value='stamp';draw();}}else if(!e.ctrlKey&&!e.metaKey&&k==='m'&&!isFormTarget(e.target)){e.preventDefault();navigator?.toggleLarge();}});

  function jumpCamera(x:number,y:number){centerX=clampCoord(x);centerY=clampCoord(y);hoverX=centerX;hoverY=centerY;syncCoords();draw();}
  function syncCoords(){xInput.value=String(centerX);yInput.value=String(centerY);}
  function mouseWorld(e:MouseEvent|WheelEvent):WorldPoint{const r=canvas.getBoundingClientRect(),px=TILE_SIZES[zoomIndex];return{x:clampCoord(centerX+(e.clientX-r.left-r.width/2)/px),y:clampCoord(centerY+(e.clientY-r.top-r.height/2)/px)};}
  function resizeCanvas(){const r=canvasWrap.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.floor(r.width*dpr));canvas.height=Math.max(1,Math.floor(r.height*dpr));canvas.style.width=`${r.width}px`;canvas.style.height=`${r.height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  function refreshMarkerJump(){markerJump.innerHTML='';addOption(markerJump,'',data.markers.length?'Jump to marker…':'No markers yet');for(const m of [...data.markers].sort((a,b)=>a.name.localeCompare(b.name)))addOption(markerJump,m.id,`${planeName(m.plane)} · ${displayName(m.type)} · ${m.name}`);}

  function renderPalette(){
    palette.innerHTML='';const tabs=document.createElement('div');tabs.className='editor-category-tabs';
    const cats:PaletteCategory[]=['terrain','elevation','structures','resources','spawners','markers','links','erase'];
    for(const c of cats){const b=button(displayName(c),()=>{category=c;renderPalette();});if(category===c)b.classList.add('active');tabs.append(b);}palette.append(tabs);
    const note=document.createElement('div');note.className='editor-palette-note';
    note.textContent=category==='elevation'?'Surface height is separate from underground planes. Normal steps can change height by 1; a 2+ level edge is an impassable cliff. Raise/Lower are cumulative and clamped to -2…+5.'
      :category==='links'?'Choose Cave Entrance, Stairs or Ladder. Click the first endpoint, switch plane if needed, then click the destination. Links are bidirectional.'
      :category==='terrain'?(plane===0?'Paint the surface over the blank ocean.':'Paint cave floor/walls over the blank underground void.')
      :category==='markers'?'Markers remember their plane, name, notes and coordinates for later world references.'
      :category==='resources'?'Trees can be single or randomized scatter; ores are exact authored nodes.'
      :category==='erase'?'Terrain revert returns to the current plane base. Set elevation 0 from the Elevation tab to flatten land.'
      :'All objects are authored on the currently selected plane.';palette.append(note);
    if(category==='markers'){const n=document.createElement('input');n.className='editor-marker-input';n.placeholder='Marker name';n.value=markerName;n.addEventListener('input',()=>markerName=n.value);const t=document.createElement('textarea');t.className='editor-marker-notes';t.placeholder='Optional notes';t.value=markerNotes;t.addEventListener('input',()=>markerNotes=t.value);palette.append(n,t);}
    if(category==='links'){const n=document.createElement('input');n.className='editor-marker-input';n.placeholder='Optional link name';n.value=linkName;n.addEventListener('input',()=>linkName=n.value);palette.append(n);if(pendingLinkStart){const p=document.createElement('div');p.className='editor-palette-note';p.textContent=`Start: ${planeName(pendingLinkStart.plane)} ${pendingLinkStart.x}, ${pendingLinkStart.y}. Switch plane and click destination.`;palette.append(p);palette.append(button('Cancel pending link',()=>{pendingLinkStart=null;renderPalette();draw();}));}}
    const grid=document.createElement('div');grid.className='editor-palette-grid';
    if(category==='terrain'){for(const id of (plane===0?SURFACE_TILES:UNDERGROUND_TILES))grid.append(paletteButton({kind:'tile',id},`/sprites/tiles/${id}.png`,displayName(id)));}
    else if(category==='elevation'){for(let v=-2;v<=5;v++)grid.append(paletteButton({kind:'elevation_set',value:v},'',`Set ${v>0?'+':''}${v}`));grid.append(paletteButton({kind:'elevation_delta',value:1},'','Raise +1'));grid.append(paletteButton({kind:'elevation_delta',value:-1},'','Lower -1'));}
    else if(category==='structures'){for(const id of STRUCTURE_IDS)grid.append(paletteButton({kind:'structure',id},`/sprites/structures/${id}.png`,displayName(id)));}
    else if(category==='resources'){for(const id of RESOURCE_IDS)grid.append(paletteButton({kind:'resource',id},`/sprites/resources/${id}.png`,displayName(id)));}
    else if(category==='spawners'){for(const m of MONSTERS)grid.append(paletteButton({kind:'spawner',id:m.id},`/sprites/monsters/${m.id}.png`,`${m.name} (${m.level})`));}
    else if(category==='markers'){for(const m of MARKER_TYPES)grid.append(paletteButton({kind:'marker',id:m.id},'',m.label));grid.append(paletteButton({kind:'eraseMarker'},'','Delete nearest marker'));}
    else if(category==='links'){for(const l of LINK_TYPES)grid.append(paletteButton({kind:'link',id:l.id},'',l.label));grid.append(paletteButton({kind:'eraseLink'},'','Delete nearest link'));}
    else{grid.append(paletteButton({kind:'eraseObjects'},'','Erase objects'));grid.append(paletteButton({kind:'revertTile'},'','Revert terrain'));grid.append(paletteButton({kind:'revertAll'},'','Clear detailed cell'));}
    palette.append(grid);
    if(category==='markers'){const mine=data.markers.filter(m=>m.plane===plane);if(mine.length){const h=document.createElement('h3');h.textContent=`Markers on ${planeName(plane)} (${mine.length})`;palette.append(h);for(const m of mine){const b=button(`${displayName(m.type)} · ${m.name} · ${m.x},${m.y}`,()=>jumpCamera(m.x,m.y));b.className='editor-marker-row';palette.append(b);}}}
    if(category==='links'){const here=data.links.filter(l=>l.from.plane===plane||l.to.plane===plane);if(here.length){const h=document.createElement('h3');h.textContent=`Links touching ${planeName(plane)} (${here.length})`;palette.append(h);for(const l of here){const ep=l.from.plane===plane?l.from:l.to;const dest=l.from.plane===plane?l.to:l.from;const b=button(`${displayName(l.kind)} · ${l.name||'unnamed'} → ${planeName(dest.plane)}`,()=>jumpCamera(ep.x,ep.y));b.className='editor-marker-row';palette.append(b);}}}
  }

  function paletteButton(next:Selection,src:string,label:string){const b=document.createElement('button');b.type='button';b.className='editor-palette-button';if(sameSelection(selection,next))b.classList.add('active');if(src){const img=document.createElement('img');img.src=src;img.alt='';img.onerror=()=>img.style.display='none';b.append(img);}const s=document.createElement('span');s.textContent=label;b.append(s);b.addEventListener('click',()=>{selection=next;renderPalette();draw();});return b;}
  function sameSelection(a:Selection,b:Selection){if(a.kind!==b.kind)return false;if('id'in a&&'id'in b)return a.id===b.id;if('value'in a&&'value'in b)return a.value===b.value;return true;}
  function effectiveBrushSize(){if(selection.kind==='tile'||selection.kind==='revertTile'||selection.kind==='elevation_set'||selection.kind==='elevation_delta')return brushSize;if(selection.kind==='eraseObjects'||selection.kind==='revertAll')return Math.min(brushSize,129);if(selection.kind==='resource'&&TREE_RESOURCES.has(selection.id)&&treeMode==='scatter')return brushSize;return 1;}

  function beginHistory(){const l=layer();strokeBefore=new Map();beforeTerrainLength=l.terrainStrokes.length;beforeElevationLength=l.elevationStrokes.length;beforeMarkers=cloneMarkers(data.markers);beforeLinks=cloneLinks(data.links);}
  function finishHistory(){const l=layer();const addedTerrain=l.terrainStrokes.slice(beforeTerrainLength).map(s=>({...s})),addedElevation=l.elevationStrokes.slice(beforeElevationLength).map(s=>({...s}));const markersChanged=JSON.stringify(beforeMarkers)!==JSON.stringify(data.markers),linksChanged=JSON.stringify(beforeLinks)!==JSON.stringify(data.links);if(!strokeBefore.size&&!addedTerrain.length&&!addedElevation.length&&!markersChanged&&!linksChanged)return;const afterCells=new Map<string,EditorCell|undefined>();for(const k of strokeBefore.keys())afterCells.set(k,cloneCell(l.cells[k]));undoStack.push({plane,beforeCells:strokeBefore,afterCells,beforeTerrainLength,addedTerrain,beforeElevationLength,addedElevation,beforeMarkers:cloneMarkers(beforeMarkers),afterMarkers:cloneMarkers(data.markers),beforeLinks:cloneLinks(beforeLinks),afterLinks:cloneLinks(data.links)});if(undoStack.length>80)undoStack.shift();redoStack.length=0;}
  function rememberBefore(k:string){if(!strokeBefore.has(k))strokeBefore.set(k,cloneCell(layer().cells[k]));}
  function ensureCell(k:string){return layer().cells[k]??=( {} );}
  function cleanupCell(k:string){const c=layer().cells[k];if(!c)return;for(const f of Object.keys(c) as (keyof EditorCell)[])if(c[f]===undefined)delete c[f];if(!Object.keys(c).length)delete layer().cells[k];}

  function paintAtMouse(e:MouseEvent,force:boolean){const p=mouseWorld(e);if((selection.kind==='marker'||selection.kind==='eraseMarker'||selection.kind==='link'||selection.kind==='eraseLink')&&!force)return;const spacing=Math.max(1,Math.floor(effectiveBrushSize()*(selection.kind==='resource'&&treeMode==='scatter'?.65:.32)));if(!lastPaintPoint||force){paintPoint(p.x,p.y);lastPaintPoint=p;}else{const dx=p.x-lastPaintPoint.x,dy=p.y-lastPaintPoint.y,d=Math.hypot(dx,dy);if(d<spacing)return;const steps=Math.min(1000,Math.max(1,Math.ceil(d/spacing)));for(let i=1;i<=steps;i++)paintPoint(clampCoord(lastPaintPoint.x+dx*i/steps),clampCoord(lastPaintPoint.y+dy*i/steps));lastPaintPoint=p;}scheduleSave();navigator?.markEditsDirty();draw();}
  function paintPoint(x:number,y:number){
    if(selection.kind==='marker'){placeMarker(x,y,selection.id);return;}if(selection.kind==='eraseMarker'){deleteNearestMarker(x,y);return;}if(selection.kind==='link'){placeLinkEndpoint(x,y,selection.id);return;}if(selection.kind==='eraseLink'){deleteNearestLink(x,y);return;}
    if(selection.kind==='resource'&&TREE_RESOURCES.has(selection.id)&&treeMode==='scatter'){scatterTrees(x,y,selection.id);return;}
    if(selection.kind==='elevation_set'||selection.kind==='elevation_delta'){layer().elevationStrokes.push({kind:'square',x,y,size:brushSize,mode:selection.kind==='elevation_set'?'set':'delta',value:selection.value});return;}
    if((selection.kind==='tile'||selection.kind==='revertTile')&&brushSize>=MACRO_BRUSH_THRESHOLD){layer().terrainStrokes.push({kind:'square',x,y,size:brushSize,tile:selection.kind==='tile'?selection.id:null});return;}
    const size=effectiveBrushSize(),half=Math.floor(size/2);for(let oy=-half;oy<=half;oy++)for(let ox=-half;ox<=half;ox++)applySelection(clampCoord(x+ox),clampCoord(y+oy));
  }

  function applySelection(x:number,y:number){const k=cellKey(x,y);rememberBefore(k);if(selection.kind==='revertAll'){delete layer().cells[k];return;}const c=ensureCell(k);if(selection.kind==='tile')c.tile=selection.id;else if(selection.kind==='structure'){c.structure=selection.id;c.resource=null;c.spawner=null;}else if(selection.kind==='resource'){c.resource=selection.id;c.structure=null;c.spawner=null;}else if(selection.kind==='spawner'){c.spawner=selection.id;c.structure=null;c.resource=null;}else if(selection.kind==='eraseObjects'){c.structure=null;c.resource=null;c.spawner=null;}else if(selection.kind==='revertTile')c.tile=baseTileForPlane(plane);cleanupCell(k);}
  function scatterTrees(cx:number,cy:number,res:ResourceType){const size=Math.max(1,brushSize),half=Math.floor(size/2),target=Math.max(1,Math.min(800,Math.round(size*size*treeDensity))),used=new Set<string>();let tries=0;while(used.size<target&&tries<target*10){tries++;const x=clampCoord(cx+Math.floor(Math.random()*size)-half),y=clampCoord(cy+Math.floor(Math.random()*size)-half),k=cellKey(x,y);if(used.has(k))continue;used.add(k);const old=selection;selection={kind:'resource',id:res};applySelection(x,y);selection=old;}}

  function commitDragShape(mode:ToolMode,start:WorldPoint,end:WorldPoint){if(mode!=='line'&&mode!=='rect_fill'&&mode!=='rect_outline')return;const kind=mode as TerrainStrokeKind;if(selection.kind==='tile'||selection.kind==='revertTile'){layer().terrainStrokes.push({kind,x:start.x,y:start.y,x2:end.x,y2:end.y,size:Math.max(1,brushSize),tile:selection.kind==='tile'?selection.id:null});return;}if(selection.kind==='elevation_set'||selection.kind==='elevation_delta'){layer().elevationStrokes.push({kind,x:start.x,y:start.y,x2:end.x,y2:end.y,size:Math.max(1,brushSize),mode:selection.kind==='elevation_set'?'set':'delta',value:selection.value});return;}if(selection.kind==='marker'||selection.kind==='eraseMarker'||selection.kind==='link'||selection.kind==='eraseLink'){updateStatus('Markers and plane links use the Brush tool.',true);return;}if(mode==='line')rasterLine(start,end);else rasterRect(start,end,mode==='rect_fill');}
  function rasterLine(a:WorldPoint,b:WorldPoint){const dx=b.x-a.x,dy=b.y-a.y,steps=Math.max(Math.abs(dx),Math.abs(dy));if(steps+1>MAX_DETAILED_SHAPE_CELLS){updateStatus('Detailed line too large; use terrain/elevation shapes for macro work.',true);return;}for(let i=0;i<=steps;i++){const t=steps?i/steps:0;applySelection(clampCoord(a.x+dx*t),clampCoord(a.y+dy*t));}}
  function rasterRect(a:WorldPoint,b:WorldPoint,fill:boolean){const q=normalizeBox(a,b),w=q.right-q.left+1,h=q.bottom-q.top+1,count=fill?w*h:Math.max(1,w*2+h*2-4);if(count>MAX_DETAILED_SHAPE_CELLS){updateStatus('Detailed rectangle too large.',true);return;}for(let y=q.top;y<=q.bottom;y++)for(let x=q.left;x<=q.right;x++)if(fill||x===q.left||x===q.right||y===q.top||y===q.bottom)applySelection(x,y);}
  function fillSelectedArea(){if(!selectedArea){updateStatus('Select an area first.',true);return;}beginHistory();if(selection.kind==='tile'||selection.kind==='revertTile')layer().terrainStrokes.push({kind:'rect_fill',x:selectedArea.left,y:selectedArea.top,x2:selectedArea.right,y2:selectedArea.bottom,size:1,tile:selection.kind==='tile'?selection.id:null});else if(selection.kind==='elevation_set'||selection.kind==='elevation_delta')layer().elevationStrokes.push({kind:'rect_fill',x:selectedArea.left,y:selectedArea.top,x2:selectedArea.right,y2:selectedArea.bottom,size:1,mode:selection.kind==='elevation_set'?'set':'delta',value:selection.value});else{updateStatus('Fill Selection works with terrain or elevation.',true);return;}finishHistory();scheduleSave();navigator?.markEditsDirty();draw();}

  function terrainStrokeAt(x:number,y:number){const a=layer().terrainStrokes;for(let i=a.length-1;i>=0;i--)if(shapeContains(a[i],x,y))return a[i];return undefined;}
  function effectiveTile(x:number,y:number):TileType{return layer().cells[cellKey(x,y)]?.tile??terrainStrokeAt(x,y)?.tile??baseTileForPlane(plane);}
  function effectiveElevation(x:number,y:number):number{let v=0;for(const s of layer().elevationStrokes)if(shapeContains(s,x,y))v=s.mode==='set'?clampElevation(s.value):clampElevation(v+s.value);return v;}

  function copySelection(){if(!selectedArea){updateStatus('Select an area first.',true);return;}const w=selectedArea.right-selectedArea.left+1,h=selectedArea.bottom-selectedArea.top+1;if(w>MAX_COPY_SIDE||h>MAX_COPY_SIDE){updateStatus(`Stamp copy is limited to ${MAX_COPY_SIDE}×${MAX_COPY_SIDE}.`,true);return;}const terrainRuns:ClipboardRun<TileType>[]=[],elevationRuns:ClipboardRun<number>[]=[],cells:ClipboardCell[]=[];for(let dy=0;dy<h;dy++){let rt=effectiveTile(selectedArea.left,selectedArea.top+dy),re=effectiveElevation(selectedArea.left,selectedArea.top+dy),ts=0,es=0;for(let dx=0;dx<=w;dx++){const x=selectedArea.left+dx,y=selectedArea.top+dy,nt=dx<w?effectiveTile(x,y):null,ne=dx<w?effectiveElevation(x,y):999;if(dx===w||nt!==rt){terrainRuns.push({dy,startX:ts,length:dx-ts,value:rt});if(dx<w&&nt){rt=nt;ts=dx;}}if(dx===w||ne!==re){elevationRuns.push({dy,startX:es,length:dx-es,value:re});if(dx<w){re=ne;es=dx;}}if(dx<w){const c=layer().cells[cellKey(x,y)];if(c?.structure||c?.resource||c?.spawner){const d:EditorCell={};if(c.structure)d.structure=c.structure;if(c.resource)d.resource=c.resource;if(c.spawner)d.spawner=c.spawner;cells.push({dx,dy,cell:d});}}}}clipboard={width:w,height:h,terrainRuns,elevationRuns,cells};updateStatus(`Copied ${w}×${h} stamp with terrain, elevation and ${cells.length} objects.`);}
  function pasteClipboardAt(cx:number,cy:number){if(!clipboard){updateStatus('Nothing copied.',true);return;}const left=cx-Math.floor(clipboard.width/2),top=cy-Math.floor(clipboard.height/2);for(const r of clipboard.terrainRuns){const y=top+r.dy;if(y<0||y>=WORLD_SIZE)continue;layer().terrainStrokes.push({kind:'rect_fill',x:clampCoord(left+r.startX),y,x2:clampCoord(left+r.startX+r.length-1),y2:y,size:1,tile:r.value});}for(const r of clipboard.elevationRuns){const y=top+r.dy;if(y<0||y>=WORLD_SIZE)continue;layer().elevationStrokes.push({kind:'rect_fill',x:clampCoord(left+r.startX),y,x2:clampCoord(left+r.startX+r.length-1),y2:y,size:1,mode:'set',value:r.value});}for(const it of clipboard.cells){const x=left+it.dx,y=top+it.dy;if(x<0||y<0||x>=WORLD_SIZE||y>=WORLD_SIZE)continue;const k=cellKey(x,y);rememberBefore(k);const c=ensureCell(k);Object.assign(c,it.cell);cleanupCell(k);}updateStatus(`Stamped ${clipboard.width}×${clipboard.height} at ${cx},${cy}.`);}

  function placeMarker(x:number,y:number,type:EditorMarkerType){const label=MARKER_TYPES.find(v=>v.id===type)?.label??displayName(type),count=data.markers.filter(m=>m.type===type&&m.plane===plane).length+1;data.markers.push({id:`marker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,type,name:markerName.trim()||`${label} ${count}`,x,y,plane,...(markerNotes.trim()?{notes:markerNotes.trim()}:{})});refreshMarkerJump();renderPalette();}
  function deleteNearestMarker(x:number,y:number){let idx=-1,best=Infinity;data.markers.forEach((m,i)=>{if(m.plane!==plane)return;const d=Math.hypot(m.x-x,m.y-y);if(d<best){best=d;idx=i;}});if(idx>=0&&best<=Math.max(8,14/TILE_SIZES[zoomIndex])){data.markers.splice(idx,1);refreshMarkerJump();renderPalette();}}
  function placeLinkEndpoint(x:number,y:number,kind:PlaneLinkKind){const ep:PlaneEndpoint={plane,x,y};if(!pendingLinkStart){pendingLinkStart=ep;updateStatus(`Link start set at ${planeName(plane)} ${x},${y}. Switch plane and click destination.`);renderPalette();return;}if(pendingLinkStart.plane===ep.plane&&pendingLinkStart.x===ep.x&&pendingLinkStart.y===ep.y){updateStatus('Destination must differ from the start.',true);return;}data.links.push({id:`link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,kind,name:linkName.trim()||undefined,from:{...pendingLinkStart},to:ep,bidirectional:true});pendingLinkStart=null;renderPalette();}
  function deleteNearestLink(x:number,y:number){let idx=-1,best=Infinity;data.links.forEach((l,i)=>{for(const ep of [l.from,l.to])if(ep.plane===plane){const d=Math.hypot(ep.x-x,ep.y-y);if(d<best){best=d;idx=i;}}});if(idx>=0&&best<=Math.max(8,14/TILE_SIZES[zoomIndex])){data.links.splice(idx,1);renderPalette();}}

  function applyHistory(entry:HistoryEntry,after:boolean){const l=getPlaneData(data,entry.plane),map=after?entry.afterCells:entry.beforeCells;for(const[k,c]of map)c?l.cells[k]={...c}:delete l.cells[k];l.terrainStrokes.splice(entry.beforeTerrainLength);if(after)l.terrainStrokes.push(...entry.addedTerrain.map(s=>({...s})));l.elevationStrokes.splice(entry.beforeElevationLength);if(after)l.elevationStrokes.push(...entry.addedElevation.map(s=>({...s})));data.markers=cloneMarkers(after?entry.afterMarkers:entry.beforeMarkers);data.links=cloneLinks(after?entry.afterLinks:entry.beforeLinks);refreshMarkerJump();renderPalette();navigator?.markEditsDirty();scheduleSave();draw();}
  function undo(){const e=undoStack.pop();if(!e)return;applyHistory(e,false);redoStack.push(e);}function redo(){const e=redoStack.pop();if(!e)return;applyHistory(e,true);undoStack.push(e);}
  function scheduleSave(){if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(persistNow,350);}function persistNow(){if(saveTimer)clearTimeout(saveTimer);saveTimer=null;try{saveEditorWorld(data);updateStatus('Saved locally.');}catch{updateStatus('Local storage full; export JSON.',true);}}
  function exportJson(){persistNow();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='twinlands-world.json';a.click();URL.revokeObjectURL(url);updateStatus(`Exported v5 world: ${data.markers.length} markers, ${data.links.length} plane links.`);}
  async function importJson(file:File|undefined){if(!file)return;try{const parsed=JSON.parse(await file.text()) as EditorWorldData;if(parsed.version!==5||!parsed.cells||!parsed.planes||!parsed.markers||!parsed.links)throw new Error();replaceEditorWorld(parsed);data=loadEditorWorld(WORLD_SIZE);plane=0;planeSelect.value='0';selectedArea=null;clipboard=null;pendingLinkStart=null;undoStack.length=0;redoStack.length=0;refreshMarkerJump();renderPalette();navigator?.markEditsDirty();draw();updateStatus('Imported v5 authored world.');}catch{updateStatus('Import expects a current v5 twinlands-world.json. Older browser data migrates automatically when loaded normally.',true);}finally{importInput.value='';}}

  function draw(){const r=canvas.getBoundingClientRect(),w=r.width,h=r.height,px=TILE_SIZES[zoomIndex];ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;if(px<4)drawMacro(w,h,px);else drawDetailed(w,h,px);drawMarkersAndLinks(w,h,px);drawPreview(w,h,px);updateStatus();navigator?.redraw();}
  function drawMacro(w:number,h:number,px:number){ctx.fillStyle=TILE_MAP_COLORS[baseTileForPlane(plane)];ctx.fillRect(0,0,w,h);if(plane!==0&&surfaceGhost){ctx.save();ctx.globalAlpha=.12;drawLayerShapes(getPlaneData(data,0),w,h,px,0);ctx.restore();}drawLayerShapes(layer(),w,h,px,plane);if(elevationOverlay)for(const s of layer().elevationStrokes)drawElevationShape(s,w,h,px);}
  function drawLayerShapes(l:ReturnType<typeof getPlaneData>,w:number,h:number,px:number,p:WorldPlane){for(const s of l.terrainStrokes)drawTerrainShape(s,w,h,px,p);for(const[k,c]of Object.entries(l.cells)){if(!c.tile)continue;const[x,y]=parseKey(k),q=worldToScreen(x,y,w,h,px);if(q.x<-2||q.y<-2||q.x>w+2||q.y>h+2)continue;ctx.fillStyle=TILE_MAP_COLORS[c.tile];ctx.fillRect(q.x,q.y,Math.max(1,px),Math.max(1,px));}}
  function drawTerrainShape(s:TerrainStroke,w:number,h:number,px:number,p:WorldPlane){const color=s.tile?TILE_MAP_COLORS[s.tile]:TILE_MAP_COLORS[baseTileForPlane(p)];ctx.fillStyle=color;ctx.strokeStyle=color;drawGenericShape(s,w,h,px,false);}
  function drawElevationShape(s:ElevationStroke,w:number,h:number,px:number){const value=s.mode==='set'?clampElevation(s.value):(s.value>0?3:-1);ctx.fillStyle=ELEVATION_COLORS[value]??'rgba(255,255,255,.2)';ctx.strokeStyle=ctx.fillStyle;drawGenericShape(s,w,h,px,true);}
  function drawGenericShape(s:{kind:TerrainStrokeKind;x:number;y:number;x2?:number;y2?:number;size:number},w:number,h:number,px:number,fillOnly:boolean){if(s.kind==='line'){const a=worldToScreen(s.x,s.y,w,h,px),b=worldToScreen(s.x2??s.x,s.y2??s.y,w,h,px);ctx.lineWidth=Math.max(1,s.size*px);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();return;}if(s.kind==='rect_fill'||s.kind==='rect_outline'){const b=normalizeBox({x:s.x,y:s.y},{x:s.x2??s.x,y:s.y2??s.y}),a=worldToScreen(b.left,b.top,w,h,px),rw=Math.max(1,(b.right-b.left+1)*px),rh=Math.max(1,(b.bottom-b.top+1)*px);if(s.kind==='rect_fill'||fillOnly)ctx.fillRect(a.x,a.y,rw,rh);else{ctx.lineWidth=Math.max(1,s.size*px);ctx.strokeRect(a.x,a.y,rw,rh);}return;}const half=Math.floor(s.size/2),a=worldToScreen(s.x-half,s.y-half,w,h,px);ctx.fillRect(a.x,a.y,Math.max(1,s.size*px),Math.max(1,s.size*px));}
  function drawDetailed(w:number,h:number,px:number){const cols=Math.ceil(w/px)+2,rows=Math.ceil(h/px)+2,startX=Math.floor(centerX-cols/2),startY=Math.floor(centerY-rows/2),ox=w/2-(centerX-startX)*px,oy=h/2-(centerY-startY)*px;for(let row=0;row<rows;row++){const y=startY+row;if(y<0||y>=WORLD_SIZE)continue;for(let col=0;col<cols;col++){const x=startX+col;if(x<0||x>=WORLD_SIZE)continue;const tile=effectiveTile(x,y),sx=ox+col*px,sy=oy+row*px,img=imageFor(`/sprites/tiles/${tile}.png`,draw);if(img.complete&&img.naturalWidth>0)ctx.drawImage(img,sx,sy,px,px);else{ctx.fillStyle=TILE_MAP_COLORS[tile];ctx.fillRect(sx,sy,px,px);}const elev=effectiveElevation(x,y);if(elevationOverlay&&elev!==0){ctx.fillStyle=ELEVATION_COLORS[elev];ctx.fillRect(sx,sy,px,px);if(px>=16){ctx.fillStyle='#fff';ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.font='10px sans-serif';ctx.textAlign='center';ctx.strokeText(`${elev>0?'+':''}${elev}`,sx+px/2,sy+px/2+3);ctx.fillText(`${elev>0?'+':''}${elev}`,sx+px/2,sy+px/2+3);}}if(col<cols-1&&Math.abs(effectiveElevation(x+1,y)-elev)>=2){ctx.strokeStyle='rgba(20,15,10,.85)';ctx.lineWidth=Math.max(2,px*.12);ctx.beginPath();ctx.moveTo(sx+px,sy);ctx.lineTo(sx+px,sy+px);ctx.stroke();}if(row<rows-1&&Math.abs(effectiveElevation(x,y+1)-elev)>=2){ctx.strokeStyle='rgba(20,15,10,.85)';ctx.lineWidth=Math.max(2,px*.12);ctx.beginPath();ctx.moveTo(sx,sy+px);ctx.lineTo(sx+px,sy+px);ctx.stroke();}}}if(px>=8)drawObjects(startX,startY,cols,rows,ox,oy,px);}
  function drawObjects(startX:number,startY:number,cols:number,rows:number,ox:number,oy:number,px:number){for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const x=startX+col,y=startY+row,c=layer().cells[cellKey(x,y)];if(!c)continue;const sx=ox+col*px,sy=oy+row*px;if(c.structure)drawSprite(`/sprites/structures/${c.structure}.png`,sx,sy,px,'#d8c9a1');else if(c.resource)drawSprite(`/sprites/resources/${c.resource}.png`,sx,sy,px,c.resource.startsWith('rock_')?'#222':'#356c36');else if(c.spawner)drawSprite(`/sprites/monsters/${c.spawner}.png`,sx,sy,px,'#aa3030');}}
  function drawSprite(path:string,sx:number,sy:number,px:number,fallback:string){const img=imageFor(path,draw);if(img.complete&&img.naturalWidth>0){const h=Math.max(px,px*img.naturalHeight/img.naturalWidth);ctx.drawImage(img,sx,sy+px-h,px,h);}else{ctx.fillStyle=fallback;ctx.beginPath();ctx.arc(sx+px/2,sy+px/2,Math.max(2,px*.3),0,Math.PI*2);ctx.fill();}}
  function worldToScreen(x:number,y:number,w:number,h:number,px:number):WorldPoint{return{x:w/2+(x-centerX)*px,y:h/2+(y-centerY)*px};}
  function drawMarkersAndLinks(w:number,h:number,px:number){for(const m of data.markers){if(m.plane!==plane)continue;const p=worldToScreen(m.x,m.y,w,h,px);if(p.x<-30||p.y<-30||p.x>w+30||p.y>h+30)continue;ctx.fillStyle=m.type==='mining_area'?'#ff8a32':m.type==='castle'?'#c391ff':m.type==='city'?'#ff7777':m.type==='village'?'#8ee28e':m.type==='town'?'#f1d56b':'#f4f4f4';ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,px<2?4:Math.max(4,Math.min(8,px*.24)),0,Math.PI*2);ctx.fill();ctx.stroke();if(px>=2){ctx.font='11px sans-serif';ctx.textAlign='center';ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.strokeText(m.name,p.x,p.y-10);ctx.fillStyle='#fff';ctx.fillText(m.name,p.x,p.y-10);}}for(const l of data.links){for(const ep of [l.from,l.to]){if(ep.plane!==plane)continue;const p=worldToScreen(ep.x,ep.y,w,h,px);ctx.fillStyle='#61e6ff';ctx.strokeStyle='#07171b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y-7);ctx.lineTo(p.x+6,p.y+5);ctx.lineTo(p.x-6,p.y+5);ctx.closePath();ctx.fill();ctx.stroke();if(px>=4&&l.name){ctx.fillStyle='#fff';ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.font='10px sans-serif';ctx.strokeText(l.name,p.x,p.y-10);ctx.fillText(l.name,p.x,p.y-10);}}}}
  function drawPreview(w:number,h:number,px:number){if(selectedArea)drawBox(selectedArea,w,h,px,'rgba(80,190,255,.10)','rgba(105,205,255,.95)',2);if(isPainting&&dragStart&&dragCurrent){if(toolMode==='line'){const a=worldToScreen(dragStart.x,dragStart.y,w,h,px),b=worldToScreen(dragCurrent.x,dragCurrent.y,w,h,px);ctx.strokeStyle='rgba(92,255,114,.95)';ctx.lineWidth=Math.max(3,brushSize*px);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();return;}const b=normalizeBox(dragStart,dragCurrent);drawBox(b,w,h,px,toolMode==='select'?'rgba(80,190,255,.12)':'rgba(72,255,103,.15)',toolMode==='select'?'rgba(105,205,255,.95)':'rgba(92,255,114,.95)',toolMode==='rect_outline'?Math.max(2,brushSize*px):2);return;}if(toolMode==='stamp'&&clipboard){const hw=Math.floor(clipboard.width/2),hh=Math.floor(clipboard.height/2);drawBox({left:hoverX-hw,top:hoverY-hh,right:hoverX-hw+clipboard.width-1,bottom:hoverY-hh+clipboard.height-1},w,h,px,'rgba(72,255,103,.15)','rgba(92,255,114,.95)',2);return;}if(toolMode!=='brush')return;const size=effectiveBrushSize(),half=Math.floor(size/2),a=worldToScreen(hoverX-half,hoverY-half,w,h,px),raw=Math.max(px,size*px),vis=Math.max(3,raw);ctx.fillStyle='rgba(72,255,103,.18)';ctx.strokeStyle='rgba(92,255,114,.95)';ctx.lineWidth=2;ctx.fillRect(a.x,a.y,vis,vis);ctx.strokeRect(a.x,a.y,vis,vis);}
  function drawBox(b:SelectionBox,w:number,h:number,px:number,fill:string,stroke:string,lw:number){const a=worldToScreen(b.left,b.top,w,h,px),rw=Math.max(3,(b.right-b.left+1)*px),rh=Math.max(3,(b.bottom-b.top+1)*px);ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.fillRect(a.x,a.y,rw,rh);ctx.strokeRect(a.x,a.y,rw,rh);}
  function updateStatus(message?:string,warning=false){const elev=effectiveElevation(hoverX,hoverY),sel='id'in selection?`${selection.kind}: ${displayName(selection.id)}`:'value'in selection?`${selection.kind} ${selection.value}`:selection.kind;statusLeft.textContent=message??`${planeName(plane)} · Cursor ${hoverX},${hoverY} · elevation ${elev>0?'+':''}${elev} · ${toolMode} · ${sel}`;statusLeft.className=warning?'warn':'';const l=layer();statusRight.textContent=`${Object.keys(l.cells).length.toLocaleString()} cells · ${l.terrainStrokes.length} terrain · ${l.elevationStrokes.length} elevation · ${data.markers.length} markers · ${data.links.length} links`;}
  function parseKey(k:string):[number,number]{const c=k.indexOf(',');return[Number(k.slice(0,c)),Number(k.slice(c+1))];}
  draw();
}
