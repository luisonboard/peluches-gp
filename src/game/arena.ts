// Cajas regalo, objetos (turbo, pelota saltarina, chicle) y los seis poderes, con sus efectos visuales.
// Todo sale de pools fijos: nada se crea durante la carrera.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { bus, type ItemId } from '../core/events';
import type { Msg } from '../net/protocol';
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
  id: string;
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
  id: string;
  on: boolean;
  x: number;
  y: number;
  z: number;
  t: number;
  owner: number;
}
interface Bubble {
  id: string;
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
/** Mano telescópica de Robotín: viaja por la pista hasta el kart de delante y vuelve encogiendo el brazo. */
interface Missile {
  id: string;
  on: boolean;
  /** 'reach' = estirándose; 'back' = ya agarró y el brazo se encoge. */
  phase: 'reach' | 'back';
  /** Posición donde agarró (para encoger desde ahí). */
  gx: number;
  gy: number;
  gz: number;
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
  /** Tramos del brazo telescópico (ARM_SEG por mano). */
  private armMeshes: THREE.Mesh[][] = [];
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
      if (k?.stompPending && !k.remote) {
        k.stompPending = false;
        this.quake(k);
        this.net?.({ t: 'quake', s: k.slot, x: k.pos.x, y: k.groundY, z: k.pos.z });
      }
    });
  }

  reset(karts: Kart[], order: () => Kart[]): void {
    this.karts = karts;
    this.order = order;
    for (const b of this.boxes) b.respawn = 0;
    for (const arr of [this.balls, this.gums, this.bubbles, this.missiles, this.rings, this.bolts]) for (const o of arr) o.on = false;
  }

  /** Cambio de pista: las cajas regalo se rehacen en sus nuevas filas. */
  setTrack(track: Track): void {
    this.track = track;
    for (const m of [this.boxPaper, this.boxRibbon]) {
      m.removeFromParent();
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
    this.boxes = [];
    this.buildBoxes();
    this.reset([], () => []);
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
      this.balls.push({ id: '', on: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, idx: 0, t: 0, owner: -1, bounces: 0, ground: 0 });
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
      this.gums.push({ id: '', on: false, x: 0, y: 0, z: 0, t: 0, owner: -1 });
      const m = new THREE.Mesh(gumGeo, gumMat);
      m.visible = false;
      m.receiveShadow = true;
      this.gumMeshes.push(m);
      this.group.add(m);
    }
    const bubGeo = new THREE.SphereGeometry(1.1, 24, 16);
    const bubMat = new THREE.MeshPhysicalMaterial({ color: 0xcfefff, roughness: 0.05, transparent: true, opacity: 0.45, iridescence: 1, iridescenceIOR: 1.6, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      this.bubbles.push({ id: '', on: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, idx: 0, t: 0, owner: -1, target: null });
      const m = new THREE.Mesh(bubGeo, bubMat);
      m.visible = false;
      this.bubbleMeshes.push(m);
      this.group.add(m);
    }
    // Mano telescópica: ventosa azul en un puño rojo, y tramos grises que se meten unos dentro de otros.
    const red = new THREE.MeshStandardMaterial({ color: 0xd83a2a, roughness: 0.35 });
    const grey = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.3, metalness: 0.4 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x3a8fe0, roughness: 0.3 });
    const segGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    for (let i = 0; i < 6; i++) {
      this.missiles.push({ id: '', on: false, phase: 'reach', gx: 0, gy: 0, gz: 0, prog: 0, lat: 0, x: 0, y: 0, z: 0, t: 0, owner: -1, target: null });
      const g = new THREE.Group();
      const fist = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), red);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 14).rotateX(Math.PI / 2).translate(0, 0, -0.3), grey);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.2, 18).rotateX(Math.PI / 2).translate(0, 0, 0.34), blue);
      g.add(fist, cuff, cup);
      g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      g.visible = false;
      this.missileMeshes.push(g);
      this.group.add(g);
      const segs: THREE.Mesh[] = [];
      for (let j = 0; j < ARM_SEG; j++) {
        const m = new THREE.Mesh(segGeo, j % 2 ? grey : new THREE.MeshStandardMaterial({ color: 0xa9b2bc, roughness: 0.3, metalness: 0.5 }));
        m.castShadow = true;
        m.visible = false;
        m.frustumCulled = false;
        segs.push(m);
        this.group.add(m);
      }
      this.armMeshes.push(segs);
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

  /** Envía mensajes a los demás dispositivos (null = un solo jugador). */
  net: ((m: Msg) => void) | null = null;
  private seq = 0;

  private bySlot(slot: number): Kart | null {
    return this.karts.find((k) => k.slot === slot) ?? null;
  }

  private newId(k: Kart): string {
    return `${k.slot}.${this.seq++}`;
  }

  useItem(k: Kart): void {
    if (!k.item || k.rouletteT > 0 || k.hitT > 0 || k.remote) return;
    const item = k.item;
    k.item = null;
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const d =
      item === 'pelota'
        ? { x: k.pos.x + fx * 2.4, y: k.pos.y + 0.8, z: k.pos.z + fz * 2.4, vx: fx * 44 + k.vel.x * 0.3, vz: fz * 44 + k.vel.z * 0.3 }
        : { x: k.pos.x - fx * 2.8, y: k.groundY, z: k.pos.z - fz * 2.8, vx: 0, vz: 0 };
    const id = this.newId(k);
    this.spawnItem(k, item, d, id);
    bus.emit('item:use', { kart: k.index, item });
    this.net?.({ t: 'use', s: k.slot, w: 'item', item, id, ...d, tg: [] });
  }

  private spawnItem(k: Kart, item: ItemId, d: { x: number; y: number; z: number; vx: number; vz: number }, id: string): void {
    if (item === 'turbo') {
      if (!k.remote) k.boost('mini', 1.4);
    } else if (item === 'pelota') {
      const b = this.free(this.balls);
      if (b) Object.assign(b, { on: true, id, x: d.x, y: d.y, z: d.z, vx: d.vx, vz: d.vz, idx: k.idx, t: 0, owner: k.index, bounces: 0, ground: k.pos.y });
    } else {
      let g = this.free(this.gums);
      if (!g) g = this.gums.reduce((a, b) => (a.t > b.t ? a : b));
      Object.assign(g, { on: true, id, x: d.x, y: d.y, z: d.z, t: 0, owner: k.index });
    }
  }

  usePower(k: Kart): void {
    if (k.power < 1 || k.hitT > 0 || k.finished || k.remote) return;
    k.power = 0;
    const tg: number[] = [];
    if (k.char.id === 'esponja' || k.char.id === 'robot') {
      const a = this.kartAhead(k);
      if (a && (k.char.id === 'robot' || (a.progress - k.progress) * this.track.step < 140)) tg.push(a.slot);
    } else if (k.char.id === 'raton') {
      for (const o of this.karts) if (o !== k && o.position < k.position && !o.finished) tg.push(o.slot);
    } else if (k.char.id === 'nieve') {
      for (const o of this.karts) if (o !== k && !o.finished && this.inFrost(k, o)) tg.push(o.slot);
    }
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const m: Msg = { t: 'use', s: k.slot, w: 'power', id: this.newId(k), x: k.pos.x, y: k.pos.y, z: k.pos.z, vx: fx, vz: fz, tg, prog: k.progress + 2.5, lat: k.lat };
    this.runPower(k, m);
    bus.emit('power:use', { kart: k.index, power: k.char.id });
    this.net?.(m);
  }

  /** Mensaje de otro dispositivo: alguien usó un objeto o su poder. */
  applyNetUse(m: Extract<Msg, { t: 'use' }>): void {
    const k = this.bySlot(m.s);
    if (!k) return;
    if (m.w === 'item' && m.item) {
      this.spawnItem(k, m.item, m, m.id);
      bus.emit('item:use', { kart: k.index, item: m.item });
    } else {
      this.runPower(k, m);
      bus.emit('power:use', { kart: k.index, power: k.char.id });
    }
  }

  private runPower(k: Kart, m: Extract<Msg, { t: 'use' }>): void {
    const target = m.tg.length ? this.bySlot(m.tg[0]) : null;
    switch (k.char.id) {
      case 'perro':
        return this.bark(k, m.x, m.y, m.z);
      case 'esponja': {
        const b = this.free(this.bubbles);
        if (b) Object.assign(b, { on: true, id: m.id, x: m.x + m.vx * 2.5, y: m.y + 1.3, z: m.z + m.vz * 2.5, vx: m.vx * 40, vz: m.vz * 40, idx: k.idx, t: 0, owner: k.index, target });
        return;
      }
      case 'raton':
        return this.lightning(k, m.tg.map((s) => this.bySlot(s)).filter((o): o is Kart => !!o));
      case 'zorro':
        if (!k.remote) {
          k.fireT = 3.5;
          k.invulnT = Math.max(k.invulnT, 3.5);
          if (k.hitKind === 'stuck') k.hitT = 0;
        }
        return;
      case 'dino':
        if (!k.remote) {
          k.grounded = false;
          k.vy = 10;
          k.stompPending = true;
        }
        return;
      case 'nieve':
        return this.frost(k, m, m.tg.map((s) => this.bySlot(s)).filter((o): o is Kart => !!o));
      case 'robot': {
        const ms = this.free(this.missiles);
        if (ms) {
          Object.assign(ms, { on: true, phase: 'reach', id: m.id, prog: m.prog ?? k.progress + 2.5, lat: m.lat ?? 0, x: m.x, y: m.y + 1.8, z: m.z, t: 0, owner: k.index, target });
          k.reachT = ARM_REACH_TIME + ARM_BACK_TIME;
        }
        return;
      }
    }
  }

  /** Otro dispositivo dice que un proyectil ya golpeó: se quita aquí también. */
  applyNetKill(id: string): void {
    for (const arr of [this.balls, this.gums, this.bubbles, this.missiles] as { on: boolean; id: string; x: number; y: number; z: number }[][]) {
      for (const o of arr) {
        if (o.on && o.id === id) {
          o.on = false;
          // La mano ya atrapó a su rival en el dispositivo de ese rival: aquí también se encoge y jala.
          if (arr === (this.missiles as unknown)) {
            o.on = true;
            this.grab(o as unknown as Missile, true);
          }
        }
      }
    }
  }

  applyNetBox(i: number): void {
    const b = this.boxes[i];
    if (b) b.respawn = BOX_RESPAWN;
  }

  applyNetQuake(slot: number, x: number, y: number, z: number): void {
    const k = this.bySlot(slot);
    if (k) this.quake(k, x, y, z);
  }

  private kill(id: string): void {
    this.net?.({ t: 'kill', id });
  }

  private kartAhead(k: Kart): Kart | null {
    const o = this.order();
    const i = o.indexOf(k);
    for (let j = i - 1; j >= 0; j--) if (!o[j].finished) return o[j];
    return null;
  }

  /** Solo se golpea a los karts que simula este dispositivo; de los demás se encarga su dueño. */
  private hit(k: Kart, kind: Parameters<Kart['applyHit']>[0], by: number): boolean {
    if (k.remote) return false;
    return k.applyHit(kind, by);
  }

  private bark(k: Kart, x: number, y: number, z: number): void {
    for (let i = 0; i < 3; i++) this.ring(x, y + 0.8 + i * 0.4, z, 16, 0.55, i * 0.12, 0xffe9a8);
    for (const o of this.karts) {
      if (o === k) continue;
      const d = Math.hypot(o.pos.x - x, o.pos.z - z);
      if (d < 16 && Math.abs(o.pos.y - y) < 4) this.hit(o, 'spin', k.index);
    }
    // El ladrido también se lleva por delante pelotas y chicles cercanos.
    for (const b of this.balls) if (b.on && Math.hypot(b.x - x, b.z - z) < 16) b.on = false;
    for (const g of this.gums) if (g.on && Math.hypot(g.x - x, g.z - z) < 16) g.on = false;
  }

  private lightning(k: Kart, targets: Kart[]): void {
    let n = 0;
    for (const o of targets) {
      const b = this.bolts[n++];
      if (!b) break;
      b.on = true;
      b.t = 0;
      b.target = o;
      this.hit(o, 'shrink', k.index);
    }
    bus.emit('fx:lightning', { kart: k.index });
  }

  /** Alcance del aliento helado: un cono hacia delante (hasta 34 m) y un círculo pequeño alrededor. */
  private inFrost(k: Kart, o: Kart): boolean {
    const dx = o.pos.x - k.pos.x;
    const dz = o.pos.z - k.pos.z;
    if (Math.abs(o.pos.y - k.pos.y) > 4) return false;
    const d = Math.hypot(dx, dz);
    if (d < 9) return true;
    const fwd = dx * Math.sin(k.heading) + dz * Math.cos(k.heading);
    const side = Math.abs(dx * Math.cos(k.heading) - dz * Math.sin(k.heading));
    return fwd > 0 && fwd < 34 && side < 4 + fwd * 0.22;
  }

  /** Aliento helado de Copito: nube de escarcha hacia delante y congela a los rivales elegidos. */
  private frost(k: Kart, m: { x: number; y: number; z: number; vx: number; vz: number }, targets: Kart[]): void {
    const sx = m.vz;
    const sz = -m.vx;
    for (let i = 0; i < 46; i++) {
      const sp = 16 + Math.random() * 22;
      const sd = (Math.random() - 0.5) * 0.7;
      const vx = (m.vx + sx * sd) * sp;
      const vz = (m.vz + sz * sd) * sp;
      const col = Math.random() < 0.5 ? 0xe8f8ff : 0x9fdcff;
      this.dust.spawn(m.x + m.vx * 1.8, m.y + 1.2, m.z + m.vz * 1.8, vx, 0.5 + Math.random() * 1.5, vz, 0.9, 1.2, 3, col, 0.6, -0.3, 1.2);
    }
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 6;
      this.sparks.spawn(m.x, m.y + 1, m.z, Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp, 0.6, 0.6, 0.1, 0xdff6ff, 1, 4, 2);
    }
    this.ring(m.x, m.y + 0.4, m.z, 9, 0.45, 0, 0xbfeaff);
    let n = 0;
    for (const o of targets) {
      if (this.hit(o, 'freeze', k.index)) n++;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        this.sparks.spawn(o.pos.x, o.pos.y + 1, o.pos.z, Math.cos(a) * 4, 3 + Math.random() * 2, Math.sin(a) * 4, 0.5, 0.5, 0.1, 0xffffff, 1, 6, 2);
      }
    }
    bus.emit('fx:frost', { kart: k.index, n });
  }

  private quake(k: Kart, x = k.pos.x, y = k.groundY, z = k.pos.z): void {
    this.ring(x, y + 0.3, z, 18, 0.7, 0, 0xffc070);
    this.ring(x, y + 0.3, z, 12, 0.5, 0.1, 0xffc070);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      this.dust.spawn(x + Math.cos(a) * 2, y + 0.3, z + Math.sin(a) * 2, Math.cos(a) * 14, 2 + Math.random() * 2, Math.sin(a) * 14, 0.8, 1, 2.6, 0xd9b98a, 0.6, 3, 2.5);
    }
    for (const o of this.karts) {
      if (o === k) continue;
      const d = Math.hypot(o.pos.x - x, o.pos.z - z);
      if (d < 18 && Math.abs(o.pos.y - y) < 4) this.hit(o, 'tumble', k.index);
    }
    for (const g of this.gums) if (g.on && Math.hypot(g.x - x, g.z - z) < 25) g.on = false;
    bus.emit('fx:quake', { kart: k.index, x, y, z });
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
    for (const k of this.karts) {
      if (k.reachT > 0) k.reachT -= dt;
      if (k.stretchT > 0) k.stretchT -= dt;
    }
    this.updateBoxes(dt, racing);
    if (racing) {
      for (const k of this.karts) {
        // Barra de poder y ruleta (los remotos la traen en su estado).
        if (k.remote) continue;
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
          if (k.remote) continue;
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
            this.net?.({ t: 'box', i });
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
        if (this.hit(k, 'spin', b.owner)) this.kill(b.id);
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
          if (this.hit(k, 'stuck', g.owner)) this.kill(g.id);
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
        if (this.hit(k, 'bubble', b.owner)) this.kill(b.id);
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

  /** Hombro derecho de Robotín en el mundo (de ahí sale el brazo telescópico). */
  private shoulder(k: Kart, out: THREE.Vector3): THREE.Vector3 {
    const h = k.heading;
    const s = k.shrinkScale;
    const lift = k.stretchT > 0 ? 1 : 0;
    return out.set(
      k.pos.x + (Math.cos(h) * 0.52 - Math.sin(h) * 0.35) * s,
      k.pos.y + (1.85 + lift) * s + k.bubbleLift,
      k.pos.z + (-Math.sin(h) * 0.52 - Math.cos(h) * 0.35) * s,
    );
  }

  /** La mano se agarró (a un rival o a la pista): el brazo se encoge y jala a Robotín hacia delante. */
  private grab(m: Missile, caught: boolean): void {
    if (m.phase === 'back') return;
    m.phase = 'back';
    m.t = 0;
    m.gx = m.x;
    m.gy = m.y;
    m.gz = m.z;
    const k = this.karts[m.owner];
    if (!k) return;
    k.reachT = ARM_BACK_TIME;
    k.stretchT = caught ? 1.6 : 1.1;
    if (!k.remote && !k.finished && k.hitT <= 0) {
      const secs = caught ? 2.0 : 1.2;
      k.boost('pad', secs);
      k.speed = Math.max(k.speed, TUNING.maxSpeed * (caught ? 1.25 : 1.1));
      k.invulnT = Math.max(k.invulnT, secs);
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      this.sparks.spawn(m.x, m.y, m.z, Math.cos(a) * 5, 2 + Math.random() * 3, Math.sin(a) * 5, 0.35, 0.7, 0.1, i % 2 ? 0x6ae8ff : 0xffffff, 1, 6, 2);
    }
    bus.emit('fx:grab', { kart: k.index, caught });
  }

  private updateMissiles(dt: number): void {
    const tr = this.track;
    const N = tr.N;
    const o = this.v;
    this.missiles.forEach((m, i) => {
      const obj = this.missileMeshes[i];
      const segs = this.armMeshes[i];
      const owner = this.karts[m.owner];
      if (!m.on || !owner) {
        m.on = false;
        obj.visible = false;
        for (const sg of segs) sg.visible = false;
        return;
      }
      m.t += dt;
      this.shoulder(owner, o);
      let nx: number;
      let ny: number;
      let nz: number;
      let s = tr.samples[0];
      if (m.phase === 'reach') {
        const speed = (TUNING.maxSpeed * 2.6) / tr.step;
        m.prog += speed * dt;
        const t = m.target;
        const idx = Math.floor(m.prog);
        s = tr.samples[((idx % N) + N) % N];
        const s2 = tr.samples[(((idx + 1) % N) + N) % N];
        const f = m.prog - idx;
        if (t && !t.finished) {
          const gap = t.progress - m.prog;
          m.lat += (t.lat - m.lat) * Math.min(1, dt * (gap < 25 ? 6 : 1.5));
        } else m.lat += (owner.lat - m.lat) * Math.min(1, dt * 2);
        nx = s.x + (s2.x - s.x) * f + s.nx * m.lat;
        nz = s.z + (s2.z - s.z) * f + s.nz * m.lat;
        ny = s.y + (s2.y - s.y) * f + 1.3;
        m.x = nx;
        m.y = ny;
        m.z = nz;
        if (t && !t.finished && t.progress - m.prog < 1.5 && Math.abs(t.lat - m.lat) < 3) {
          // ¡Atrapado! La ventosa se pega al rival, que da vueltas.
          m.x = t.pos.x;
          m.y = t.pos.y + 1.2;
          m.z = t.pos.z;
          if (this.hit(t, 'spin', m.owner)) this.kill(m.id);
          this.grab(m, true);
        } else if (m.t > ARM_REACH_TIME) {
          // No llegó (o no hay nadie delante): se agarra de la pista y se jala igual, con menos fuerza.
          this.grab(m, false);
        }
      } else {
        // Encogiendo: la mano vuelve al hombro.
        const u = Math.min(1, m.t / ARM_BACK_TIME);
        const e = u * u;
        nx = m.gx + (o.x - m.gx) * e;
        ny = m.gy + (o.y - m.gy) * e;
        nz = m.gz + (o.z - m.gz) * e;
        if (u >= 1) m.on = false;
        m.x = nx;
        m.y = ny;
        m.z = nz;
      }
      obj.visible = m.on;
      obj.position.set(m.x, m.y, m.z);
      obj.rotation.set(0, Math.atan2(m.x - o.x, m.z - o.z), 0);
      // Tramos telescópicos del hombro a la mano, cada uno más fino y algo solapado con el anterior.
      const dx = m.x - o.x;
      const dy = m.y - o.y;
      const dz = m.z - o.z;
      const len = Math.hypot(dx, dy, dz);
      this.sc.set(dx, dy, dz).divideScalar(Math.max(1e-4, len));
      this.q.setFromUnitVectors(this.up, this.sc);
      const part = len / ARM_SEG;
      for (let j = 0; j < ARM_SEG; j++) {
        const sg = segs[j];
        sg.visible = m.on && len > 0.3;
        if (!sg.visible) continue;
        const a = Math.max(0, j * part - 0.15);
        const b = (j + 1) * part;
        const mid = (a + b) / 2;
        const r = 0.15 - j * 0.022;
        sg.position.set(o.x + this.sc.x * mid, o.y + this.sc.y * mid, o.z + this.sc.z * mid);
        sg.quaternion.copy(this.q);
        sg.scale.set(r, b - a, r);
      }
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

/** Tramos del brazo telescópico de Robotín y sus tiempos (s). */
const ARM_SEG = 5;
const ARM_REACH_TIME = 1.8;
const ARM_BACK_TIME = 0.3;
const BOLT_SEG = 12;
