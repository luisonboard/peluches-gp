// Pista: línea central (Catmull-Rom cerrada) muestreada cada ~1 m, con altura y ancho suavizados.
// Las consultas de posición usan una ventana alrededor del último índice conocido (barato y sin saltos entre tramos).
import * as THREE from 'three';

export type Surface = 'floor' | 'ramp' | 'bed';

export interface CtrlPt {
  x: number;
  z: number;
  /** Altura (sin escalar). */
  y: number;
  /** Medio ancho del asfalto (sin escalar). */
  hw: number;
}

export interface PadDef {
  /** Punto de control y fracción hacia el siguiente. */
  seg: number;
  f: number;
  /** Desplazamiento lateral en metros (+ = derecha). */
  lat: number;
}

export interface TrackDef {
  name: string;
  /** Escala horizontal de los puntos. */
  scale: number;
  /** Ancho de la franja de alfombra entre la curva y la barrera. */
  shoulder: number;
  points: CtrlPt[];
  pads: PadDef[];
  /** Puntos de control donde van las cajas regalo (hito 2). */
  itemRows: { seg: number; f: number }[];
}

export interface Sample {
  x: number;
  y: number;
  z: number;
  /** Tangente horizontal unitaria. */
  tx: number;
  tz: number;
  /** Normal horizontal hacia la DERECHA de la marcha. */
  nx: number;
  nz: number;
  hw: number;
  slope: number;
  /** Curvatura con signo (+ = gira a la derecha), en rad/m. */
  curv: number;
  s: number;
  segF: number;
  surface: Surface;
}

export interface Loc {
  i: number;
  f: number;
  lat: number;
  y: number;
  hw: number;
  slope: number;
  surface: Surface;
  nx: number;
  nz: number;
  tx: number;
  tz: number;
}

export interface Pad {
  i: number;
  lat: number;
  len: number;
  hw: number;
}

export const newLoc = (): Loc => ({ i: 0, f: 0, lat: 0, y: 0, hw: 8, slope: 0, surface: 'floor', nx: 1, nz: 0, tx: 0, tz: 1 });

const smooth = (t: number): number => t * t * (3 - 2 * t);

export class Track {
  readonly samples: Sample[] = [];
  readonly N: number;
  readonly length: number;
  readonly step: number;
  readonly shoulder: number;
  readonly pads: Pad[];
  readonly bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

  constructor(readonly def: TrackDef) {
    const sc = def.scale;
    const P = def.points;
    const M = P.length;
    const curve = new THREE.CatmullRomCurve3(
      P.map((p) => new THREE.Vector3(p.x * sc, 0, p.z * sc)),
      true,
      'centripetal',
    );
    curve.arcLengthDivisions = 4000;
    this.length = curve.getLength();
    this.N = Math.round(this.length);
    this.step = this.length / this.N;
    this.shoulder = def.shoulder;
    const pt = new THREE.Vector3();
    const tan = new THREE.Vector3();
    for (let i = 0; i < this.N; i++) {
      const u = i / this.N;
      curve.getPointAt(u, pt);
      curve.getTangentAt(u, tan);
      tan.y = 0;
      tan.normalize();
      const segF = curve.getUtoTmapping(u, 0) * M;
      const seg = Math.min(M - 1, Math.floor(segF));
      const fr = smooth(segF - seg);
      const a = P[seg];
      const b = P[(seg + 1) % M];
      const y = a.y + (b.y - a.y) * fr;
      const hw = a.hw + (b.hw - a.hw) * fr;
      this.samples.push({
        x: pt.x, y, z: pt.z, tx: tan.x, tz: tan.z, nx: -tan.z, nz: tan.x, hw, slope: 0, curv: 0,
        s: i * this.step, segF, surface: y > 7.5 ? 'bed' : y > 0.05 ? 'ramp' : 'floor',
      });
      const bd = this.bounds;
      bd.minX = Math.min(bd.minX, pt.x);
      bd.maxX = Math.max(bd.maxX, pt.x);
      bd.minZ = Math.min(bd.minZ, pt.z);
      bd.maxZ = Math.max(bd.maxZ, pt.z);
    }
    const S = this.samples;
    const N = this.N;
    const K = 6;
    for (let i = 0; i < N; i++) {
      const p = S[(i - 1 + N) % N];
      const n = S[(i + 1) % N];
      S[i].slope = (n.y - p.y) / (2 * this.step);
      const j = S[(i + K) % N];
      S[i].curv = ((j.tx - S[i].tx) * S[i].nx + (j.tz - S[i].tz) * S[i].nz) / (K * this.step);
    }
    this.pads = def.pads.map((p) => ({ i: this.indexAtSeg(p.seg, p.f), lat: p.lat, len: 7, hw: 2.3 }));
  }

  /** Índice de muestra donde la curva pasa por el punto de control `seg` + fracción `f`. */
  indexAtSeg(seg: number, f: number): number {
    const target = seg + f;
    const S = this.samples;
    for (let i = 0; i < this.N; i++) if (S[i].segF >= target) return i;
    return 0;
  }

  /** Localiza (x, z) cerca del índice `hint`. `win` = muestras hacia atrás (hacia delante, el doble). */
  locate(x: number, z: number, hint: number, out: Loc, win = 16): Loc {
    const S = this.samples;
    const N = this.N;
    let best = hint;
    let bd = Infinity;
    const full = win * 3 >= N;
    const lo = full ? 0 : -win;
    const hi = full ? N : win * 2;
    for (let k = lo; k < hi; k++) {
      const i = full ? k : (((hint + k) % N) + N) % N;
      const s = S[i];
      const dx = x - s.x;
      const dz = z - s.z;
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    let i = best;
    let s = S[i];
    let along = (x - s.x) * s.tx + (z - s.z) * s.tz;
    if (along < 0) {
      i = (i - 1 + N) % N;
      s = S[i];
      along = (x - s.x) * s.tx + (z - s.z) * s.tz;
    }
    const f = Math.min(1, Math.max(0, along / this.step));
    const s2 = S[(i + 1) % N];
    const px = s.x + (s2.x - s.x) * f;
    const pz = s.z + (s2.z - s.z) * f;
    let nx = s.nx + (s2.nx - s.nx) * f;
    let nz = s.nz + (s2.nz - s.nz) * f;
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    out.i = i;
    out.f = f;
    out.lat = (x - px) * nx + (z - pz) * nz;
    out.y = s.y + (s2.y - s.y) * f;
    out.hw = s.hw + (s2.hw - s.hw) * f;
    out.slope = s.slope + (s2.slope - s.slope) * f;
    out.surface = f < 0.5 ? s.surface : s2.surface;
    out.nx = nx;
    out.nz = nz;
    out.tx = nz;
    out.tz = -nx;
    return out;
  }

  /** Punto en la muestra i desplazado `lat` metros a la derecha. */
  pointAt(i: number, lat: number, out: THREE.Vector3): THREE.Vector3 {
    const s = this.samples[((i % this.N) + this.N) % this.N];
    return out.set(s.x + s.nx * lat, s.y, s.z + s.nz * lat);
  }

  /** Distancia mínima en planta desde (x, z) a la línea central (búsqueda completa). */
  distanceToCenter(x: number, z: number): { d: number; i: number } {
    let bd = Infinity;
    let bi = 0;
    for (let i = 0; i < this.N; i++) {
      const s = this.samples[i];
      const d = (x - s.x) ** 2 + (z - s.z) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return { d: Math.sqrt(bd), i: bi };
  }
}
