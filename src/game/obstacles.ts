// Obstáculos que cruzan la pista de lado a lado: patitos de goma gigantes.
// Su posición depende solo del tiempo de carrera, así que en línea todos los dispositivos los ven igual sin enviar nada.
// Un choque empuja y frena el kart, pero no lo hace girar (pensado para un piloto de 5 años).
import * as THREE from 'three';
import { bus } from '../core/events';
import type { Track, MoverDef } from './track';
import { TUNING, type Kart } from './kart';

/** Obstáculo visto desde la pista: muestra, posición lateral (m), velocidad lateral (m/s), radio y límite del vaivén. */
export interface Hazard {
  i: number;
  lat: number;
  vLat: number;
  r: number;
  range: number;
}

interface Mover {
  def: MoverDef;
  i: number;
  hazard: Hazard;
  x: number;
  y: number;
  z: number;
  root: THREE.Group;
}

export class Obstacles {
  readonly group = new THREE.Group();
  private movers: Mover[] = [];
  /** Para la IA y la dirección asistida (se actualiza en el sitio cada cuadro). */
  readonly hazards: Hazard[] = [];
  /** Choques contra los patitos (para las pruebas). */
  hits = 0;

  constructor(private track: Track, shadows: boolean) {
    this.group.name = 'obstaculos';
    const defs = track.def.movers ?? [];
    if (!defs.length) return;
    for (const def of defs) {
      const root = new THREE.Group();
      const duck = makeDuck(shadows);
      root.add(duck);
      root.scale.setScalar(def.r / 1.6);
      this.group.add(root);
      const i = track.indexAtSeg(def.seg, def.f);
      const hazard: Hazard = { i, lat: 0, vLat: 0, r: def.r, range: 0 };
      this.hazards.push(hazard);
      this.movers.push({ def, i, hazard, x: 0, y: 0, z: 0, root });
    }
    this.update(0, []);
  }

  /** `t`: tiempo de carrera (el mismo en todos los dispositivos). Solo choca con los karts de este dispositivo. */
  update(t: number, karts: readonly Kart[]): void {
    const S = this.track.samples;
    for (const m of this.movers) {
      const s = S[m.i];
      const w = (Math.PI * 2) / m.def.period;
      const a = w * t + m.def.phase * Math.PI * 2;
      const range = m.def.amp * s.hw;
      const lat = range * Math.sin(a);
      const vLat = range * w * Math.cos(a);
      Object.assign(m.hazard, { lat, vLat, range });
      m.x = s.x + s.nx * lat;
      m.y = s.y;
      m.z = s.z + s.nz * lat;
      m.root.position.set(m.x, m.y + Math.abs(Math.sin(a * 3)) * 0.25, m.z);
      // Mira hacia donde camina (a lo ancho de la pista) y se balancea.
      const dir = vLat >= 0 ? 1 : -1;
      m.root.rotation.set(0, Math.atan2(s.nx * dir, s.nz * dir), Math.sin(a * 6) * 0.08);
      for (const k of karts) this.collide(m, k);
    }
  }

  private collide(m: Mover, k: Kart): void {
    if (k.remote || k.pos.y > m.y + m.def.r * 1.6) return;
    const dx = k.pos.x - m.x;
    const dz = k.pos.z - m.z;
    const minD = m.def.r + TUNING.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minD * minD) return;
    const d = Math.sqrt(d2) || 0.001;
    const nx = dx / d;
    const nz = dz / d;
    k.pos.x += nx * (minD - d);
    k.pos.z += nz * (minD - d);
    const vn = k.vel.x * nx + k.vel.z * nz;
    if (vn < 0) {
      k.vel.x -= nx * vn * 1.4;
      k.vel.z -= nz * vn * 1.4;
      k.speed *= 0.7;
      if (vn < -3) this.hits++;
      if (vn < -3) bus.emit('kart:bump', { kart: k.index, strength: -vn, wall: false });
    }
  }

  /** Posiciones para el minimapa y las pruebas. */
  get positions(): { x: number; z: number }[] {
    return this.movers.map((m) => ({ x: m.x, z: m.z }));
  }
}

/** Patito de goma (≈ 3,3 m de alto, mira hacia +Z). Materiales y geometrías propios: se liberan con su grupo. */
export function makeDuck(shadows: boolean): THREE.Group {
  const duck = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.35 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8a1a, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e2236, roughness: 0.3 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const sph = new THREE.SphereGeometry(1, 16, 12);
  const cone = new THREE.ConeGeometry(1, 1, 12);
  const part = (geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = shadows;
    duck.add(m);
    return m;
  };
  part(sph, yellow, 1.5, 1.1, 1.9, 0, 1.1, 0);
  part(sph, yellow, 1.0, 1.0, 1.0, 0, 2.6, 0.9);
  const beak = part(cone, orange, 0.45, 0.9, 0.25, 0, 2.45, 1.95);
  beak.rotation.x = Math.PI / 2;
  const tail = part(cone, yellow, 0.6, 0.9, 0.5, 0, 1.7, -1.8);
  tail.rotation.x = -Math.PI / 2.6;
  for (const s of [-1, 1]) {
    part(sph, white, 0.24, 0.28, 0.12, s * 0.42, 2.85, 1.78);
    part(sph, dark, 0.13, 0.17, 0.08, s * 0.42, 2.85, 1.86);
    part(sph, yellow, 0.35, 0.5, 1.0, s * 1.35, 1.35, -0.1); // alas
  }
  return duck;
}
