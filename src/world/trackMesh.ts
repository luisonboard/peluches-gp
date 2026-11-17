// Malla de la pista: asfalto, bordillos, alfombra lateral, barreras de juguete, faldón de cartón bajo las rampas,
// línea de salida con arco y placas de turbo.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Track, Sample } from '../game/track';
import type { Textures } from './textures';
import type { Quality } from '../core/quality';
import type { TrackLook } from './tracks';

const CURB = 1.0;
/** Distancia extra fuera de la alfombra donde termina la plataforma (ahí se apoyan las barreras). */
export const LIP = 1.1;

export interface TrackVisual {
  group: THREE.Group;
  /** Avanza la animación de las placas de turbo. */
  update(dt: number): void;
}

export function buildTrack(track: Track, tex: Textures, q: Quality, look: TrackLook): TrackVisual {
  const g = new THREE.Group();
  g.name = 'track';
  const S = track.samples;
  const N = track.N;
  const sh = track.shoulder;

  const ribbon = (
    latA: (s: Sample) => number,
    latB: (s: Sample) => number,
    yOff: number,
    vScale: number,
    mat: THREE.Material,
    color?: (s: Sample) => THREE.Color,
  ): THREE.Mesh => {
    const pos = new Float32Array((N + 1) * 6);
    const uv = new Float32Array((N + 1) * 4);
    const col = color ? new Float32Array((N + 1) * 6) : null;
    for (let k = 0; k <= N; k++) {
      const s = S[k % N];
      const v = (k === N ? track.length : s.s) / vScale;
      const a = latA(s);
      const b = latB(s);
      pos.set([s.x + s.nx * a, s.y + yOff, s.z + s.nz * a, s.x + s.nx * b, s.y + yOff, s.z + s.nz * b], k * 6);
      uv.set([0, v, 1, v], k * 4);
      if (col && color) {
        const c = color(s);
        col.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
      }
    }
    const idx: number[] = [];
    for (let k = 0; k < N; k++) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
  };

  // Asfalto.
  const roadMat = new THREE.MeshStandardMaterial({ map: tex.road, roughness: 0.82, metalness: 0 });
  g.add(ribbon((s) => -s.hw, (s) => s.hw, 0.04, 14, roadMat));

  // Bordillos.
  const curbMat = new THREE.MeshStandardMaterial({ map: tex.curb, roughness: 0.6 });
  g.add(ribbon((s) => -s.hw - CURB, (s) => -s.hw, 0.05, 3, curbMat));
  g.add(ribbon((s) => s.hw, (s) => s.hw + CURB, 0.05, 3, curbMat));

  // Franja lateral, con el color de cada superficie (en el cuarto: alfombra verde, cartón en la rampa, fieltro en la cama).
  const feltMat = new THREE.MeshStandardMaterial({ map: tex.felt, roughness: 1, vertexColors: true });
  const shoulderCols = new Map<string, THREE.Color>();
  const shoulderColor = (s: Sample): THREE.Color => {
    let c = shoulderCols.get(s.surface);
    if (!c) shoulderCols.set(s.surface, (c = new THREE.Color(look.shoulder[s.surface] ?? look.shoulder.floor)));
    return c;
  };
  g.add(ribbon((s) => -(s.hw + sh + LIP), (s) => -s.hw - CURB, 0.03, 6, feltMat, shoulderColor));
  g.add(ribbon((s) => s.hw + CURB, (s) => s.hw + sh + LIP, 0.03, 6, feltMat, shoulderColor));

  // Faldón bajo las partes elevadas (en el cuarto, cartón bajo las rampas y la cama), teñido por superficie.
  const skirtTint = look.skirt?.tint;
  const skirtMat = new THREE.MeshStandardMaterial({ map: tex[look.skirt?.tex ?? 'cardboard'], roughness: 0.95, side: THREE.DoubleSide, vertexColors: !!skirtTint });
  const white = new THREE.Color(0xffffff);
  const tintCols = new Map<string, THREE.Color>();
  const tintOf = (s: Sample): THREE.Color => {
    const v = skirtTint?.[s.surface];
    if (v === undefined) return white;
    let c = tintCols.get(s.surface);
    if (!c) tintCols.set(s.surface, (c = new THREE.Color(v)));
    return c;
  };
  for (const side of [-1, 1]) {
    const pos = new Float32Array((N + 1) * 6);
    const uv = new Float32Array((N + 1) * 4);
    const col = skirtTint ? new Float32Array((N + 1) * 6) : null;
    for (let k = 0; k <= N; k++) {
      const s = S[k % N];
      const l = side * (s.hw + sh + LIP);
      const x = s.x + s.nx * l;
      const z = s.z + s.nz * l;
      const v = (k === N ? track.length : s.s) / 10;
      pos.set([x, s.y + 0.03, z, x, 0, z], k * 6);
      uv.set([v, s.y / 10, v, 0], k * 4);
      if (col) {
        const c = tintOf(s);
        col.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
      }
    }
    const idx: number[] = [];
    for (let k = 0; k < N; k++) {
      if (S[k].y < 0.02 && S[(k + 1) % N].y < 0.02) continue;
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, skirtMat);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  // Barreras de juguete: bloques de dos colores alternos, según la superficie.
  const spacing = 2.4;
  const per = Math.floor(track.length / spacing);
  const barrierGeo = q.roundedBarriers ? new RoundedBoxGeometry(1.0, 1.3, 2.25, 1, 0.22) : new THREE.BoxGeometry(1.0, 1.3, 2.25);
  const barrierMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 });
  const barriers = new THREE.InstancedMesh(barrierGeo, barrierMat, per * 2);
  barriers.castShadow = q.shadowMap > 0;
  barriers.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const barrierCols = new Map<string, THREE.Color[]>();
  const barrierOf = (s: Sample): THREE.Color[] => {
    let c = barrierCols.get(s.surface);
    if (!c) barrierCols.set(s.surface, (c = (look.barrier[s.surface] ?? look.barrier.floor).map((h) => new THREE.Color(h))));
    return c;
  };
  let n = 0;
  for (const side of [-1, 1]) {
    for (let j = 0; j < per; j++) {
      const sAlong = j * spacing;
      const i = Math.min(N - 1, Math.floor(sAlong / track.step));
      const s = S[i];
      const lat = side * (s.hw + sh + 0.55);
      p.set(s.x + s.nx * lat, s.y + 0.68, s.z + s.nz * lat);
      eul.set(-Math.atan(s.slope), Math.atan2(s.tx, s.tz), 0);
      quat.setFromEuler(eul);
      m4.compose(p, quat, one);
      barriers.setMatrixAt(n, m4);
      barriers.setColorAt(n, barrierOf(s)[j % 2]);
      n++;
    }
  }
  barriers.count = n;
  g.add(barriers);

  // Línea de salida (a cuadros) y arco con pancarta.
  const s0 = S[0];
  const yaw0 = Math.atan2(s0.tx, s0.tz);
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(s0.hw * 2, 2.2),
    new THREE.MeshStandardMaterial({ map: tex.checker, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  line.rotation.order = 'YXZ';
  line.rotation.set(-Math.PI / 2, yaw0, 0);
  line.position.set(s0.x, s0.y + 0.06, s0.z);
  line.receiveShadow = true;
  g.add(line);

  const arch = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe8423a, roughness: 0.5 });
  const halfSpan = s0.hw + sh + 1.6;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 11, 16), postMat);
    post.position.set(side * halfSpan, 5.5, 0);
    post.castShadow = true;
    arch.add(post);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.4 }));
    ball.position.set(side * halfSpan, 11.4, 0);
    arch.add(ball);
  }
  const bannerMats = [
    new THREE.MeshStandardMaterial({ color: 0xffd23a }),
    new THREE.MeshStandardMaterial({ color: 0xffd23a }),
    new THREE.MeshStandardMaterial({ color: 0xffd23a }),
    new THREE.MeshStandardMaterial({ color: 0xffd23a }),
    new THREE.MeshStandardMaterial({ map: tex.banner, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ map: tex.banner, roughness: 0.6 }),
  ];
  const ban = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 2, 3.2, 0.5), bannerMats);
  ban.position.y = 9.4;
  ban.castShadow = true;
  arch.add(ban);
  arch.position.set(s0.x, s0.y, s0.z);
  arch.rotation.y = yaw0 + Math.PI; // la cara +Z de la pancarta mira hacia quien llega
  g.add(arch);

  // Placas de turbo.
  const padTex = tex.pad;
  padTex.repeat.set(1, 2);
  const padMat = new THREE.MeshBasicMaterial({ map: padTex, polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false });
  for (const pd of track.pads) {
    const s = S[(pd.i + Math.floor(pd.len / 2)) % N];
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pd.hw * 2, pd.len), padMat);
    mesh.rotation.order = 'YXZ';
    // El "arriba" del lienzo apunta a -Z local: se gira 180° para que los cheurones miren hacia delante.
    mesh.rotation.set(-Math.PI / 2, Math.atan2(s.tx, s.tz) + Math.PI, 0);
    mesh.position.set(s.x + s.nx * pd.lat, s.y + 0.07, s.z + s.nz * pd.lat);
    g.add(mesh);
  }

  // Charcos de jabón: espuma blanca y azul con burbujas.
  if (track.slicks.length) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const cg = c.getContext('2d')!;
    const grd = cg.createRadialGradient(64, 64, 8, 64, 64, 62);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.6, 'rgba(200,236,255,0.85)');
    grd.addColorStop(1, 'rgba(200,236,255,0)');
    cg.fillStyle = grd;
    cg.beginPath();
    cg.ellipse(64, 64, 62, 62, 0, 0, Math.PI * 2);
    cg.fill();
    cg.strokeStyle = 'rgba(120,190,235,0.9)';
    cg.lineWidth = 3;
    for (const [x, y, r] of [[40, 44, 10], [80, 36, 7], [70, 78, 12], [36, 84, 6], [92, 70, 5]]) {
      cg.beginPath();
      cg.arc(x, y, r, 0, Math.PI * 2);
      cg.stroke();
    }
    const soapTex = new THREE.CanvasTexture(c);
    soapTex.colorSpace = THREE.SRGBColorSpace;
    const soapMat = new THREE.MeshBasicMaterial({ map: soapTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    for (const sl of track.slicks) {
      const s = S[(sl.i + Math.floor(sl.len / 2)) % N];
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sl.hw * 2.2, sl.len * 1.1), soapMat);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(-Math.PI / 2, Math.atan2(s.tx, s.tz), 0);
      mesh.position.set(s.x + s.nx * sl.lat, s.y + 0.08, s.z + s.nz * sl.lat);
      g.add(mesh);
    }
  }

  return {
    group: g,
    update(dt: number) {
      padTex.offset.y = (padTex.offset.y - dt * 1.6) % 1;
    },
  };
}
