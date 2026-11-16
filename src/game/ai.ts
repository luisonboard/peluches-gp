// Piloto automático: sigue una línea con desplazamiento lateral variable, se cierra hacia el interior
// de las curvas, derrapa en las cerradas y sabe salir marcha atrás si se atasca.
import type { Rng } from '../core/rng';
import type { Kart, KartCtl } from './kart';
import { wrapAngle } from './kart';

export class AIDriver {
  private offset = 0;
  private target = 0;
  private changeT = 0;
  private stuckT = 0;
  private reverseT = 0;
  private holdDrift = false;
  private holdT = 0;
  private readonly ctl: KartCtl = { steer: 0, throttle: 0, brake: 0, drift: false };

  /** `driftSkill` 0..1: cuántas veces aprovecha los derrapes. */
  constructor(private rng: Rng, public driftSkill: number) {}

  drive(k: Kart, dt: number, active: boolean): KartCtl {
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
    return c;
  }
}
