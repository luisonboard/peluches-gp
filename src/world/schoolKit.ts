// Piezas comunes de los escenarios de la Escuelita: texturas en <canvas> y objetos gigantes (lápices, crayones,
// manzanas, mochilas, libros, pupitres). Todo con materiales y geometrías propios: se liberan con su grupo.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Track } from '../game/track';
import type { Rng } from '../core/rng';
import { LIP } from './trackMesh';

export const SCHOOL_COLORS = ['#e8423a', '#2f7de0', '#3fb24a', '#ffb52a', '#8a4fd8', '#f07ab0'];

export const plastic = (c: number | string, rough = 0.45): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness: rough });

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, aniso: number, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

/** Baldosas de dos colores (cada textura = 2 × 2 baldosas) con juntas y un poco de brillo irregular. */
export function tileTexture(rng: Rng, aniso: number, a: string, b: string): THREE.CanvasTexture {
  return canvasTex(
    256,
    256,
    (g) => {
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          g.fillStyle = (i + j) % 2 ? b : a;
          g.fillRect(i * 128, j * 128, 128, 128);
        }
      for (let k = 0; k < 900; k++) {
        g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        g.fillRect(rng.next() * 256, rng.next() * 256, rng.range(1, 3), rng.range(1, 3));
      }
      g.fillStyle = 'rgba(60,50,40,0.35)';
      for (const p of [0, 127, 255]) {
        g.fillRect(p - 1, 0, 2, 256);
        g.fillRect(0, p - 1, 256, 2);
      }
    },
    aniso,
  );
}

/** Césped claro de día. */
export function grassTexture(rng: Rng, aniso: number): THREE.CanvasTexture {
  return canvasTex(
    256,
    256,
    (g) => {
      g.fillStyle = '#58a845';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) {
        g.strokeStyle = `hsl(${rng.range(90, 120)} ${rng.range(40, 60)}% ${rng.range(36, 52)}%)`;
        g.lineWidth = rng.range(1, 2.2);
        const x = rng.next() * 256;
        const y = rng.next() * 256;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + rng.range(-3, 3), y - rng.range(4, 10));
        g.stroke();
      }
    },
    aniso,
  );
}

/** Arena: beige con granitos. */
export function sandTexture(rng: Rng, aniso: number): THREE.CanvasTexture {
  return canvasTex(
    256,
    256,
    (g) => {
      g.fillStyle = '#e8cf8e';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 6000; i++) {
        g.fillStyle = rng.chance(0.5) ? 'rgba(255,250,230,0.35)' : 'rgba(150,110,50,0.22)';
        g.fillRect(rng.next() * 256, rng.next() * 256, rng.range(1, 2.5), rng.range(1, 2.5));
      }
    },
    aniso,
  );
}

/**
 * Cartel con texto (o dibujos con `extra`): fondo, borde opcional y líneas de texto centradas.
 * `lines`: [texto, tamaño en px, color].
 */
export function signTexture(
  w: number,
  h: number,
  bg: string,
  lines: [string, number, string][],
  aniso: number,
  extra?: (g: CanvasRenderingContext2D) => void,
  border?: string,
): THREE.CanvasTexture {
  return canvasTex(
    w,
    h,
    (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      if (border) {
        g.strokeStyle = border;
        g.lineWidth = Math.max(6, w * 0.02);
        g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
      }
      extra?.(g);
      const total = lines.reduce((a, l) => a + l[1] * 1.15, 0);
      let y = (h - total) / 2;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      for (const [t, size, col] of lines) {
        g.font = `900 ${size}px "Trebuchet MS", "Comic Sans MS", system-ui, sans-serif`;
        g.fillStyle = col;
        g.fillText(t, w / 2, y);
        y += size * 1.15;
      }
    },
    aniso,
    false,
  );
}

/** ¿Cabe un objeto de radio `r` en (x, z) sin tocar la pista? `rect`: límites del escenario. */
export function clearOfTrack(track: Track, rect: { x0: number; x1: number; z0: number; z1: number }, keepOut: { x0: number; x1: number; z0: number; z1: number }[] = []) {
  return (x: number, z: number, r: number): boolean => {
    const { d, i } = track.distanceToCenter(x, z);
    if (d < track.samples[i].hw + track.shoulder + LIP + r + 4) return false;
    if (x - r < rect.x0 + 2 || x + r > rect.x1 - 2 || z - r < rect.z0 + 2 || z + r > rect.z1 - 2) return false;
    for (const k of keepOut) if (x + r > k.x0 && x - r < k.x1 && z + r > k.z0 && z - r < k.z1) return false;
    return true;
  };
}

const shadowAll = (o: THREE.Object3D, on = true): void => {
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = on;
  });
};

/** Lápiz amarillo tumbado (a lo largo de X, punta hacia +X), con goma rosa. Apoyado en y = 0. */
export function pencil(len: number, r = 1.8): THREE.Group {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len * 0.78, 6), plastic('#ffc21a', 0.6));
  body.rotation.z = Math.PI / 2;
  const wood = new THREE.Mesh(new THREE.ConeGeometry(r, len * 0.14, 6), plastic('#f3d3a0', 0.8));
  wood.rotation.z = -Math.PI / 2;
  wood.position.x = len * 0.46;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(r * 0.36, len * 0.05, 6), plastic('#3a3a46', 0.5));
  lead.rotation.z = -Math.PI / 2;
  lead.position.x = len * 0.5 + len * 0.025;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, len * 0.05, 12), plastic('#c8ccd6', 0.3));
  band.rotation.z = Math.PI / 2;
  band.position.x = -len * 0.41;
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len * 0.07, 12), plastic('#f58bb0', 0.7));
  eraser.rotation.z = Math.PI / 2;
  eraser.position.x = -len * 0.47;
  grp.add(body, wood, lead, band, eraser);
  grp.position.y = r * 0.87;
  shadowAll(grp);
  const out = new THREE.Group();
  out.add(grp);
  return out;
}

/** Crayón tumbado de un color (a lo largo de X). Apoyado en y = 0. */
export function crayon(len: number, color: string, r = 1.7): THREE.Group {
  const grp = new THREE.Group();
  const mat = plastic(color, 0.7);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len * 0.82, 8), mat);
  body.rotation.z = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(r, len * 0.18, 8), mat);
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = len * 0.5;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, len * 0.5, 8), plastic('#f4f1ea', 0.8));
  wrap.rotation.z = Math.PI / 2;
  wrap.position.x = -len * 0.08;
  grp.add(body, tip, wrap);
  grp.position.y = r * 0.9;
  shadowAll(grp);
  const out = new THREE.Group();
  out.add(grp);
  return out;
}

/** Manzana roja con rabito y hoja. Apoyada en y = 0. */
export function apple(r: number, color = '#e3342b'): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), plastic(color, 0.35));
  body.scale.set(1, 0.9, 1);
  body.position.y = r * 0.9;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.06, r * 0.08, r * 0.45, 6), plastic('#6b4423', 0.8));
  stem.position.y = r * 1.85;
  stem.rotation.z = 0.25;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 10, 6), plastic('#3fa53a', 0.6));
  leaf.scale.set(1, 0.22, 0.5);
  leaf.position.set(r * 0.25, r * 1.85, 0);
  leaf.rotation.z = -0.4;
  g.add(body, stem, leaf);
  shadowAll(g);
  return g;
}

/** Mochila (mira hacia +Z): cuerpo, bolsillo, tapa y tirantes. Apoyada en y = 0. */
export function backpack(h: number, color: string, pocket: string): THREE.Group {
  const g = new THREE.Group();
  const w = h * 0.75;
  const d = h * 0.42;
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, h * 0.12), plastic(color, 0.8));
  body.position.y = h / 2;
  const pk = new THREE.Mesh(new RoundedBoxGeometry(w * 0.7, h * 0.38, d * 0.4, 2, h * 0.06), plastic(pocket, 0.8));
  pk.position.set(0, h * 0.3, d / 2 + d * 0.12);
  const flap = new THREE.Mesh(new RoundedBoxGeometry(w * 1.02, h * 0.3, d * 1.06, 2, h * 0.08), plastic(pocket, 0.8));
  flap.position.set(0, h * 0.86, 0.02);
  const strapMat = plastic('#2a2050', 0.8);
  g.add(body, pk, flap);
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(h * 0.32, h * 0.04, 6, 16, Math.PI), strapMat);
    strap.rotation.y = Math.PI / 2;
    strap.position.set(s * w * 0.28, h * 0.5, -d / 2);
    g.add(strap);
  }
  shadowAll(g);
  return g;
}

/** Pila de libros (tapas de colores, hojas claras). Devuelve la altura total. */
export function bookStack(g: THREE.Group, rng: Rng, pagesMap: THREE.Texture, x: number, z: number, n: number, w = 30, d = 21): number {
  let y = 0;
  const pages = new THREE.MeshStandardMaterial({ map: pagesMap, roughness: 0.9 });
  for (let i = 0; i < n; i++) {
    const h = rng.range(3.5, 5.5);
    const cover = plastic(rng.pick(SCHOOL_COLORS), 0.75);
    const b = new THREE.Mesh(new RoundedBoxGeometry(w * rng.range(0.88, 1.08), h, d * rng.range(0.9, 1.1), 2, 0.6), [pages, cover, cover, cover, pages, pages]);
    b.position.set(x + rng.range(-1.5, 1.5), y + h / 2, z + rng.range(-1.5, 1.5));
    b.rotation.y = rng.range(-0.25, 0.25);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
    y += h;
  }
  return y;
}

/** Pupitre con silla (de niño, gigante): mesa con tablero de color y patas metálicas; la silla delante (+Z). */
export function schoolDesk(color: string, size = 1): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3b5, roughness: 0.35, metalness: 0.5 });
  const top = new THREE.Mesh(new RoundedBoxGeometry(34, 1.6, 24, 2, 0.6), plastic('#e9cf9a', 0.6));
  top.position.y = 19;
  const rim = new THREE.Mesh(new RoundedBoxGeometry(34.6, 1, 24.6, 2, 0.4), plastic(color, 0.5));
  rim.position.y = 18;
  g.add(top, rim);
  const legGeo = new THREE.CylinderGeometry(0.8, 0.8, 18, 8);
  for (const [x, z] of [[-15, -10], [15, -10], [-15, 10], [15, 10]]) {
    const leg = new THREE.Mesh(legGeo, metal);
    leg.position.set(x, 9, z);
    g.add(leg);
  }
  // Silla.
  const seat = new THREE.Mesh(new RoundedBoxGeometry(16, 1.4, 15, 2, 0.5), plastic(color, 0.5));
  seat.position.set(0, 11, 20);
  const back = new THREE.Mesh(new RoundedBoxGeometry(16, 10, 1.4, 2, 0.5), plastic(color, 0.5));
  back.position.set(0, 18, 27);
  g.add(seat, back);
  const cl = new THREE.CylinderGeometry(0.6, 0.6, 11, 6);
  for (const [x, z] of [[-7, 14], [7, 14], [-7, 26], [7, 26]]) {
    const leg = new THREE.Mesh(cl, metal);
    leg.position.set(x, 5.5, z);
    g.add(leg);
  }
  g.scale.setScalar(size);
  shadowAll(g);
  return g;
}

/** Nube de algodón (varias esferas blancas). Sin niebla para que se vea a lo lejos. */
export function cloud(rng: Rng, s: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const geo = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(geo, mat);
    const r = s * rng.range(0.5, 0.9);
    m.scale.set(r * 1.3, r, r);
    m.position.set((i - 2.5) * s * 0.55, rng.range(-0.15, 0.25) * s, rng.range(-0.3, 0.3) * s);
    g.add(m);
  }
  return g;
}
