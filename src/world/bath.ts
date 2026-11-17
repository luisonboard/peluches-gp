// El baño gigante: suelo y paredes de baldosas, bañera con agua y espuma (el borde sur es la pista),
// grifo, ventana, patito flotando, burbujas que suben y objetos de baño enormes fuera de la pista.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Track } from '../game/track';
import type { Textures } from './textures';
import type { Quality } from '../core/quality';
import type { Rng } from '../core/rng';
import { LIP } from './trackMesh';
import { RIM_HEIGHT, TUB } from './bathTrack';
import { makeDuck } from '../game/obstacles';

const WALL_H = 170;

/** Baldosas en <canvas> (propias de esta pista: se liberan al cambiar de pista). */
function tileTexture(rng: Rng, n: number, base: string, alt: string, altChance: number, grout: string, aniso: number): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const t = S / n;
  g.fillStyle = grout;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      g.fillStyle = rng.chance(altChance) ? alt : base;
      g.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
      // Brillo suave en una esquina de cada baldosa.
      const grd = g.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
      grd.addColorStop(0, 'rgba(255,255,255,0.22)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0)');
      grd.addColorStop(1, 'rgba(0,40,60,0.06)');
      g.fillStyle = grd;
      g.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  return tex;
}

export function buildBath(track: Track, tex: Textures, q: Quality, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.name = 'bano';
  const sc = track.def.scale;
  const shadows = q.shadowMap > 0;
  const b = track.bounds;
  const R = { x0: b.minX - 40, x1: b.maxX + 45, z0: b.minZ - 55, z1: Math.max(b.maxZ, TUB.z1) + 30 };
  const W = R.x1 - R.x0;
  const D = R.z1 - R.z0;
  const cx = (R.x0 + R.x1) / 2;
  const cz = (R.z0 + R.z1) / 2;

  // Suelo de baldosas grandes (blancas con alguna celeste).
  const floorTex = tileTexture(rng, 4, '#f3f6f8', '#bfe6f2', 0.18, '#a9b9c2', q.anisotropy);
  floorTex.repeat.set(W / 40, D / 40);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.25, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, -0.02, cz);
  floor.receiveShadow = true;
  g.add(floor);

  // Paredes: baldosas pequeñas abajo y pintura celeste arriba, con una cenefa.
  const wallTiles = tileTexture(rng, 8, '#9fd8e8', '#7cc6dc', 0.25, '#e8f4f8', q.anisotropy);
  const tileH = 60;
  const tileMat = new THREE.MeshStandardMaterial({ map: wallTiles, roughness: 0.2 });
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xcfeef6, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2f7de0, roughness: 0.4 });
  const walls: [number, number, number, number][] = [
    [cx, R.z0, W, 0],
    [cx, R.z1, W, Math.PI],
    [R.x0, cz, D, Math.PI / 2],
    [R.x1, cz, D, -Math.PI / 2],
  ];
  for (const [x, z, len, ry] of walls) {
    const tl = tileMat.clone();
    tl.map = wallTiles.clone();
    tl.map.repeat.set(len / 30, tileH / 30);
    tl.map.needsUpdate = true;
    const lower = new THREE.Mesh(new THREE.PlaneGeometry(len, tileH), tl);
    lower.position.set(x, tileH / 2, z);
    lower.rotation.y = ry;
    lower.receiveShadow = true;
    g.add(lower);
    const upper = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_H - tileH), paintMat);
    upper.position.set(x, tileH + (WALL_H - tileH) / 2, z);
    upper.rotation.y = ry;
    g.add(upper);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(len, 3, 1.5), trimMat);
    trim.position.set(x, tileH, z);
    trim.rotation.y = ry;
    g.add(trim);
  }

  // Ventana con cielo en la pared del fondo, sobre la bañera.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 64;
  skyCanvas.height = 128;
  const sg = skyCanvas.getContext('2d')!;
  const grd = sg.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#7cc0ff');
  grd.addColorStop(1, '#e8f6ff');
  sg.fillStyle = grd;
  sg.fillRect(0, 0, 64, 128);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const win = new THREE.Group();
  win.add(new THREE.Mesh(new THREE.PlaneGeometry(90, 64), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })));
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  for (const [w, h, x, y] of [[96, 4, 0, 34], [96, 4, 0, -34], [4, 72, -46, 0], [4, 72, 46, 0], [3, 64, 0, 0]] as const) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), frameMat);
    f.position.set(x, y, 1);
    win.add(f);
  }
  win.position.set((TUB.x0 + TUB.x1) / 2, 105, R.z1 - 0.5);
  win.rotation.y = Math.PI;
  g.add(win);

  // --- Bañera ---
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0 });
  const tubH = RIM_HEIGHT - 0.1;
  const T = TUB;
  const wallBox = (x0: number, x1: number, z0: number, z1: number): void => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(x1 - x0, tubH, z1 - z0, 3, 1.5), porcelain);
    m.position.set((x0 + x1) / 2, tubH / 2, (z0 + z1) / 2);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  wallBox(T.x0, T.x1, T.z0, T.z0 + T.south); // pared sur (bajo la pista)
  wallBox(T.x0, T.x1, T.z1 - T.wall, T.z1);
  wallBox(T.x0, T.x0 + T.wall, T.z0, T.z1);
  wallBox(T.x1 - T.wall, T.x1, T.z0, T.z1);
  const inX0 = T.x0 + T.wall;
  const inX1 = T.x1 - T.wall;
  const inZ0 = T.z0 + T.south;
  const inZ1 = T.z1 - T.wall;
  const waterY = RIM_HEIGHT - 2.2;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(inX1 - inX0, inZ1 - inZ0),
    new THREE.MeshStandardMaterial({ color: 0x7fd0ea, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((inX0 + inX1) / 2, waterY, (inZ0 + inZ1) / 2);
  g.add(water);

  // Espuma: montoncitos blancos sobre el agua.
  const foamN = q.scenery >= 1 ? 60 : 30;
  const foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), foamN);
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  for (let i = 0; i < foamN; i++) {
    const r = rng.range(2.5, 6);
    v.set(rng.range(inX0 + 4, inX1 - 4), waterY, rng.range(inZ0 + 4, inZ1 - 4));
    s3.set(r, r * 0.45, r);
    foam.setMatrixAt(i, m4.compose(v, quat, s3));
  }
  g.add(foam);

  // Patito grande flotando.
  const bigDuck = makeDuck(shadows);
  bigDuck.scale.setScalar(4.2);
  bigDuck.position.set(inX0 + (inX1 - inX0) * 0.35, waterY - 1.2, (inZ0 + inZ1) / 2 + 4);
  bigDuck.rotation.y = -0.6;
  g.add(bigDuck);

  // Grifo cromado en la pared oeste.
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe4ebf2, roughness: 0.2, metalness: 0.35 });
  const tapX = T.x0 + T.wall / 2;
  const tapZ = (inZ0 + inZ1) / 2;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 12, 20), chrome);
  post.position.set(tapX, RIM_HEIGHT + 6, tapZ);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 14, 16), chrome);
  spout.rotation.z = Math.PI / 2;
  spout.position.set(tapX + 6, RIM_HEIGHT + 11, tapZ);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3, 16), chrome);
  tip.position.set(tapX + 12.5, RIM_HEIGHT + 9.5, tapZ);
  for (const [dz, col] of [[-6, 0xe8423a], [6, 0x2f7de0]] as const) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 }));
    knob.position.set(tapX, RIM_HEIGHT + 4, tapZ + dz);
    g.add(knob);
  }
  for (const m of [post, spout, tip]) {
    m.castShadow = shadows;
    g.add(m);
  }

  // Patas doradas en las esquinas.
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc928, roughness: 0.3, metalness: 0.7 });
  for (const [x, z] of [[T.x0 + 3, T.z1 - 3], [T.x1 - 3, T.z1 - 3]]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), gold);
    foot.scale.y = 0.6;
    foot.position.set(x, 1.5, z + 2);
    g.add(foot);
  }

  // Burbujas que suben desde la bañera y vuelven a empezar (se animan al dibujarse).
  const bubN = q.scenery >= 1 ? 40 : 18;
  const bubMat = new THREE.MeshStandardMaterial({ color: 0xd8f4ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45, depthWrite: false });
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), bubMat, bubN);
  bubbles.frustumCulled = false;
  const bub = Array.from({ length: bubN }, () => ({
    x: rng.range(inX0, inX1 + 60),
    z: rng.range(inZ0 - 20, inZ1),
    r: rng.range(0.8, 2.6),
    speed: rng.range(2.5, 5),
    phase: rng.next(),
    sway: rng.range(1, 4),
  }));
  const RISE = 70;
  bubbles.onBeforeRender = () => {
    const t = performance.now() / 1000;
    for (let i = 0; i < bubN; i++) {
      const p = bub[i];
      const k = (t * p.speed / RISE + p.phase) % 1;
      v.set(p.x + Math.sin(t * 0.8 + i) * p.sway, waterY + k * RISE, p.z + Math.cos(t * 0.6 + i) * p.sway);
      const r = p.r * Math.min(1, k * 8) * (1 - k * 0.3);
      s3.set(r, r, r);
      bubbles.setMatrixAt(i, m4.compose(v, quat, s3));
    }
    bubbles.instanceMatrix.needsUpdate = true;
  };
  g.add(bubbles);

  // --- Objetos de baño gigantes, solo donde no estorben a la pista ---
  const clear = (x: number, z: number, r: number): boolean => {
    const { d, i } = track.distanceToCenter(x, z);
    const s = track.samples[i];
    if (d < s.hw + track.shoulder + LIP + r + 4) return false;
    if (x - r < R.x0 + 2 || x + r > R.x1 - 2 || z - r < R.z0 + 2 || z + r > R.z1 - 2) return false;
    if (x + r > T.x0 - 6 && x - r < T.x1 + 6 && z + r > T.z0 - 6 && z - r < T.z1 + 6) return false;
    return true;
  };
  const plastic = (c: number | string, rough = 0.35): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness: rough });
  const add = (m: THREE.Object3D): void => {
    m.traverse((o) => ((o as THREE.Mesh).castShadow = shadows));
    g.add(m);
  };

  const bottle = (x: number, z: number, h: number, r: number, color: string, cap: string): void => {
    if (!clear(x, z, r)) return;
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(r * 2, h, r * 1.3, 3, r * 0.45), plastic(color, 0.3));
    body.position.y = h / 2;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.45, h * 0.12, 16), plastic(cap, 0.4));
    neck.position.y = h + h * 0.06;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, h * 0.08, 16), plastic(cap, 0.4));
    top.position.y = h + h * 0.15;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.4, h * 0.35), plastic('#ffffff', 0.6));
    label.position.set(0, h * 0.45, r * 0.66);
    grp.add(body, neck, top, label);
    grp.position.set(x, 0, z);
    grp.rotation.y = rng.range(-0.6, 0.6);
    add(grp);
  };

  const paperRolls = (x: number, z: number): void => {
    if (!clear(x, z, 16)) return;
    const paper = plastic('#fbfaf6', 0.9);
    const core = plastic('#b88a5a', 0.9);
    const rollGeo = new THREE.CylinderGeometry(6, 6, 10, 28);
    const coreGeo = new THREE.CylinderGeometry(2.2, 2.2, 10.2, 16);
    const spots: [number, number, number][] = [[-6.3, 5, 0], [6.3, 5, 0], [0, 15, 0], [0, 5, 11]];
    for (const [dx, y, dz] of spots) {
      const roll = new THREE.Group();
      roll.add(new THREE.Mesh(rollGeo, paper), new THREE.Mesh(coreGeo, core));
      roll.position.set(x + dx, y, z + dz);
      add(roll);
    }
  };

  const soapBar = (x: number, z: number): void => {
    if (!clear(x, z, 16)) return;
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(15, 13, 2, 32), plastic('#8fd0ff', 0.25));
    dish.position.set(x, 1, z);
    const soap = new THREE.Mesh(new RoundedBoxGeometry(18, 5, 11, 3, 2.4), plastic('#f07ab0', 0.4));
    soap.position.set(x, 4.2, z);
    soap.rotation.y = rng.range(-0.5, 0.5);
    add(dish);
    add(soap);
  };

  const brushCup = (x: number, z: number): void => {
    if (!clear(x, z, 8)) return;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 16, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x3fb24a, roughness: 0.3, side: THREE.DoubleSide }));
    cup.position.set(x, 8, z);
    add(cup);
    for (const [col, a] of [['#e8423a', 0.25], ['#2f7de0', -0.3], ['#ffd23a', 0.05]] as const) {
      const brush = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 30, 10), plastic(col));
      handle.position.y = 15;
      const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5, 2.4), plastic('#ffffff', 0.8));
      head.position.set(0, 29, 1);
      brush.add(handle, head);
      brush.position.set(x, 1, z);
      brush.rotation.set(a, rng.next() * 6, a * 0.6);
      add(brush);
    }
  };

  const towelRoll = (x: number, z: number, color: string, ry: number): void => {
    if (!clear(x, z, 12)) return;
    const mat = new THREE.MeshStandardMaterial({ map: tex.towel, color, roughness: 1 });
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 22, 24), mat);
    roll.rotation.set(0, ry, Math.PI / 2);
    roll.position.set(x, 5, z);
    add(roll);
  };

  const S = sc;
  bottle(-60 * S, 55 * S, 26, 6, '#2f7de0', '#ffffff');
  bottle(-48 * S, 62 * S, 20, 5, '#f07ab0', '#ffd23a');
  bottle(-70 * S, 68 * S, 16, 4.5, '#3fb24a', '#ffffff');
  paperRolls(-15 * S, 45 * S);
  soapBar(10 * S, 40 * S);
  brushCup(-105 * S, 40 * S);
  towelRoll(70 * S, 125 * S, '#ff9f5a', 0.4);
  towelRoll(80 * S, 135 * S, '#8fd0ff', 0.2);
  towelRoll(-120 * S, -25 * S, '#f07ab0', 0);
  bottle(120 * S, 20 * S, 30, 7, '#8a4fd8', '#ffffff');
  bottle(130 * S, 35 * S, 22, 5, '#ffb52a', '#e8423a');
  paperRolls(-250 * S * 0.7, 150 * S * 0.4);
  if (q.scenery >= 1) {
    for (let i = 0; i < 8; i++) {
      const x = rng.range(R.x0 + 15, R.x1 - 15);
      const z = rng.range(R.z0 + 15, R.z1 - 15);
      if (rng.chance(0.5)) bottle(x, z, rng.range(16, 26), rng.range(4, 6), rng.pick(['#2f7de0', '#f07ab0', '#3fb24a', '#ffb52a']), '#ffffff');
      else towelRoll(x, z, rng.pick(['#ff9f5a', '#8fd0ff', '#f07ab0']), rng.next() * Math.PI);
    }
  }

  return g;
}
