// El jardín de noche: césped, cerca con farolitos, pared de la casa con ventanas encendidas, luna y estrellas,
// arroyo (que la pista salta), charco bajo el puente, maceta tumbada como túnel, manguera, flores, arbustos,
// setas que brillan, luciérnagas y luces en el borde de la pista. Todo lo que brilla es emisivo: sin luces puntuales.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Track } from '../game/track';
import type { Textures } from './textures';
import type { Quality } from '../core/quality';
import type { Rng } from '../core/rng';
import { LIP } from './trackMesh';
import { POT_AT } from './gardenTrack';

/** Dirección de la luna (la misma que la luz principal de la pista). */
export const MOON_DIR: [number, number, number] = [-0.45, 0.55, -0.7];

const glow = (color: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color, toneMapped: false });

function grassTexture(rng: Rng, aniso: number): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f5a2c';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const l = rng.range(18, 34);
    g.strokeStyle = `hsl(${rng.range(95, 125)} ${rng.range(30, 50)}% ${l}%)`;
    g.lineWidth = rng.range(1, 2.2);
    const x = rng.next() * S;
    const y = rng.next() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rng.range(-3, 3), y - rng.range(4, 10));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

export function buildGarden(track: Track, tex: Textures, q: Quality, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.name = 'jardin';
  const shadows = q.shadowMap > 0;
  const S = track.samples;
  const N = track.N;
  const b = track.bounds;
  const R = { x0: b.minX - 60, x1: b.maxX + 60, z0: b.minZ - 60, z1: b.maxZ + 60 };
  const W = R.x1 - R.x0;
  const D = R.z1 - R.z0;
  const cx = (R.x0 + R.x1) / 2;
  const cz = (R.z0 + R.z1) / 2;
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const plastic = (c: number | string, rough = 0.6): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness: rough });

  // Césped.
  const grass = grassTexture(rng, q.anisotropy);
  grass.repeat.set(W / 18, D / 18);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 400, D + 400), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.03, cz);
  ground.receiveShadow = true;
  g.add(ground);

  // Cielo: luna y estrellas (no les afecta la niebla).
  const moonDir = new THREE.Vector3(...MOON_DIR).normalize();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(34, 32, 20), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false, toneMapped: false }));
  moon.position.set(cx, 0, cz).addScaledVector(moonDir, 900);
  g.add(moon);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x8fa4ff, transparent: true, opacity: 0.12, fog: false, depthWrite: false }),
  );
  halo.position.copy(moon.position);
  g.add(halo);
  const starN = q.scenery >= 1 ? 500 : 250;
  const starPos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const a = rng.next() * Math.PI * 2;
    const e = Math.asin(rng.range(0.12, 1));
    starPos.set([cx + Math.cos(a) * Math.cos(e) * 1000, Math.sin(e) * 1000, cz + Math.sin(a) * Math.cos(e) * 1000], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })));

  // --- Lo que no debe pisar la pista ---
  const clear = (x: number, z: number, r: number): boolean => {
    const { d, i } = track.distanceToCenter(x, z);
    if (d < S[i].hw + track.shoulder + LIP + r + 4) return false;
    return x - r > R.x0 + 6 && x + r < R.x1 - 6 && z - r > R.z0 + 6 && z + r < R.z1 - 6;
  };

  // Arroyo: cruza la pista donde está el hueco del salto y termina en un estanque dentro del circuito.
  const center = new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1d4f86, emissive: 0x0b2244, roughness: 0.12, metalness: 0.2 });
  const rockMat = plastic(0x6f7480, 0.9);
  const rockGeo = new THREE.SphereGeometry(1, 8, 5);
  const rocks: THREE.Matrix4[] = [];
  const keepOffRoad = (x: number, z: number, r: number): boolean => {
    const { d, i } = track.distanceToCenter(x, z);
    return d > S[i].hw + track.shoulder + LIP + r + 0.5;
  };
  for (const gap of track.gaps) {
    const len = (gap.i1 - gap.i0 + N) % N;
    const mid = S[(gap.i0 + Math.floor(len / 2)) % N];
    const width = len * track.step - 0.6;
    // Hacia dentro del circuito (estanque) y hacia fuera (hasta la cerca).
    const toC = (center.x - mid.x) * mid.nx + (center.z - mid.z) * mid.nz >= 0 ? 1 : -1;
    const inward = 85;
    let outward = 0;
    while (outward < 400) {
      const x = mid.x - mid.nx * toC * outward;
      const z = mid.z - mid.nz * toC * outward;
      if (x < R.x0 || x > R.x1 || z < R.z0 || z > R.z1) break;
      outward += 5;
    }
    const total = inward + outward;
    const yaw = Math.atan2(mid.tx, mid.tz);
    // Plano: X queda a lo largo de la normal de la pista (el arroyo) y su alto a lo largo de la pista (el hueco).
    const creek = new THREE.Mesh(new THREE.PlaneGeometry(total, width), waterMat);
    creek.rotation.order = 'YXZ';
    creek.rotation.set(-Math.PI / 2, yaw, 0);
    const off = (inward - outward) / 2;
    creek.position.set(mid.x + mid.nx * toC * off, 0.05, mid.z + mid.nz * toC * off);
    g.add(creek);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(20, 40), waterMat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(mid.x + mid.nx * toC * inward, 0.05, mid.z + mid.nz * toC * inward);
    g.add(pond);
    // Piedras en las dos orillas, fuera de la pista.
    for (let d = -outward; d < inward; d += 3.2) {
      for (const bank of [-1, 1]) {
        const x = mid.x + mid.nx * toC * d + mid.tx * bank * (width / 2 + rng.range(0, 1.2));
        const z = mid.z + mid.nz * toC * d + mid.tz * bank * (width / 2 + rng.range(0, 1.2));
        const r = rng.range(1.2, 2.6);
        if (!keepOffRoad(x, z, r)) continue;
        rocks.push(new THREE.Matrix4().compose(v.set(x, 0, z), quat.setFromAxisAngle(up, rng.next() * 6), s3.set(r, r * 0.55, r * rng.range(0.8, 1.2))));
      }
    }
    // Cara de madera al final de la rampa (lo que se ve desde la otra orilla).
    const lip = S[(gap.i0 - 1 + N) % N];
    const faceW = (lip.hw + track.shoulder + LIP) * 2;
    const face = new THREE.Mesh(new THREE.BoxGeometry(faceW, lip.y + 4, 0.6), plastic(0x7a4a26, 0.8));
    face.position.set(lip.x + lip.tx * 0.3, (lip.y - 4) / 2, lip.z + lip.tz * 0.3);
    face.rotation.y = yaw;
    face.castShadow = shadows;
    g.add(face);
  }
  if (rocks.length) {
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
    rocks.forEach((mm, i) => rockMesh.setMatrixAt(i, mm));
    rockMesh.receiveShadow = true;
    g.add(rockMesh);
  }

  // Charco bajo el puente de tabla.
  const plankAt = S.findIndex((s) => s.surface === 'plank');
  if (plankAt >= 0) {
    let top = plankAt;
    for (let i = plankAt; i < N && S[i].surface === 'plank'; i++) if (S[i].y > S[top].y) top = i;
    const p = S[top];
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(26, 40), waterMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(1, 0.7, 1);
    puddle.position.set(p.x, 0.04, p.z);
    g.add(puddle);
  }

  // Maceta tumbada: medio enterrada, la pista pasa por dentro.
  const potI = track.indexAtSeg(POT_AT.seg, POT_AT.f);
  const ps = S[potI];
  const potR = ps.hw + track.shoulder + LIP + 2.5;
  const terracotta = new THREE.MeshStandardMaterial({ color: 0xc0622f, roughness: 0.85, side: THREE.DoubleSide });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(potR, potR * 0.86, 30, 40, 1, true, Math.PI / 2, Math.PI), terracotta);
  pot.rotation.order = 'YXZ';
  pot.rotation.set(Math.PI / 2, Math.atan2(ps.tx, ps.tz), 0);
  pot.position.set(ps.x, 0, ps.z);
  pot.castShadow = shadows;
  g.add(pot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(potR + 0.6, 1.4, 10, 40, Math.PI), terracotta);
  rim.rotation.y = Math.atan2(ps.tx, ps.tz);
  rim.position.set(ps.x - ps.tx * 15, 0, ps.z - ps.tz * 15);
  g.add(rim);
  const soil = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), plastic(0x3a2616, 1));
  soil.scale.set(potR * 0.9, 3, 9);
  soil.rotation.y = Math.atan2(ps.tx, ps.tz);
  soil.position.set(ps.x + ps.tx * 19, 0, ps.z + ps.tz * 19);
  // La tierra derramada queda a los lados, no sobre el asfalto.
  for (const side of [-1, 1]) {
    const pile = soil.clone();
    pile.scale.set(4, 2.2, 7);
    pile.position.set(ps.x + ps.tx * 19 + ps.nx * side * (potR - 2), 0, ps.z + ps.tz * 19 + ps.nz * side * (potR - 2));
    g.add(pile);
  }

  // Manguera: cruza la pista justo en el bache y acaba en su carrete.
  const hoseJump = track.def.jumps?.find((j) => j.gap === 0);
  if (hoseJump) {
    const hi = track.indexAtSeg(hoseJump.seg, hoseJump.f);
    const hs = S[(hi + 1) % N];
    const span = hs.hw + track.shoulder + LIP + 20;
    const pts: THREE.Vector3[] = [];
    for (let k = -1; k <= 1; k += 0.125) {
      const wig = Math.abs(k) > 0.55 ? Math.sin(k * 9) * 4 : 0;
      pts.push(new THREE.Vector3(hs.x + hs.nx * k * span + hs.tx * wig, 0.6, hs.z + hs.nz * k * span + hs.tz * wig));
    }
    const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.6, 8), plastic(0x2fa84a, 0.5));
    hose.castShadow = shadows;
    g.add(hose);
    const end = pts[pts.length - 1];
    const reel = new THREE.Group();
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 5, 24), plastic(0x2fa84a, 0.5));
    drum.rotation.z = Math.PI / 2;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(5, 0.5, 8, 24), plastic(0xe8423a, 0.4));
    frame.rotation.y = Math.PI / 2;
    reel.add(drum, frame);
    reel.position.set(end.x + hs.nx * 6, 5, end.z + hs.nz * 6);
    reel.rotation.y = Math.atan2(hs.nx, hs.nz) + Math.PI / 2;
    if (clear(reel.position.x, reel.position.z, 4)) g.add(reel);
  }

  // Luces en el borde de la pista cada 8 m (postes cortos con una bombilla), menos sobre el hueco.
  const lightPts: THREE.Vector3[] = [];
  const every = Math.max(1, Math.round(8 / track.step));
  for (let i = 0; i < N; i += every) {
    if (track.inGap(i) || Math.abs(i - potI) < 12) continue;
    const s = S[i];
    for (const side of [-1, 1]) {
      const lat = side * (s.hw + track.shoulder + LIP + 0.5);
      lightPts.push(new THREE.Vector3(s.x + s.nx * lat, s.y, s.z + s.nz * lat));
    }
  }
  const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.15, 1.6, 6), plastic(0x2a2d36, 0.5), lightPts.length);
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 6, 4), glow(0xffe08a), lightPts.length);
  lightPts.forEach((p, i) => {
    postMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y + 0.8, p.z));
    bulbMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y + 1.75, p.z));
  });
  g.add(postMesh, bulbMesh);

  // Cerca de madera alrededor, con farolitos sobre algunos postes.
  const picketGeo = q.roundedBarriers ? new RoundedBoxGeometry(2.4, 26, 0.8, 1, 0.3) : new THREE.BoxGeometry(2.4, 26, 0.8);
  const fenceMat = plastic(0xd8cdb8, 0.8);
  const pickets: THREE.Matrix4[] = [];
  const lanterns: THREE.Vector3[] = [];
  const edges: [number, number, number, number][] = [
    [R.x0, R.z1, R.x1, R.z1],
    [R.x1, R.z0, R.x1, R.z1],
    [R.x0, R.z0, R.x0, R.z1],
  ];
  for (const [x0, z0, x1, z1] of edges) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    const n = Math.floor(len / 4);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      pickets.push(new THREE.Matrix4().compose(v.set(x, 13, z), quat.setFromAxisAngle(up, yaw), s3.set(1, 1, 1)));
      if (i % 10 === 5) lanterns.push(new THREE.Vector3(x, 27.5, z));
    }
    for (const y of [7, 19]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 1.6, 0.6), fenceMat);
      rail.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      rail.rotation.y = yaw;
      g.add(rail);
    }
  }
  const fence = new THREE.InstancedMesh(picketGeo, fenceMat, pickets.length);
  pickets.forEach((mm, i) => fence.setMatrixAt(i, mm));
  g.add(fence);
  const lampGlass = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 12, 8), glow(0xffc96a), lanterns.length);
  const lampHalo = new THREE.InstancedMesh(
    new THREE.SphereGeometry(4, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb84a, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }),
    lanterns.length,
  );
  lanterns.forEach((p, i) => {
    lampGlass.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
    lampHalo.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
  });
  g.add(lampGlass, lampHalo);

  // Pared de la casa (lado sur) con ventanas encendidas y una puerta.
  const houseW = W;
  const house = new THREE.Mesh(new THREE.PlaneGeometry(houseW, 110), plastic(0x5b4a6e, 0.9));
  house.position.set(cx, 55, R.z0);
  g.add(house);
  const winGlow = glow(0xffd98a);
  const frameMat = plastic(0xf4f1ea, 0.6);
  for (let k = 0; k < 4; k++) {
    const x = R.x0 + houseW * (0.15 + k * 0.23);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(26, 30), winGlow);
    w.position.set(x, 58, R.z0 + 0.3);
    g.add(w);
    for (const [fw, fh, fx, fy] of [[30, 2.4, 0, 16], [30, 2.4, 0, -16], [2.4, 32, -14, 0], [2.4, 32, 14, 0], [2, 30, 0, 0]] as const) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 1), frameMat);
      f.position.set(x + fx, 58 + fy, R.z0 + 0.6);
      g.add(f);
    }
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(20, 36), plastic(0x8a4a2a, 0.7));
  door.position.set(cx + houseW * 0.04, 18, R.z0 + 0.3);
  g.add(door);

  // Flores, arbustos y setas que brillan, solo donde no estorban.
  const flowerCols = [0xff6fb0, 0xffd23a, 0x8f7bff, 0xff8a3a, 0xffffff];
  const stems: THREE.Matrix4[] = [];
  const heads: { m: THREE.Matrix4; c: number }[] = [];
  const bushes: THREE.Matrix4[] = [];
  const caps: THREE.Matrix4[] = [];
  const tries = q.scenery >= 1 ? 160 : 90;
  for (let t = 0; t < tries; t++) {
    const x = rng.range(R.x0 + 10, R.x1 - 10);
    const z = rng.range(R.z0 + 10, R.z1 - 10);
    const kind = rng.next();
    if (kind < 0.55) {
      if (!clear(x, z, 4)) continue;
      const n = rng.int(3, 6);
      for (let k = 0; k < n; k++) {
        const fx = x + rng.range(-4, 4);
        const fz = z + rng.range(-4, 4);
        const h = rng.range(4, 9);
        stems.push(new THREE.Matrix4().compose(v.set(fx, h / 2, fz), quat.identity(), s3.set(1, h, 1)));
        heads.push({ m: new THREE.Matrix4().compose(v.set(fx, h, fz), quat.identity(), s3.setScalar(rng.range(1.2, 2))), c: rng.pick(flowerCols) });
      }
    } else if (kind < 0.85) {
      const r = rng.range(5, 10);
      if (!clear(x, z, r)) continue;
      bushes.push(new THREE.Matrix4().compose(v.set(x, r * 0.55, z), quat.setFromAxisAngle(up, rng.next() * 6), s3.set(r, r * 0.8, r)));
    } else {
      if (!clear(x, z, 3)) continue;
      const r = rng.range(1.6, 3);
      caps.push(new THREE.Matrix4().compose(v.set(x, r * 1.2, z), quat.identity(), s3.set(r, r * 0.6, r)));
    }
  }
  const stemMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.2, 1, 5), plastic(0x3f8a3a), stems.length);
  stems.forEach((mm, i) => stemMesh.setMatrixAt(i, mm));
  const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0x221122 }), heads.length);
  const col = new THREE.Color();
  heads.forEach((h, i) => {
    headMesh.setMatrixAt(i, h.m);
    headMesh.setColorAt(i, col.setHex(h.c));
  });
  const bushMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), plastic(0x234d2a, 0.9), bushes.length);
  bushes.forEach((mm, i) => bushMesh.setMatrixAt(i, mm));
  bushMesh.castShadow = shadows;
  const capMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glow(0x7af0ff), caps.length);
  const capStem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.45, 1, 8), plastic(0xf4f1ea), caps.length);
  caps.forEach((mm, i) => {
    capMesh.setMatrixAt(i, mm);
    v.setFromMatrixPosition(mm);
    capStem.setMatrixAt(i, m4.compose(s3.set(v.x, v.y / 2, v.z), quat.identity(), new THREE.Vector3(1, v.y, 1)));
  });
  g.add(stemMesh, headMesh, bushMesh, capMesh, capStem);

  // Luciérnagas: puntitos que flotan y parpadean (se animan al dibujarse).
  const flyN = q.scenery >= 1 ? 70 : 35;
  const flies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 6, 4), glow(0xd8ff6a), flyN);
  flies.frustumCulled = false;
  const fly = Array.from({ length: flyN }, () => ({
    x: rng.range(R.x0 + 20, R.x1 - 20),
    z: rng.range(R.z0 + 20, R.z1 - 20),
    y: rng.range(3, 16),
    r: rng.range(3, 9),
    w: rng.range(0.2, 0.6),
    p: rng.next() * 10,
  }));
  flies.onBeforeRender = () => {
    const t = performance.now() / 1000;
    for (let i = 0; i < flyN; i++) {
      const f = fly[i];
      const a = t * f.w + f.p;
      v.set(f.x + Math.cos(a) * f.r, f.y + Math.sin(a * 1.7) * 1.5, f.z + Math.sin(a * 0.8) * f.r);
      const blink = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.2 + f.p * 3));
      s3.setScalar(blink);
      flies.setMatrixAt(i, m4.compose(v, quat.identity(), s3));
    }
    flies.instanceMatrix.needsUpdate = true;
  };
  g.add(flies);

  void tex;
  return g;
}
