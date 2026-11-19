// Kart de juguete + piloto provisional (los peluches definitivos llegan en el hito 2).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterDef } from './characters';
import { buildPlush, type PlushMaterials, type PlushRig } from './plush';

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    geoCache.set(key, (g = make()));
    g.userData.shared = true; // compartida por todos los karts: no se libera (render/dispose.ts)
  }
  return g;
}
function mat(key: string, make: () => THREE.Material): THREE.Material {
  let m = matCache.get(key);
  if (!m) {
    matCache.set(key, (m = make()));
    m.userData.shared = true;
  }
  return m;
}
const plastic = (c: number): THREE.Material => mat(`p${c}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.38, metalness: 0.05 }));

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
  spinVisual: number;
  bubbleLift: number;
  shrinkScale: number;
  invulnT: number;
  hitT: number;
  hitKind: string;
  blinkT: number;
  finished: boolean;
  fireT: number;
  assisted: boolean;
  showoff: boolean;
  reachT: number;
  stretchT: number;
}

export class KartModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private wheels: THREE.Object3D[] = [];
  private steerPivots: THREE.Object3D[] = [];
  private blob: THREE.Mesh | null = null;
  private wheelRot = 0;
  private readonly plush: PlushRig;
  private readonly bubble: THREE.Mesh;
  /** Bloque de hielo (aliento helado de Copito). */
  private ice: THREE.Mesh | null = null;
  private readonly lift = new THREE.Group();
  private cheer = 0;
  private stretch = 0;
  private star: THREE.Mesh | null = null;
  private t = Math.random() * 10;
  private pitch = 0;
  private roll = 0;

  constructor(char: CharacterDef, blobTex: THREE.Texture | null, castShadow: boolean, plushMats: PlushMaterials) {
    const r = this.root;
    r.add(this.lift);
    this.lift.add(this.body);
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
    this.plush = buildPlush(char, plushMats);
    const driver = new THREE.Group();
    driver.position.set(0, 0.9, -0.35);
    driver.add(this.plush.group);
    b.add(driver);
    // Burbuja que atrapa (poder de Esponjo).
    this.bubble = new THREE.Mesh(
      geo('bubble', () => new THREE.SphereGeometry(2.1, 32, 20)),
      mat('bubble', () => new THREE.MeshPhysicalMaterial({ color: 0xcfefff, roughness: 0.05, transparent: true, opacity: 0.32, iridescence: 1, iridescenceIOR: 1.6, depthWrite: false })),
    );
    this.bubble.position.y = 1.1;
    // Estrella guía de la dirección asistida (solo se crea si se usa).
    this.bubble.visible = false;
    this.lift.add(this.bubble);
    if (blobTex) {
      this.blob = new THREE.Mesh(
        geo('blob', () => new THREE.PlaneGeometry(2.6, 3.4).rotateX(-Math.PI / 2)),
        mat('blob', () => new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })),
      );
      this.blob.renderOrder = 1;
      r.add(this.blob);
    }
    r.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o !== this.blob && o !== this.bubble) {
        (o as THREE.Mesh).castShadow = castShadow;
      }
    });
  }

  private lights: THREE.Group | null = null;

  /** Faros (pistas de noche): dos luces delanteras y un haz suave en el suelo. Se crean la primera vez. */
  setHeadlights(on: boolean): void {
    if (on && !this.lights) {
      const g = (this.lights = new THREE.Group());
      const bulb = mat('headlight', () => new THREE.MeshBasicMaterial({ color: 0xfff6d0, toneMapped: false }));
      for (const x of [-0.5, 0.5]) {
        const m = new THREE.Mesh(geo('headlight', () => new THREE.SphereGeometry(0.16, 10, 8)), bulb);
        m.position.set(x, 0.62, 1.86);
        g.add(m);
      }
      const beam = new THREE.Mesh(
        geo('beam', () => new THREE.PlaneGeometry(5.5, 10).rotateX(-Math.PI / 2).translate(0, 0.12, 6.6)),
        mat('beam', () => new THREE.MeshBasicMaterial({ map: beamTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })),
      );
      beam.renderOrder = 2;
      g.add(beam);
      this.body.add(g);
    }
    if (this.lights) this.lights.visible = on;
  }

  update(k: KartPose, dt: number): void {
    const r = this.root;
    this.t += dt;
    r.position.copy(k.pos);
    r.rotation.y = k.heading - k.driftVisual + k.spinVisual;
    r.scale.setScalar(k.shrinkScale);
    this.lift.position.y = k.bubbleLift;
    this.bubble.visible = k.bubbleLift > 0.05;
    if (this.bubble.visible) this.bubble.scale.setScalar(1 + Math.sin(this.t * 6) * 0.04);
    const frozen = k.hitKind === 'freeze' && k.hitT > 0;
    if (frozen && !this.ice) {
      this.ice = new THREE.Mesh(
        geo('ice', () => new RoundedBoxGeometry(2.3, 2.5, 3.1, 2, 0.25)),
        mat('ice', () => new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.08, transparent: true, opacity: 0.45, clearcoat: 1, depthWrite: false })),
      );
      this.ice.position.y = 1.15;
      this.lift.add(this.ice);
    }
    if (this.ice) {
      this.ice.visible = frozen;
      // Se encoge un poco al derretirse (último cuarto de segundo).
      if (frozen) this.ice.scale.setScalar(0.75 + 0.25 * Math.min(1, k.hitT / 0.25));
    }
    // Parpadeo mientras dura la invulnerabilidad tras un golpe.
    r.visible = !(k.invulnT > 0 && k.hitT <= 0 && k.fireT <= 0 && Math.floor(k.blinkT * 14) % 2 === 1);
    this.cheer += ((k.finished || k.showoff ? 1 : 0) - this.cheer) * Math.min(1, dt * 3);
    if (k.assisted && !this.star) {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        const rr = i % 2 ? 0.16 : 0.38;
        if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      this.star = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }),
        new THREE.MeshBasicMaterial({ color: 0xffd84a, toneMapped: false }),
      );
      this.star.position.set(0, 1.5, -2.1);
      this.lift.add(this.star);
    }
    if (this.star) {
      this.star.visible = k.assisted;
      this.star.rotation.y = this.t * 2.5;
      this.star.position.y = 1.5 + Math.sin(this.t * 3) * 0.12;
      this.star.scale.setScalar(1 + Math.sin(this.t * 6) * 0.1);
    }
    this.stretch += ((k.stretchT > 0 ? 1 : 0) - this.stretch) * Math.min(1, dt * (k.stretchT > 0 ? 12 : 5));
    this.plush.update({
      steerS: k.steerS, speed: k.speed, t: this.t, cheer: this.cheer, hurt: k.hitT > 0 && k.hitKind !== 'stuck' && k.hitKind !== 'freeze' ? 1 : 0,
      reach: k.reachT > 0 ? 1 : 0, stretch: this.stretch,
    });
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
      const h = Math.max(0, k.pos.y - k.groundY) + k.bubbleLift;
      this.blob.position.y = (-h + 0.08) / Math.max(0.3, k.shrinkScale);
      this.blob.rotation.y = k.driftVisual;
      const s = Math.max(0.4, 1 - h * 0.12);
      this.blob.scale.set(s, 1, s);
    }
  }
}

let beamTex: THREE.Texture | null = null;
/** Haz de los faros: un óvalo cálido que se desvanece hacia delante (compartido por todos los karts). */
function beamTexture(): THREE.Texture {
  if (beamTex) return beamTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 16, 4, 32, 48, 70); // arriba del lienzo = cerca del kart
  grd.addColorStop(0, 'rgba(255,240,190,0.55)');
  grd.addColorStop(0.5, 'rgba(255,235,170,0.22)');
  grd.addColorStop(1, 'rgba(255,230,160,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 128);
  beamTex = new THREE.CanvasTexture(c);
  beamTex.colorSpace = THREE.SRGBColorSpace;
  beamTex.userData.shared = true;
  return beamTex;
}
