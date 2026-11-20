// El patio de recreo de día: césped, sol y nubes, cerca de colores, el edificio de la escuelita con su letrero,
// túnel de gusano (la pista pasa por dentro), arenero con balde, pala y castillo de arena, piscina de pelotas bajo
// el salto, torres del castillo junto al puente, sube y baja en el bache, columpios, tiovivo, tobogán, rayuela y
// árboles.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Track } from '../game/track';
import type { Textures } from './textures';
import type { Quality } from '../core/quality';
import type { Rng } from '../core/rng';
import { LIP } from './trackMesh';
import { SEESAW_AT, WORM_AT } from './schoolTracks';
import { SCHOOL_COLORS, clearOfTrack, cloud, grassTexture, plastic, sandTexture, signTexture } from './schoolKit';

/** Dirección del sol (la misma que la luz principal de la pista). */
export const SUN_DIR: [number, number, number] = [0.4, 1, 0.45];

export function buildPlayground(track: Track, _tex: Textures, q: Quality, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.name = 'recreo';
  const shadows = q.shadowMap > 0;
  const S = track.samples;
  const N = track.N;
  const b = track.bounds;
  const R = { x0: b.minX - 70, x1: b.maxX + 70, z0: b.minZ - 70, z1: b.maxZ + 90 };
  const W = R.x1 - R.x0;
  const D = R.z1 - R.z0;
  const cx = (R.x0 + R.x1) / 2;
  const cz = (R.z0 + R.z1) / 2;
  const sc = track.def.scale;
  const up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const cast = (o: THREE.Object3D): THREE.Object3D => {
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = shadows;
    });
    return o;
  };

  // Césped.
  const grass = grassTexture(rng, q.anisotropy);
  grass.repeat.set((W + 600) / 20, (D + 600) / 20);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 600, D + 600), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.03, cz);
  ground.receiveShadow = true;
  g.add(ground);

  // Sol y nubes (sin niebla).
  const sunDir = new THREE.Vector3(...SUN_DIR).normalize();
  const sun = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff2a0, fog: false, toneMapped: false }));
  sun.position.set(cx, 0, cz).addScaledVector(sunDir, 950);
  g.add(sun);
  for (let i = 0; i < (q.scenery >= 1 ? 12 : 7); i++) {
    const c = cloud(rng, rng.range(24, 40));
    const a = rng.next() * Math.PI * 2;
    c.position.set(cx + Math.cos(a) * rng.range(500, 800), rng.range(180, 320), cz + Math.sin(a) * rng.range(500, 800));
    c.lookAt(cx, c.position.y, cz);
    g.add(c);
  }

  // Lo que no debe pisar la pista ni salirse del patio.
  const podium = { x0: 60 * sc - 26, x1: 60 * sc + 26, z0: -55 * sc - 26, z1: -55 * sc + 26 };
  const clear = clearOfTrack(track, R, [podium]);
  const keepOffRoad = (x: number, z: number, r: number): boolean => {
    const { d, i } = track.distanceToCenter(x, z);
    return d > S[i].hw + track.shoulder + LIP + r + 0.5;
  };

  // Cerca de colores alrededor del patio (instanciada), con una puerta delante de la escuela.
  const picketGeo = new THREE.BoxGeometry(2.4, 9, 0.8);
  const fence: [number, number, number][] = [];
  for (let x = R.x0; x <= R.x1; x += 4) fence.push([x, R.z0, 0], [x, R.z1, 0]);
  for (let z = R.z0 + 4; z < R.z1; z += 4) fence.push([R.x0, z, Math.PI / 2], [R.x1, z, Math.PI / 2]);
  const fenceMesh = new THREE.InstancedMesh(picketGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), fence.length);
  const col = new THREE.Color();
  fence.forEach(([x, z, ry], i) => {
    fenceMesh.setMatrixAt(i, m4.compose(v.set(x, 4.5, z), quat.setFromAxisAngle(up, ry), s3.set(1, 1, 1)));
    fenceMesh.setColorAt(i, col.set(SCHOOL_COLORS[i % SCHOOL_COLORS.length]));
  });
  fenceMesh.castShadow = shadows;
  g.add(fenceMesh);

  // Edificio de la escuelita al fondo (más allá de z1): paredes, techo rojo, ventanas, puerta y letrero.
  const school = new THREE.Group();
  const SW = 300;
  const SH = 60;
  const SD = 50;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(SW, SH, SD), plastic('#ffd9a0', 0.9));
  wall.position.y = SH / 2;
  school.add(wall);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(SD * 0.72, SD * 0.72, SW + 10, 3, 1), plastic('#e0563a', 0.7));
  roof.rotation.z = Math.PI / 2;
  roof.rotation.x = Math.PI / 2;
  roof.position.y = SH + SD * 0.32;
  school.add(roof);
  const winTex = signTexture(128, 128, '#8fd0ff', [], q.anisotropy, (c) => {
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(14, 14, 40, 100);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 10;
    c.strokeRect(5, 5, 118, 118);
    c.beginPath();
    c.moveTo(64, 0);
    c.lineTo(64, 128);
    c.moveTo(0, 64);
    c.lineTo(128, 64);
    c.stroke();
  });
  const winMat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.2 });
  for (let i = 0; i < 8; i++) {
    if (i === 3 || i === 4) continue;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(24, 22), winMat);
    w.position.set(-SW / 2 + 22 + i * ((SW - 44) / 7), SH * 0.55, -SD / 2 - 0.2);
    w.rotation.y = Math.PI;
    school.add(w);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(30, 34), plastic('#2f7de0', 0.5));
  door.position.set(0, 17, -SD / 2 - 0.2);
  door.rotation.y = Math.PI;
  school.add(door);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 18),
    new THREE.MeshBasicMaterial({ map: signTexture(1024, 205, '#ffffff', [['Mi Escuelita', 140, '#e8423a']], q.anisotropy, undefined, '#2f7de0') }),
  );
  sign.position.set(0, 46, -SD / 2 - 0.3);
  sign.rotation.y = Math.PI;
  school.add(sign);
  school.position.set(cx, 0, R.z1 + SD / 2 + 8);
  cast(school);
  g.add(school);

  // Túnel de gusano: arcos de colores sobre la pista y una cabeza sonriente en la entrada.
  const wi = track.indexAtSeg(WORM_AT.seg, WORM_AT.f);
  const ws = S[wi];
  const wormR = ws.hw + track.shoulder + LIP + 2.5;
  const yaw = Math.atan2(ws.tx, ws.tz);
  const ringGeo = new THREE.TorusGeometry(wormR, 2.6, 10, 32, Math.PI);
  for (let k = -5; k <= 5; k++) {
    const r = new THREE.Mesh(ringGeo, plastic(SCHOOL_COLORS[(k + 6) % SCHOOL_COLORS.length], 0.6));
    r.rotation.y = yaw;
    r.position.set(ws.x + ws.tx * k * 4.6, 0, ws.z + ws.tz * k * 4.6);
    r.castShadow = shadows;
    g.add(r);
  }
  const head = new THREE.Group();
  const face = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), plastic('#3fb24a', 0.5));
  head.add(face);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10), plastic('#ffffff', 0.3));
    eye.position.set(s * 2.6, 2, 5.6);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), plastic('#1e2236', 0.3));
    pupil.position.set(s * 2.6, 2, 7.5);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 6, 6), plastic('#1e2236', 0.5));
    ant.position.set(s * 3, 8.5, 0);
    ant.rotation.z = -s * 0.3;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), plastic('#ffd23a', 0.4));
    tip.position.set(s * 4, 11.2, 0);
    head.add(eye, pupil, ant, tip);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(3, 0.5, 6, 16, Math.PI), plastic('#1e2236', 0.5));
  smile.rotation.z = Math.PI;
  smile.position.set(0, -1.5, 6.6);
  head.add(smile);
  // Sobre el primer arco, mirando a los karts que llegan.
  head.position.set(ws.x - ws.tx * 5 * 4.6, wormR + 6, ws.z - ws.tz * 5 * 4.6);
  head.rotation.y = yaw + Math.PI;
  cast(head);
  g.add(head);

  // Arenero: arena bajo el tramo de arena, más ancha que la pista, con borde de madera alrededor.
  const sand = sandTexture(rng, q.anisotropy);
  sand.repeat.set(4, 4);
  const sandMat = new THREE.MeshStandardMaterial({ map: sand, roughness: 1 });
  const sandIdx = S.map((s, i) => (s.surface === 'sand' ? i : -1)).filter((i) => i >= 0);
  if (sandIdx.length) {
    const sandGeo = new THREE.CircleGeometry(1, 20);
    const pts = sandIdx.filter((_, k) => k % 6 === 0);
    const patch = new THREE.InstancedMesh(sandGeo, sandMat, pts.length);
    pts.forEach((i, k) => {
      const s = S[i];
      const r = s.hw + track.shoulder + LIP + 12;
      patch.setMatrixAt(k, m4.compose(v.set(s.x, 0.01, s.z), quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), s3.set(r, r, 1)));
    });
    patch.receiveShadow = true;
    g.add(patch);
    // Balde, pala y castillo de arena junto al arenero, dentro del circuito.
    const mid = S[sandIdx[Math.floor(sandIdx.length / 2)]];
    const centre = new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    const toC = (centre.x - mid.x) * mid.nx + (centre.z - mid.z) * mid.nz >= 0 ? 1 : -1;
    const at = (d: number, along: number): [number, number] => [mid.x + mid.nx * toC * d + mid.tx * along, mid.z + mid.nz * toC * d + mid.tz * along];
    const [bx, bz] = at(mid.hw + track.shoulder + LIP + 9, -8);
    if (clear(bx, bz, 5)) {
      const bucket = new THREE.Group();
      const pail = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 3.4, 7, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8423a, roughness: 0.4, side: THREE.DoubleSide }));
      pail.position.y = 3.5;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.3, 6, 20, Math.PI), plastic('#ffd23a', 0.4));
      handle.position.y = 7;
      bucket.add(pail, handle);
      bucket.position.set(bx, 0, bz);
      g.add(cast(bucket));
    }
    const [sx, sz] = at(mid.hw + track.shoulder + LIP + 9, 10);
    if (clear(sx, sz, 3)) {
      const shovel = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 5), plastic('#2f7de0', 0.4));
      blade.position.set(0, 0.3, 0);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 10, 8), plastic('#2f7de0', 0.4));
      stick.rotation.x = Math.PI / 2;
      stick.position.set(0, 0.6, 7);
      shovel.add(blade, stick);
      shovel.position.set(sx, 0, sz);
      shovel.rotation.y = rng.next() * Math.PI;
      g.add(cast(shovel));
    }
    const [kx, kz] = at(mid.hw + track.shoulder + LIP + 20, 0);
    if (clear(kx, kz, 10)) {
      const castle = new THREE.Group();
      const sandy = plastic('#e0c27a', 1);
      const keep = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 8, 16), sandy);
      keep.position.y = 4;
      castle.add(keep);
      for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 10, 12), sandy);
        t.position.set(x, 5, z);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(3, 4, 12), sandy);
        cone.position.set(x, 12, z);
        castle.add(t, cone);
      }
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshStandardMaterial({ color: 0xe8423a, side: THREE.DoubleSide }));
      flag.position.set(1.5, 12, 0);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), plastic('#6b4423'));
      mast.position.set(0, 10, 0);
      castle.add(flag, mast);
      castle.position.set(kx, 0, kz);
      g.add(cast(castle));
    }
  }

  // Piscina de pelotas en el hueco del salto: se extiende a los dos lados de la pista, con borde acolchado.
  const center = new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  for (const gap of track.gaps) {
    const len = (gap.i1 - gap.i0 + N) % N;
    const mid = S[(gap.i0 + Math.floor(len / 2)) % N];
    const width = len * track.step - 0.4;
    const toC = (center.x - mid.x) * mid.nx + (center.z - mid.z) * mid.nz >= 0 ? 1 : -1;
    const half = mid.hw + track.shoulder + LIP + 14;
    const gyaw = Math.atan2(mid.tx, mid.tz);
    // Fondo azul (lo que se ve entre las pelotas).
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, width), plastic('#2f6fd6', 0.6));
    floor.rotation.order = 'YXZ';
    floor.rotation.set(-Math.PI / 2, gyaw, 0);
    floor.position.set(mid.x, 0.03, mid.z);
    g.add(floor);
    // Pelotas en dos capas.
    const balls: [number, number, number][] = [];
    for (let a = -half + 1.4; a < half - 1.2; a += 2.5)
      for (let c = -width / 2 + 1.4; c < width / 2 - 1.2; c += 2.5)
        for (const layer of [0, 1]) balls.push([a + rng.range(-0.5, 0.5) + layer * 1.2, c + rng.range(-0.5, 0.5) + layer * 1.2, layer]);
    const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1.35, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.35 }), balls.length);
    balls.forEach(([a, c, layer], i) => {
      const x = mid.x + mid.nx * a + mid.tx * c;
      const z = mid.z + mid.nz * a + mid.tz * c;
      ballMesh.setMatrixAt(i, m4.makeTranslation(x, 0.9 + layer * 1.3 + rng.range(-0.3, 0.3), z));
      ballMesh.setColorAt(i, col.set(SCHOOL_COLORS[Math.floor(rng.next() * SCHOOL_COLORS.length)]));
    });
    g.add(ballMesh);
    // Borde acolchado: en los dos extremos y a lo largo de las orillas, pero fuera de la pista.
    const padMat = plastic('#f07ab0', 0.8);
    for (const end of [-1, 1]) {
      const p = new THREE.Mesh(new RoundedBoxGeometry(3, 4, width + 6, 2, 1), padMat);
      p.position.set(mid.x + mid.nx * end * (half + 1.5), 2, mid.z + mid.nz * end * (half + 1.5));
      p.rotation.y = gyaw;
      g.add(cast(p));
      for (const bank of [-1, 1]) {
        const off = (mid.hw + track.shoulder + LIP + 2 + half) / 2;
        const lenB = half - (mid.hw + track.shoulder + LIP + 2);
        const e = new THREE.Mesh(new RoundedBoxGeometry(lenB, 3, 3, 2, 1), plastic(bank < 0 ? '#ffd23a' : '#3fb24a', 0.8));
        e.position.set(mid.x + mid.nx * end * off + mid.tx * bank * (width / 2 + 1.5), 1.5, mid.z + mid.nz * end * off + mid.tz * bank * (width / 2 + 1.5));
        e.rotation.y = gyaw + Math.PI / 2;
        g.add(cast(e));
      }
    }
    // Cara del final del tobogán (lo que se ve desde la otra orilla).
    const lip = S[(gap.i0 - 1 + N) % N];
    const faceW = (lip.hw + track.shoulder + LIP) * 2;
    const faceM = new THREE.Mesh(new THREE.BoxGeometry(faceW, lip.y + 4, 0.6), plastic('#2f9bd6', 0.5));
    faceM.position.set(lip.x + lip.tx * 0.3, (lip.y - 4) / 2, lip.z + lip.tz * 0.3);
    faceM.rotation.y = gyaw;
    g.add(cast(faceM));
    // Letrero.
    const signPos = (mid.hw + track.shoulder + LIP + 6) * -toC;
    const pole = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 16, 8), plastic('#c8ccd6', 0.3));
    stick.position.y = 8;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 9),
      new THREE.MeshBasicMaterial({ map: signTexture(512, 256, '#ffd23a', [['¡A saltar!', 96, '#2a2050']], q.anisotropy, undefined, '#e8423a'), side: THREE.DoubleSide }),
    );
    board.position.y = 18;
    pole.add(stick, board);
    const back = S[(gap.i0 - 40 + N) % N];
    pole.position.set(back.x + back.nx * signPos, 0, back.z + back.nz * signPos);
    pole.rotation.y = Math.atan2(-back.tx, -back.tz);
    if (keepOffRoad(pole.position.x, pole.position.z, 2)) g.add(cast(pole));
  }

  // Torres del castillo a los dos lados del puente.
  const plankAt = S.findIndex((s) => s.surface === 'plank');
  if (plankAt >= 0) {
    let top = plankAt;
    for (let i = plankAt; i < N && S[i].surface === 'plank'; i++) if (S[i].y > S[top].y) top = i;
    const p = S[top];
    for (const side of [-1, 1]) {
      const lat = side * (p.hw + track.shoulder + LIP + 9);
      const tower = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 26, 20), plastic(side < 0 ? '#8a4fd8' : '#2f7de0', 0.6));
      body.position.y = 13;
      const roofC = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 20), plastic('#e8423a', 0.5));
      roofC.position.y = 32;
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshStandardMaterial({ color: 0xffd23a, side: THREE.DoubleSide }));
      flag.position.set(2.5, 41, 0);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 6), plastic('#6b4423'));
      mast.position.y = 40;
      tower.add(body, roofC, flag, mast);
      const x = p.x + p.nx * lat;
      const z = p.z + p.nz * lat;
      tower.position.set(x, 0, z);
      if (keepOffRoad(x, z, 6.5)) g.add(cast(tower));
    }
    // Arco con banderines sobre el puente.
    const lat = p.hw + track.shoulder + LIP + 9;
    const pts: THREE.Vector3[] = [];
    for (let k = -1; k <= 1.001; k += 0.1) pts.push(new THREE.Vector3(p.x + p.nx * lat * k, 26 - 6 * (1 - k * k), p.z + p.nz * lat * k));
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.2, 6), plastic('#ffffff', 0.6));
    g.add(rope);
    const flagGeo = new THREE.ConeGeometry(1.4, 3, 3);
    pts.slice(1, -1).forEach((pt, i) => {
      const f = new THREE.Mesh(flagGeo, plastic(SCHOOL_COLORS[i % SCHOOL_COLORS.length], 0.6));
      f.position.set(pt.x, pt.y - 1.7, pt.z);
      f.rotation.x = Math.PI;
      g.add(f);
    });
  }

  // Sube y baja junto al bache (a un lado) y una franja de colores sobre el bache.
  const si = track.indexAtSeg(SEESAW_AT.seg, SEESAW_AT.f);
  const ss = S[(si + 1) % N];
  {
    // Del lado de fuera o de dentro del circuito, donde quepa.
    let x = 0;
    let z = 0;
    let fits = false;
    for (const side of [1, -1]) {
      const lat = side * (ss.hw + track.shoulder + LIP + 18);
      x = ss.x + ss.nx * lat;
      z = ss.z + ss.nz * lat;
      if ((fits = clear(x, z, 9))) break;
    }
    if (fits) {
      const saw = new THREE.Group();
      const pivot = new THREE.Mesh(new THREE.ConeGeometry(3, 5, 4), plastic('#e8423a', 0.5));
      pivot.position.y = 2.5;
      const plank = new THREE.Mesh(new RoundedBoxGeometry(26, 1, 3.2, 2, 0.4), plastic('#ffd23a', 0.5));
      plank.position.y = 5.2;
      plank.rotation.z = 0.22;
      saw.add(pivot, plank);
      for (const s of [-1, 1]) {
        const seat = new THREE.Mesh(new RoundedBoxGeometry(3.4, 1.2, 4, 2, 0.4), plastic('#2f7de0', 0.5));
        seat.position.set(s * 11, 5.2 + Math.sin(0.22) * s * 11 + 0.8, 0);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.25, 6, 12, Math.PI), plastic('#3fb24a', 0.5));
        handle.position.set(s * 9, 5.2 + Math.sin(0.22) * s * 9 + 0.8, 0);
        saw.add(seat, handle);
      }
      saw.position.set(x, 0, z);
      saw.rotation.y = Math.atan2(ss.tx, ss.tz) + Math.PI / 2;
      g.add(cast(saw));
    }
  }

  // Columpios.
  const swings = (x: number, z: number, ry: number): void => {
    if (!clear(x, z, 22)) return;
    const grp = new THREE.Group();
    const metal = plastic('#e8423a', 0.4);
    const legGeo = new THREE.CylinderGeometry(0.7, 0.7, 30, 8);
    for (const sx of [-18, 18])
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, metal);
        leg.position.set(sx, 14, sz * 5);
        leg.rotation.x = sz * 0.36;
        grp.add(leg);
      }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 38, 10), plastic('#2f7de0', 0.4));
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 28;
    grp.add(bar);
    const chain = new THREE.CylinderGeometry(0.15, 0.15, 21, 4);
    for (const [k, c] of [[-9, '#ffd23a'], [0, '#3fb24a'], [9, '#f07ab0']] as const) {
      const swing = new THREE.Group();
      for (const s of [-1.6, 1.6]) {
        const ch = new THREE.Mesh(chain, plastic('#9aa3b5', 0.3));
        ch.position.set(s, -10.5, 0);
        swing.add(ch);
      }
      const seat = new THREE.Mesh(new RoundedBoxGeometry(4.4, 0.7, 2.6, 2, 0.3), plastic(c, 0.5));
      seat.position.y = -21;
      swing.add(seat);
      swing.position.set(k, 28, 0);
      swing.rotation.x = rng.range(-0.25, 0.25);
      grp.add(swing);
    }
    grp.position.set(x, 0, z);
    grp.rotation.y = ry;
    g.add(cast(grp));
  };

  // Tiovivo.
  const carousel = (x: number, z: number): void => {
    if (!clear(x, z, 14)) return;
    const grp = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 1.4, 6), plastic('#ffd23a', 0.5));
    disc.position.y = 1.4;
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 8, 10), plastic('#9aa3b5', 0.3));
    axle.position.y = 4;
    grp.add(disc, axle);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 11, 6), plastic(SCHOOL_COLORS[k], 0.4));
      rail.rotation.z = Math.PI / 2;
      rail.rotation.y = -a;
      rail.position.set(Math.cos(a) * 5.5, 7.5, Math.sin(a) * 5.5);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 6), plastic(SCHOOL_COLORS[k], 0.4));
      post.position.set(Math.cos(a) * 11, 4.8, Math.sin(a) * 11);
      grp.add(rail, post);
    }
    grp.position.set(x, 0, z);
    grp.rotation.y = rng.next() * Math.PI;
    g.add(cast(grp));
  };

  // Tobogán: escalera, plataforma y rampa curva.
  const slide = (x: number, z: number, ry: number): void => {
    if (!clear(x, z, 22)) return;
    const grp = new THREE.Group();
    const plat = new THREE.Mesh(new RoundedBoxGeometry(10, 1.2, 10, 2, 0.4), plastic('#3fb24a', 0.5));
    plat.position.y = 18;
    grp.add(plat);
    for (const [px, pz] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 26, 8), plastic('#2f7de0', 0.4));
      post.position.set(px, 13, pz);
      grp.add(post);
    }
    const roofS = new THREE.Mesh(new THREE.ConeGeometry(8.5, 6, 4), plastic('#e8423a', 0.5));
    roofS.position.y = 29;
    roofS.rotation.y = Math.PI / 4;
    grp.add(roofS);
    for (let k = 0; k < 6; k++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 6), plastic('#ffd23a', 0.4));
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 2.5 + k * 3, -6 - k * 0.1);
      grp.add(rung);
    }
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      pts.push(new THREE.Vector3(0, 18 - 17 * (t * t * (3 - 2 * t)), 5 + t * 26));
    }
    const chute = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 3, 10, false), new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.3, side: THREE.DoubleSide }));
    chute.scale.set(1, 0.35, 1);
    chute.position.y = 18 * 0.65 * 0;
    grp.add(chute);
    grp.position.set(x, 0, z);
    grp.rotation.y = ry;
    g.add(cast(grp));
  };

  // Rayuela pintada en un trozo de cemento.
  const hopscotch = (x: number, z: number, ry: number): void => {
    if (!clear(x, z, 16)) return;
    const t = signTexture(256, 640, '#c9c4bc', [], q.anisotropy, (c) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 8;
      c.fillStyle = '#ffffff';
      c.font = '900 56px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const cell = 80;
      const rows: number[][] = [[1], [2, 3], [4], [5, 6], [7], [8]];
      rows.forEach((r, i) => {
        const y = 600 - (i + 1) * cell - 10;
        r.forEach((n, j) => {
          const x0 = r.length === 1 ? 88 : 48 + j * cell;
          c.strokeRect(x0, y, cell, cell);
          c.fillStyle = SCHOOL_COLORS[(n - 1) % SCHOOL_COLORS.length];
          c.fillText(String(n), x0 + cell / 2, y + cell / 2);
        });
      });
    });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(10, 25), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    pad.rotation.order = 'YXZ';
    pad.rotation.set(-Math.PI / 2, ry, 0);
    pad.position.set(x, 0.02, z);
    pad.receiveShadow = true;
    g.add(pad);
  };

  // Posiciones: dentro del circuito, alrededor del podio, y fuera del circuito hacia la escuela.
  const S2 = sc;
  swings(-60 * S2, -60 * S2, 0.3);
  carousel(10 * S2, -80 * S2);
  slide(-110 * S2, -40 * S2, 1.2);
  hopscotch(20 * S2, -30 * S2, 0.4);
  if (q.scenery >= 1) {
    swings(40 * S2, 50 * S2, -0.2);
    slide(-60 * S2, 45 * S2, Math.PI);
    carousel(-170 * S2, 40 * S2);
    hopscotch(110 * S2, 35 * S2, -0.8);
  }

  // Árboles (tronco + copa), instanciados.
  const trees: [number, number, number][] = [];
  for (let k = 0; k < (q.scenery >= 1 ? 40 : 22); k++) {
    const x = rng.range(R.x0 + 10, R.x1 - 10);
    const z = rng.range(R.z0 + 10, R.z1 - 10);
    const r = rng.range(8, 13);
    if (clear(x, z, r)) trees.push([x, z, r]);
  }
  if (trees.length) {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.4, 2, 14, 8), plastic('#8a5a2c', 0.9), trees.length);
    const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ roughness: 0.9 }), trees.length);
    trees.forEach(([x, z, r], i) => {
      trunk.setMatrixAt(i, m4.makeTranslation(x, 7, z));
      crown.setMatrixAt(i, m4.compose(v.set(x, 14 + r * 0.6, z), quat.identity(), s3.set(r, r * 0.9, r)));
      crown.setColorAt(i, col.setHSL(rng.range(0.25, 0.36), 0.55, rng.range(0.32, 0.42)));
    });
    trunk.castShadow = crown.castShadow = shadows;
    g.add(trunk, crown);
  }
  // Florecitas en el césped.
  if (q.scenery >= 1) {
    const flowers: [number, number][] = [];
    for (let k = 0; k < 160; k++) {
      const x = rng.range(R.x0 + 4, R.x1 - 4);
      const z = rng.range(R.z0 + 4, R.z1 - 4);
      if (keepOffRoad(x, z, 1)) flowers.push([x, z]);
    }
    const fm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), flowers.length);
    flowers.forEach(([x, z], i) => {
      fm.setMatrixAt(i, m4.makeTranslation(x, 0.5, z));
      fm.setColorAt(i, col.set(rng.pick(['#ffffff', '#ffd23a', '#f07ab0', '#ff7a5a'])));
    });
    g.add(fm);
  }

  return g;
}
