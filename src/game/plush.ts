// Los peluches, modelados con formas suaves y tela (sheen + relieve de pelusa), a partir de los juguetes de la foto.
// Cada uno devuelve sus partes móviles (cabeza, orejas, brazos, colas) para animarlas al conducir.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CharacterDef } from './characters';

export interface PlushPose {
  steerS: number;
  speed: number;
  t: number;
  /** 1 mientras celebra (cruzó la meta). */
  cheer: number;
  /** 1 mientras recibe un golpe. */
  hurt: number;
  /** Robotín: 1 mientras su brazo derecho está estirado lejos (se oculta el del modelo). */
  reach?: number;
  /** Robotín: 0..1 piernas telescópicas estiradas (se eleva sobre el kart). */
  stretch?: number;
}

export interface PlushRig {
  group: THREE.Group;
  update(p: PlushPose): void;
}

// ---------------- Materiales compartidos ----------------

let furNormal: THREE.Texture | null = null;
/** Mapa de normales de pelusa (trazos cortos), generado una vez. */
function furTexture(): THREE.Texture {
  if (furNormal) return furNormal;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * Math.PI * 2;
    const l = 2 + rnd() * 4;
    const v = Math.floor(90 + rnd() * 120);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // Altura → normales (Sobel, con repetición en los bordes).
  const h = g.getImageData(0, 0, S, S).data;
  const out = g.createImageData(S, S);
  const H = (x: number, y: number): number => h[((((y + S) % S) * S + ((x + S) % S)) * 4)] / 255;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2;
      const dy = (H(x, y + 1) - H(x, y - 1)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  furNormal = t;
  return t;
}

const matCache = new Map<string, THREE.Material>();
function cached(key: string, make: () => THREE.Material): THREE.Material {
  let m = matCache.get(key);
  if (!m) {
    matCache.set(key, (m = make()));
    m.userData.shared = true; // compartido entre peluches: no se libera (render/dispose.ts)
  }
  return m;
}

export class PlushMaterials {
  constructor(private rich: boolean) {}
  /** Tela de peluche. */
  fur(c: number): THREE.Material {
    return cached(`fur${c}${this.rich}`, () =>
      this.rich
        ? new THREE.MeshPhysicalMaterial({
            color: c,
            roughness: 0.92,
            sheen: 1,
            sheenRoughness: 0.55,
            sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.45),
            normalMap: furTexture(),
            normalScale: new THREE.Vector2(0.45, 0.45),
          })
        : new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, normalMap: furTexture(), normalScale: new THREE.Vector2(0.35, 0.35) }),
    );
  }
  /** Plástico o fieltro liso (ojos, botones). */
  flat(c: number, rough = 0.5, emissive = 0): THREE.Material {
    return cached(`flat${c}-${rough}-${emissive}`, () =>
      new THREE.MeshStandardMaterial({ color: c, roughness: rough, emissive: emissive ? c : 0x000000, emissiveIntensity: emissive }),
    );
  }
}

/** Tubo que cambia de grosor a lo largo de la curva (colas esponjosas). */
function taperedTube(curve: THREE.Curve<THREE.Vector3>, radius: (u: number) => number, seg = 18, radial = 10): THREE.BufferGeometry {
  const geo = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    curve.getPointAt(u, c);
    const r = radius(u);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  // Punta redondeada.
  const tip = new THREE.SphereGeometry(radius(1), radial, 8);
  curve.getPointAt(1, c);
  tip.translate(c.x, c.y, c.z);
  const merged = new THREE.BufferGeometry();
  const a = geo.toNonIndexed();
  const b = tip.toNonIndexed();
  for (const name of ['position', 'normal', 'uv']) {
    const A = a.attributes[name] as THREE.BufferAttribute;
    const B = b.attributes[name] as THREE.BufferAttribute;
    const arr = new Float32Array(A.array.length + B.array.length);
    arr.set(A.array as Float32Array);
    arr.set(B.array as Float32Array, A.array.length);
    merged.setAttribute(name, new THREE.BufferAttribute(arr, A.itemSize));
  }
  return merged;
}

const SPH = new THREE.SphereGeometry(1, 28, 18);
const SPH_LO = new THREE.SphereGeometry(1, 14, 10);
const CONE = new THREE.ConeGeometry(1, 1, 18);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
for (const g of [SPH, SPH_LO, CONE, CYL]) g.userData.shared = true;

type V3 = [number, number, number];

class Builder {
  constructor(readonly root: THREE.Object3D, readonly M: PlushMaterials) {}

  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, p: V3, s: V3, r: V3 = [0, 0, 0], parent: THREE.Object3D = this.root): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    m.scale.set(...s);
    m.rotation.set(...r);
    parent.add(m);
    return m;
  }
  sph(mat: THREE.Material, p: V3, s: V3, r?: V3, parent?: THREE.Object3D): THREE.Mesh {
    return this.mesh(SPH, mat, p, s, r, parent);
  }
  group(p: V3, r: V3 = [0, 0, 0], parent: THREE.Object3D = this.root): THREE.Group {
    const g = new THREE.Group();
    g.position.set(...p);
    g.rotation.set(...r);
    parent.add(g);
    return g;
  }
  /** Cápsula de `a` a `b`. */
  limb(mat: THREE.Material, a: V3, b: V3, radius: number, parent: THREE.Object3D = this.root): THREE.Mesh {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const geo = new THREE.CapsuleGeometry(radius, Math.max(0.01, len - radius * 2), 6, 12);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    parent.add(m);
    return m;
  }
  /** Ojo bordado: blanco, iris, pupila y brillo; mira hacia +Z. */
  eye(p: V3, size: number, iris: number, parent: THREE.Object3D = this.root, whiteScale = 1): THREE.Group {
    const g = this.group(p, [0, p[0] * 0.5, 0], parent);
    if (whiteScale > 0) this.mesh(SPH_LO, this.M.flat(0xfbfbf6, 0.6), [0, 0, 0], [size * whiteScale, size * 1.12 * whiteScale, size * 0.35], undefined, g);
    this.mesh(SPH_LO, this.M.flat(iris, 0.4), [0, -size * 0.05, size * 0.22], [size * 0.62, size * 0.7, size * 0.2], undefined, g);
    this.mesh(SPH_LO, this.M.flat(0x111118, 0.3), [0, -size * 0.05, size * 0.3], [size * 0.36, size * 0.42, size * 0.15], undefined, g);
    this.mesh(SPH_LO, this.M.flat(0xffffff, 0.2), [size * 0.18, size * 0.2, size * 0.36], [size * 0.16, size * 0.16, size * 0.08], undefined, g);
    return g;
  }
}

/** Piernas telescópicas de Robotín: tramos, largo de cada tramo y cuánto se eleva. */
const LEG_SEG = 3;
const LEG_LEN = 0.42;
const LEG_RISE = 1;

// Volante del kart en coordenadas del piloto (el piloto está en (0, 0.9, -0.35) del kart).
const WHEEL_L: V3 = [-0.22, 0.42, 0.68];
const WHEEL_R: V3 = [0.22, 0.42, 0.68];

export function buildPlush(c: CharacterDef, M: PlushMaterials): PlushRig {
  const group = new THREE.Group();
  const b = new Builder(group, M);
  const fur = M.fur(c.color);
  const acc = M.fur(c.accent);
  /** Partes animadas. */
  let head: THREE.Object3D = group;
  const ears: THREE.Object3D[] = [];
  const tails: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  /** Tramos de las piernas telescópicas de Robotín: [pierna][tramo], y los pies. */
  const legSegs: THREE.Object3D[][] = [];
  const feet: THREE.Object3D[] = [];

  const armPair = (mat: THREE.Material, shoulderY: number, shoulderX: number, r: number, hand?: THREE.Material): void => {
    for (const sx of [-1, 1]) {
      const pivot = b.group([sx * shoulderX, shoulderY, 0.05]);
      const target = sx < 0 ? WHEEL_L : WHEEL_R;
      const local: V3 = [target[0] - sx * shoulderX, target[1] - shoulderY, target[2] - 0.05];
      b.limb(mat, [0, 0, 0], local, r, pivot);
      b.sph(hand ?? mat, local, [r * 1.35, r * 1.35, r * 1.35], undefined, pivot);
      arms.push(pivot);
    }
  };

  switch (c.id) {
    case 'perro': {
      // Perro café: barriga y hocico claros, orejas en punta, mancha clara en un ojo.
      b.sph(fur, [0, 0.5, 0], [0.56, 0.62, 0.5]);
      b.sph(acc, [0, 0.46, 0.3], [0.4, 0.44, 0.22]);
      head = b.group([0, 1.3, 0]);
      b.sph(fur, [0, 0.05, 0], [0.62, 0.55, 0.54], undefined, head);
      b.sph(acc, [0, -0.12, 0.42], [0.34, 0.25, 0.26], undefined, head);
      b.sph(M.flat(0x3a2414, 0.5), [0, -0.02, 0.66], [0.13, 0.1, 0.09], undefined, head);
      b.sph(acc, [0.2, 0.12, 0.42], [0.2, 0.22, 0.1], undefined, head);
      b.eye([-0.2, 0.12, 0.47], 0.09, 0x2a1a10, head);
      b.eye([0.2, 0.12, 0.5], 0.09, 0x2a1a10, head);
      b.limb(acc, [-0.32, 0.3, 0.42], [-0.1, 0.26, 0.5], 0.035, head);
      b.limb(acc, [0.32, 0.3, 0.42], [0.1, 0.26, 0.5], 0.035, head);
      for (const sx of [-1, 1]) {
        const ear = b.group([sx * 0.3, 0.4, -0.02], [0, 0, -sx * 0.22], head);
        b.mesh(CONE, fur, [0, 0.3, 0], [0.22, 0.62, 0.13], undefined, ear);
        b.mesh(CONE, acc, [0, 0.26, 0.06], [0.13, 0.42, 0.06], undefined, ear);
        ears.push(ear);
      }
      armPair(fur, 0.82, 0.48, 0.12, acc);
      const tail = b.group([0, 0.35, -0.45]);
      b.mesh(CONE, fur, [0, 0.2, -0.05], [0.12, 0.45, 0.12], [-0.5, 0, 0], tail);
      tails.push(tail);
      break;
    }
    case 'esponja': {
      // Esponja cuadrada: agujeros, ojos grandes azules, sonrisa con dientes, camisa blanca, pantalón café y corbata roja.
      const sponge = b.mesh(new RoundedBoxGeometry(1.2, 1.25, 0.62, 3, 0.16), fur, [0, 1.22, 0], [1, 1, 1]);
      void sponge;
      head = b.group([0, 1.22, 0]);
      const hole = M.flat(0xb8941e, 0.95);
      const holes: [number, number, number, number][] = [
        [-0.42, 0.42, 0.31, 0.09], [0.4, 0.45, 0.31, 0.07], [-0.45, -0.15, 0.31, 0.06], [0.44, -0.25, 0.31, 0.08], [0.1, 0.5, 0.31, 0.05],
        [-0.3, 0.3, -0.31, 0.1], [0.25, 0.1, -0.31, 0.08], [-0.15, -0.3, -0.31, 0.07], [0.38, 0.45, -0.31, 0.06], [0.05, 0.45, -0.31, 0.05],
        [0.6, 0.2, 0.1, 0.08], [-0.6, 0.05, -0.1, 0.08],
      ];
      for (const [x, y, z, r] of holes) {
        const side = Math.abs(x) > 0.55;
        b.sph(hole, [x, y, z], side ? [0.03, r, r] : [r, r, 0.03], undefined, head);
      }
      b.eye([-0.24, 0.2, 0.32], 0.2, 0x3a8fd8, head);
      b.eye([0.24, 0.2, 0.32], 0.2, 0x3a8fd8, head);
      for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) b.limb(M.flat(0x15151c), [sx * 0.24 + k * 0.08, 0.43, 0.36], [sx * 0.24 + k * 0.11, 0.53, 0.38], 0.012, head);
      b.mesh(CYL, fur, [0, 0.02, 0.42], [0.07, 0.24, 0.07], [Math.PI / 2 - 0.3, 0, 0], head);
      b.sph(M.flat(0x9a1f22, 0.6), [0, -0.24, 0.31], [0.34, 0.15, 0.05], undefined, head);
      b.sph(M.flat(0xf07a8a, 0.6), [0, -0.3, 0.335], [0.14, 0.06, 0.03], undefined, head);
      for (const sx of [-1, 1]) {
        b.mesh(new THREE.BoxGeometry(1, 1, 1), M.flat(0xffffff, 0.4), [sx * 0.055, -0.15, 0.345], [0.09, 0.1, 0.03], undefined, head);
        b.sph(M.flat(0xe0605a, 0.8), [sx * 0.42, -0.05, 0.315], [0.09, 0.07, 0.02], undefined, head);
      }
      b.mesh(new RoundedBoxGeometry(1.22, 0.34, 0.64, 2, 0.08), M.fur(0x8a5a2b), [0, 0.42, 0], [1, 1, 1]);
      b.mesh(new THREE.BoxGeometry(1.23, 0.12, 0.65), M.fur(0xf6f3ee), [0, 0.62, 0], [1, 1, 1]);
      b.mesh(new THREE.BoxGeometry(1.24, 0.05, 0.66), M.flat(0x1a1a1a), [0, 0.52, 0], [1, 1, 1]);
      b.mesh(CONE, M.fur(0xd8302a), [0, 0.5, 0.35], [0.07, 0.24, 0.03], [Math.PI, 0, 0]);
      armPair(fur, 0.86, 0.62, 0.06, fur);
      break;
    }
    case 'raton': {
      // Ratón eléctrico amarillo: orejas largas con punta negra, mejillas rojas, cola en zigzag y rayas en la espalda.
      b.sph(fur, [0, 0.55, 0], [0.52, 0.6, 0.46]);
      b.limb(M.fur(0x8a5a2b), [-0.25, 0.75, -0.42], [0.25, 0.75, -0.42], 0.06);
      b.limb(M.fur(0x8a5a2b), [-0.22, 0.55, -0.44], [0.22, 0.55, -0.44], 0.05);
      head = b.group([0, 1.28, 0.02]);
      b.sph(fur, [0, 0, 0], [0.55, 0.5, 0.5], undefined, head);
      b.eye([-0.19, 0.08, 0.42], 0.1, 0x111118, head, 0.75);
      b.eye([0.19, 0.08, 0.42], 0.1, 0x111118, head, 0.75);
      for (const sx of [-1, 1]) {
        b.sph(M.fur(0xd8302a), [sx * 0.34, -0.1, 0.34], [0.11, 0.11, 0.05], [0, sx * 0.7, 0], head);
        const ear = b.group([sx * 0.24, 0.32, 0], [0, 0, -sx * 0.32], head);
        b.mesh(CONE, fur, [0, 0.38, 0], [0.14, 0.76, 0.1], undefined, ear);
        b.mesh(CONE, M.fur(0x1a1a1f), [0, 0.67, 0], [0.083, 0.2, 0.062], undefined, ear);
        ears.push(ear);
      }
      b.sph(M.flat(0x6a2020, 0.6), [0, -0.12, 0.47], [0.06, 0.035, 0.03], undefined, head);
      armPair(fur, 0.75, 0.42, 0.09);
      const tail = b.group([0, 0.55, -0.45]);
      const zig: V3[] = [[0, 0, 0], [0.18, 0.3, -0.15], [-0.15, 0.55, -0.25], [0.25, 0.9, -0.35]];
      for (let i = 0; i < zig.length - 1; i++) b.limb(i === 0 ? M.fur(0x8a5a2b) : fur, zig[i], zig[i + 1], 0.07 + i * 0.03, tail);
      tails.push(tail);
      break;
    }
    case 'zorro': {
      // Zorro naranja de nueve colas: orejas grandes con interior negro, collar azul con placa, mirada decidida.
      b.sph(fur, [0, 0.5, 0], [0.5, 0.56, 0.46]);
      b.mesh(new THREE.TorusGeometry(0.4, 0.07, 10, 28), M.fur(0x8fc8f0), [0, 0.9, 0.02], [1, 1, 1], [Math.PI / 2 - 0.15, 0, 0]);
      b.mesh(CYL, M.flat(0xc8d0d8, 0.25), [0, 0.86, 0.44], [0.09, 0.02, 0.09], [Math.PI / 2, 0, 0]);
      head = b.group([0, 1.3, 0]);
      b.sph(fur, [0, 0, 0], [0.6, 0.52, 0.52], undefined, head);
      b.sph(M.fur(0xf6b070), [0, -0.12, 0.38], [0.26, 0.18, 0.18], undefined, head);
      for (const sx of [-1, 1]) {
        b.eye([sx * 0.22, 0.04, 0.44], 0.14, 0x2a2a35, head);
        b.limb(M.flat(0x15151c), [sx * 0.08, 0.2, 0.5], [sx * 0.36, 0.14, 0.4], 0.025, head);
        const ear = b.group([sx * 0.3, 0.36, 0], [0, 0, -sx * 0.32], head);
        b.mesh(CONE, fur, [0, 0.3, 0], [0.27, 0.66, 0.13], undefined, ear);
        b.mesh(CONE, M.fur(0x22222a), [0, 0.27, 0.06], [0.17, 0.48, 0.06], undefined, ear);
        ears.push(ear);
      }
      b.sph(M.flat(0x15151c), [0, -0.05, 0.53], [0.05, 0.035, 0.03], undefined, head);
      armPair(fur, 0.78, 0.44, 0.1);
      // Nueve colas en abanico (tubos curvos).
      for (let i = 0; i < 9; i++) {
        const a = (i / 8 - 0.5) * 3.0;
        const lift = ((i % 3) - 1) * 0.25;
        const pivot = b.group([0, 0.35, -0.38], [lift, a, 0]);
        const len = 1.15 + (i % 2) * 0.25;
        const curl = (i % 2 ? 1 : -1) * 0.22;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(curl * 0.3, 0.05, -0.45 * len),
          new THREE.Vector3(curl, 0.25, -0.95 * len),
          new THREE.Vector3(curl * 0.5, 0.6, -1.2 * len),
        ]);
        pivot.add(new THREE.Mesh(taperedTube(curve, (u) => 0.07 + Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.11 + (1 - u) * 0.03), fur));
        tails.push(pivot);
      }
      break;
    }
    case 'dino': {
      // Dinosaurio verde: barriga crema grande, cabeza redonda con hocico, cuernito y cola gruesa.
      b.sph(fur, [0, 0.55, 0], [0.6, 0.66, 0.55]);
      b.sph(acc, [0, 0.5, 0.28], [0.48, 0.56, 0.32]);
      head = b.group([0, 1.35, 0.05]);
      b.sph(fur, [0, 0, 0], [0.55, 0.48, 0.58], undefined, head);
      b.sph(fur, [0, -0.1, 0.4], [0.42, 0.3, 0.34], undefined, head);
      for (const sx of [-1, 1]) {
        b.sph(fur, [sx * 0.28, 0.28, 0.18], [0.17, 0.17, 0.17], undefined, head);
        b.eye([sx * 0.3, 0.32, 0.3], 0.1, 0x2a2a35, head);
        b.sph(M.flat(0x3a5a30, 0.6), [sx * 0.1, -0.02, 0.72], [0.035, 0.025, 0.02], undefined, head);
      }
      b.mesh(CONE, acc, [0, 0.55, 0.05], [0.09, 0.2, 0.09], undefined, head);
      armPair(fur, 0.82, 0.5, 0.12);
      const tail = b.group([0, 0.4, -0.5]);
      b.mesh(CONE, fur, [0, 0, -0.45], [0.28, 0.9, 0.28], [-Math.PI / 2 + 0.25, 0, 0], tail);
      tails.push(tail);
      break;
    }
    case 'robot': {
      // Robot rojo de juguete: brazos grises articulados, visor con ojos que brillan, antena y ventosas azules.
      const red = M.flat(c.color, 0.35);
      const grey = M.flat(0x9aa3ad, 0.3);
      b.mesh(new RoundedBoxGeometry(0.9, 0.8, 0.56, 3, 0.12), red, [0, 0.72, 0], [1, 1, 1]);
      b.mesh(new RoundedBoxGeometry(0.5, 0.36, 0.06, 2, 0.04), grey, [0, 0.76, 0.29], [1, 1, 1]);
      [0xffd23a, 0x3fb24a, 0x2f7de0].forEach((col, i) => b.sph(M.flat(col, 0.3, 0.4), [-0.14 + i * 0.14, 0.76, 0.33], [0.05, 0.05, 0.03]));
      b.mesh(new RoundedBoxGeometry(0.5, 0.55, 0.25, 2, 0.06), grey, [0, 0.75, -0.38], [1, 1, 1]);
      b.mesh(CYL, grey, [0, 1.18, 0], [0.12, 0.15, 0.12]);
      head = b.group([0, 1.45, 0]);
      b.mesh(new RoundedBoxGeometry(0.66, 0.52, 0.52, 3, 0.1), red, [0, 0, 0], [1, 1, 1], undefined, head);
      b.mesh(new RoundedBoxGeometry(0.5, 0.18, 0.06, 2, 0.04), M.flat(0x1a2440, 0.2), [0, 0.02, 0.27], [1, 1, 1], undefined, head);
      for (const sx of [-1, 1]) {
        b.sph(M.flat(0x6ae8ff, 0.2, 1.6), [sx * 0.12, 0.02, 0.31], [0.06, 0.06, 0.03], undefined, head);
        b.mesh(CYL, grey, [sx * 0.36, 0, 0], [0.09, 0.08, 0.09], [0, 0, Math.PI / 2], head);
      }
      b.mesh(CYL, grey, [0, 0.38, 0], [0.025, 0.28, 0.025], undefined, head);
      b.sph(M.flat(0xffd23a, 0.3, 0.6), [0, 0.55, 0], [0.07, 0.07, 0.07], undefined, head);
      ears.push(head.children[head.children.length - 1]);
      // Brazos articulados con ventosas.
      for (const sx of [-1, 1]) {
        const pivot = b.group([sx * 0.52, 0.95, 0]);
        b.sph(red, [0, 0, 0], [0.14, 0.14, 0.14], undefined, pivot);
        const target = sx < 0 ? WHEEL_L : WHEEL_R;
        const local: V3 = [target[0] - sx * 0.52, target[1] - 0.95, target[2]];
        const elbow: V3 = [local[0] * 0.5 + sx * 0.12, local[1] * 0.5 - 0.12, local[2] * 0.5];
        b.limb(grey, [0, 0, 0], elbow, 0.06, pivot);
        b.sph(grey, elbow, [0.08, 0.08, 0.08], undefined, pivot);
        b.limb(grey, elbow, local, 0.055, pivot);
        b.mesh(CYL, M.flat(0x3a8fe0, 0.3), local, [0.1, 0.04, 0.1], [Math.PI / 2, 0, 0], pivot);
        arms.push(pivot);
      }
      // Piernas telescópicas: tres tramos que se meten uno dentro de otro bajo el cuerpo, con ventosas de pie.
      for (const sx of [-1, 1]) {
        const segs: THREE.Object3D[] = [];
        for (let j = 0; j < LEG_SEG; j++) {
          const m = b.mesh(CYL, j % 2 ? grey : M.flat(0xb8c0c8, 0.3), [sx * 0.24, 0.2, 0.02], [0.11 - j * 0.017, LEG_LEN, 0.11 - j * 0.017]);
          segs.push(m);
        }
        legSegs.push(segs);
        feet.push(b.mesh(CYL, M.flat(0x3a8fe0, 0.3), [sx * 0.24, 0, 0.06], [0.14, 0.05, 0.17]));
      }
      break;
    }
  }

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });

  const earBase = ears.map((e) => e.rotation.z);
  const tailBase = tails.map((t) => t.rotation.y);
  const armBase = arms.map((a) => a.rotation.x);
  // Al celebrar, los brazos suben y se abren hacia afuera para no atravesar la cabeza.
  // Orden ZYX: primero se levanta el brazo (X) y luego se abre hacia el lado (Z).
  // El robot tiene hombros anchos y codos, y ya celebra sin chocar.
  const spread = c.id === 'robot' ? 0 : 1;
  const legTop = 0.42;
  if (spread) for (const a of arms) a.rotation.order = 'ZYX';
  return {
    group,
    update(p: PlushPose) {
      const sp = Math.min(1, Math.abs(p.speed) / 30);
      const stretch = p.stretch ?? 0;
      const rise = stretch * LEG_RISE;
      // Al estirar las piernas, Robotín levanta los brazos de alegría.
      const cheer = Math.max(p.cheer, stretch);
      p = { ...p, cheer };
      head.rotation.y = -p.steerS * 0.28;
      head.rotation.z = p.steerS * 0.08 + Math.sin(p.t * 3) * 0.02 * (1 - sp) + p.hurt * Math.sin(p.t * 25) * 0.15;
      head.rotation.x = -sp * 0.06 + p.cheer * -0.2;
      ears.forEach((e, i) => {
        e.rotation.z = earBase[i] + Math.sin(p.t * 9 + i) * 0.08 * sp + p.hurt * 0.3 * (i % 2 ? 1 : -1);
        e.rotation.x = -sp * 0.35;
      });
      tails.forEach((t, i) => {
        t.rotation.y = tailBase[i] + Math.sin(p.t * 6 + i * 0.7) * 0.18 + p.steerS * 0.3;
        t.rotation.x = -sp * 0.4;
      });
      arms.forEach((a, i) => {
        a.rotation.x = armBase[i] - p.cheer * 2.4 * (0.8 + 0.2 * Math.sin(p.t * 10 + i * 3));
        const side = i % 2 ? 1 : -1;
        a.rotation.z = p.steerS * 0.12 * side - side * spread * p.cheer * (1.0 + 0.12 * Math.sin(p.t * 10 + i * 3));
      });
      group.position.y = Math.abs(Math.sin(p.t * 14)) * 0.03 * sp + p.cheer * Math.abs(Math.sin(p.t * 8)) * 0.15 * (1 - stretch) + rise;
      if (legSegs.length) {
        // Cada tramo baja un poco más que el anterior hasta tocar el asiento (y = 0 del kart → −group.y aquí).
        const bottom = -group.position.y;
        const total = legTop - bottom;
        legSegs.forEach((segs, li) => {
          segs.forEach((m, j) => {
            const top = legTop - (j * Math.max(0, total - LEG_LEN)) / (LEG_SEG - 1);
            m.position.y = top - LEG_LEN / 2;
          });
          feet[li].position.y = Math.min(0.02, bottom + 0.02);
        });
        // El brazo derecho viaja lejos convertido en mano telescópica.
        if (arms[1]) arms[1].visible = !(p.reach && p.reach > 0);
      }
    },
  };
}
