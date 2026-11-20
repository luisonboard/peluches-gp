// El aula gigante: baldosas, paredes amarillas con zócalo, pizarra con dibujos, abecedario, reloj, ventanas,
// mesa de la maestra (la pista da una vuelta por encima, con manzana, lápices y globo terráqueo), pila de libros
// como rampa, regla como bajada, pupitres con sillas, mochilas, crayones y lápices gigantes fuera de la pista.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Track } from '../game/track';
import type { Textures } from './textures';
import type { Quality } from '../core/quality';
import type { Rng } from '../core/rng';
import { DESK_HEIGHT, DESK_RECT } from './schoolTracks';
import { SCHOOL_COLORS, apple, backpack, bookStack, clearOfTrack, crayon, pencil, plastic, schoolDesk, signTexture, tileTexture } from './schoolKit';

const RECT = { x0: -170, x1: 185, z0: -60, z1: 185 };
const WALL_H = 170;

export function buildClassroom(track: Track, tex: Textures, q: Quality, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.name = 'aula';
  const sc = track.def.scale;
  const R = { x0: RECT.x0 * sc, x1: RECT.x1 * sc, z0: RECT.z0 * sc, z1: RECT.z1 * sc };
  const W = R.x1 - R.x0;
  const D = R.z1 - R.z0;
  const cx = (R.x0 + R.x1) / 2;
  const cz = (R.z0 + R.z1) / 2;

  // Suelo de baldosas.
  const tiles = tileTexture(rng, q.anisotropy, '#e9e0c8', '#8cc7a6');
  tiles.repeat.set(W / 40, D / 40);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, -0.02, cz);
  floor.receiveShadow = true;
  g.add(floor);

  // Paredes amarillas con zócalo verde.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, roughness: 0.95 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x4f9a6a, roughness: 0.7 });
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
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 22, 1.2), baseMat);
    b.position.set(x, 11, z);
    b.rotation.y = ry;
    g.add(b);
  }

  // Pizarra en la pared del fondo (z1) con dibujos de tiza.
  const board = signTexture(
    1024,
    512,
    '#2f5d46',
    [['¡Hola, amigos!', 92, '#ffffff'], ['A B C   1 2 3', 110, '#ffe27a']],
    q.anisotropy,
    (c) => {
      c.lineWidth = 10;
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      // Sol.
      c.beginPath();
      c.arc(120, 110, 50, 0, Math.PI * 2);
      c.stroke();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        c.beginPath();
        c.moveTo(120 + Math.cos(a) * 66, 110 + Math.sin(a) * 66);
        c.lineTo(120 + Math.cos(a) * 92, 110 + Math.sin(a) * 92);
        c.stroke();
      }
      // Casita.
      c.strokeStyle = 'rgba(255,190,210,0.9)';
      c.strokeRect(820, 300, 140, 120);
      c.beginPath();
      c.moveTo(800, 300);
      c.lineTo(890, 220);
      c.lineTo(980, 300);
      c.stroke();
      c.strokeRect(870, 350, 40, 70);
      // Flor.
      c.strokeStyle = 'rgba(160,220,255,0.9)';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        c.beginPath();
        c.arc(130 + Math.cos(a) * 26, 390 + Math.sin(a) * 26, 18, 0, Math.PI * 2);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(130, 416);
      c.lineTo(130, 500);
      c.stroke();
    },
    '#8a5a2c',
  );
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 100), new THREE.MeshStandardMaterial({ map: board, roughness: 0.9 }));
  boardMesh.position.set(-10 * sc, 75, R.z1 - 0.6);
  boardMesh.rotation.y = Math.PI;
  g.add(boardMesh);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(200, 2, 4), plastic('#8a5a2c', 0.7));
  tray.position.set(-10 * sc, 24, R.z1 - 2);
  g.add(tray);

  // Abecedario de cartulinas sobre la pizarra y en la pared de la salida.
  const abc = (x: number, z: number, ry: number, letters: string): void => {
    const n = letters.length;
    for (let i = 0; i < n; i++) {
      const t = signTexture(128, 160, SCHOOL_COLORS[i % SCHOOL_COLORS.length], [[letters[i], 110, '#ffffff']], q.anisotropy, undefined, '#ffffff');
      const card = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), new THREE.MeshBasicMaterial({ map: t }));
      const off = (i - (n - 1) / 2) * 19;
      card.position.set(x + Math.cos(ry) * off, 142 + (i % 2) * 2, z - Math.sin(ry) * off);
      card.rotation.y = ry;
      g.add(card);
    }
  };
  abc(-10 * sc, R.z1 - 0.8, Math.PI, 'ABCDEFGHIJKLM');
  abc(cx, R.z0 + 0.8, 0, 'NOPQRSTUVWXYZ');

  // Reloj de pared.
  const clock = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(16, 40),
    new THREE.MeshBasicMaterial({
      map: signTexture(256, 256, '#ffffff', [], q.anisotropy, (c) => {
        c.fillStyle = '#2a2050';
        c.font = '900 34px system-ui, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        for (let h = 1; h <= 12; h++) {
          const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
          c.fillText(String(h), 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
        }
        c.lineCap = 'round';
        c.strokeStyle = '#2a2050';
        c.lineWidth = 12;
        c.beginPath();
        c.moveTo(128, 128);
        c.lineTo(128, 62);
        c.stroke();
        c.strokeStyle = '#e8423a';
        c.lineWidth = 9;
        c.beginPath();
        c.moveTo(128, 128);
        c.lineTo(180, 128);
        c.stroke();
      }),
    }),
  );
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16.5, 1.6, 10, 40), plastic('#e8423a', 0.4));
  clock.add(face, ring);
  clock.position.set(R.x0 + 0.8, 120, 60 * sc);
  clock.rotation.y = Math.PI / 2;
  g.add(clock);

  // Dos ventanas con cielo en la pared derecha (x1).
  const skyTex = signTexture(64, 128, '#9fd3ff', [], q.anisotropy, (c) => {
    const grd = c.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, '#6fb8ff');
    grd.addColorStop(1, '#e8f6ff');
    c.fillStyle = grd;
    c.fillRect(0, 0, 64, 128);
  });
  const frameMat = plastic('#ffffff', 0.5);
  for (const wz of [10 * sc, 120 * sc]) {
    const win = new THREE.Group();
    win.add(new THREE.Mesh(new THREE.PlaneGeometry(80, 70), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })));
    for (const [w, h, x, y] of [[86, 4, 0, 37], [86, 4, 0, -37], [4, 78, -41, 0], [4, 78, 41, 0], [3, 70, 0, 0]] as const) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), frameMat);
      f.position.set(x, y, 1);
      win.add(f);
    }
    win.position.set(R.x1 - 0.5, 90, wz);
    win.rotation.y = -Math.PI / 2;
    g.add(win);
  }

  // Mesa de la maestra: tablero de madera clara con canto, faldón al frente y patas.
  const B = { x0: DESK_RECT.x0 * sc, x1: DESK_RECT.x1 * sc, z0: DESK_RECT.z0 * sc, z1: DESK_RECT.z1 * sc };
  const bw = B.x1 - B.x0;
  const bd = B.z1 - B.z0;
  const bx = (B.x0 + B.x1) / 2;
  const bz = (B.z0 + B.z1) / 2;
  const deskTop = new THREE.Mesh(new RoundedBoxGeometry(bw, 2.4, bd, 2, 0.8), plastic('#d9a868', 0.55));
  deskTop.position.set(bx, DESK_HEIGHT - 1.25, bz);
  deskTop.castShadow = deskTop.receiveShadow = true;
  g.add(deskTop);
  const deskBody = new THREE.Mesh(new RoundedBoxGeometry(bw - 4, DESK_HEIGHT - 2.4, bd - 4, 2, 0.6), plastic('#b9814a', 0.6));
  deskBody.position.set(bx, (DESK_HEIGHT - 2.4) / 2, bz);
  deskBody.castShadow = deskBody.receiveShadow = true;
  g.add(deskBody);
  // Cajones en los lados que no toca la pista (oeste y norte).
  const knob = plastic('#ffd23a', 0.3);
  for (let i = 0; i < 4; i++) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), knob);
    k.position.set(B.x1 - 1.2, DESK_HEIGHT / 2 - 1, B.z0 + bd * (0.2 + i * 0.2));
    g.add(k);
  }

  // Sobre la mesa (fuera de la pista): manzana, vaso con lápices, globo terráqueo.
  const onDesk = (x: number, z: number, r: number): boolean => {
    const { d, i } = track.distanceToCenter(x, z);
    return d > track.samples[i].hw + track.shoulder + 3 + r && x - r > B.x0 + 1 && x + r < B.x1 - 1 && z - r > B.z0 + 1 && z + r < B.z1 - 1;
  };
  const deskSpots: [number, number][] = [];
  for (let x = B.x0 + 8; x < B.x1 - 8; x += 6) for (let z = B.z0 + 8; z < B.z1 - 8; z += 6) if (onDesk(x, z, 9)) deskSpots.push([x, z]);
  if (deskSpots.length) {
    // Lo más lejos posible de la pista, en el centro de la vuelta.
    deskSpots.sort((a, b) => track.distanceToCenter(b[0], b[1]).d - track.distanceToCenter(a[0], a[1]).d);
    const [ax, az] = deskSpots[0];
    const ap = apple(8);
    ap.position.set(ax, DESK_HEIGHT, az);
    g.add(ap);
  }

  // Globo terráqueo en el suelo, junto a la mesa.
  // Ni sobre la mesa ni donde va el podio (centro del circuito).
  const clear = clearOfTrack(track, R, [
    { x0: B.x0 - 4, x1: B.x1 + 4, z0: B.z0 - 4, z1: B.z1 + 4 },
    { x0: 5 * sc - 26, x1: 5 * sc + 26, z0: 30 * sc - 26, z1: 30 * sc + 26 },
  ]);
  const globe = (x: number, z: number): void => {
    if (!clear(x, z, 16)) return;
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 3, 24), plastic('#2a2050', 0.4));
    base.position.y = 1.5;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 12, 8), plastic('#c8ccd6', 0.3));
    stand.position.y = 8;
    const earthTex = signTexture(256, 128, '#3d8fe0', [], q.anisotropy, (c) => {
      c.fillStyle = '#4fb34a';
      for (const [x0, y0, rx, ry] of [[40, 40, 30, 22], [70, 85, 16, 26], [140, 38, 34, 18], [150, 80, 22, 20], [215, 90, 20, 12], [200, 30, 18, 12]]) {
        c.beginPath();
        c.ellipse(x0, y0, rx, ry, 0.3, 0, Math.PI * 2);
        c.fill();
      }
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 20), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.4 }));
    earth.position.y = 26;
    earth.rotation.z = 0.4;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(13.5, 0.8, 8, 32, Math.PI), plastic('#c8ccd6', 0.3));
    arc.position.y = 26;
    arc.rotation.set(0, Math.PI / 2, 0.4 + Math.PI / 2);
    grp.add(base, stand, earth, arc);
    grp.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    grp.position.set(x, 0, z);
    g.add(grp);
  };
  globe(170 * sc, 30 * sc);

  // --- Pupitres, mochilas y útiles gigantes, solo donde no estorben ---
  const place = (obj: THREE.Object3D, x: number, z: number, r: number, ry = rng.range(-0.5, 0.5)): boolean => {
    if (!clear(x, z, r)) {
      disposeLater(obj);
      return false;
    }
    obj.position.set(x, 0, z);
    obj.rotation.y = ry;
    g.add(obj);
    return true;
  };
  // Pupitres en filas dentro de la curva grande y a la izquierda de la salida.
  let d = 0;
  for (const [x, z] of [[-80, 50], [-55, 50], [-80, 72], [-55, 30], [10, 40], [35, 50], [60, 40], [10, -38], [-40, -38], [-110, -40]] as const) {
    const desk = schoolDesk(SCHOOL_COLORS[d % SCHOOL_COLORS.length], 0.85);
    if (place(desk, x * sc, z * sc, 26, rng.range(-0.25, 0.25))) d++;
  }
  const bags: [number, number][] = [[-100, 150], [-130, 140], [150, -40], [-150, -30], [70, 165]];
  bags.forEach(([x, z], i) => {
    const b = backpack(18, SCHOOL_COLORS[(i + 2) % SCHOOL_COLORS.length], SCHOOL_COLORS[(i + 4) % SCHOOL_COLORS.length]);
    place(b, x * sc, z * sc, 12);
  });
  for (const [x, z, c] of [[-20, 60, '#e8423a'], [-12, 68, '#2f7de0'], [-28, 52, '#3fb24a']] as const) place(crayon(34, c), x * sc, z * sc, 18, 0.6);
  for (const [x, z] of [[80, 70], [-140, 100], [20, 160]] as const) place(pencil(44), x * sc, z * sc, 23, rng.range(0, Math.PI));
  for (const [x, z, n] of [[-150, 165, 5], [165, 165, 4], [-60, 160, 3]] as const) {
    if (clear(x * sc, z * sc, 20)) bookStack(g, rng, tex.pages, x * sc, z * sc, n);
  }
  if (q.scenery >= 1) {
    for (let i = 0; i < 12; i++) {
      const x = rng.range(R.x0 + 20, R.x1 - 20);
      const z = rng.range(R.z0 + 20, R.z1 - 20);
      const r = rng.next();
      if (r < 0.4) place(crayon(30, rng.pick(SCHOOL_COLORS)), x, z, 16, rng.next() * Math.PI);
      else if (r < 0.7) place(pencil(38), x, z, 20, rng.next() * Math.PI);
      else {
        const e = new THREE.Mesh(new RoundedBoxGeometry(12, 4, 7, 2, 1), [plastic('#f58bb0', 0.8), plastic('#f58bb0', 0.8), plastic('#ffffff', 0.8), plastic('#f58bb0', 0.8), plastic('#3f7de0', 0.8), plastic('#3f7de0', 0.8)]);
        e.position.y = 2;
        e.castShadow = true;
        const holder = new THREE.Group();
        holder.add(e);
        place(holder, x, z, 8, rng.next() * Math.PI); // goma de borrar
      }
    }
  }

  // Lo que no se colocó se libera ahora (no está en el grupo, así que nadie más lo haría).
  function disposeLater(o: THREE.Object3D): void {
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      mesh.geometry?.dispose();
      for (const mat of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) mat.dispose();
    });
  }

  return g;
}
