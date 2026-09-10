import { el } from './dom';
import type { Game } from '../core/Game';
import { WORLD_SIZE } from '../world/AeldorData';
import { loadEditorWorld, type EditorMarker, type EditorMarkerType, type TerrainStroke } from '../world/EditorWorld';
import { TILE_MAP_COLORS } from './mapColors';
import { findNearestWalkable } from '../systems/Pathfinding';
import { log } from '../core/EventBus';

const CANVAS_SIZE = 560;
const ZOOM_SPANS = [WORLD_SIZE, WORLD_SIZE / 3, WORLD_SIZE / 9];
const MARKER_COLORS: Record<EditorMarkerType, string> = {
  settlement: '#f2f2f2', village: '#8ee28e', town: '#f1d56b', city: '#ff7777', castle: '#c391ff', mining_area: '#ff8a32',
};

export function buildWorldMap(root: HTMLElement, game: Game) {
  const canvas = el('canvas', { className: 'worldmap-canvas', attrs: { width: String(CANVAS_SIZE), height: String(CANVAS_SIZE) } }) as HTMLCanvasElement;
  const context = canvas.getContext('2d'); if (!context) throw new Error('World map requires Canvas 2D.'); const ctx: CanvasRenderingContext2D = context;
  const zoomOutBtn = el('button', { className: 'worldmap-zoom-btn', text: '−', attrs: { title: 'Zoom out' } });
  const zoomInBtn = el('button', { className: 'worldmap-zoom-btn', text: '+', attrs: { title: 'Zoom in' } });
  const zoomLabel = el('span', { className: 'worldmap-zoom-label', text: '' });
  const closeBtn = el('span', { className: 'close-x', text: '✕', attrs: { id: 'worldmap-close' } });
  const panel = el('div', { className: 'panel worldmap-panel hidden', attrs: { id: 'panel-worldmap' } }, [
    el('h2', {}, ['The Twin Lands - Surface Map', closeBtn]),
    el('div', { className: 'worldmap-canvas-wrap' }, [canvas]),
    el('div', { className: 'worldmap-controls' }, [zoomOutBtn, zoomLabel, zoomInBtn, el('span', { className: 'worldmap-hint', text: 'Surface terrain, authored markers and cave entrances.' })]),
  ]);
  root.append(panel);
  let zoomIndex = 0;
  let baseCache: { key: string; canvas: HTMLCanvasElement } | null = null;

  function center() { return zoomIndex === 0 ? { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 } : { x: game.player.x, y: game.player.y }; }
  function worldToCanvas(wx:number,wy:number,c:{x:number;y:number},span:number){const scale=CANVAS_SIZE/span;return{x:(wx-c.x)*scale+CANVAS_SIZE/2,y:(wy-c.y)*scale+CANVAS_SIZE/2};}
  function canvasToWorld(px:number,py:number,c:{x:number;y:number},span:number){const scale=CANVAS_SIZE/span;return{x:c.x+(px-CANVAS_SIZE/2)/scale,y:c.y+(py-CANVAS_SIZE/2)/scale};}

  function renderBaseTerrain(c:{x:number;y:number},span:number){
    const data=loadEditorWorld(WORLD_SIZE),key=`${data.updatedAt}:${span}:${Math.round(c.x)}:${Math.round(c.y)}`;
    if(baseCache?.key===key)return baseCache.canvas;
    const off=document.createElement('canvas');off.width=CANVAS_SIZE;off.height=CANVAS_SIZE;const o=off.getContext('2d');if(!o)throw new Error('World map cache requires Canvas 2D.');
    o.fillStyle=TILE_MAP_COLORS.deep_water;o.fillRect(0,0,CANVAS_SIZE,CANVAS_SIZE);
    for(const s of data.terrainStrokes)drawStroke(o,s,c,span);
    for(const[k,cell]of Object.entries(data.cells)){if(!cell.tile)continue;const comma=k.indexOf(','),wx=Number(k.slice(0,comma)),wy=Number(k.slice(comma+1)),p=worldToCanvas(wx,wy,c,span);if(p.x<-2||p.y<-2||p.x>CANVAS_SIZE+2||p.y>CANVAS_SIZE+2)continue;o.fillStyle=TILE_MAP_COLORS[cell.tile];o.fillRect(Math.floor(p.x),Math.floor(p.y),zoomIndex===0?1:2,zoomIndex===0?1:2);}
    baseCache={key,canvas:off};return off;
  }
  function drawStroke(o:CanvasRenderingContext2D,s:TerrainStroke,c:{x:number;y:number},span:number){
    const scale=CANVAS_SIZE/span;o.fillStyle=s.tile?TILE_MAP_COLORS[s.tile]:TILE_MAP_COLORS.deep_water;o.strokeStyle=o.fillStyle;
    if(s.kind==='line'){const a=worldToCanvas(s.x,s.y,c,span),b=worldToCanvas(s.x2??s.x,s.y2??s.y,c,span);o.lineWidth=Math.max(1,s.size*scale);o.lineCap='round';o.beginPath();o.moveTo(a.x,a.y);o.lineTo(b.x,b.y);o.stroke();return;}
    if(s.kind==='rect_fill'||s.kind==='rect_outline'){const x2=s.x2??s.x,y2=s.y2??s.y,left=Math.min(s.x,x2),top=Math.min(s.y,y2),w=(Math.abs(x2-s.x)+1)*scale,h=(Math.abs(y2-s.y)+1)*scale,a=worldToCanvas(left,top,c,span);if(s.kind==='rect_fill')o.fillRect(a.x,a.y,Math.max(1,w),Math.max(1,h));else{o.lineWidth=Math.max(1,s.size*scale);o.strokeRect(a.x,a.y,Math.max(1,w),Math.max(1,h));}return;}
    const half=Math.floor(s.size/2),a=worldToCanvas(s.x-half,s.y-half,c,span),sz=Math.max(1,s.size*scale);o.fillRect(a.x,a.y,sz,sz);
  }
  function drawMarker(m:EditorMarker,c:{x:number;y:number},span:number){const p=worldToCanvas(m.x,m.y,c,span);if(p.x<-12||p.y<-12||p.x>CANVAS_SIZE+12||p.y>CANVAS_SIZE+12)return;const r=m.type==='city'||m.type==='castle'?4.5:3.5;ctx.fillStyle=MARKER_COLORS[m.type];ctx.strokeStyle='#111';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();if(zoomIndex>0||m.type==='city'||m.type==='castle'){ctx.fillStyle='#fff';ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.font=m.type==='city'?'bold 10px sans-serif':'10px sans-serif';ctx.textAlign='center';ctx.strokeText(m.name,p.x,p.y-r-4);ctx.fillText(m.name,p.x,p.y-r-4);}}
  function draw(){const c=center(),span=ZOOM_SPANS[zoomIndex];ctx.clearRect(0,0,CANVAS_SIZE,CANVAS_SIZE);ctx.drawImage(renderBaseTerrain(c,span),0,0);const data=loadEditorWorld(WORLD_SIZE);for(const m of data.markers)if(m.plane===0)drawMarker(m,c,span);for(const link of data.links){for(const ep of [link.from,link.to]){if(ep.plane!==0)continue;const p=worldToCanvas(ep.x,ep.y,c,span);ctx.fillStyle='#61e6ff';ctx.strokeStyle='#07171b';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p.x,p.y-5);ctx.lineTo(p.x+4,p.y+4);ctx.lineTo(p.x-4,p.y+4);ctx.closePath();ctx.fill();ctx.stroke();}}if(game.player.plane===0){const player=worldToCanvas(game.player.x,game.player.y,c,span);ctx.fillStyle='#ffee55';ctx.strokeStyle='#000';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(player.x,player.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}zoomLabel.textContent=zoomIndex===0?'Whole Twin Lands':`Zoom ${zoomIndex}/${ZOOM_SPANS.length-1}`;zoomOutBtn.toggleAttribute('disabled',zoomIndex===0);zoomInBtn.toggleAttribute('disabled',zoomIndex===ZOOM_SPANS.length-1);}
  canvas.addEventListener('click',e=>{if(game.player.plane!==0){log('Return to the surface before using surface-map fast travel.','warning');return;}const r=canvas.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*CANVAS_SIZE,py=(e.clientY-r.top)/r.height*CANVAS_SIZE,target=canvasToWorld(px,py,center(),ZOOM_SPANS[zoomIndex]),tile={x:Math.round(target.x),y:Math.round(target.y)},dest=findNearestWalkable(game.world,tile);if(!dest){log("You can't find authored land to travel to there.",'warning');return;}game.player.action=null;game.player.combatTargetId=null;game.player.path=[];game.player.x=dest.x;game.player.y=dest.y;log('You travel across the surface map.','info');close();});
  zoomInBtn.addEventListener('click',()=>{zoomIndex=Math.min(ZOOM_SPANS.length-1,zoomIndex+1);baseCache=null;draw();});zoomOutBtn.addEventListener('click',()=>{zoomIndex=Math.max(0,zoomIndex-1);baseCache=null;draw();});closeBtn.addEventListener('click',()=>close());
  function open(){zoomIndex=0;baseCache=null;panel.classList.remove('hidden');draw();}function close(){panel.classList.add('hidden');}
  return{panel,open,close};
}
