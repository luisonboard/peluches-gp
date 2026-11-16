// Kart de juguete + piloto provisional (los peluches definitivos llegan en el hito 2).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterDef } from './characters';

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}
function mat(key: string, make: () => THREE.Material): THREE.Material {
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = make()));
  return m;
}
const plastic = (c: number): THREE.Material => mat(`p${c}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.38, metalness: 0.05 }));
const plush = (c: number): THREE.Material =>
  mat(`f${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.9, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.5) }));

export interface KartPose {
  heading: number;
  driftVisual: number;
  steerS: number;
  speed: number;
  slope: number;
  grounded: boolean;
  vy: number;
  landSquash: number;
  pos: THREE.Vector3;
  groundY: number;
}

export class KartModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private wheels: THREE.Object3D[] = [];
  private steerPivots: THREE.Object3D[] = [];
  private blob: THREE.Mesh | null = null;
  private wheelRot = 0;
  private pitch = 0;
  private roll = 0;

  constructor(char: CharacterDef, blobTex: THREE.Texture | null, castShadow: boolean) {
    const r = this.root;
    r.add(this.body);
    const b = this.body;
    // Chasis.
    const chassis = new THREE.Mesh(geo('chassis', () => new RoundedBoxGeometry(1.6, 0.5, 2.5, 3, 0.2)), plastic(char.kart));
    chassis.position.set(0, 0.55, 0);
    const nose = new THREE.Mesh(geo('nose', () => new RoundedBoxGeometry(1.2, 0.38, 0.9, 3, 0.16)), plastic(char.kart));
    nose.position.set(0, 0.5, 1.4);
    const bumper = new THREE.Mesh(geo('bumper', () => new RoundedBoxGeometry(1.9, 0.28, 0.32, 2, 0.12)), plastic(0x2a2d36));
    bumper.position.set(0, 0.42, 1.85);
    const seat = new THREE.Mesh(geo('seat', () => new RoundedBoxGeometry(1.0, 0.9, 0.35, 2, 0.14)), plastic(0x2a2d36));
    seat.position.set(0, 1.15, -0.75);
    const engine = new THREE.Mesh(geo('engine', () => new RoundedBoxGeometry(1.1, 0.55, 0.6, 2, 0.12)), plastic(0x9aa3ad));
    engine.position.set(0, 0.95, -1.15);
    b.add(chassis, nose, bumper, seat, engine);
    for (const sx of [-0.32, 0.32]) {
      const pipe = new THREE.Mesh(geo('pipe', () => new THREE.CylinderGeometry(0.13, 0.15, 0.55, 10)), plastic(0x9aa3ad));
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx, 0.9, -1.55);
      b.add(pipe);
    }
    const column = new THREE.Mesh(geo('column', () => new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8)), plastic(0x2a2d36));
    column.position.set(0, 1.05, 0.55);
    column.rotation.x = -0.6;
    const wheel = new THREE.Mesh(geo('swheel', () => new THREE.TorusGeometry(0.28, 0.06, 8, 20)), plastic(0x2a2d36));
    wheel.position.set(0, 1.3, 0.38);
    wheel.rotation.x = -0.6;
    b.add(column, wheel);
    // Ruedas.
    const tyreG = geo('tyre', () => new THREE.CylinderGeometry(0.42, 0.42, 0.42, 20).rotateZ(Math.PI / 2));
    const hubG = geo('hub', () => new THREE.CylinderGeometry(0.22, 0.22, 0.46, 12).rotateZ(Math.PI / 2));
    for (const [x, z, front] of [[-0.95, 0.95, true], [0.95, 0.95, true], [-0.95, -0.95, false], [0.95, -0.95, false]] as const) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.42, z);
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(tyreG, plastic(0x22242b)), new THREE.Mesh(hubG, plastic(char.accent === 0x2a2a35 ? 0xffd23a : 0xf4f1ea)));
      pivot.add(spin);
      b.add(pivot);
      this.wheels.push(spin);
      if (front) this.steerPivots.push(pivot);
    }
    b.add(this.buildDriver(char));
    if (blobTex) {
      this.blob = new THREE.Mesh(
        geo('blob', () => new THREE.PlaneGeometry(2.6, 3.4).rotateX(-Math.PI / 2)),
        mat('blob', () => new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })),
      );
      this.blob.renderOrder = 1;
      r.add(this.blob);
    }
    r.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o !== this.blob) {
        (o as THREE.Mesh).castShadow = castShadow;
      }
    });
  }

  /** Piloto provisional: cuerpo y cabeza de peluche con rasgos básicos de cada especie. */
  private buildDriver(c: CharacterDef): THREE.Group {
    const d = new THREE.Group();
    d.position.set(0, 0.9, -0.35);
    const fur = plush(c.color);
    const acc = plush(c.accent);
    const sphere = geo('sph', () => new THREE.SphereGeometry(1, 24, 16));
    const cone = geo('cone', () => new THREE.ConeGeometry(1, 1, 16));
    const add = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], s: [number, number, number], rot?: [number, number, number]): THREE.Mesh => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(...p);
      mesh.scale.set(...s);
      if (rot) mesh.rotation.set(...rot);
      d.add(mesh);
      return mesh;
    };
    add(sphere, fur, [0, 0.45, 0], [0.55, 0.6, 0.5]);
    let headY = 1.3;
    if (c.id === 'esponja' || c.id === 'robot') {
      const box = geo(`head-${c.id}`, () => new RoundedBoxGeometry(1.15, 1.2, 0.75, 3, c.id === 'esponja' ? 0.18 : 0.1));
      add(box, c.id === 'esponja' ? fur : plastic(c.color), [0, 1.35, 0], [1, 1, 1]);
      headY = 1.35;
      if (c.id === 'esponja') {
        for (const [x, y] of [[-0.35, 1.7], [0.4, 1.05], [-0.25, 0.95], [0.42, 1.75]]) add(sphere, acc, [x, y, 0.37], [0.09, 0.09, 0.03]);
      } else {
        add(geo('ant', () => new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6)), plastic(0x9aa3ad), [0, 2.15, 0], [1, 1, 1]);
        add(sphere, plastic(0xffd23a), [0, 2.42, 0], [0.12, 0.12, 0.12]);
      }
    } else {
      add(sphere, fur, [0, headY, 0.05], [0.6, 0.55, 0.55]);
    }
    // Ojos.
    const white = plastic(0xffffff);
    const black = plastic(0x15151c);
    const ez = c.id === 'esponja' || c.id === 'robot' ? 0.38 : 0.52;
    for (const sx of [-0.2, 0.2]) {
      add(sphere, white, [sx, headY + 0.1, ez], [0.15, 0.17, 0.08]);
      add(sphere, black, [sx, headY + 0.1, ez + 0.06], [0.07, 0.09, 0.04]);
    }
    switch (c.id) {
      case 'perro':
        add(sphere, acc, [0, headY - 0.12, 0.5], [0.28, 0.2, 0.2]);
        add(sphere, black, [0, headY - 0.04, 0.68], [0.08, 0.06, 0.05]);
        for (const sx of [-1, 1]) add(cone, fur, [sx * 0.38, headY + 0.55, 0], [0.18, 0.5, 0.12], [0, 0, -sx * 0.25]);
        break;
      case 'raton':
        for (const sx of [-1, 1]) {
          add(cone, fur, [sx * 0.35, headY + 0.75, 0], [0.13, 0.8, 0.1], [0, 0, -sx * 0.3]);
          add(cone, black, [sx * 0.47, headY + 1.08, 0], [0.07, 0.22, 0.06], [0, 0, -sx * 0.3]);
          add(sphere, plastic(c.accent), [sx * 0.42, headY - 0.1, 0.38], [0.11, 0.11, 0.05]);
        }
        break;
      case 'zorro':
        for (const sx of [-1, 1]) add(cone, fur, [sx * 0.38, headY + 0.6, 0], [0.24, 0.6, 0.12], [0, 0, -sx * 0.35]);
        for (let i = 0; i < 3; i++) add(cone, fur, [(i - 1) * 0.35, 0.5, -0.65], [0.16, 0.9, 0.16], [-1.1, 0, (i - 1) * 0.5]);
        add(sphere, plastic(0x8fd0ff), [0, 0.85, 0.22], [0.45, 0.08, 0.35]);
        break;
      case 'dino':
        add(sphere, acc, [0, headY - 0.1, 0.42], [0.35, 0.25, 0.25]);
        add(cone, acc, [0, headY + 0.6, 0], [0.1, 0.25, 0.1]);
        add(sphere, acc, [0, 0.4, 0.3], [0.38, 0.45, 0.3]);
        break;
      case 'esponja':
        add(geo('shirt', () => new THREE.BoxGeometry(1.0, 0.25, 0.7)), plastic(0xf4f1ea), [0, 0.65, 0], [1, 1, 1]);
        add(cone, plastic(0xd8302a), [0, 0.5, 0.38], [0.08, 0.3, 0.04], [Math.PI, 0, 0]);
        break;
      case 'robot':
        break;
    }
    return d;
  }

  update(k: KartPose, dt: number): void {
    const r = this.root;
    r.position.copy(k.pos);
    r.rotation.y = k.heading - k.driftVisual;
    const targetPitch = k.grounded ? -Math.atan(k.slope) : -Math.atan2(k.vy, Math.max(8, Math.abs(k.speed))) * 0.6;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 10);
    const sp01 = Math.min(1, Math.abs(k.speed) / 30);
    const targetRoll = -k.steerS * sp01 * 0.07 - k.driftVisual * 0.18;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 8);
    this.body.rotation.set(this.pitch, 0, this.roll, 'YXZ');
    const sq = k.landSquash;
    this.body.scale.set(1 + sq * 0.12, 1 - sq * 0.22, 1 + sq * 0.12);
    this.wheelRot += (k.speed / 0.42) * dt;
    for (const w of this.wheels) w.rotation.x = this.wheelRot;
    for (const p of this.steerPivots) p.rotation.y = -k.steerS * 0.42;
    if (this.blob) {
      const h = Math.max(0, k.pos.y - k.groundY);
      this.blob.position.y = -h + 0.08;
      this.blob.rotation.y = k.driftVisual;
      const s = Math.max(0.4, 1 - h * 0.12);
      this.blob.scale.set(s, 1, s);
    }
  }
}
