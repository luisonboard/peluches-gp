// Física arcade del kart: aceleración exponencial, derrape con saltito y miniturbo de 3 niveles,
// barreras que frenan y enderezan, saltos naturales en las crestas, vueltas y sentido contrario.
import * as THREE from 'three';
import { bus, type HitKind, type ItemId } from '../core/events';
import type { Track, Surface } from './track';
import { newLoc } from './track';
import type { CharacterDef } from './characters';
import type { KartModel } from './kartModel';

export interface KartCtl {
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
  item: boolean;
  power: boolean;
}

export const NO_CTL: KartCtl = { steer: 0, throttle: 0, brake: 0, drift: false, item: false, power: false };

/** Duración (s) de cada golpe. */
export const HIT_TIME: Record<HitKind, number> = { spin: 1.15, stuck: 1.4, bubble: 2.0, shrink: 3.0, tumble: 0.9 };

/** Ajustable en vivo desde DevTools: __game.TUNING. */
export const TUNING = {
  maxSpeed: 30,
  accel: 1.15,
  brake: 40,
  reverseMax: 9,
  reverseAccel: 16,
  drag: 0.45,
  turnRate: 2.15,
  driftMinSpeed: 11,
  driftTurnBase: 1.3,
  driftTurnRange: 0.85,
  grip: 11,
  gripDrift: 3.4,
  offroadMax: 0.55,
  boostMult: 1.4,
  slopeGrav: 9,
  gravity: 30,
  hopVel: 5.2,
  /** Carga necesaria (s) para cada nivel de miniturbo: azul, naranja, rosa. */
  miniLevels: [0.7, 1.5, 2.5],
  miniBoost: [0.55, 0.95, 1.4],
  padBoost: 1.15,
  startBoost: 1.3,
  radius: 1.15,
  wallBounce: 0.25,
};

export const wrapAngle = (a: number): number => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class Kart {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  heading = 0;
  speed = 0;
  vy = 0;
  grounded = true;
  groundY = 0;
  steerS = 0;
  /** -1 / 0 / 1: dirección del derrape en curso. */
  drift = 0;
  driftCharge = 0;
  driftLevel = 0;
  driftVisual = 0;
  boostT = 0;
  speedMult = 1;
  idx = 0;
  f = 0;
  lat = 0;
  slope = 0;
  surface: Surface = 'floor';
  offroad = false;
  lap = 0;
  checkpoint = false;
  progress = 0;
  finished = false;
  finishTime = 0;
  place = 0;
  position = 1;
  wrongWayT = 0;
  startHold = 0;
  landSquash = 0;
  lastLapTime = 0;
  // --- Objetos, poder y golpes ---
  item: ItemId | null = null;
  /** Ruleta de la caja regalo en curso (s). */
  rouletteT = 0;
  /** Barra de poder 0..1. */
  power = 0;
  hitKind: HitKind | '' = '';
  hitT = 0;
  hitDur = 1;
  invulnT = 0;
  shrinkT = 0;
  fireT = 0;
  /** El Pisotón de Dino espera a aterrizar. */
  stompPending = false;
  /** Multiplicador de la duración de los golpes (perfil "Peque": menos de 1). */
  hitScale = 1;
  /** Carga del miniturbo (la dirección asistida la hace más lenta). */
  driftChargeMult = 1;
  /** La dirección asistida está activa (muestra la estrella guía). */
  assisted = false;
  /** Ángulo visual del trompo. */
  spinVisual = 0;
  bubbleLift = 0;
  shrinkScale = 1;
  blinkT = 0;
  private prevDrift = false;
  private hopDrift = false;
  private bumpCooldown = 0;
  private padCooldown = 0;
  private readonly loc = newLoc();

  constructor(
    readonly index: number,
    readonly char: CharacterDef,
    readonly isPlayer: boolean,
    readonly model: KartModel,
    readonly track: Track,
  ) {}

  placeAt(i: number, lat: number): void {
    const N = this.track.N;
    const s = this.track.samples[((i % N) + N) % N];
    this.pos.set(s.x + s.nx * lat, s.y, s.z + s.nz * lat);
    this.heading = Math.atan2(s.tx, s.tz);
    this.vel.set(0, 0, 0);
    this.speed = this.vy = 0;
    this.grounded = true;
    this.groundY = s.y;
    this.idx = ((i % N) + N) % N;
    this.lap = 0;
    this.checkpoint = false;
    this.finished = false;
    this.place = 0;
    this.drift = this.driftCharge = this.driftLevel = this.driftVisual = 0;
    this.boostT = this.startHold = this.wrongWayT = 0;
    this.item = null;
    this.rouletteT = this.power = this.hitT = this.invulnT = this.shrinkT = this.fireT = 0;
    this.hitKind = '';
    this.stompPending = false;
    this.spinVisual = this.bubbleLift = 0;
    this.shrinkScale = 1;
    this.track.locate(this.pos.x, this.pos.z, this.idx, this.loc);
    this.progress = this.idx + this.loc.f;
    this.syncModel(0);
  }

  boost(kind: 'mini' | 'pad' | 'start', seconds: number): void {
    if (this.boostT < seconds) this.boostT = seconds;
    bus.emit('kart:boost', { kart: this.index, kind, seconds });
  }

  /** Aplica un golpe. Devuelve false si el kart es invulnerable (fuego o recién golpeado). */
  applyHit(kind: HitKind, by: number): boolean {
    if (this.invulnT > 0 || this.fireT > 0 || this.finished) return false;
    if (kind === 'shrink') {
      this.shrinkT = HIT_TIME.shrink * this.hitScale;
      this.invulnT = 0.6;
    } else {
      this.hitKind = kind;
      this.hitDur = this.hitT = HIT_TIME[kind] * this.hitScale;
      this.invulnT = this.hitT + 1.2;
      this.boostT = 0;
      if (this.drift !== 0) this.endDrift(false);
      if (kind === 'tumble') {
        this.grounded = false;
        this.vy = 6.5;
      }
    }
    bus.emit('kart:hit', { kart: this.index, kind, by });
    return true;
  }

  private endDrift(release: boolean): void {
    if (release && this.driftLevel > 0) this.boost('mini', TUNING.miniBoost[this.driftLevel - 1]);
    this.drift = this.driftCharge = this.driftLevel = 0;
  }

  update(dt: number, c: KartCtl, active: boolean): void {
    const T = TUNING;
    const tr = this.track;
    // Golpes: el trompo, la burbuja y la voltereta quitan el control; el chicle solo frena.
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) this.hitKind = '';
    }
    const disabled = this.hitT > 0 && this.hitKind !== 'stuck';
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.shrinkT > 0) this.shrinkT -= dt;
    if (this.fireT > 0) this.fireT -= dt;
    const steerIn = active && !disabled ? c.steer : 0;
    this.steerS += (steerIn - this.steerS) * Math.min(1, dt * 12);
    const throttle = active && !disabled ? c.throttle : 0;
    const brake = active && !disabled ? c.brake : 0;

    // Saltito y derrape.
    const driftHeld = active && !disabled && c.drift;
    if (driftHeld && !this.prevDrift && this.grounded) {
      this.grounded = false;
      this.vy = T.hopVel + Math.max(0, this.vy);
      this.hopDrift = true;
      bus.emit('kart:hop', { kart: this.index });
    }
    this.prevDrift = driftHeld;
    if (!driftHeld) this.hopDrift = false;
    if (this.drift === 0 && this.hopDrift && Math.abs(this.steerS) > 0.25 && this.speed > T.driftMinSpeed) {
      this.drift = Math.sign(this.steerS);
      this.driftCharge = this.driftLevel = 0;
    }
    if (this.drift !== 0 && !driftHeld) this.endDrift(true);
    else if (this.drift !== 0 && this.speed < T.driftMinSpeed * 0.7) this.endDrift(false);
    if (this.drift !== 0 && this.grounded) {
      const into = Math.max(0, this.steerS * this.drift);
      this.driftCharge += dt * (0.85 + 0.6 * into) * (this.offroad ? 0.4 : 1) * this.driftChargeMult;
      let lvl = 0;
      for (const th of T.miniLevels) if (this.driftCharge >= th) lvl++;
      if (lvl > this.driftLevel) {
        this.driftLevel = lvl;
        bus.emit('kart:drift', { kart: this.index, level: lvl });
      }
    }

    // Velocidad.
    let maxS = T.maxSpeed * this.speedMult;
    if (this.offroad) maxS *= T.offroadMax;
    if (this.boostT > 0) {
      this.boostT -= dt;
      maxS = T.maxSpeed * this.speedMult * T.boostMult;
    }
    if (this.fireT > 0) maxS = T.maxSpeed * this.speedMult * 1.5;
    if (this.shrinkT > 0) maxS *= 0.62;
    if (this.hitKind === 'stuck') maxS *= 0.3;
    const surging = (this.boostT > 0 || this.fireT > 0) && !disabled;
    if (disabled) this.speed *= Math.exp(-(this.hitKind === 'bubble' ? 4 : 2.6) * dt);
    if (this.grounded && !disabled) {
      if (surging) this.speed += (maxS - this.speed) * Math.min(1, dt * 5);
      else if (throttle > 0.05) {
        const target = maxS * throttle;
        if (this.speed < 0) this.speed += T.brake * dt;
        else if (this.speed < target) this.speed += (target - this.speed) * T.accel * dt;
        else this.speed += (target - this.speed) * Math.min(1, dt * 1.6);
      } else if (brake > 0.05) {
        if (this.speed > 0.5) this.speed -= T.brake * brake * dt;
        else this.speed = Math.max(-T.reverseMax, this.speed - T.reverseAccel * brake * dt);
      } else {
        this.speed -= this.speed * T.drag * dt;
        if (Math.abs(this.speed) < 0.3) this.speed = 0;
      }
      this.speed -= this.slope * T.slopeGrav * dt;
      if (!active) this.speed *= Math.max(0, 1 - dt * 8);
    }

    // Giro.
    const sp = Math.abs(this.speed);
    let yawRate: number;
    if (this.drift !== 0) {
      yawRate = this.drift * (T.driftTurnBase + T.driftTurnRange * this.steerS * this.drift) * Math.min(1, sp / 10);
    } else {
      const low = Math.min(1, sp / 5);
      const high = 1 - 0.3 * Math.min(1, sp / T.maxSpeed);
      yawRate = this.steerS * T.turnRate * low * high * (this.speed < 0 ? -1 : 1);
    }
    if (!this.grounded) yawRate *= 0.6;
    this.heading = wrapAngle(this.heading - yawRate * dt);

    // Velocidad real: se acerca a la dirección del morro según el agarre (en derrape, desliza).
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const grip = !this.grounded ? 0.6 : this.drift !== 0 ? T.gripDrift : T.grip;
    const kf = 1 - Math.exp(-grip * dt);
    this.vel.x += (fx * this.speed - this.vel.x) * kf;
    this.vel.z += (fz * this.speed - this.vel.z) * kf;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // Suelo y saltos.
    const L = tr.locate(this.pos.x, this.pos.z, this.idx, this.loc);
    const gy = L.y;
    if (this.grounded) {
      const roadVy = (gy - this.groundY) / Math.max(dt, 1e-3);
      const ballistic = this.vy - T.gravity * dt;
      if (roadVy < ballistic - 0.2 && sp > 14) {
        this.grounded = false;
        this.vy = ballistic;
        this.pos.y += this.vy * dt;
      } else {
        this.vy = roadVy;
        this.pos.y = gy;
      }
    } else {
      this.vy -= T.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gy) {
        const impact = -this.vy;
        this.pos.y = gy;
        this.grounded = true;
        this.vy = 0;
        if (impact > 3) {
          this.landSquash = Math.min(1, impact / 12);
          bus.emit('kart:land', { kart: this.index, strength: impact });
        }
      }
    }
    this.groundY = gy;

    // Barreras.
    const wallLat = L.hw + tr.shoulder + 0.05 - T.radius * 0.8;
    const al = Math.abs(L.lat);
    // Con dirección asistida, las barreras están "acolchadas": se frena el deslizamiento hacia ellas antes del golpe.
    if (this.assisted && al > wallLat - 2.5) {
      const sgn = Math.sign(L.lat);
      const vn = (this.vel.x * L.nx + this.vel.z * L.nz) * sgn;
      if (vn > 0) {
        const k = 1 - Math.exp(-9 * dt * Math.min(1, (al - (wallLat - 2.5)) / 2.5 + 0.3));
        this.vel.x -= L.nx * sgn * vn * k;
        this.vel.z -= L.nz * sgn * vn * k;
      }
    }
    if (al > wallLat) {
      const sgn = Math.sign(L.lat);
      const push = al - wallLat;
      this.pos.x -= L.nx * sgn * push;
      this.pos.z -= L.nz * sgn * push;
      const vn = (this.vel.x * L.nx + this.vel.z * L.nz) * sgn;
      if (vn > 0) {
        this.vel.x -= L.nx * sgn * vn * (1 + T.wallBounce);
        this.vel.z -= L.nz * sgn * vn * (1 + T.wallBounce);
        this.speed *= 1 - Math.min(0.55, (vn / Math.max(8, sp)) * 0.8);
        const tang = Math.atan2(L.tx, L.tz);
        const fwdDot = fx * L.tx + fz * L.tz;
        const along = fwdDot >= 0 ? tang : wrapAngle(tang + Math.PI);
        this.heading = wrapAngle(this.heading + wrapAngle(along - this.heading) * Math.min(0.5, vn * 0.04));
        if (vn > 5 && this.bumpCooldown <= 0) {
          bus.emit('kart:bump', { kart: this.index, strength: vn, wall: true });
          this.bumpCooldown = 0.3;
        }
        if (vn > 10 && this.drift !== 0) this.endDrift(false);
      }
      L.lat = sgn * wallLat;
    }
    this.bumpCooldown -= dt;
    this.lat = L.lat;
    this.offroad = Math.abs(L.lat) > L.hw + 1.0;
    this.surface = L.surface;
    this.slope = L.slope;

    // Placas de turbo.
    if (this.padCooldown > 0) this.padCooldown -= dt;
    if (this.grounded && this.padCooldown <= 0) {
      for (const p of tr.pads) {
        let d = L.i - p.i;
        if (d < 0) d += tr.N;
        if (d < p.len && Math.abs(L.lat - p.lat) < p.hw) {
          this.boost('pad', T.padBoost);
          this.padCooldown = 0.5;
          break;
        }
      }
    }

    // Vueltas: cruzar la meta hacia delante cuenta si se pasó por la mitad de la pista.
    const N = tr.N;
    const prev = this.idx;
    const now = L.i;
    if (prev > N * 0.8 && now < N * 0.2) {
      if (this.lap === 0 || this.checkpoint) {
        this.lap++;
        this.checkpoint = false;
        bus.emit('kart:lap', { kart: this.index, lap: this.lap });
      }
    } else if (prev < N * 0.2 && now > N * 0.8 && this.lap > 0) {
      this.lap--;
      this.checkpoint = true;
    }
    if (now > N * 0.45 && now < N * 0.55) this.checkpoint = true;
    this.idx = now;
    this.f = L.f;
    this.progress = this.lap * N + now + L.f;

    // Sentido contrario.
    const fwdDot = fx * L.tx + fz * L.tz;
    if ((fwdDot < -0.3 && this.speed > 3) || (fwdDot > 0.3 && this.speed < -3)) this.wrongWayT += dt;
    else this.wrongWayT = Math.max(0, this.wrongWayT - dt * 2);

    this.syncModel(dt);
  }

  private syncModel(dt: number): void {
    this.driftVisual += (this.drift * 0.38 - this.driftVisual) * Math.min(1, dt * 8);
    // Trompo: dos vueltas completas con frenado suave (termina mirando hacia delante, sin saltos).
    if ((this.hitKind === 'spin' || this.hitKind === 'tumble') && this.hitT > 0) {
      const u = 1 - this.hitT / this.hitDur;
      this.spinVisual = Math.PI * 4 * (1 - (1 - u) * (1 - u));
    } else this.spinVisual = 0;
    const lift = this.hitKind === 'bubble' && this.hitT > 0 ? 1.6 + Math.sin(this.hitT * 5) * 0.25 : 0;
    this.bubbleLift += (lift - this.bubbleLift) * Math.min(1, dt * 5);
    const sc = this.shrinkT > 0 ? 0.55 : 1;
    this.shrinkScale += (sc - this.shrinkScale) * Math.min(1, dt * 7);
    this.blinkT += dt;
    this.landSquash = Math.max(0, this.landSquash - dt * 4);
    this.model.update(this, dt);
  }
}
