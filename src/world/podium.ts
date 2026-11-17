// Podio final: tres bloques de juguete (1, 2, 3) con los tres primeros peluches celebrando, y confeti.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterDef } from '../game/characters';
import { buildPlush, type PlushMaterials, type PlushRig } from '../game/plush';
import type { Textures } from './textures';
import type { Particles } from '../fx/particles';

const STEPS = [
  { place: 1, x: 0, h: 3.0, color: '#ffc928' },
  { place: 2, x: -3.7, h: 2.1, color: '#c9d3df' },
  { place: 3, x: 3.7, h: 1.4, color: '#e0995a' },
];

export class Podium {
  readonly group = new THREE.Group();
  private rigs: (PlushRig | null)[] = [null, null, null];
  private holders: THREE.Group[] = [];
  private cache = new Map<string, PlushRig>();
  private t = 0;
  /** Hacia dónde mira el podio (unitario, en el plano). */
  readonly facing = new THREE.Vector3();

  constructor(
    readonly pos: THREE.Vector3,
    yaw: number,
    tex: Textures,
    private mats: PlushMaterials,
    private confetti: Particles,
  ) {
    const g = this.group;
    this.place(pos.x, pos.y, pos.z, yaw);
    for (const s of STEPS) {
      const side = new THREE.MeshStandardMaterial({ map: tex.letter(String(s.place), s.color), roughness: 0.45 });
      const top = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.4 });
      const block = new THREE.Mesh(new RoundedBoxGeometry(3.4, s.h, 3.4, 2, 0.25), [side, side, top, top, side, side]);
      block.position.set(s.x, s.h / 2, 0);
      block.castShadow = block.receiveShadow = true;
      g.add(block);
      const holder = new THREE.Group();
      holder.position.set(s.x, s.h, 0);
      holder.scale.setScalar(1.35);
      g.add(holder);
      this.holders.push(holder);
    }
    g.visible = false;
  }

  /** Pone el podio en otro sitio (cada pista tiene el suyo). */
  place(x: number, y: number, z: number, yaw: number): void {
    this.pos.set(x, y, z);
    this.group.position.copy(this.pos);
    this.group.rotation.y = yaw;
    this.facing.set(Math.sin(yaw), 0, Math.cos(yaw));
  }

  private trophies: THREE.Group[] = [];

  /** Trofeos de oro, plata y bronce delante de cada escalón (final de la copa). */
  private buildTrophies(): void {
    const colors = [0xffc928, 0xd7dee8, 0xd0844a];
    const profile = [
      [0, 0], [0.55, 0], [0.55, 0.14], [0.16, 0.24], [0.13, 0.62], [0.2, 0.72], [0.62, 0.9], [0.72, 1.35], [0.66, 1.38], [0.5, 1.0], [0, 0.95],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const cup = new THREE.LatheGeometry(profile, 24);
    const handle = new THREE.TorusGeometry(0.26, 0.06, 8, 16, Math.PI);
    STEPS.forEach((s, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.25, metalness: 0.35, emissive: colors[i], emissiveIntensity: 0.12 });
      const g = new THREE.Group();
      g.add(new THREE.Mesh(cup, mat));
      for (const side of [-1, 1]) {
        const h = new THREE.Mesh(handle, mat);
        h.rotation.z = side * Math.PI / 2;
        h.position.set(side * 0.68, 1.05, 0);
        g.add(h);
      }
      g.scale.setScalar(1.1 - i * 0.12);
      g.position.set(s.x, 0, 2.2);
      g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      this.group.add(g);
      this.trophies.push(g);
    });
  }

  /** Coloca a los tres primeros (en orden de llegada). `trophies`: final de la copa. */
  show(top: CharacterDef[], trophies = false): void {
    this.group.visible = true;
    this.t = 0;
    if (trophies && !this.trophies.length) this.buildTrophies();
    this.trophies.forEach((t, i) => (t.visible = trophies && !!top[i]));
    for (let i = 0; i < 3; i++) {
      const h = this.holders[i];
      h.clear();
      const c = top[i];
      if (!c) {
        this.rigs[i] = null;
        continue;
      }
      let rig = this.cache.get(c.id);
      if (!rig) this.cache.set(c.id, (rig = buildPlush(c, this.mats)));
      h.add(rig.group);
      rig.group.position.set(0, 0, 0);
      this.rigs[i] = rig;
    }
  }

  hide(): void {
    this.group.visible = false;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;
    this.rigs.forEach((r, i) => {
      if (!r) return;
      r.update({ steerS: Math.sin(this.t * 2 + i) * 0.4, speed: 0, t: this.t + i * 0.7, cheer: 1, hurt: 0 });
      this.holders[i].rotation.y = Math.sin(this.t * 1.5 + i) * 0.25;
      const tr = this.trophies[i];
      if (tr?.visible) tr.rotation.y = this.t * 1.2 + i;
    });
    // Confeti cayendo.
    const cols = [0xe8423a, 0x2f7de0, 0x3fb24a, 0xffd23a, 0xf07ab0, 0x8a4fd8];
    const n = Math.floor(dt * 90 + Math.random());
    for (let i = 0; i < n; i++) {
      const x = this.pos.x + (Math.random() - 0.5) * 16;
      const z = this.pos.z + (Math.random() - 0.5) * 8;
      this.confetti.spawn(x, this.pos.y + 13, z, (Math.random() - 0.5) * 2, -2 - Math.random() * 2, (Math.random() - 0.5) * 2, 4, 0.35, 0.3, cols[i % cols.length], 1, 0.6, 0.4);
    }
  }
}
