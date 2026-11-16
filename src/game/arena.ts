// Cajas regalo, objetos (turbo, pelota saltarina, chicle) y los seis poderes, con sus efectos visuales.
// Todo sale de pools fijos: nada se crea durante la carrera.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bus, type ItemId } from '../core/events';
import type { Rng } from '../core/rng';
import type { Track } from './track';
import { newLoc } from './track';
import type { Kart } from './kart';
import { TUNING } from './kart';
import type { Particles } from '../fx/particles';
import type { Textures } from '../world/textures';

export const ITEM_LABEL: Record<ItemId, string> = { turbo: 'Turbo cohete', pelota: 'Pelota saltarina', chicle: 'Chicle pegajoso' };

/** Segundos que tarda la barra de poder en llenarse sola. */
export const POWER_FILL_SECONDS = 26;
const BOX_POWER = 0.18;
const BOX_RESPAWN = 2.5;

interface Box {
  x: number;
  y: number;
  z: number;
  respawn: number;
  phase: number;
}
interface Ball {
  on: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  idx: number;
  t: number;
  owner: number;
  bounces: number;
  ground: number;
}
interface Gum {
  on: boolean;
  x: number;
  y: number;
  z: number;
  t: number;
  owner: number;
}
interface Bubble {
  on: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  idx: number;
  t: number;
  owner: number;
  target: Kart | null;
}
interface Missile {
  on: boolean;
  /** Progreso absoluto (vueltas × N + índice). */
  prog: number;
  lat: number;
  x: number;
  y: number;
  z: number;
  t: number;
  owner: number;
  target: Kart | null;
}
interface Ring {
  on: boolean;
  t: number;
  dur: number;
  maxR: number;
  delay: number;
}
interface Bolt {
  on: boolean;
  t: number;
  target: Kart | null;
}

export class Arena {
  readonly group = new THREE.Group();
  private karts: Kart[] = [];
  private order: () => Kart[] = () => this.karts;
  private boxes: Box[] = [];
  private balls: Ball[] = [];
  private gums: Gum[] = [];
  private bubbles: Bubble[] = [];
  private missiles: Missile[] = [];
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  // Visuales.
  private boxPaper!: THREE.InstancedMesh;
  private boxRibbon!: THREE.InstancedMesh;
  private ballMeshes: THREE.Mesh[] = [];
  private gumMeshes: THREE.Mesh[] = [];
  private bubbleMeshes: THREE.Mesh[] = [];
  private missileMeshes: THREE.Object3D[] = [];
  private ringMeshes: THREE.Mesh[] = [];
  private boltMeshes: THREE.Mesh[] = [];
  private readonly loc = newLoc();
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private time = 0;

  constructor(
    private track: Track,
    private tex: Textures,
    private sparks: Particles,
    private dust: Particles,
    private rng: Rng,
  ) {
    this.group.name = 'arena';
    this.buildBoxes();
    this.buildPools();
    bus.on('kart:land', ({ kart }) => {
      const k = this.karts[kart];
      if (k?.stompPending) {
        k.stompPending = false;
        this.quake(k);
      }
    });
  }

  reset(karts: Kart[], order: () => Kart[]): void {
    this.karts = karts;
    this.order = order;
    for (const b of this.boxes) b.respawn = 0;
    for (const arr of [this.balls, this.gums, this.bubbles, this.missiles, this.rings, this.bolts]) for (const o of arr) o.on = false;
  }

  // ---------------- Construcción ----------------

  private buildBoxes(): void {
    const tr = this.track;
    for (const row of tr.def.itemRows) {
      const i = tr.indexAtSeg(row.seg, row.f);
      const s = tr.samples[i];
      for (const f of [-0.6, -0.2, 0.2, 0.6]) {
        this.boxes.push({ x: s.x + s.nx * f * s.hw, y: s.y, z: s.z + s.nz * f * s.hw, respawn: 0, phase: this.rng.next() * 6 });
      }
    }
    const n = this.boxes.length;
    const paper = new RoundedBoxGeometry(1.6, 1.6, 1.6, 2, 0.18);
    const band = new THREE.BoxGeometry(1.66, 1.66, 0.34);
    const band2 = new THREE.BoxGeometry(0.34, 1.66, 1.66);
    const bowL = new THREE.TorusGeometry(0.28, 0.1, 8, 16).rotateY(Math.PI / 2).rotateZ(0.6).translate(-0.22, 0.98, 0);
    const bowR = new THREE.TorusGeometry(0.28, 0.1, 8, 16).rotateY(Math.PI / 2).rotateZ(-0.6).translate(0.22, 0.98, 0);
    const ribbon = mergeGeometries([band, band2, bowL, bowR].map((g) => g.toNonIndexed()));
    this.boxPaper = new THREE.InstancedMesh(paper, new THREE.MeshStandardMaterial({ roughness: 0.45 }), n);
    this.boxRibbon = new THREE.InstancedMesh(ribbon, new THREE.MeshStandardMaterial({ color: 0xffd84a, roughness: 0.3, metalness: 0.2, emissive: 0x332200 }), n);
    const cols = [0xe8423a, 0x2f7de0, 0x3fb24a, 0x8a4fd8, 0xf07ab0];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) this.boxPaper.setColorAt(i, c.setHex(cols[i % cols.length]));
    this.boxPaper.castShadow = this.boxRibbon.castShadow = true;
    this.group.add(this.boxPaper, this.boxRibbon);
  }

  private buildPools(): void {
    const ballMat = new THREE.MeshStandardMaterial({ map: this.tex.ball, roughness: 0.3 });
    const ballGeo = new THREE.SphereGeometry(0.75, 20, 14);
    for (let i = 0; i < 10; i++) {
      this.balls.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, idx: 0, t: 0, owner: -1, bounces: 0, ground: 0 });
      const m = new THREE.Mesh(ballGeo, ballMat);
      m.castShadow = true;
      m.visible = false;
      this.ballMeshes.push(m);
      this.group.add(m);
    }
    const gumGeo = new THREE.IcosahedronGeometry(1, 2);
    const pos = gumGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const w = 1 + Math.sin(pos.getX(i) * 5) * 0.12 + Math.cos(pos.getZ(i) * 4) * 0.1;
      pos.setXYZ(i, pos.getX(i) * w * 1.25, y * 0.28 + 0.15, pos.getZ(i) * w * 1.25);
    }
    gumGeo.computeVertexNormals();
    const gumMat = new THREE.MeshStandardMaterial({ color: 0xff7ab8, roughness: 0.25 });
    for (let i = 0; i < 12; i++) {
      this.gums.push({ on: false, x: 0, y: 0, z: 0, t: 0, owner: -1 });
      const m = new THREE.Mesh(gumGeo, gumMat);
      m.visible = false;
      m.receiveShadow = true;
      this.gumMeshes.push(m);
      this.group.add(m);
    }
    const bubGeo = new THREE.SphereGeometry(1.1, 24, 16);
    const bubMat = new THREE.MeshPhysicalMaterial({ color: 0xcfefff, roughness: 0.05, transparent: true, opacity: 0.45, iridescence: 1, iridescenceIOR: 1.6, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      this.bubbles.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, idx: 0, t: 0, owner: -1, target: null });
      const m = new THREE.Mesh(bubGeo, bubMat);
      m.visible = false;
      this.bubbleMeshes.push(m);
      this.group.add(m);
    }
    const red = new THREE.MeshStandardMaterial({ color: 0xd83a2a, roughness: 0.35 });
    const grey = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.3, metalness: 0.4 });
    for (let i = 0; i < 6; i++) {
      this.missiles.push({ on: false, prog: 0, lat: 0, x: 0, y: 0, z: 0, t: 0, owner: -1, target: null });
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.3, 14).rotateX(Math.PI / 2), red);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 14).rotateX(-Math.PI / 2).translate(0, 0, -0.85), grey);
      const magnet = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 8, 16, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0, 0.75), red);
      const tips = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.2).translate(0, 0, 0.82), grey);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.35).translate(0, 0, -0.5), grey);
      g.add(body, tail, magnet, tips, fin);
      g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      g.visible = false;
      this.missileMeshes.push(g);
      this.group.add(g);
    }
    const ringGeo = new THREE.TorusGeometry(1, 0.06, 6, 48).rotateX(Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      this.rings.push({ on: false, t: 0, dur: 0.6, maxR: 16, delay: 0 });
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.visible = false;
      this.ringMeshes.push(m);
      this.group.add(m);
    }
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xfff6a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    for (let i = 0; i < 6; i++) {
      this.bolts.push({ on: false, t: 0, target: null });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT_SEG * 2 * 3), 3));
      const idx: number[] = [];
      for (let k = 0; k < BOLT_SEG - 1; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
      g.setIndex(idx);
      const m = new THREE.Mesh(g, boltMat);
      m.frustumCulled = false;
      m.visible = false;
      this.boltMeshes.push(m);
      this.group.add(m);
    }
  }

  // ---------------- Uso ----------------

  /** Elige el objeto según la posición: los de atrás reciben más turbos; los de delante, más trampas. */
  private rollItem(k: Kart): ItemId {
    const n = this.karts.length;
    const f = n > 1 ? (k.position - 1) / (n - 1) : 0.5; // 0 = primero, 1 = último
    const turbo = 0.1 + f * 0.55;
    const chicle = 0.55 - f * 0.45;
    const r = this.rng.next() * (turbo + chicle + 0.35);
    return r < turbo ? 'turbo' : r < turbo + chicle ? 'chicle' : 'pelota';
  }

  useItem(k: Kart): void {
    if (!k.item || k.rouletteT > 0 || k.hitT > 0) return;
    const item = k.item;
    k.item = null;
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    if (item === 'turbo') k.boost('mini', 1.4);
    else if (item === 'pelota') {
      const b = this.free(this.balls);
      if (b) {
        Object.assign(b, { on: true, x: k.pos.x + fx * 2.4, y: k.pos.y + 0.8, z: k.pos.z + fz * 2.4, vx: fx * 44 + k.vel.x * 0.3, vz: fz * 44 + k.vel.z * 0.3, idx: k.idx, t: 0, owner: k.index, bounces: 0, ground: k.pos.y });
      }
    } else {
      let g = this.free(this.gums);
      if (!g) g = this.gums.reduce((a, b) => (a.t > b.t ? a : b));
      Object.assign(g, { on: true, x: k.pos.x - fx * 2.8, y: k.groundY, z: k.pos.z - fz * 2.8, t: 0, owner: k.index });
    }
    bus.emit('item:use', { kart: k.index, item });
  }

  usePower(k: Kart): void {
    if (k.power < 1 || k.hitT > 0 || k.finished) return;
    k.power = 0;
    bus.emit('power:use', { kart: k.index, power: k.char.id });
    switch (k.char.id) {
      case 'perro':
        return this.bark(k);
      case 'esponja':
        return this.launchBubble(k);
      case 'raton':
        return this.lightning(k);
      case 'zorro':
        k.fireT = 3.5;
        k.invulnT = Math.max(k.invulnT, 3.5);
        if (k.hitKind === 'stuck') k.hitT = 0;
        return;
      case 'dino':
        k.grounded = false;
        k.vy = 10;
        k.stompPending = true;
        return;
      case 'robot':
        return this.launchMissile(k);
    }
  }

  private kartAhead(k: Kart): Kart | null {
    const o = this.order();
    const i = o.indexOf(k);
    for (let j = i - 1; j >= 0; j--) if (!o[j].finished) return o[j];
    return null;
  }

  private hit(k: Kart, kind: Parameters<Kart['applyHit']>[0], by: number): boolean {
    return k.applyHit(kind, by);
  }

  private bark(k: Kart): void {
    for (let i = 0; i < 3; i++) this.ring(k.pos.x, k.pos.y + 0.8 + i * 0.4, k.pos.z, 16, 0.55, i * 0.12, 0xffe9a8);
    for (const o of this.karts) {
      if (o === k) continue;
      const d = Math.hypot(o.pos.x - k.pos.x, o.pos.z - k.pos.z);
      if (d < 16 && Math.abs(o.pos.y - k.pos.y) < 4) this.hit(o, 'spin', k.index);
    }
    // El ladrido también se lleva por delante pelotas y chicles cercanos.
    for (const b of this.balls) if (b.on && Math.hypot(b.x - k.pos.x, b.z - k.pos.z) < 16) b.on = false;
    for (const g of this.gums) if (g.on && Math.hypot(g.x - k.pos.x, g.z - k.pos.z) < 16) g.on = false;
  }

  private launchBubble(k: Kart): void {
    const b = this.free(this.bubbles);
    if (!b) return;
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const target = this.kartAhead(k);
    const ok = target && (target.progress - k.progress) * this.track.step < 140 ? target : null;
    Object.assign(b, { on: true, x: k.pos.x + fx * 2.5, y: k.pos.y + 1.3, z: k.pos.z + fz * 2.5, vx: fx * 40, vz: fz * 40, idx: k.idx, t: 0, owner: k.index, target: ok });
  }

  private lightning(k: Kart): void {
    let n = 0;
    for (const o of this.karts) {
      if (o === k || o.position >= k.position || o.finished) continue;
      const b = this.bolts[n++];
      if (!b) break;
      b.on = true;
      b.t = 0;
      b.target = o;
      this.hit(o, 'shrink', k.index);
    }
    bus.emit('fx:lightning', { kart: k.index });
  }

  private quake(k: Kart): void {
    this.ring(k.pos.x, k.groundY + 0.3, k.pos.z, 18, 0.7, 0, 0xffc070);
    this.ring(k.pos.x, k.groundY + 0.3, k.pos.z, 12, 0.5, 0.1, 0xffc070);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      this.dust.spawn(k.pos.x + Math.cos(a) * 2, k.groundY + 0.3, k.pos.z + Math.sin(a) * 2, Math.cos(a) * 14, 2 + Math.random() * 2, Math.sin(a) * 14, 0.8, 1, 2.6, 0xd9b98a, 0.6, 3, 2.5);
    }
    for (const o of this.karts) {
      if (o === k) continue;
      const d = Math.hypot(o.pos.x - k.pos.x, o.pos.z - k.pos.z);
      if (d < 18 && Math.abs(o.pos.y - k.pos.y) < 4) this.hit(o, 'tumble', k.index);
    }
    for (const g of this.gums) if (g.on && Math.hypot(g.x - k.pos.x, g.z - k.pos.z) < 25) g.on = false;
    bus.emit('fx:quake', { kart: k.index, x: k.pos.x, y: k.pos.y, z: k.pos.z });
  }

  private launchMissile(k: Kart): void {
    const m = this.free(this.missiles);
    if (!m) return;
    Object.assign(m, { on: true, prog: k.progress + 2.5, lat: k.lat, x: k.pos.x, y: k.pos.y + 1, z: k.pos.z, t: 0, owner: k.index, target: this.kartAhead(k) });
  }

  private ring(x: number, y: number, z: number, maxR: number, dur: number, delay: number, color: number): void {
    const r = this.free(this.rings);
    if (!r) return;
    Object.assign(r, { on: true, t: -delay, dur, maxR, delay });
    const m = this.ringMeshes[this.rings.indexOf(r)];
    m.position.set(x, y, z);
    (m.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  private explode(x: number, y: number, z: number, big: boolean): void {
    const n = big ? 40 : 18;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 0.9;
      const sp = (big ? 10 : 6) * (0.5 + Math.random());
      this.sparks.spawn(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 2, Math.sin(a) * Math.cos(e) * sp, 0.45, big ? 1.4 : 0.9, 0.1, Math.random() < 0.5 ? 0xffb52a : 0xff5a2a, 1, 6, 2);
    }
    for (let i = 0; i < (big ? 10 : 5); i++) this.dust.spawn(x, y, z, (Math.random() - 0.5) * 5, 2 + Math.random() * 2, (Math.random() - 0.5) * 5, 1, 1.5, 3.5, 0xd8d0c8, 0.55, -0.5, 1.5);
    bus.emit('fx:explode', { x, y, z, big });
  }

  private free<T extends { on: boolean }>(arr: T[]): T | null {
    for (const o of arr) if (!o.on) return o;
    return null;
  }

  // ---------------- Simulación ----------------

  /** `racing` = false durante la parrilla y la cuenta atrás (solo se animan las cajas). */
  update(dt: number, racing: boolean, cam: THREE.Camera): void {
    this.time += dt;
    this.updateBoxes(dt, racing);
    if (racing) {
      for (const k of this.karts) {
        // Barra de poder y ruleta.
        if (!k.finished) {
          const before = k.power;
          k.power = Math.min(1, k.power + dt / POWER_FILL_SECONDS);
          if (before < 1 && k.power >= 1) bus.emit('power:ready', { kart: k.index });
        }
        if (k.rouletteT > 0) {
          k.rouletteT -= dt;
          if (k.rouletteT <= 0) {
            k.item = this.rollItem(k);
            bus.emit('item:get', { kart: k.index, item: k.item });
          }
        }
      }
      this.contactPowers();
      this.updateBalls(dt);
      this.updateGums(dt);
      this.updateBubbles(dt);
      this.updateMissiles(dt);
    }
    this.updateRings(dt);
    this.updateBolts(dt, cam);
  }

  private updateBoxes(dt: number, racing: boolean): void {
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (b.respawn > 0) b.respawn -= dt;
      if (racing && b.respawn <= 0) {
        for (const k of this.karts) {
          if (Math.abs(k.pos.x - b.x) < 2.1 && Math.abs(k.pos.z - b.z) < 2.1 && Math.abs(k.pos.y - b.y) < 2.6) {
            b.respawn = BOX_RESPAWN;
            const before = k.power;
            k.power = Math.min(1, k.power + BOX_POWER);
            if (before < 1 && k.power >= 1) bus.emit('power:ready', { kart: k.index });
            if (!k.item && k.rouletteT <= 0) k.rouletteT = 1.1;
            for (let j = 0; j < 16; j++) {
              const a = Math.random() * Math.PI * 2;
              this.dust.spawn(b.x, b.y + 1.2, b.z, Math.cos(a) * 6, 4 + Math.random() * 4, Math.sin(a) * 6, 0.9, 0.5, 0.35, [0xe8423a, 0x2f7de0, 0x3fb24a, 0xffd23a, 0xf07ab0][j % 5], 1, 14, 1);
            }
            bus.emit('box:open', { kart: k.index, x: b.x, y: b.y, z: b.z });
            break;
          }
        }
      }
      const grow = b.respawn > 0 ? 0 : Math.min(1, -b.respawn * 4 + 1);
      const s = b.respawn > 0 ? 0.001 : Math.max(0.001, grow);
      this.q.setFromAxisAngle(this.up, this.time * 1.4 + b.phase);
      this.v.set(b.x, b.y + 1.3 + Math.sin(this.time * 2.5 + b.phase) * 0.18, b.z);
      this.m4.compose(this.v, this.q, this.sc.set(s, s, s));
      this.boxPaper.setMatrixAt(i, this.m4);
      this.boxRibbon.setMatrixAt(i, this.m4);
    }
    this.boxPaper.instanceMatrix.needsUpdate = this.boxRibbon.instanceMatrix.needsUpdate = true;
  }

  /** Fuego de Kitsu aparta a quien toca; un kart encogido es aplastado por uno de tamaño normal. */
  private contactPowers(): void {
    const ks = this.karts;
    for (const a of ks) {
      for (const b of ks) {
        if (a === b) continue;
        const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
        if (d > 2.7 || Math.abs(a.pos.y - b.pos.y) > 2) continue;
        if (a.fireT > 0) this.hit(b, 'spin', a.index);
        else if (b.shrinkT > 0 && a.shrinkT <= 0 && Math.abs(a.speed) > 10 && d < 2.2) this.hit(b, 'spin', a.index);
      }
    }
  }

  private kartNear(x: number, y: number, z: number, r: number, skip: number, grace: boolean): Kart | null {
    for (const k of this.karts) {
      if (grace && k.index === skip) continue;
      if (Math.abs(k.pos.y + 0.8 - y) > 2.2) continue;
      if ((k.pos.x - x) ** 2 + (k.pos.z - z) ** 2 < r * r) return k;
    }
    return null;
  }

  private updateBalls(dt: number): void {
    const tr = this.track;
    this.balls.forEach((b, i) => {
      const m = this.ballMeshes[i];
      if (!b.on) {
        m.visible = false;
        return;
      }
      b.t += dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      const L = tr.locate(b.x, b.z, b.idx, this.loc);
      b.idx = L.i;
      b.ground = L.y;
      const wall = L.hw + tr.shoulder - 0.6;
      if (Math.abs(L.lat) > wall) {
        const sgn = Math.sign(L.lat);
        b.x -= L.nx * sgn * (Math.abs(L.lat) - wall);
        b.z -= L.nz * sgn * (Math.abs(L.lat) - wall);
        const vn = b.vx * L.nx + b.vz * L.nz;
        if (vn * sgn > 0) {
          b.vx -= 2 * vn * L.nx;
          b.vz -= 2 * vn * L.nz;
          b.bounces++;
        }
      }
      b.y = b.ground + 0.75 + Math.abs(Math.sin(b.t * 7)) * 1.3;
      const k = this.kartNear(b.x, b.y, b.z, 1.9, b.owner, b.t < 0.5);
      if (k) {
        this.hit(k, 'spin', b.owner);
        b.on = false;
        this.explode(b.x, b.y, b.z, false);
      } else if (b.t > 6 || b.bounces > 7) b.on = false;
      m.visible = b.on;
      m.position.set(b.x, b.y, b.z);
      m.rotation.x += dt * 12;
    });
  }

  private updateGums(dt: number): void {
    this.gums.forEach((g, i) => {
      const m = this.gumMeshes[i];
      if (g.on) {
        g.t += dt;
        const k = this.kartNear(g.x, g.y + 0.8, g.z, 1.7, g.owner, g.t < 1);
        if (k && k.grounded) {
          this.hit(k, 'stuck', g.owner);
          g.on = false;
        } else if (g.t > 45) g.on = false;
      }
      m.visible = g.on;
      if (g.on) {
        const s = Math.min(1, g.t * 5);
        m.position.set(g.x, g.y, g.z);
        m.scale.set(s, s * (1 + Math.sin(this.time * 4 + i) * 0.08), s);
      }
    });
  }

  private updateBubbles(dt: number): void {
    const tr = this.track;
    this.bubbles.forEach((b, i) => {
      const m = this.bubbleMeshes[i];
      if (!b.on) {
        m.visible = false;
        return;
      }
      b.t += dt;
      if (b.target && !b.target.finished) {
        const want = Math.atan2(b.target.pos.x - b.x, b.target.pos.z - b.z);
        const cur = Math.atan2(b.vx, b.vz);
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + Math.max(-3.2 * dt, Math.min(3.2 * dt, d));
        const sp = Math.min(46, Math.hypot(b.vx, b.vz) + dt * 6);
        b.vx = Math.sin(na) * sp;
        b.vz = Math.cos(na) * sp;
      }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      const L = tr.locate(b.x, b.z, b.idx, this.loc);
      b.idx = L.i;
      b.y += (L.y + 1.4 + Math.sin(b.t * 5) * 0.3 - b.y) * Math.min(1, dt * 6);
      const k = this.kartNear(b.x, b.y, b.z, 2.2, b.owner, true);
      const offTrack = Math.abs(L.lat) > L.hw + tr.shoulder;
      if (k) {
        this.hit(k, 'bubble', b.owner);
        b.on = false;
      } else if (b.t > 6 || offTrack) {
        b.on = false;
        for (let j = 0; j < 10; j++) this.sparks.spawn(b.x, b.y, b.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0.35, 0.4, 0.05, 0xcfefff, 0.8, 4, 1);
      }
      m.visible = b.on;
      m.position.set(b.x, b.y, b.z);
      m.scale.setScalar(1 + Math.sin(b.t * 9) * 0.06);
    });
  }

  private updateMissiles(dt: number): void {
    const tr = this.track;
    const N = tr.N;
    this.missiles.forEach((m, i) => {
      const obj = this.missileMeshes[i];
      if (!m.on) {
        obj.visible = false;
        return;
      }
      m.t += dt;
      const speed = (TUNING.maxSpeed * 1.9) / tr.step;
      m.prog += speed * dt;
      const t = m.target;
      if (t && !t.finished) {
        const gap = t.progress - m.prog;
        m.lat += (t.lat - m.lat) * Math.min(1, dt * (gap < 25 ? 6 : 1.5));
        if (gap < 1.5 && Math.abs(t.lat - m.lat) < 3) {
          this.hit(t, 'tumble', m.owner);
          this.explode(t.pos.x, t.pos.y + 1, t.pos.z, true);
          m.on = false;
        }
      }
      const idx = Math.floor(m.prog);
      const s = tr.samples[((idx % N) + N) % N];
      const s2 = tr.samples[(((idx + 1) % N) + N) % N];
      const f = m.prog - idx;
      const nx = s.x + (s2.x - s.x) * f + s.nx * m.lat;
      const nz = s.z + (s2.z - s.z) * f + s.nz * m.lat;
      const ny = s.y + (s2.y - s.y) * f + 1.2 + Math.sin(m.t * 10) * 0.1;
      obj.position.set(nx, ny, nz);
      obj.rotation.set(0, Math.atan2(nx - m.x, nz - m.z), Math.sin(m.t * 8) * 0.3);
      m.x = nx;
      m.y = ny;
      m.z = nz;
      if (Math.random() < 0.8) this.dust.spawn(nx - s.tx * 1, ny, nz - s.tz * 1, 0, 0.6, 0, 0.6, 0.4, 1.4, 0xe8e4e0, 0.5, -0.5, 1);
      if (m.on && (m.t > 10 || (!t && m.t > 3))) {
        this.explode(nx, ny, nz, false);
        m.on = false;
      }
      obj.visible = m.on;
    });
  }

  private updateRings(dt: number): void {
    this.rings.forEach((r, i) => {
      const m = this.ringMeshes[i];
      if (!r.on) {
        m.visible = false;
        return;
      }
      r.t += dt;
      if (r.t < 0) {
        m.visible = false;
        return;
      }
      const u = r.t / r.dur;
      if (u >= 1) {
        r.on = false;
        m.visible = false;
        return;
      }
      const rad = 1 + (r.maxR - 1) * (1 - (1 - u) * (1 - u));
      m.visible = true;
      m.scale.set(rad, 1 + rad * 0.6, rad);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - u);
    });
  }

  private updateBolts(dt: number, cam: THREE.Camera): void {
    const right = this.v.setFromMatrixColumn(cam.matrixWorld, 0);
    this.bolts.forEach((b, i) => {
      const m = this.boltMeshes[i];
      if (!b.on || !b.target) {
        m.visible = false;
        return;
      }
      b.t += dt;
      if (b.t > 0.55) {
        b.on = false;
        m.visible = false;
        return;
      }
      // Parpadeo y nueva forma en zigzag cada pocos cuadros.
      m.visible = Math.floor(b.t * 30) % 3 !== 2;
      const p = (m.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      const k = b.target;
      const top = k.pos.y + 45;
      const bottom = k.pos.y + 1.2;
      let x = k.pos.x;
      let z = k.pos.z;
      for (let s = 0; s < BOLT_SEG; s++) {
        const u = s / (BOLT_SEG - 1);
        const y = top + (bottom - top) * u;
        if (s > 0 && s < BOLT_SEG - 1) {
          x = k.pos.x + (Math.random() - 0.5) * 3.2 * (1 - u * 0.8);
          z = k.pos.z + (Math.random() - 0.5) * 3.2 * (1 - u * 0.8);
        } else {
          x = k.pos.x;
          z = k.pos.z;
        }
        const w = 0.55 * (1 - u * 0.5);
        p.set([x - right.x * w, y, z - right.z * w, x + right.x * w, y, z + right.z * w], s * 6);
      }
      m.geometry.attributes.position.needsUpdate = true;
      if (b.t < dt * 1.5) {
        for (let j = 0; j < 14; j++) {
          this.sparks.spawn(k.pos.x, k.pos.y + 1, k.pos.z, (Math.random() - 0.5) * 9, Math.random() * 6, (Math.random() - 0.5) * 9, 0.4, 0.6, 0.05, 0xfff6a0, 1, 10, 1);
        }
      }
    });
  }

  /** Cajas regalo: posiciones (para la IA y las pruebas). */
  get boxPositions(): { x: number; z: number; ready: boolean }[] {
    return this.boxes.map((b) => ({ x: b.x, z: b.z, ready: b.respawn <= 0 }));
  }

  /** Chicles activos (la IA de Dino los busca para el Pisotón). */
  get activeGums(): { x: number; z: number }[] {
    return this.gums.filter((g) => g.on);
  }
}

const BOLT_SEG = 12;
