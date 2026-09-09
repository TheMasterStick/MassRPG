export type Facing4 = 'up' | 'down' | 'left' | 'right';

/** Resolves the dominant compass direction of a delta, keeping `fallback` when there's no movement to judge (e.g. target directly adjacent with zero remainder). */
export function facingFromDelta(dx: number, dy: number, fallback: Facing4): Facing4 {
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
