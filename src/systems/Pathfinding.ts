import type { World } from '../world/World';

export interface Point { x: number; y: number }

const DIRS: Point[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

export function bfsPath(world: World, start: Point, goal: Point, maxRadius = 40): Point[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const key = (p: Point) => `${p.x},${p.y}`;
  const visited = new Set<string>([key(start)]);
  const cameFrom = new Map<string, Point>();
  const queue: Point[] = [start];
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    for (const d of DIRS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (Math.abs(nx - start.x) > maxRadius || Math.abs(ny - start.y) > maxRadius) continue;
      const nk = `${nx},${ny}`;
      if (visited.has(nk)) continue;
      if (!world.canStep(cur.x, cur.y, nx, ny)) continue;
      visited.add(nk);
      cameFrom.set(nk, cur);
      if (nx === goal.x && ny === goal.y) {
        const path: Point[] = [];
        let p: Point | undefined = { x: nx, y: ny };
        while (p && !(p.x === start.x && p.y === start.y)) {
          path.push(p);
          p = cameFrom.get(key(p));
        }
        return path.reverse();
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

export function nearestAdjacentWalkable(world: World, from: Point, target: Point): Point | null {
  let best: Point | null = null;
  let bestDist = Infinity;
  for (const d of DIRS) {
    const p = { x: target.x + d.x, y: target.y + d.y };
    if (!world.isWalkable(p.x, p.y)) continue;
    const dist = (p.x - from.x) ** 2 + (p.y - from.y) ** 2;
    if (dist < bestDist) { bestDist = dist; best = p; }
  }
  return best;
}

export function findNearestWalkable(world: World, target: Point, maxRadius = 30): Point | null {
  if (world.isWalkable(target.x, target.y)) return target;
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of [-r, r]) {
        const p = { x: target.x + dx, y: target.y + dy };
        if (world.isWalkable(p.x, p.y)) return p;
      }
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      for (const dx of [-r, r]) {
        const p = { x: target.x + dx, y: target.y + dy };
        if (world.isWalkable(p.x, p.y)) return p;
      }
    }
  }
  return null;
}

export function isAdjacent(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && !(a.x === b.x && a.y === b.y);
}
export function isSameOrAdjacent(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}
