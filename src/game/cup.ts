// "Copa Peluche": las tres pistas seguidas, con puntos por carrera. Lógica pura (sin three.js ni DOM),
// la comprueba `npm run check:copa`. Los puntos se guardan por peluche: si un jugador se va en línea,
// la IA sigue con su peluche y con sus puntos.
import type { Species } from '../core/events';

export const CUP_TRACKS = ['cuarto', 'bano', 'jardin'] as const;
/** Puntos del 1.º al 6.º. */
export const CUP_POINTS = [10, 8, 6, 4, 3, 2];

export interface CupRow {
  char: Species;
  name: string;
  points: number;
  /** Puntos de la última carrera. */
  last: number;
  /** Puesto en la última carrera (0 = aún no corrió). */
  lastPlace: number;
  wins: number;
  /** Puesto en la clasificación antes de la última carrera (para las flechas ▲▼). */
  prevRank: number;
  rank: number;
}

export class Cup {
  /** Carreras ya puntuadas (0..3). */
  raced = 0;
  private rows = new Map<Species, CupRow>();

  constructor(entrants: { char: Species; name: string }[]) {
    entrants.forEach((e, i) => this.rows.set(e.char, { char: e.char, name: e.name, points: 0, last: 0, lastPlace: 0, wins: 0, prevRank: i + 1, rank: i + 1 }));
  }

  get total(): number {
    return CUP_TRACKS.length;
  }

  get done(): boolean {
    return this.raced >= this.total;
  }

  /** Pista de la carrera que toca (o la última si ya terminó). */
  get trackId(): string {
    return CUP_TRACKS[Math.min(this.raced, this.total - 1)];
  }

  /** Suma una carrera: `order` = peluches del 1.º al último. Quien no esté en la lista no suma. */
  addRace(order: { char: Species; name: string }[]): void {
    const before = this.standings();
    for (const r of this.rows.values()) {
      r.last = 0;
      r.lastPlace = 0;
    }
    order.forEach((e, i) => {
      let r = this.rows.get(e.char);
      if (!r) this.rows.set(e.char, (r = { char: e.char, name: e.name, points: 0, last: 0, lastPlace: 0, wins: 0, prevRank: 99, rank: 99 }));
      r.name = e.name;
      r.last = CUP_POINTS[i] ?? 0;
      r.points += r.last;
      r.lastPlace = i + 1;
      if (i === 0) r.wins++;
    });
    before.forEach((r, i) => (r.prevRank = i + 1));
    const first = this.raced === 0;
    this.raced++;
    // Tras la primera carrera no hay flechas: antes no había clasificación.
    this.standings().forEach((r, i) => {
      r.rank = i + 1;
      if (first) r.prevRank = r.rank;
    });
  }

  /** Clasificación: más puntos, luego más victorias, luego mejor puesto en la última carrera. */
  standings(): CupRow[] {
    return [...this.rows.values()].sort(
      (a, b) => b.points - a.points || b.wins - a.wins || (a.lastPlace || 99) - (b.lastPlace || 99) || a.rank - b.rank,
    );
  }

  /** Orden de salida de la próxima carrera: el último de la clasificación sale primero. Sin puntos: null. */
  gridOrder(): Species[] | null {
    if (this.raced === 0) return null;
    return this.standings()
      .reverse()
      .map((r) => r.char);
  }

  /** Para enviarla por la red. */
  toJSON(): { raced: number; rows: CupRow[] } {
    return { raced: this.raced, rows: [...this.rows.values()] };
  }

  static fromJSON(d: { raced: number; rows: CupRow[] }): Cup {
    const c = new Cup([]);
    c.raced = d.raced;
    for (const r of d.rows) c.rows.set(r.char, { ...r });
    return c;
  }
}
