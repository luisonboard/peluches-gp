// Texturas procedurales en <canvas>: sin descargas.
import * as THREE from 'three';
import type { Rng } from '../core/rng';

export interface Textures {
  wood: THREE.Texture;
  road: THREE.Texture;
  curb: THREE.Texture;
  felt: THREE.Texture;
  blanket: THREE.Texture;
  wall: THREE.Texture;
  cardboard: THREE.Texture;
  checker: THREE.Texture;
  pad: THREE.Texture;
  ball: THREE.Texture;
  blob: THREE.Texture;
  banner: THREE.Texture;
  pages: THREE.Texture;
  letter(ch: string, bg: string): THREE.Texture;
}

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toTex(c: HTMLCanvasElement, aniso: number, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

function speckle(g: Ctx, rng: Rng, w: number, h: number, n: number, light: string, dark: string, size = 2): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rng.chance(0.5) ? light : dark;
    g.fillRect(rng.next() * w, rng.next() * h, size * rng.range(0.5, 1.5), size * rng.range(0.5, 1.5));
  }
}

export function makeTextures(rng: Rng, aniso: number): Textures {
  // Suelo de madera: tablas a lo largo de X, vetas, nudos y juntas.
  const wood = (() => {
    const [c, g] = canvas(1024, 1024);
    const rh = 128;
    for (let r = 0; r < 8; r++) {
      let x = -rng.range(0, 300);
      while (x < 1024) {
        const len = rng.range(320, 700);
        const l = rng.range(40, 52);
        const hue = rng.range(24, 31);
        g.save();
        g.beginPath();
        g.rect(x, r * rh, len, rh);
        g.clip();
        g.fillStyle = `hsl(${hue} ${rng.range(42, 55)}% ${l}%)`;
        g.fillRect(x, r * rh, len, rh);
        for (let k = 0; k < 34; k++) {
          g.strokeStyle = `rgba(70,35,12,${rng.range(0.04, 0.13)})`;
          g.lineWidth = rng.range(1, 3);
          g.beginPath();
          const y0 = r * rh + rng.next() * rh;
          const ph = rng.next() * 6;
          const amp = rng.range(1, 4);
          for (let xx = x; xx <= x + len; xx += 24) g.lineTo(xx, y0 + Math.sin(xx * 0.008 + ph) * amp);
          g.stroke();
        }
        if (rng.chance(0.35)) {
          const kx = x + rng.range(60, len - 60);
          const ky = r * rh + rng.range(30, rh - 30);
          for (let k = 0; k < 5; k++) {
            g.strokeStyle = `rgba(80,40,15,${0.25 - k * 0.04})`;
            g.lineWidth = 2;
            g.beginPath();
            g.ellipse(kx, ky, 6 + k * 7, 3 + k * 3, 0, 0, Math.PI * 2);
            g.stroke();
          }
        }
        g.restore();
        g.fillStyle = 'rgba(45,22,8,0.75)';
        g.fillRect(x + len - 2, r * rh, 3, rh);
        x += len;
      }
      g.fillStyle = 'rgba(40,20,6,0.8)';
      g.fillRect(0, r * rh, 1024, 3);
    }
    return toTex(c, aniso);
  })();

  // Asfalto de juguete: gris azulado, líneas de borde blancas y raya central discontinua.
  const road = (() => {
    const [c, g] = canvas(512, 512);
    g.fillStyle = '#676c7c';
    g.fillRect(0, 0, 512, 512);
    speckle(g, rng, 512, 512, 7000, 'rgba(255,255,255,0.07)', 'rgba(0,0,0,0.09)', 2);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillRect(10, 0, 10, 512);
    g.fillRect(492, 0, 10, 512);
    g.fillStyle = '#f4c84a';
    g.fillRect(249, 40, 14, 200);
    g.fillRect(249, 296, 14, 200);
    return toTex(c, aniso);
  })();

  const curb = (() => {
    const [c, g] = canvas(64, 128);
    g.fillStyle = '#e0392c';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#f6f3ee';
    g.fillRect(0, 64, 64, 64);
    const grd = g.createLinearGradient(0, 0, 64, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.18)');
    grd.addColorStop(0.3, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 128);
    return toTex(c, aniso);
  })();

  // Fieltro claro: se tiñe con el color de vértice (alfombra verde en el suelo, manta en la cama).
  const felt = (() => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#ececec';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      const x = rng.next() * 256;
      const y = rng.next() * 256;
      const a = rng.next() * Math.PI * 2;
      const l = rng.range(2, 6);
      g.strokeStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.1)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return toTex(c, aniso);
  })();

  // Manta amarilla con hojas verdes y flores rosas (como la de la foto).
  const blanket = (() => {
    const [c, g] = canvas(1024, 1024);
    g.fillStyle = '#ece25a';
    g.fillRect(0, 0, 1024, 1024);
    speckle(g, rng, 1024, 1024, 6000, 'rgba(255,255,255,0.08)', 'rgba(120,100,0,0.06)', 3);
    const leaf = (x: number, y: number, s: number, a: number, col: string): void => {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(0, 0, s, s * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(30,70,20,0.5)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-s, 0);
      g.lineTo(s, 0);
      g.stroke();
      g.restore();
    };
    for (let i = 0; i < 70; i++) {
      const x = rng.next() * 1024;
      const y = rng.next() * 1024;
      for (const ox of [-1024, 0, 1024]) for (const oy of [-1024, 0, 1024]) {
        if (Math.abs(x + ox - 512) > 600 || Math.abs(y + oy - 512) > 600) continue;
        leaf(x + ox, y + oy, rng.range(28, 60), rng.next() * Math.PI, rng.chance(0.5) ? '#5daa45' : '#86c763');
      }
    }
    for (let i = 0; i < 26; i++) {
      const x = rng.range(40, 984);
      const y = rng.range(40, 984);
      const r = rng.range(10, 18);
      g.fillStyle = '#f28bb3';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ffd84a';
      g.beginPath();
      g.arc(x, y, r * 0.6, 0, Math.PI * 2);
      g.fill();
    }
    return toTex(c, aniso);
  })();

  const wall = (() => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#7480c4';
    g.fillRect(0, 0, 256, 256);
    speckle(g, rng, 256, 256, 2500, 'rgba(255,255,255,0.035)', 'rgba(0,0,40,0.04)', 3);
    return toTex(c, aniso);
  })();

  const cardboard = (() => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#c99f68';
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 8) {
      g.fillStyle = 'rgba(90,60,20,0.10)';
      g.fillRect(x, 0, 3, 256);
    }
    speckle(g, rng, 256, 256, 1500, 'rgba(255,240,200,0.08)', 'rgba(60,30,0,0.08)', 2);
    g.fillStyle = 'rgba(210,190,140,0.55)';
    g.fillRect(0, 108, 256, 40); // cinta adhesiva
    return toTex(c, aniso);
  })();

  const checker = (() => {
    const [c, g] = canvas(256, 32);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#1d1d24' : '#f7f7f2';
      g.fillRect(i * 16, j * 16, 16, 16);
    }
    const t = toTex(c, aniso);
    t.magFilter = THREE.NearestFilter;
    return t;
  })();

  // Placa de turbo: cheurones que se desplazan (se anima el offset).
  const pad = (() => {
    const [c, g] = canvas(128, 256);
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#ff7a1a');
    grd.addColorStop(1, '#ffb52a');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#fff6c8';
    for (let k = 0; k < 2; k++) {
      const y = k * 128 + 30;
      g.beginPath();
      g.moveTo(14, y + 70);
      g.lineTo(64, y + 20);
      g.lineTo(114, y + 70);
      g.lineTo(114, y + 96);
      g.lineTo(64, y + 46);
      g.lineTo(14, y + 96);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = '#8a3a00';
    g.lineWidth = 8;
    g.strokeRect(4, -10, 120, 276);
    return toTex(c, aniso);
  })();

  const ball = (() => {
    const [c, g] = canvas(512, 256);
    const cols = ['#e8423a', '#ffffff', '#2f7de0', '#ffd23a', '#3fb24a', '#ffffff'];
    for (let i = 0; i < 6; i++) {
      g.fillStyle = cols[i];
      g.fillRect((i * 512) / 6, 0, 512 / 6 + 1, 256);
    }
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 18);
    g.fillRect(0, 238, 512, 18);
    return toTex(c, aniso);
  })();

  const blob = (() => {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return toTex(c, 1, false);
  })();

  const banner = (() => {
    const [c, g] = canvas(1024, 128);
    g.fillStyle = '#ffd23a';
    g.fillRect(0, 0, 1024, 128);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      g.fillStyle = (i + j) % 2 ? '#1d1d24' : '#f7f7f2';
      g.fillRect(i * 16, j * 16, 16, 16);
      g.fillRect(896 + i * 16, j * 16, 16, 16);
    }
    const word = 'PELUCHES GP';
    const cols = ['#e8423a', '#2f7de0', '#3fb24a', '#8a4fd8', '#f0862a', '#e2453a', '#2f7de0', '#3fb24a', '#ffffff', '#8a4fd8', '#e8423a'];
    g.font = '900 86px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    g.textBaseline = 'middle';
    let total = 0;
    for (const ch of word) total += g.measureText(ch).width + 4;
    let x = 512 - total / 2;
    [...word].forEach((ch, i) => {
      g.lineWidth = 10;
      g.strokeStyle = '#2a2050';
      g.strokeText(ch, x, 68);
      g.fillStyle = cols[i % cols.length];
      if (ch !== ' ') g.fillText(ch, x, 68);
      x += g.measureText(ch).width + 4;
    });
    return toTex(c, aniso, false);
  })();

  const pages = (() => {
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#f4efe2';
    g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 3) {
      g.fillStyle = 'rgba(120,100,70,0.18)';
      g.fillRect(0, y, 64, 1);
    }
    return toTex(c, 1);
  })();

  const letterCache = new Map<string, THREE.Texture>();
  const letter = (ch: string, bg: string): THREE.Texture => {
    const key = ch + bg;
    const hit = letterCache.get(key);
    if (hit) return hit;
    const [c, g] = canvas(256, 256);
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 14;
    g.strokeRect(22, 22, 212, 212);
    g.font = '900 170px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = 'rgba(30,20,60,0.85)';
    g.strokeText(ch, 128, 140);
    g.fillStyle = '#ffffff';
    g.fillText(ch, 128, 140);
    const t = toTex(c, aniso, false);
    t.userData.shared = true;
    letterCache.set(key, t);
    return t;
  };

  const all = { wood, road, curb, felt, blanket, wall, cardboard, checker, pad, ball, blob, banner, pages };
  // Compartidas por todas las pistas: no se liberan al cambiar de pista (ver render/dispose.ts).
  for (const t of Object.values(all)) t.userData.shared = true;
  return { ...all, letter };
}
