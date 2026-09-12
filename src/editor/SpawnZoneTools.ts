import { MONSTERS } from '../data/monsters';
import { WORLD_SIZE } from '../world/AeldorData';
import { loadEditorWorld, saveEditorWorld } from '../world/EditorWorld';
import {
  mutableSpawnZones,
  type EditorSpawnZone,
  type SpawnZoneKind,
  type SpawnZoneStroke,
} from '../world/SpawnZones';
import type { ResourceType, WorldPlane } from '../world/types';

const RESOURCE_OPTIONS: { id: ResourceType; label: string }[] = [
  { id: 'flax_plant', label: 'Flax' },
  { id: 'tree_normal', label: 'Normal Tree' },
  { id: 'tree_oak', label: 'Oak' },
  { id: 'tree_willow', label: 'Willow' },
  { id: 'tree_maple', label: 'Maple' },
  { id: 'tree_yew', label: 'Yew' },
  { id: 'tree_magic', label: 'Magic Tree' },
  { id: 'rock_copper', label: 'Copper Rock' },
  { id: 'rock_tin', label: 'Tin Rock' },
  { id: 'rock_iron', label: 'Iron Rock' },
  { id: 'rock_coal', label: 'Coal Rock' },
  { id: 'rock_silver', label: 'Silver Rock' },
  { id: 'rock_gold', label: 'Gold Rock' },
  { id: 'rock_mithril', label: 'Mithril Rock' },
  { id: 'rock_adamant', label: 'Adamant Rock' },
  { id: 'rock_rune', label: 'Rune Rock' },
  { id: 'rock_dragonite', label: 'Dragonite Rock' },
  { id: 'rock_gem', label: 'Gem Rock' },
  { id: 'fishing_shrimp', label: 'Small Fishing' },
  { id: 'fishing_lobster', label: 'Lobster Fishing' },
  { id: 'fishing_swordfish', label: 'Deep Fishing' },
  { id: 'farm_patch', label: 'Farm Patch' },
  { id: 'herb_patch', label: 'Herb Patch' },
];

type ZoneMode = 'off' | 'paint' | 'erase';

/**
 * WC3-style region painting for authored populations. A zone is a stable named
 * logical object with one creature/resource target and a live-count budget; the
 * brush only edits the zone's shape. Runtime derives deterministic spawn points
 * from that shape, so map authors never need to hand-place dozens of spawners.
 */
export function installSpawnZoneTools(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('.editor-canvas')!;
  const toolbar = root.querySelector<HTMLElement>('.editor-toolbar')!;
  const wrap = canvas.parentElement!;
  if (!canvas || !toolbar || !wrap) return;

  let mode: ZoneMode = 'off';
  let kind: SpawnZoneKind = 'monster';
  let activeZoneId = '';
  let painting = false;
  let lastPoint: { x: number; y: number } | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let frame = 0;

  const modeSelect = document.createElement('select');
  modeSelect.title = 'Paint or erase a named monster/resource spawn region.';
  for (const [value, label] of [
    ['off', 'Spawn zones: Off'],
    ['paint', 'Spawn zones: Paint'],
    ['erase', 'Spawn zones: Erase'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    modeSelect.append(option);
  }

  const kindSelect = document.createElement('select');
  for (const [value, label] of [['monster', 'Creatures'], ['resource', 'Resources']] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `Zone: ${label}`;
    kindSelect.append(option);
  }

  const targetSelect = document.createElement('select');
  targetSelect.title = 'Population type for a new zone.';

  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = '100';
  countInput.value = '6';
  countInput.style.width = '48px';
  countInput.title = 'Desired simultaneously-live spawn points/nodes in this zone.';

  const brushSelect = document.createElement('select');
  brushSelect.title = 'Logical spawn-zone brush size.';
  for (const size of [1, 3, 5, 9, 17, 33, 65]) {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = `Zone brush ${size}`;
    brushSelect.append(option);
  }
  brushSelect.value = '9';

  const activeSelect = document.createElement('select');
  activeSelect.title = 'Existing zone to extend/erase.';
  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.textContent = 'New Zone';
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Delete Zone';

  toolbar.append(
    modeSelect,
    kindSelect,
    targetSelect,
    document.createTextNode('N'),
    countInput,
    brushSelect,
    activeSelect,
    newBtn,
    deleteBtn,
  );

  const overlay = document.createElement('canvas');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '1';
  wrap.append(overlay);
  const ctx = overlay.getContext('2d')!;
  if (!ctx) return;

  function currentPlane(): WorldPlane {
    const planeSelect = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((select) => [...select.options].some((option) => option.textContent === 'Surface')
        && [...select.options].some((option) => option.value === '-1'));
    const value = Number(planeSelect?.value ?? 0);
    return value === -1 || value === -2 ? value : 0;
  }

  function currentZoom(): number {
    const zoomSelect = [...toolbar.querySelectorAll<HTMLSelectElement>('select')]
      .find((select) => select.selectedOptions[0]?.textContent?.includes('px / tile'));
    const px = Number.parseFloat(zoomSelect?.selectedOptions[0]?.textContent ?? '1');
    return Number.isFinite(px) && px > 0 ? px : 1;
  }

  function currentCenter(): { x: number; y: number } {
    const inputs = [...toolbar.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    return { x: Number(inputs[0]?.value ?? WORLD_SIZE / 2), y: Number(inputs[1]?.value ?? WORLD_SIZE / 2) };
  }

  function eventPoint(event: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const tilePx = currentZoom();
    const center = currentCenter();
    return {
      x: Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(center.x + (event.clientX - rect.left - rect.width / 2) / tilePx))),
      y: Math.max(0, Math.min(WORLD_SIZE - 1, Math.round(center.y + (event.clientY - rect.top - rect.height / 2) / tilePx))),
    };
  }

  function zones(): EditorSpawnZone[] {
    return mutableSpawnZones(loadEditorWorld(WORLD_SIZE));
  }

  function refreshTargets(): void {
    const previous = targetSelect.value;
    targetSelect.innerHTML = '';
    if (kind === 'monster') {
      for (const monster of MONSTERS) {
        const option = document.createElement('option');
        option.value = monster.id;
        option.textContent = `${monster.name} (${monster.level})`;
        targetSelect.append(option);
      }
    } else {
      for (const resource of RESOURCE_OPTIONS) {
        const option = document.createElement('option');
        option.value = resource.id;
        option.textContent = resource.label;
        targetSelect.append(option);
      }
    }
    if ([...targetSelect.options].some((option) => option.value === previous)) targetSelect.value = previous;
  }

  function refreshZones(): void {
    const previous = activeZoneId;
    activeSelect.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Active zone: none';
    activeSelect.append(none);
    for (const zone of zones()) {
      const option = document.createElement('option');
      option.value = zone.id;
      option.textContent = `${zone.plane === 0 ? 'Surface' : `U${zone.plane}`} · ${zone.name}`;
      activeSelect.append(option);
    }
    if ([...activeSelect.options].some((option) => option.value === previous)) {
      activeZoneId = previous;
      activeSelect.value = previous;
    } else {
      activeZoneId = '';
    }
  }

  function selectedZone(): EditorSpawnZone | undefined {
    return zones().find((zone) => zone.id === activeZoneId);
  }

  function targetName(zoneKind: SpawnZoneKind, id: string): string {
    if (zoneKind === 'monster') return MONSTERS.find((monster) => monster.id === id)?.name ?? id;
    return RESOURCE_OPTIONS.find((resource) => resource.id === id)?.label ?? id;
  }

  function createZone(): EditorSpawnZone {
    const targetId = targetSelect.value;
    const list = zones();
    const index = list.filter((zone) => zone.kind === kind && zone.targetId === targetId).length + 1;
    const zone: EditorSpawnZone = {
      id: `zone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${targetName(kind, targetId)} ${kind === 'monster' ? 'Spawn' : 'Resource'} Zone ${index}`,
      kind,
      targetId,
      plane: currentPlane(),
      count: Math.max(1, Math.min(100, Math.round(Number(countInput.value) || 1))),
      paint: [],
      erase: [],
    };
    list.push(zone);
    activeZoneId = zone.id;
    refreshZones();
    activeSelect.value = zone.id;
    scheduleSave();
    redraw();
    return zone;
  }

  function brushSize(): number {
    return Math.max(1, Number(brushSelect.value) || 1);
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveEditorWorld(loadEditorWorld(WORLD_SIZE));
    }, 180);
  }

  function paintPoint(point: { x: number; y: number }): void {
    let zone = selectedZone();
    if (!zone || zone.plane !== currentPlane()) zone = createZone();
    const stroke: SpawnZoneStroke = { x: point.x, y: point.y, size: brushSize() };
    (mode === 'erase' ? zone.erase : zone.paint).push(stroke);
    scheduleSave();
  }

  function paintSegment(point: { x: number; y: number }): void {
    const spacing = Math.max(1, Math.floor(brushSize() * 0.45));
    if (!lastPoint) {
      paintPoint(point);
      lastPoint = point;
      return;
    }
    const dx = point.x - lastPoint.x;
    const dy = point.y - lastPoint.y;
    const distance = Math.hypot(dx, dy);
    if (distance < spacing) return;
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let i = 1; i <= steps; i++) {
      paintPoint({ x: Math.round(lastPoint.x + dx * i / steps), y: Math.round(lastPoint.y + dy * i / steps) });
    }
    lastPoint = point;
  }

  function syncFromZone(): void {
    const zone = selectedZone();
    if (!zone) return;
    kind = zone.kind;
    kindSelect.value = kind;
    refreshTargets();
    targetSelect.value = zone.targetId;
    countInput.value = String(zone.count);
  }

  modeSelect.addEventListener('change', () => {
    mode = modeSelect.value as ZoneMode;
    painting = false;
    lastPoint = null;
    canvas.style.cursor = mode === 'off' ? '' : 'crosshair';
    redraw();
  });
  kindSelect.addEventListener('change', () => {
    kind = kindSelect.value as SpawnZoneKind;
    refreshTargets();
  });
  activeSelect.addEventListener('change', () => {
    activeZoneId = activeSelect.value;
    syncFromZone();
    redraw();
  });
  countInput.addEventListener('change', () => {
    const zone = selectedZone();
    if (!zone) return;
    zone.count = Math.max(1, Math.min(100, Math.round(Number(countInput.value) || 1)));
    countInput.value = String(zone.count);
    scheduleSave();
    redraw();
  });
  newBtn.addEventListener('click', () => createZone());
  deleteBtn.addEventListener('click', () => {
    const list = zones();
    const index = list.findIndex((zone) => zone.id === activeZoneId);
    if (index >= 0) list.splice(index, 1);
    activeZoneId = '';
    refreshZones();
    scheduleSave();
    redraw();
  });

  canvas.addEventListener('mousedown', (event) => {
    if (mode === 'off' || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    painting = true;
    lastPoint = null;
    paintSegment(eventPoint(event));
    refreshZones();
    activeSelect.value = activeZoneId;
    redraw();
  }, { capture: true });

  canvas.addEventListener('mousemove', (event) => {
    if (mode === 'off' || !painting) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    paintSegment(eventPoint(event));
    redraw();
  }, { capture: true });

  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0 || !painting) return;
    painting = false;
    lastPoint = null;
    scheduleSave();
    redraw();
  });

  function drawStroke(stroke: SpawnZoneStroke, toScreen: (x: number, y: number) => { x: number; y: number }, tilePx: number, fill: string): void {
    const radius = Math.floor(Math.max(1, stroke.size) / 2);
    const p = toScreen(stroke.x - radius, stroke.y - radius);
    const side = Math.max(2, (radius * 2 + 1) * tilePx);
    ctx.fillStyle = fill;
    ctx.fillRect(p.x, p.y, side, side);
  }

  function redraw(): void {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (overlay.width !== Math.round(width * dpr) || overlay.height !== Math.round(height * dpr)) {
        overlay.width = Math.round(width * dpr);
        overlay.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const tilePx = currentZoom();
      const center = currentCenter();
      const plane = currentPlane();
      const toScreen = (x: number, y: number) => ({ x: width / 2 + (x - center.x) * tilePx, y: height / 2 + (y - center.y) * tilePx });

      for (const zone of zones()) {
        if (zone.plane !== plane) continue;
        const active = zone.id === activeZoneId;
        const fill = zone.kind === 'monster'
          ? active ? 'rgba(224,70,120,.28)' : 'rgba(224,70,120,.14)'
          : active ? 'rgba(54,210,158,.26)' : 'rgba(54,210,158,.13)';
        for (const stroke of zone.paint) drawStroke(stroke, toScreen, tilePx, fill);
        for (const stroke of zone.erase) drawStroke(stroke, toScreen, tilePx, 'rgba(20,22,24,.55)');
        const anchor = zone.paint[0];
        if (anchor && tilePx >= 2) {
          const p = toScreen(anchor.x, anchor.y);
          ctx.font = active ? 'bold 11px sans-serif' : '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeStyle = '#111';
          ctx.fillStyle = '#fff';
          ctx.lineWidth = 3;
          const label = `${zone.name} · ${zone.count}`;
          ctx.strokeText(label, p.x, p.y - 8);
          ctx.fillText(label, p.x, p.y - 8);
        }
      }
    });
  }

  refreshTargets();
  refreshZones();
  toolbar.addEventListener('change', redraw);
  toolbar.addEventListener('input', redraw);
  toolbar.addEventListener('click', redraw);
  canvas.addEventListener('wheel', redraw, { passive: true });
  window.addEventListener('resize', redraw);
  redraw();
}
