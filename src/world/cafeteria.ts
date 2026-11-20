// El comedor gigante: baldosas, paredes verde menta con zócalo, ventanas, pizarra del menú, mostrador con
// bandejas, dos mesas largas con mantel de cuadros (la pista pasa por encima y salta de una a otra), platos con
// sándwiches, vasos y cajitas de jugo sobre las mesas, sillas, y loncheras, cartón de leche, plátano, galletas y
// manzanas gigantes en el suelo.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Track } from '../game/track';
import type { Textures } from './textures';
import type { Quality } from '../core/quality';
import type { Rng } from '../core/rng';
import { LIP } from './trackMesh';
import { TABLE_HEIGHT } from './schoolTracks';
import { SCHOOL_COLORS, apple, clearOfTrack, plastic, signTexture, tileTexture } from './schoolKit';

const WALL_H = 170;

export function buildCafeteria(track: Track, _tex: Textures, q: Quality, rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.name = 'comedor';
  const shadows = q.shadowMap > 0;
  const S = track.samples;
  const b = track.bounds;
  const sc = track.def.scale;
  const R = { x0: b.minX - 60, x1: b.maxX + 60, z0: b.minZ - 60, z1: b.maxZ + 60 };
  const W = R.x1 - R.x0;
  const D = R.z1 - R.z0;
  const cx = (R.x0 + R.x1) / 2;
  const cz = (R.z0 + R.z1) / 2;
  const cast = <T extends THREE.Object3D>(o: T): T => {
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = shadows;
    });
    return o;
  };

  // Suelo de baldosas.
  const tiles = tileTexture(rng, q.anisotropy, '#f4f1ea', '#f2a0b8');
  tiles.repeat.set(W / 36, D / 36);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, -0.02, cz);
  floor.receiveShadow = true;
  g.add(floor);

  // Paredes.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc8eedc, roughness: 0.95 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2f9b8a, roughness: 0.7 });
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
    const bb = new THREE.Mesh(new THREE.BoxGeometry(len, 18, 1.2), baseMat);
    bb.position.set(x, 9, z);
    bb.rotation.y = ry;
    g.add(bb);
  }

  // Ventanas en la pared norte (z1).
  const skyTex = signTexture(64, 128, '#9fd3ff', [], q.anisotropy, (c) => {
    const grd = c.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, '#6fb8ff');
    grd.addColorStop(1, '#e8f6ff');
    c.fillStyle = grd;
    c.fillRect(0, 0, 64, 128);
  });
  const frameMat = plastic('#ffffff', 0.5);
  for (let i = 0; i < 4; i++) {
    const win = new THREE.Group();
    win.add(new THREE.Mesh(new THREE.PlaneGeometry(70, 60), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })));
    for (const [w, h, x, y] of [[76, 4, 0, 32], [76, 4, 0, -32], [4, 68, -36, 0], [4, 68, 36, 0], [3, 60, 0, 0]] as const) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), frameMat);
      f.position.set(x, y, 1);
      win.add(f);
    }
    win.position.set(R.x0 + W * (0.2 + i * 0.2), 95, R.z1 - 0.5);
    win.rotation.y = Math.PI;
    g.add(win);
  }

  // Pizarra del menú en la pared de la salida (z0).
  const menu = signTexture(
    768,
    512,
    '#2a2a36',
    [['Menú de hoy', 86, '#ffe27a'], ['Sopita', 64, '#ffffff'], ['Arroz con pollo', 64, '#ffffff'], ['Fruta y jugo', 64, '#ffffff']],
    q.anisotropy,
    undefined,
    '#b9814a',
  );
  const menuMesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshStandardMaterial({ map: menu, roughness: 0.9 }));
  menuMesh.position.set(cx + 40, 85, R.z0 + 0.6);
  g.add(menuMesh);

  // Mostrador con bandejas apiladas contra la pared oeste (x0).
  const counter = new THREE.Group();
  const cBody = new THREE.Mesh(new RoundedBoxGeometry(24, 22, 160, 2, 1), plastic('#c8ccd6', 0.35));
  cBody.position.y = 11;
  const cTop = new THREE.Mesh(new RoundedBoxGeometry(27, 2, 164, 2, 0.8), plastic('#9aa3b5', 0.25));
  cTop.position.y = 23;
  counter.add(cBody, cTop);
  for (let k = 0; k < 6; k++) {
    const tr = new THREE.Mesh(new RoundedBoxGeometry(18, 1.2, 26, 2, 0.5), plastic(SCHOOL_COLORS[k % SCHOOL_COLORS.length], 0.4));
    tr.position.set(0, 24.6 + (k % 3) * 1.3, -60 + Math.floor(k / 3) * 120);
    counter.add(tr);
  }
  counter.position.set(R.x0 + 14, 0, cz);
  g.add(cast(counter));

  // --- Mesas largas bajo el tramo alto (una a cada lado del salto) ---
  const tableIdx = S.map((s, i) => ((s.surface === 'table' || s.surface === 'ramp') && s.y >= TABLE_HEIGHT - 0.05 && !track.inGap(i) ? i : -1)).filter((i) => i >= 0);
  // Se separa en tramos donde hay un salto en los índices (el hueco entre las mesas).
  const runs: number[][] = [];
  for (const i of tableIdx) {
    const last = runs[runs.length - 1];
    if (last && i - last[last.length - 1] <= 2) last.push(i);
    else runs.push([i]);
  }
  const cloth = signTexture(128, 128, '#ffffff', [], q.anisotropy, (c) => {
    c.fillStyle = 'rgba(224,64,48,0.9)';
    c.fillRect(0, 0, 64, 64);
    c.fillRect(64, 64, 64, 64);
    c.fillStyle = 'rgba(224,64,48,0.45)';
    c.fillRect(64, 0, 64, 64);
    c.fillRect(0, 64, 64, 64);
  });
  cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping;
  const clothMat = new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.9 });
  const legMat = plastic('#b9814a', 0.6);
  const tableHalf = (S[tableIdx[0] ?? 0]?.hw ?? 7.5) + track.shoulder + LIP + 15;
  const tables: { x0: number; x1: number; z0: number; z1: number }[] = [];
  for (const run of runs) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const i of run) {
      x0 = Math.min(x0, S[i].x); x1 = Math.max(x1, S[i].x);
      z0 = Math.min(z0, S[i].z); z1 = Math.max(z1, S[i].z);
    }
    // El tramo va a lo largo de X: la mesa se alarga un poco en X y se ensancha en Z.
    const T = { x0: x0 - 1, x1: x1 + 1, z0: (z0 + z1) / 2 - tableHalf, z1: (z0 + z1) / 2 + tableHalf };
    tables.push(T);
    const tw = T.x1 - T.x0;
    const td = T.z1 - T.z0;
    const tx = (T.x0 + T.x1) / 2;
    const tz = (T.z0 + T.z1) / 2;
    const top = new THREE.Mesh(new RoundedBoxGeometry(tw, 1.6, td, 2, 0.5), [clothMat, clothMat, clothMat, clothMat, clothMat, clothMat]);
    cloth.repeat.set(tw / 14, td / 14);
    top.position.set(tx, TABLE_HEIGHT - 0.85, tz);
    top.castShadow = top.receiveShadow = true;
    g.add(top);
    const legGeo = new THREE.CylinderGeometry(1.4, 1.4, TABLE_HEIGHT - 1.6, 10);
    for (const lx of [T.x0 + 4, T.x1 - 4])
      for (const lz of [T.z0 + 4, T.z1 - 4]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, (TABLE_HEIGHT - 1.6) / 2, lz);
        leg.castShadow = shadows;
        g.add(leg);
      }
    // Platos, vasos y cajitas de jugo a los dos lados de la pista, sobre el mantel.
    const sideZ = [T.z0 + 7, T.z1 - 7];
    for (let x = T.x0 + 10; x < T.x1 - 8; x += 22) {
      for (const z of sideZ) {
        const pick = rng.next();
        const obj = pick < 0.45 ? plateWithFood(rng) : pick < 0.75 ? juiceBox(rng.pick(SCHOOL_COLORS)) : cup(rng.pick(SCHOOL_COLORS));
        obj.position.set(x + rng.range(-3, 3), TABLE_HEIGHT, z);
        obj.rotation.y = rng.next() * Math.PI * 2;
        g.add(cast(obj));
      }
    }
  }

  // --- En el suelo: sillas junto a las mesas, y comida y loncheras gigantes ---
  const keepOut = tables.map((t) => ({ x0: t.x0 - 3, x1: t.x1 + 3, z0: t.z0 - 3, z1: t.z1 + 3 }));
  keepOut.push({ x0: 40 * sc - 26, x1: 40 * sc + 26, z0: -40 * sc - 26, z1: -40 * sc + 26 }); // podio
  keepOut.push({ x0: R.x0, x1: R.x0 + 30, z0: cz - 85, z1: cz + 85 }); // mostrador
  const clear = clearOfTrack(track, R, keepOut);
  const place = (o: THREE.Object3D, x: number, z: number, r: number, ry = rng.next() * Math.PI * 2): void => {
    if (!clear(x, z, r)) return dispose(o);
    o.position.set(x, 0, z);
    o.rotation.y = ry;
    g.add(cast(o));
  };
  for (const T of tables) {
    for (let x = T.x0 + 12; x < T.x1 - 8; x += 26) {
      place(chair(rng.pick(SCHOOL_COLORS)), x, T.z0 - 10, 8, 0);
      place(chair(rng.pick(SCHOOL_COLORS)), x, T.z1 + 10, 8, Math.PI);
    }
  }
  const S2 = sc;
  place(lunchbox('#2f7de0', '#ffd23a'), -60 * S2, -50 * S2, 16);
  place(lunchbox('#f07ab0', '#ffffff'), 120 * S2, -110 * S2, 16);
  place(milkCarton(), -120 * S2, -60 * S2, 12);
  place(juiceBox('#ff8a1a', 3.2), 0, -40 * S2, 14);
  place(banana(), 60 * S2, 30 * S2, 22);
  place(apple(9), -200 * S2, 30 * S2, 10);
  place(apple(8, '#7cc443'), -60 * S2, 40 * S2, 9);
  place(cookies(rng), 150 * S2, 20 * S2, 14);
  place(lunchbox('#3fb24a', '#e8423a'), -250 * S2, -130 * S2, 16);
  if (q.scenery >= 1) {
    for (let i = 0; i < 10; i++) {
      const x = rng.range(R.x0 + 20, R.x1 - 20);
      const z = rng.range(R.z0 + 20, R.z1 - 20);
      const r = rng.next();
      if (r < 0.35) place(apple(rng.range(5, 7), rng.pick(['#e3342b', '#7cc443', '#ffcf3a'])), x, z, 8);
      else if (r < 0.65) place(cup(rng.pick(SCHOOL_COLORS), 2.4), x, z, 10);
      else place(chair(rng.pick(SCHOOL_COLORS)), x, z, 8);
    }
  }

  function dispose(o: THREE.Object3D): void {
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      mesh.geometry?.dispose();
      for (const mat of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
  }

  return g;
}

/** Plato con un sándwich (o arroz) encima. Radio ≈ 6. */
function plateWithFood(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(6, 4.6, 0.8, 28), plastic('#ffffff', 0.25));
  plate.position.y = 0.4;
  g.add(plate);
  if (rng.chance(0.6)) {
    // Sándwich triangular: pan, lechuga, queso, pan.
    const tri = (y: number, h: number, c: string, s = 1): void => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(4 * s, 4 * s, h, 3), plastic(c, 0.8));
      m.position.y = y;
      g.add(m);
    };
    tri(1.3, 1, '#f3d9a0');
    tri(2.0, 0.4, '#5fc04a', 1.08);
    tri(2.4, 0.4, '#ffd23a', 1.02);
    tri(3.0, 1, '#f3d9a0');
  } else {
    const rice = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), plastic('#fbf7ea', 0.9));
    rice.position.y = 0.8;
    const pea = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), plastic('#5fc04a', 0.6));
    pea.position.set(3.6, 1.4, 1);
    const carrot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 10), plastic('#ff8a1a', 0.6));
    carrot.position.set(3, 1.1, -1.8);
    g.add(rice, pea, carrot);
  }
  return g;
}

/** Vaso de plástico con leche. */
function cup(color: string, s = 1): THREE.Group {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(2.6 * s, 2.1 * s, 6 * s, 20, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.35, side: THREE.DoubleSide }));
  c.position.y = 3 * s;
  const milk = new THREE.Mesh(new THREE.CircleGeometry(2.45 * s, 20), plastic('#ffffff', 0.3));
  milk.rotation.x = -Math.PI / 2;
  milk.position.y = 5 * s;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(2.1 * s, 20), plastic(color, 0.35));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.05;
  g.add(c, milk, bottom);
  return g;
}

/** Cajita de jugo con pajita. */
function juiceBox(color: string, s = 1): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new RoundedBoxGeometry(4 * s, 6 * s, 2.6 * s, 2, 0.3 * s), plastic(color, 0.5));
  box.position.y = 3 * s;
  const label = new THREE.Mesh(new THREE.CircleGeometry(1.3 * s, 16), plastic('#ffffff', 0.5));
  label.position.set(0, 3 * s, 1.31 * s);
  const fruit = new THREE.Mesh(new THREE.CircleGeometry(0.8 * s, 16), plastic('#ff8a1a', 0.5));
  fruit.position.set(0, 3 * s, 1.33 * s);
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 4 * s, 6), plastic('#ffffff', 0.4));
  straw.position.set(1 * s, 7.4 * s, 0);
  straw.rotation.z = -0.25;
  g.add(box, label, fruit, straw);
  return g;
}

/** Silla de niño (asiento y respaldo de color, patas metálicas). Respaldo hacia −Z. */
function chair(color: string): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3b5, roughness: 0.35, metalness: 0.5 });
  const seat = new THREE.Mesh(new RoundedBoxGeometry(11, 1.2, 10, 2, 0.4), plastic(color, 0.5));
  seat.position.y = 7;
  const back = new THREE.Mesh(new RoundedBoxGeometry(11, 7, 1.2, 2, 0.4), plastic(color, 0.5));
  back.position.set(0, 11.5, -5);
  g.add(seat, back);
  const legGeo = new THREE.CylinderGeometry(0.45, 0.45, 7, 6);
  for (const [x, z] of [[-4.6, -4], [4.6, -4], [-4.6, 4], [4.6, 4]]) {
    const leg = new THREE.Mesh(legGeo, metal);
    leg.position.set(x, 3.5, z);
    g.add(leg);
  }
  return g;
}

/** Lonchera con asa. */
function lunchbox(color: string, lid: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(24, 15, 13, 3, 2), plastic(color, 0.45));
  body.position.y = 7.5;
  const top = new THREE.Mesh(new RoundedBoxGeometry(24.6, 4, 13.6, 3, 1.6), plastic(lid, 0.45));
  top.position.y = 16;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(5, 0.9, 8, 20, Math.PI), plastic('#2a2050', 0.5));
  handle.position.y = 18;
  const clasp = new THREE.Mesh(new RoundedBoxGeometry(3, 3, 1, 1, 0.3), plastic('#ffd23a', 0.3));
  clasp.position.set(0, 14, 6.9);
  g.add(body, top, handle, clasp);
  return g;
}

/** Cartón de leche. */
function milkCarton(): THREE.Group {
  const g = new THREE.Group();
  const t = signTexture(256, 256, '#ffffff', [['LECHE', 60, '#2f7de0']], 1, (c) => {
    c.fillStyle = '#2f7de0';
    c.fillRect(0, 196, 256, 60);
  });
  const sideMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  const plain = plastic('#ffffff', 0.6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 18, 12), [sideMat, sideMat, plain, plain, sideMat, sideMat]);
  body.position.y = 9;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 12, 3, 1), plastic('#ffffff', 0.6));
  roof.rotation.set(0, 0, Math.PI / 2);
  roof.rotation.x = Math.PI / 2;
  roof.scale.set(1, 1, 0.7);
  roof.position.y = 21;
  g.add(body, roof);
  return g;
}

/** Plátano curvo tumbado. */
function banana(): THREE.Group {
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10 - 0.5;
    pts.push(new THREE.Vector3(t * 34, 3 + (0.25 - t * t) * 10, 0));
  }
  const body = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 3, 10), plastic('#ffd23a', 0.5));
  const tipGeo = new THREE.SphereGeometry(1.2, 8, 6);
  const tipMat = plastic('#6b4423', 0.7);
  for (const p of [pts[0], pts[pts.length - 1]]) {
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.copy(p);
    g.add(tip);
  }
  g.add(body);
  return g;
}

/** Galletas apiladas (con chispas). */
function cookies(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const dough = plastic('#d9a35a', 0.9);
  const chip = plastic('#5a3418', 0.7);
  const chipGeo = new THREE.SphereGeometry(0.6, 6, 4);
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 2, 24), dough);
    c.position.set(rng.range(-1, 1), 1 + k * 2.1, rng.range(-1, 1));
    g.add(c);
  }
  for (let k = 0; k < 9; k++) {
    const a = rng.next() * Math.PI * 2;
    const r = rng.range(1, 5.5);
    const m = new THREE.Mesh(chipGeo, chip);
    m.position.set(Math.cos(a) * r, 6.3, Math.sin(a) * r);
    g.add(m);
  }
  return g;
}
