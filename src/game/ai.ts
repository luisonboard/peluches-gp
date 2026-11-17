// Piloto automático: sigue una línea con desplazamiento lateral variable, se cierra hacia el interior
// de las curvas, derrapa en las cerradas y sabe salir marcha atrás si se atasca.
import type { Rng } from '../core/rng';
import type { Kart, KartCtl } from './kart';
import { wrapAngle } from './kart';

/** Lo que la IA necesita saber de la carrera para decidir objetos y poderes. */
export interface AIContext {
  order: Kart[];
  /** 0 = fácil, 1 = normal, 2 = difícil. */
  level: number;
  gums: { x: number; z: number }[];
}

export class AIDriver {
  private offset = 0;
  private target = 0;
  private changeT = 0;
  private stuckT = 0;
  private reverseT = 0;
  private holdDrift = false;
  private holdT = 0;
  private readonly ctl: KartCtl = { steer: 0, throttle: 0, brake: 0, drift: false, item: false, power: false };
  private itemWait = -1;
  private powerWait = -1;
  private itemHeld = 0;
  private powerHeld = 0;

  /** `driftSkill` 0..1: cuántas veces aprovecha los derrapes. */
  constructor(private rng: Rng, public driftSkill: number) {}

  drive(k: Kart, dt: number, active: boolean, ctx?: AIContext): KartCtl {
    const tr = k.track;
    const S = tr.samples;
    const N = tr.N;
    this.changeT -= dt;
    if (this.changeT <= 0) {
      this.target = this.rng.range(-0.45, 0.45);
      this.changeT = this.rng.range(1.5, 4.5);
    }
    this.offset += (this.target - this.offset) * Math.min(1, dt * 0.8);
    const look = Math.round(7 + Math.abs(k.speed) * 0.5);
    const s = S[(k.idx + look) % N];
    const cAhead = S[(k.idx + Math.round(look * 1.6) + 6) % N].curv;
    const inside = Math.sign(cAhead) * Math.min(0.55, Math.abs(cAhead) * 18);
    const latN = Math.max(-0.7, Math.min(0.7, this.offset + inside));
    const tx = s.x + s.nx * latN * s.hw;
    const tz = s.z + s.nz * latN * s.hw;
    const want = Math.atan2(tx - k.pos.x, tz - k.pos.z);
    const diff = wrapAngle(want - k.heading);
    const steer = Math.max(-1, Math.min(1, -diff * 2.6));
    let throttle = 1;
    let brake = 0;
    if (Math.abs(diff) > 1.1 && k.speed > 14) {
      throttle = 0;
      brake = 0.6;
    }

    // Derrape en curvas cerradas.
    const cNear = S[(k.idx + 12) % N].curv;
    if (!this.holdDrift) {
      if (Math.abs(cNear) > 0.03 && k.speed > 20 && k.grounded && this.rng.next() < this.driftSkill * dt * 6) {
        this.holdDrift = true;
        this.holdT = 0;
      }
    } else {
      this.holdT += dt;
      const straight = Math.abs(S[(k.idx + 4) % N].curv) < 0.012;
      if ((k.drift !== 0 && (straight || k.driftLevel >= 3)) || (k.drift === 0 && this.holdT > 0.5)) this.holdDrift = false;
    }

    // Atasco: marcha atrás un segundo.
    if (active && Math.abs(k.speed) < 2 && !k.finished) this.stuckT += dt;
    else this.stuckT = 0;
    if (this.stuckT > 1.2) {
      this.reverseT = 1;
      this.stuckT = 0;
    }
    const c = this.ctl;
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      c.steer = -steer;
      c.throttle = 0;
      c.brake = 1;
      c.drift = false;
      return c;
    }
    c.steer = steer;
    c.throttle = throttle;
    c.brake = brake;
    c.drift = this.holdDrift;
    c.item = false;
    c.power = false;
    if (ctx && active && !k.finished) this.decide(k, dt, ctx, c);
    return c;
  }

  /** Decide cuándo usar el objeto y el poder. Pulsa un solo cuadro (la carrera detecta el flanco). */
  private decide(k: Kart, dt: number, ctx: AIContext, c: KartCtl): void {
    const tr = k.track;
    const step = tr.step;
    const react = [this.rng.range(2, 4), this.rng.range(0.8, 2), this.rng.range(0.2, 0.8)][ctx.level];
    const gapTo = (o: Kart): number => (o.progress - k.progress) * step; // + = va delante
    const ahead = ctx.order[ctx.order.indexOf(k) - 1] ?? null;
    const behind = ctx.order[ctx.order.indexOf(k) + 1] ?? null;
    const straight = Math.abs(tr.samples[(k.idx + 20) % tr.N].curv) < 0.012;

    // Objeto.
    if (k.item && k.rouletteT <= 0) {
      if (this.itemWait < 0) this.itemWait = react;
      this.itemWait -= dt;
      this.itemHeld += dt;
      if (this.itemWait <= 0) {
        let use = false;
        if (k.item === 'turbo') use = straight || k.position >= 4 || this.itemHeld > 8;
        else if (k.item === 'pelota') use = (!!ahead && gapTo(ahead) < 38 && Math.abs(ahead.lat - k.lat) < 4) || this.itemHeld > 10;
        else use = (!!behind && -gapTo(behind) < 22) || this.itemHeld > 8;
        if (use) {
          c.item = true;
          this.itemWait = -1;
          this.itemHeld = 0;
        }
      }
    } else {
      this.itemWait = -1;
      this.itemHeld = 0;
    }

    // Poder. En fácil, nunca en la primera vuelta.
    if (k.power >= 1 && !(ctx.level === 0 && k.lap < 2)) {
      if (this.powerWait < 0) this.powerWait = react * 1.5;
      this.powerWait -= dt;
      this.powerHeld += dt;
      if (this.powerWait <= 0) {
        const near = ctx.order.some((o) => o !== k && Math.hypot(o.pos.x - k.pos.x, o.pos.z - k.pos.z) < 13);
        let use = false;
        switch (k.char.id) {
          case 'perro':
            use = near;
            break;
          case 'esponja':
            use = !!ahead && gapTo(ahead) < 110;
            break;
          case 'robot':
            // El brazo alcanza unos 80 m de ventaja; si va primero, se jala de la pista en una recta.
            use = ahead ? gapTo(ahead) < 80 : straight;
            break;
          case 'raton':
            use = k.position >= (ctx.level === 2 ? 2 : 3);
            break;
          case 'zorro':
            use = straight || k.position >= 3;
            break;
          case 'dino':
            use = near || ctx.gums.some((g) => Math.hypot(g.x - k.pos.x, g.z - k.pos.z) < 30);
            break;
        }
        if (use || this.powerHeld > 14) {
          c.power = true;
          this.powerWait = -1;
          this.powerHeld = 0;
        }
      }
    } else {
      this.powerWait = -1;
      this.powerHeld = 0;
    }
  }
}
