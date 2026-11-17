// Partículas en un pool fijo (THREE.Points con shader propio): chispas de derrape, llamas de turbo y polvo.
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute float size;
attribute vec4 pcolor;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d) * vColor.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

export class Particles {
  readonly points: THREE.Points;
  private n = 0;
  /** Tope de partículas vivas (≤ max): baja en pantalla dividida. */
  limit: number;
  private readonly p: Float32Array;
  private readonly v: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array; // [s0, s1]
  private readonly col: Float32Array;
  private readonly phys: Float32Array; // [gravedad, rozamiento]
  private readonly aPos: THREE.BufferAttribute;
  private readonly aSize: THREE.BufferAttribute;
  private readonly aCol: THREE.BufferAttribute;
  private readonly mat: THREE.ShaderMaterial;

  constructor(readonly max: number, additive: boolean) {
    this.limit = max;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max * 2);
    this.col = new Float32Array(max * 4);
    this.phys = new Float32Array(max * 2);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('size', this.aSize);
    geo.setAttribute('pcolor', this.aCol);
    geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  /** `color` en sRGB hexadecimal (el shader escribe el color tal cual). */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, color: number, alpha = 1, gravity = 0, drag = 0): void {
    if (this.n >= Math.min(this.max, this.limit)) return;
    const i = this.n++;
    this.p.set([x, y, z], i * 3);
    this.v.set([vx, vy, vz], i * 3);
    this.life[i] = this.maxLife[i] = life;
    this.size[i * 2] = s0;
    this.size[i * 2 + 1] = s1;
    this.col.set([((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255, alpha], i * 4);
    this.phys[i * 2] = gravity;
    this.phys[i * 2 + 1] = drag;
  }

  private copy(from: number, to: number): void {
    this.p.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.v.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.size.copyWithin(to * 2, from * 2, from * 2 + 2);
    this.col.copyWithin(to * 4, from * 4, from * 4 + 4);
    this.phys.copyWithin(to * 2, from * 2, from * 2 + 2);
  }

  update(dt: number, cam: THREE.PerspectiveCamera, viewportHeight: number): void {
    this.mat.uniforms.uScale.value = viewportHeight / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const P = this.aPos.array as Float32Array;
    const SZ = this.aSize.array as Float32Array;
    const C = this.aCol.array as Float32Array;
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.n--;
        if (i !== this.n) this.copy(this.n, i);
        continue;
      }
      const g = this.phys[i * 2];
      const drag = Math.max(0, 1 - this.phys[i * 2 + 1] * dt);
      this.v[i * 3] *= drag;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * drag - g * dt;
      this.v[i * 3 + 2] *= drag;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      P[i * 3] = this.p[i * 3];
      P[i * 3 + 1] = this.p[i * 3 + 1];
      P[i * 3 + 2] = this.p[i * 3 + 2];
      SZ[i] = this.size[i * 2] + (this.size[i * 2 + 1] - this.size[i * 2]) * t;
      C[i * 4] = this.col[i * 4];
      C[i * 4 + 1] = this.col[i * 4 + 1];
      C[i * 4 + 2] = this.col[i * 4 + 2];
      C[i * 4 + 3] = this.col[i * 4 + 3] * (1 - t * t);
      i++;
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aCol.needsUpdate = true;
  }

  get count(): number {
    return this.n;
  }
}
