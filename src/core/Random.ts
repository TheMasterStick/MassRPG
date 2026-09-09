// Deterministic PRNG (mulberry32) plus a coordinate hash used to make
// procedural generation reproducible from a single world seed.

export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // Returns a float in [0, 1)
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  weightedPick<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let roll = this.next() * total;
    for (const entry of items) {
      roll -= entry.weight;
      if (roll <= 0) return entry.item;
    }
    return items[items.length - 1].item;
  }
}

// Hashes (seed, x, y[, salt]) into a stable float in [0,1). Used so tile
// contents (resources, decoration) are deterministic without needing to
// store every generated tile.
export function hash2D(seed: number, x: number, y: number, salt = 0): number {
  let h = seed ^ salt;
  h = Math.imul(h ^ x, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h ^ y, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hashInt(seed: number, x: number, y: number, salt = 0): number {
  return Math.floor(hash2D(seed, x, y, salt) * 4294967296) >>> 0;
}
