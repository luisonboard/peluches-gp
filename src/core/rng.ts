// RNG con semilla (mulberry32). Todo lo procedural usa esto, nunca Math.random.
export class Rng {
  private s: number;
  constructor(seed: number | string) {
    this.s = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  /** Sub-generador independiente y estable para un subsistema ("texturas", "ia"...). */
  fork(label: string): Rng {
    let h = this.s ^ 0x9e3779b9;
    for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 2654435761);
    return new Rng(h >>> 0);
  }
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
