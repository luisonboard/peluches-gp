// Cámaras: persecución detrás del kart, órbita para el título y vista cenital de depuración (?cam=top).
import * as THREE from 'three';
import type { Kart } from './kart';
import { TUNING, wrapAngle } from './kart';
import type { Track } from './track';

export class ChaseCam {
  private yaw = 0;
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private init = false;
  private shakeT = 0;
  private shakeAmp = 0;
  private fov = 68;
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  constructor(private cam: THREE.PerspectiveCamera) {}

  reset(): void {
    this.init = false;
  }

  shake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = 0.3;
  }

  update(dt: number, k: Kart): void {
    const target = k.heading - k.driftVisual * 0.35;
    if (!this.init) this.yaw = target;
    this.yaw = wrapAngle(this.yaw + wrapAngle(target - this.yaw) * Math.min(1, dt * 7));
    const sp01 = Math.min(1.3, Math.abs(k.speed) / TUNING.maxSpeed);
    const bx = Math.sin(this.yaw);
    const bz = Math.cos(this.yaw);
    const dist = 6.4 + sp01 * 0.9;
    const desired = this.desired.set(k.pos.x - bx * dist, k.pos.y + 2.6, k.pos.z - bz * dist);
    const lookAt = this.lookAt.set(k.pos.x + bx * 3.5, k.pos.y + 1.2, k.pos.z + bz * 3.5);
    if (!this.init) {
      this.pos.copy(desired);
      this.look.copy(lookAt);
      this.init = true;
    }
    const kh = 1 - Math.exp(-14 * dt);
    const kv = 1 - Math.exp(-6 * dt);
    this.pos.x += (desired.x - this.pos.x) * kh;
    this.pos.z += (desired.z - this.pos.z) * kh;
    this.pos.y += (desired.y - this.pos.y) * kv;
    this.pos.y = Math.max(this.pos.y, k.groundY + 1.2);
    this.look.lerp(lookAt, 1 - Math.exp(-18 * dt));
    this.cam.position.copy(this.pos);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * (this.shakeT / 0.3);
      this.cam.position.x += (Math.random() - 0.5) * a;
      this.cam.position.y += (Math.random() - 0.5) * a;
    } else this.shakeAmp = 0;
    this.cam.lookAt(this.look);
    const targetFov = 68 + Math.min(1, sp01) * 8 + (k.boostT > 0 ? 7 : 0);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) {
      this.cam.fov = this.fov;
      this.cam.updateProjectionMatrix();
    }
  }
}

/** Plano del título: órbita lenta alrededor de la parrilla. */
export function orbitCam(cam: THREE.PerspectiveCamera, track: Track, t: number): void {
  const s = track.samples[track.N - 14];
  const a = t * 0.1 + 2.2;
  cam.position.set(s.x + Math.cos(a) * 26, 8 + Math.sin(t * 0.2) * 1.5, s.z + Math.sin(a) * 26);
  cam.lookAt(s.x, 1.5, s.z);
  if (cam.fov !== 55) {
    cam.fov = 55;
    cam.updateProjectionMatrix();
  }
}

export function topCam(cam: THREE.PerspectiveCamera, track: Track): void {
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  cam.position.set(cx, 420, cz + 1);
  cam.lookAt(cx, 0, cz);
  if (cam.fov !== 50) {
    cam.fov = 50;
    cam.updateProjectionMatrix();
  }
}
