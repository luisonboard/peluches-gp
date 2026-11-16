// El cuarto gigante: suelo de madera, paredes azules, ventana, cama con manta y barrotes de cuna,
// y juguetes enormes (bloques de letras, crayones, libros, pelota, aros) fuera de la pista.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Track } from '../game/track';
import type { Textures } from './textures';
import type { Quality } from '../core/quality';
import type { Rng } from '../core/rng';
import { BED_HEIGHT, BED_RECT } from './roomTrack';
import { LIP } from './trackMesh';

export const ROOM_RECT = { x0: -185, x1: 170, z0: -60, z1: 185 };
const WALL_H = 170;

export function buildRoom(track: Track, tex: Textures, q: Quality, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.name = 'room';
  const sc = track.def.scale;
  const R = { x0: ROOM_RECT.x0 * sc, x1: ROOM_RECT.x1 * sc, z0: ROOM_RECT.z0 * sc, z1: ROOM_RECT.z1 * sc };
  const W = R.x1 - R.x0;
  const D = R.z1 - R.z0;
  const cx = (R.x0 + R.x1) / 2;
  const cz = (R.z0 + R.z1) / 2;

  // Suelo.
  tex.wood.repeat.set(W / 44, D / 44);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.5, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, -0.02, cz);
  floor.receiveShadow = true;
  g.add(floor);

  // Paredes (miran hacia dentro) y zócalo.
  tex.wall.repeat.set(8, 4);
  const wallMat = new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.95 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 });
  const walls: [number, number, number, number][] = [
    [cx, R.z0, W, 0],
    [cx, R.z1, W, Math.PI],
    [R.x0, cz, D, Math.PI / 2],
    [R.x1, cz, D, -Math.PI / 2],
  ];
  for (const [x, z, len, ry] of walls) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_H), wallMat);
    w.position.set(x, WALL_H / 2, z);
    w.rotation.y = ry;
    w.receiveShadow = true;
    g.add(w);
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 5, 1.2), baseMat);
    b.position.set(x, 2.5, z);
    b.rotation.y = ry;
    g.add(b);
  }

  // Ventana con cielo (pared del fondo) que justifica la luz del sol.
  const winGroup = new THREE.Group();
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
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(110, 80), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false }));
  winGroup.add(pane);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  for (const [w, h, x, y] of [
    [116, 4, 0, 42], [116, 4, 0, -42], [4, 88, -56, 0], [4, 88, 56, 0], [3, 80, 0, 0], [110, 3, 0, 0],
  ] as const) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), frameMat);
    f.position.set(x, y, 1);
    winGroup.add(f);
  }
  winGroup.position.set(40 * sc, 92, R.z1 - 0.5);
  winGroup.rotation.y = Math.PI;
  g.add(winGroup);

  // Cama baja: base de madera + colchón + manta + barrotes en los lados del fondo.
  const B = { x0: BED_RECT.x0 * sc, x1: BED_RECT.x1 * sc, z0: BED_RECT.z0 * sc, z1: BED_RECT.z1 * sc };
  const bw = B.x1 - B.x0;
  const bd = B.z1 - B.z0;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb06a32, roughness: 0.55 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(bw + 2, 3, bd + 2, 2, 0.8), woodMat);
  base.position.set((B.x0 + B.x1) / 2, 1.5, (B.z0 + B.z1) / 2);
  base.castShadow = base.receiveShadow = true;
  g.add(base);
  const mattressMat = new THREE.MeshStandardMaterial({ color: 0xe6dd6a, roughness: 0.95 });
  const mattress = new THREE.Mesh(new RoundedBoxGeometry(bw, BED_HEIGHT - 3 - 0.1, bd, 3, 1.2), mattressMat);
  mattress.position.set((B.x0 + B.x1) / 2, 3 + (BED_HEIGHT - 3.1) / 2, (B.z0 + B.z1) / 2);
  mattress.castShadow = mattress.receiveShadow = true;
  g.add(mattress);
  tex.blanket.repeat.set(bw / 60, bd / 60);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(bw - 1.5, bd - 1.5), new THREE.MeshStandardMaterial({ map: tex.blanket, roughness: 0.95 }));
  top.rotation.x = -Math.PI / 2;
  top.position.set((B.x0 + B.x1) / 2, BED_HEIGHT - 0.08, (B.z0 + B.z1) / 2);
  top.receiveShadow = true;
  g.add(top);

  // Barrotes de cuna (instanciados) en el lado oeste (x0) y el norte (z1).
  const slatH = 34;
  const slatGeo = new THREE.CylinderGeometry(0.9, 0.9, slatH, 10);
  const slatPos: [number, number][] = [];
  for (let z = B.z0 + 3; z <= B.z1 - 3; z += 6.5) slatPos.push([B.x0 - 1, z]);
  for (let x = B.x0 + 3; x <= B.x1 - 3; x += 6.5) slatPos.push([x, B.z1 + 1]);
  const slats = new THREE.InstancedMesh(slatGeo, woodMat, slatPos.length);
  const m4 = new THREE.Matrix4();
  slatPos.forEach(([x, z], i) => slats.setMatrixAt(i, m4.makeTranslation(x, BED_HEIGHT + slatH / 2 - 1, z)));
  slats.castShadow = q.shadowMap > 0;
  g.add(slats);
  for (const [x, z, len, ry] of [
    [B.x0 - 1, (B.z0 + B.z1) / 2, bd + 4, Math.PI / 2],
    [(B.x0 + B.x1) / 2, B.z1 + 1, bw + 4, 0],
  ] as const) {
    const rail = new THREE.Mesh(new RoundedBoxGeometry(len, 2.6, 2.6, 2, 0.8), woodMat);
    rail.position.set(x, BED_HEIGHT + slatH - 1, z);
    rail.rotation.y = ry;
    rail.castShadow = true;
    g.add(rail);
  }
  for (const [x, z] of [[B.x0 - 1, B.z0 - 1], [B.x0 - 1, B.z1 + 1], [B.x1 + 1, B.z1 + 1]]) {
    const post = new THREE.Mesh(new RoundedBoxGeometry(4, slatH + 12, 4, 2, 1), woodMat);
    post.position.set(x, (slatH + 12) / 2, z);
    post.castShadow = true;
    g.add(post);
  }

  // --- Juguetes gigantes, solo donde no estorben a la pista ---
  const margin = (r: number): number => r + 4;
  const clear = (x: number, z: number, r: number): boolean => {
    const { d, i } = track.distanceToCenter(x, z);
    const s = track.samples[i];
    if (d < s.hw + track.shoulder + LIP + margin(r)) return false;
    if (x - r < R.x0 + 2 || x + r > R.x1 - 2 || z - r < R.z0 + 2 || z + r > R.z1 - 2) return false;
    if (x + r > B.x0 - 4 && x - r < B.x1 + 4 && z + r > B.z0 - 4 && z - r < B.z1 + 4) return false;
    return true;
  };
  const toyCols = ['#e8423a', '#2f7de0', '#3fb24a', '#ffb52a', '#8a4fd8', '#f07ab0'];
  const plastic = (c: number | string): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness: 0.42 });

  const blockGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
  const addBlock = (x: number, z: number, y: number, size: number, ry: number): void => {
    const letters = 'ABCDEFGHIJKLMNOPRSTUVZ123';
    const mats = [0, 1, 2, 3, 4, 5].map(() =>
      new THREE.MeshStandardMaterial({ map: tex.letter(rng.pick([...letters]), rng.pick(toyCols)), roughness: 0.5 }),
    );
    const m = new THREE.Mesh(blockGeo, mats);
    m.scale.setScalar(size);
    m.position.set(x, y + size / 2, z);
    m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  const blockStack = (x: number, z: number, size: number): void => {
    if (!clear(x, z, size * 1.6)) return;
    const ry = rng.range(-0.4, 0.4);
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    addBlock(x - c * size * 0.55, z + s * size * 0.55, 0, size, ry + rng.range(-0.1, 0.1));
    addBlock(x + c * size * 0.55, z - s * size * 0.55, 0, size, ry + rng.range(-0.1, 0.1));
    addBlock(x, z, size, size, ry + rng.range(-0.3, 0.3));
  };

  const crayon = (x: number, z: number, len: number, ry: number, color: string): void => {
    if (!clear(x, z, len / 2)) return;
    const r = 1.7;
    const grp = new THREE.Group();
    const mat = plastic(color);
    mat.roughness = 0.7;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len * 0.82, 6), mat);
    body.rotation.z = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(r, len * 0.18, 6), mat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = len * 0.5;
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, len * 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.8 }));
    wrap.rotation.z = Math.PI / 2;
    wrap.position.x = -len * 0.08;
    grp.add(body, tip, wrap);
    grp.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    grp.position.set(x, r * 0.87, z);
    grp.rotation.y = ry;
    g.add(grp);
  };

  const books = (x: number, z: number, n: number): void => {
    if (!clear(x, z, 18)) return;
    let y = 0;
    for (let i = 0; i < n; i++) {
      const w = rng.range(26, 34);
      const d = rng.range(18, 24);
      const h = rng.range(3.5, 5.5);
      const cover = plastic(rng.pick(toyCols));
      cover.roughness = 0.75;
      const pages = new THREE.MeshStandardMaterial({ map: tex.pages, roughness: 0.9 });
      const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.6), [pages, cover, cover, cover, pages, pages]);
      b.position.set(x + rng.range(-1.5, 1.5), y + h / 2, z + rng.range(-1.5, 1.5));
      b.rotation.y = rng.range(-0.25, 0.25);
      b.castShadow = b.receiveShadow = true;
      g.add(b);
      y += h;
    }
  };

  const ball = (x: number, z: number, r: number): void => {
    if (!clear(x, z, r)) return;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ map: tex.ball, roughness: 0.35 }));
    m.position.set(x, r, z);
    m.rotation.set(0.4, rng.next() * 6, 0.2);
    m.castShadow = true;
    g.add(m);
  };

  const rings = (x: number, z: number): void => {
    if (!clear(x, z, 14)) return;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 16), plastic('#ffd23a'));
    pole.position.set(x, 17, z);
    pole.castShadow = true;
    g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(12, 13, 4, 32), plastic('#e8423a'));
    base.position.set(x, 2, z);
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    let y = 4;
    for (let i = 0; i < 5; i++) {
      const rr = 10 - i * 1.6;
      const tor = new THREE.Mesh(new THREE.TorusGeometry(rr, 2.3, 12, 32), plastic(toyCols[(i + 1) % toyCols.length]));
      tor.rotation.x = Math.PI / 2;
      tor.position.set(x, y + 2.3, z);
      tor.castShadow = true;
      g.add(tor);
      y += 4.4;
    }
  };

  const S = sc;
  blockStack(32 * S, 44 * S, 10);
  blockStack(5 * S, -33 * S, 11);
  blockStack(140 * S, 120 * S, 12);
  crayon(-38 * S, 50 * S, 34, 0.5, '#e8423a');
  crayon(-30 * S, 58 * S, 34, 0.75, '#2f7de0');
  crayon(-46 * S, 40 * S, 34, 0.2, '#3fb24a');
  books(-70 * S, 30 * S, 4);
  books(150 * S, 20 * S, 5);
  ball(78 * S, 52 * S, 13);
  ball(-60 * S, -35 * S, 10);
  rings(150 * S, -30 * S);
  if (q.scenery >= 1) {
    for (let i = 0; i < 10; i++) {
      const x = rng.range(R.x0 + 15, R.x1 - 15);
      const z = rng.range(R.z0 + 15, R.z1 - 15);
      if (rng.chance(0.5)) addBlockIfClear(x, z);
      else crayon(x, z, 34, rng.next() * Math.PI, rng.pick(toyCols));
    }
  }
  function addBlockIfClear(x: number, z: number): void {
    const size = rng.range(8, 11);
    if (clear(x, z, size)) addBlock(x, z, 0, size, rng.next() * Math.PI);
  }

  return g;
}
