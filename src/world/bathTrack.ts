// "Bañera Burbujeante": suelo de baldosas, alfombra de baño, subida por una toalla doblada al borde de la bañera,
// tramo estrecho por el borde y bajada por un tobogán de esponja con salto. Patitos de goma y charcos de jabón.
// Coordenadas sin escalar (se multiplican por `scale`); el borde de la bañera está a 10 m.
import type { TrackDef } from '../game/track';

export const RIM_HEIGHT = 10;

/** Bañera (metros, ya escalados): el tramo del borde pasa por encima de su pared sur. */
export const TUB = { x0: -205, x1: -80, z0: 145, z1: 236, wall: 8, south: 23 };

export const BATH_TRACK: TrackDef = {
  id: 'bano',
  name: 'Bañera Burbujeante',
  scale: 1.4,
  shoulder: 3.2,
  points: [
    { x: -100, z: 0, y: 0, hw: 8.5 }, // 0 salida
    { x: -30, z: 0, y: 0, hw: 8.5 },
    { x: 40, z: 0, y: 0, hw: 8.5 },
    { x: 85, z: 15, y: 0, hw: 8 },
    { x: 100, z: 50, y: 0, hw: 8, surf: 'mat' }, // alfombra de baño
    { x: 80, z: 80, y: 0, hw: 8, surf: 'mat' },
    { x: 45, z: 72, y: 0, hw: 7.5 }, // eses
    { x: 20, z: 90, y: 0, hw: 7.5 },
    { x: 5, z: 108, y: 0, hw: 8 },
    { x: -25, z: 112, y: 0, hw: 8, surf: 'towel' }, // 9 pie de la toalla
    { x: -60, z: 112, y: 10, hw: 6.5, surf: 'rim' }, // 10 borde de la bañera (estrecho)
    { x: -100, z: 112, y: 10, hw: 6.5, surf: 'rim' },
    { x: -140, z: 112, y: 10, hw: 6.5, surf: 'rim' },
    // 13–14 tobogán de esponja: bajada larga y suave (el kart no despega) hasta un rellano a 2,5 m...
    { x: -158, z: 112, y: 10, hw: 7, surf: 'sponge' },
    { x: -202, z: 111, y: 2.5, hw: 7.5, surf: 'sponge' },
    // ...y caída corta al suelo: ahí está el salto (≈ 0,5 s en el aire, en recta para aterrizar en la pista).
    { x: -212, z: 110.5, y: 0, hw: 8 },
    { x: -226, z: 95, y: 0, hw: 8 },
    { x: -220, z: 55, y: 0, hw: 8 },
    { x: -192, z: 22, y: 0, hw: 8 },
    { x: -160, z: 4, y: 0, hw: 8.5 },
  ],
  pads: [
    { seg: 2, f: 0.3, lat: 0 },
    { seg: 11, f: 0.5, lat: 0 },
    { seg: 17, f: 0.5, lat: 2 },
  ],
  itemRows: [
    { seg: 1, f: 0.6 },
    { seg: 7, f: 0.3 },
    { seg: 10, f: 0.6 },
    { seg: 18, f: 0.2 },
  ],
  slicks: [
    { seg: 3, f: 0.4, lat: -3 },
    { seg: 8, f: 0.3, lat: 2.5 },
    { seg: 17, f: 0.1, lat: -2.5 },
  ],
  movers: [
    { seg: 6, f: 0.5, amp: 0.7, period: 7, phase: 0, r: 1.8 },
    { seg: 16, f: 0.5, amp: 0.7, period: 8, phase: 0.4, r: 1.8 },
    { seg: 18, f: 0.6, amp: 0.6, period: 6, phase: 0.7, r: 1.8 },
  ],
};
