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
  readonly facing: THREE.Vector3;

  constructor(
    readonly pos: THREE.Vector3,
    yaw: number,
    tex: Textures,
    private mats: PlushMaterials,
    private confetti: Particles,
  ) {
    const g = this.group;
    g.position.copy(pos);
    g.rotation.y = yaw;
    this.facing = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
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

  /** Coloca a los tres primeros (en orden de llegada). */
  show(top: CharacterDef[]): void {
    this.group.visible = true;
    this.t = 0;
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
