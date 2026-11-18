// Carrera: parrilla, cuenta atrás con turbo de salida, choques entre karts, vueltas, posiciones,
// llegada y ayuda a los rezagados (más suave para un niño: la IA afloja si va muy por delante).
import { bus } from '../core/events';
import type { Rng } from '../core/rng';
import type { Kart, KartCtl } from './kart';
import { NO_CTL, TUNING } from './kart';
import type { AIDriver, AIContext } from './ai';
import type { Arena } from './arena';
import { applyAssist, type AssistOpts } from './assist';
import type { Hazard } from './obstacles';

export type Phase = 'grid' | 'countdown' | 'racing' | 'done';

export interface CpuLevel {
  id: 'facil' | 'normal' | 'dificil';
  label: string;
  speed: number;
  driftSkill: number;
  startBoost: number;
}

export const CPU_LEVELS: CpuLevel[] = [
  { id: 'facil', label: 'Fácil', speed: 0.85, driftSkill: 0.25, startBoost: 0.2 },
  { id: 'normal', label: 'Normal', speed: 0.94, driftSkill: 0.6, startBoost: 0.45 },
  { id: 'dificil', label: 'Difícil', speed: 1.0, driftSkill: 1, startBoost: 0.75 },
];

/**
 * Orden de la parrilla por número de jugadores de este dispositivo (índice del kart → puesto de salida).
 * Un jugador sale 4.º; dos, 3.º y 4.º, uno al lado del otro; tres, del 3.º al 5.º; cuatro, del 3.º al 6.º.
 * La IA ocupa los puestos de delante.
 */
const GRID_SLOTS: Record<number, number[]> = {
  1: [3, 0, 1, 2, 4, 5],
  2: [3, 2, 0, 1, 4, 5],
  3: [2, 3, 4, 0, 1, 5],
  4: [2, 3, 4, 5, 0, 1],
};

/** Un jugador de este dispositivo y sus ayudas (en pantalla dividida, de dos a cuatro). */
export interface Pilot {
  kart: Kart;
  assist: AssistOpts;
  autoPower: boolean;
}

export class Race {
  phase: Phase = 'grid';
  time = 0;
  countdown = 0;
  /** Karts ordenados por posición. */
  order: Kart[] = [];
  doneAt = 0;
  private lastCount = 5;
  private finished = 0;
  private prevItem: boolean[] = [];
  private prevPower: boolean[] = [];
  private readonly ctx: AIContext = { order: [], level: 0, gums: [], hazards: [] };
  /** Para el poder automático del jugador: decide como un piloto atento. */
  private readonly playerCtx: AIContext = { order: [], level: 2, gums: [], hazards: [] };
  private readonly assisted: KartCtl[] = [];
  /** Jugadores de este dispositivo; `update` recibe un control por cada uno, en el mismo orden. */
  pilots: Pilot[];
  /** Obstáculos de la pista (patitos): la IA y la dirección asistida los esquivan. */
  hazards: readonly Hazard[] = [];
  /** false en los invitados: el anfitrión decide los puestos de llegada. */
  authority = true;
  /** Un kart de este dispositivo cruzó la meta (invitado: avisar al anfitrión). */
  onLocalFinish: (k: Kart) => void = () => {};
  /** El anfitrión asignó un puesto (para avisar a los invitados). */
  onPlace: (k: Kart) => void = () => {};

  constructor(
    readonly karts: Kart[],
    readonly ais: AIDriver[],
    readonly laps: number,
    readonly cpu: CpuLevel,
    public autoplay: boolean,
    private rng: Rng,
    readonly arena: Arena,
    /** En red, la parrilla sigue el orden común (slot) en todos los dispositivos. */
    private gridBySlot = false,
  ) {
    this.pilots = [{ kart: karts[0], assist: { autoAccel: false, smartSteer: false }, autoPower: false }];
    this.placeOnGrid();
    arena.reset(karts, () => this.order);
    this.ctx.level = CPU_LEVELS.indexOf(cpu);
  }

  get player(): Kart {
    return this.karts[0];
  }

  placeOnGrid(): void {
    const tr = this.karts[0].track;
    const table = GRID_SLOTS[this.karts.filter((x) => x.isPlayer).length] ?? GRID_SLOTS[1];
    this.karts.forEach((k, n) => {
      const slot = this.gridBySlot ? k.slot : table[n] ?? n;
      const row = Math.floor(slot / 2);
      const col = slot % 2;
      const i = tr.N - 5 - row * 6;
      const s = tr.samples[i];
      k.placeAt(i, (col ? 1 : -1) * s.hw * 0.42);
      k.speedMult = k.isPlayer ? 1 : this.cpu.speed;
    });
    this.order = [...this.karts];
    this.phase = 'grid';
    this.time = 0;
    this.finished = 0;
  }

  start(): void {
    this.phase = 'countdown';
    this.countdown = 4;
    this.lastCount = 5;
  }

  /** `ctls[i]`: mando del piloto `pilots[i]`. */
  update(dt: number, ctls: readonly KartCtl[], cam: import('three').Camera): void {
    this.arena.update(dt, this.phase === 'racing' || this.phase === 'done', cam);
    if (this.phase === 'grid') {
      for (const k of this.karts) {
        if (k.remote) k.netUpdate(dt);
        else k.update(dt, NO_CTL, false);
      }
      return;
    }
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n < this.lastCount && n >= 1 && n <= 3) bus.emit('race:countdown', { n });
      this.lastCount = n;
      this.pilots.forEach((pl, i) => {
        const k = pl.kart;
        const pc = this.autoplay ? this.ais[k.index].drive(k, dt, false) : ctls[i] ?? NO_CTL;
        // Turbo de salida: mantener el acelerador durante el último segundo (ni antes ni después).
        // Con aceleración automática, el turbo de salida llega solo en el último segundo (ayuda para los peques).
        const autoHold = pl.assist.autoAccel && !this.autoplay && this.countdown < 0.75;
        if (pc.throttle > 0.5 || autoHold) k.startHold += dt;
        else k.startHold = 0;
      });
      for (const k of this.karts) {
        if (k.remote) k.netUpdate(dt);
        else k.update(dt, NO_CTL, false);
      }
      if (this.countdown <= 0) {
        this.phase = 'racing';
        bus.emit('race:go');
        for (const { kart: k } of this.pilots) {
          const h = k.startHold;
          if ((this.autoplay && this.rng.chance(0.5)) || (!this.autoplay && h > 0.15 && h < 1.1)) k.boost('start', TUNING.startBoost);
        }
        for (const k of this.karts) if (!k.isPlayer && this.rng.chance(this.cpu.startBoost)) k.boost('start', TUNING.startBoost * 0.8);
      }
      return;
    }

    this.time += dt;
    this.ctx.order = this.order;
    this.ctx.gums = this.arena.activeGums;
    this.ctx.hazards = this.playerCtx.hazards = this.hazards;
    for (let n = 0; n < this.karts.length; n++) {
      const k = this.karts[n];
      if (k.remote) {
        k.netUpdate(dt);
        continue;
      }
      const pi = this.pilots.findIndex((p) => p.kart === k);
      const pl = this.pilots[pi];
      const useAi = !pl || this.autoplay || k.finished;
      let ctl = useAi ? this.ais[n].drive(k, dt, true, this.ctx) : ctls[pi] ?? NO_CTL;
      if (!useAi) {
        ctl = applyAssist(k, ctl, pl.assist, (this.assisted[pi] ??= { ...NO_CTL }), this.hazards);
        if (pl.autoPower && k.power >= 1) {
          this.playerCtx.order = this.order;
          this.playerCtx.gums = this.ctx.gums;
          const ai = this.ais[n].drive(k, dt, true, this.playerCtx);
          ctl.power ||= ai.power;
        }
      }
      k.assisted = !useAi && pl.assist.smartSteer;
      k.update(dt, ctl, true);
      if (ctl.item && !this.prevItem[n] && !k.finished) this.arena.useItem(k);
      if (ctl.power && !this.prevPower[n] && !k.finished) this.arena.usePower(k);
      this.prevItem[n] = ctl.item;
      this.prevPower[n] = ctl.power;
    }
    this.collide();
    for (const k of this.karts) {
      if (!k.finished && !k.remote && k.lap > this.laps) {
        k.finished = true;
        k.finishTime = this.time;
        if (this.authority) this.assignPlace(k, this.time);
        else this.onLocalFinish(k);
      }
    }
    this.order = [...this.karts].sort((a, b) => {
      if (a.finished && b.finished) return (a.place || 99) - (b.place || 99) || a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
    this.order.forEach((k, i) => (k.position = i + 1));

    // Ayuda a rezagados: la IA acelera un poco si va detrás del jugador y afloja si va muy por delante.
    // Con varios jugadores, la referencia es el promedio de todos.
    const N = this.player.track.N;
    const ref = this.pilots.reduce((a, p) => a + p.kart.progress, 0) / this.pilots.length;
    for (const k of this.karts) {
      if (k.isPlayer) continue;
      const gap = (ref - k.progress) / N; // vueltas que el jugador le saca
      const band = gap > 0 ? Math.min(0.1, gap * 0.25) : Math.max(-0.16, gap * 0.45);
      k.speedMult = this.cpu.speed * (1 + band);
    }

    if (this.phase === 'racing' && this.pilots.every((p) => p.kart.finished)) {
      this.phase = 'done';
      this.doneAt = this.time;
      bus.emit('race:done');
    }
  }

  /** Anfitrión: da el siguiente puesto libre (también a los invitados cuando avisan). */
  assignPlace(k: Kart, time: number): void {
    if (k.place) return;
    k.finished = true;
    k.finishTime = time;
    k.place = ++this.finished;
    bus.emit('kart:finish', { kart: k.index, place: k.place, time });
    this.onPlace(k);
  }

  /** Invitado: el anfitrión comunicó el puesto de un kart. */
  setPlace(k: Kart, place: number, time: number): void {
    if (k.place) return;
    k.finished = true;
    k.finishTime = time;
    k.place = place;
    this.finished = Math.max(this.finished, place);
    bus.emit('kart:finish', { kart: k.index, place, time });
  }

  private collide(): void {
    const R = TUNING.radius * 2;
    const ks = this.karts;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i];
        const b = ks[j];
        if (Math.abs(a.pos.y - b.pos.y) > 1.6) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const nz = dz / d;
        const push = (R - d) / 2;
        a.pos.x -= nx * push;
        a.pos.z -= nz * push;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rv < 0) {
          const imp = -rv * 0.75;
          a.vel.x -= nx * imp * 0.5;
          a.vel.z -= nz * imp * 0.5;
          b.vel.x += nx * imp * 0.5;
          b.vel.z += nz * imp * 0.5;
          if (imp > 3) {
            bus.emit('kart:bump', { kart: a.index, strength: imp, wall: false });
            bus.emit('kart:bump', { kart: b.index, strength: imp, wall: false });
          }
        }
      }
    }
  }
}
