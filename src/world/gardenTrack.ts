// "Jardín de Noche": césped, túnel bajo una maceta tumbada, sendero de piedras, salto sobre el arroyo con
// aceleradores a todo el ancho, puente de tabla sobre un charco y salto sobre una manguera.
// Coordenadas sin escalar (se multiplican por `scale`).
import type { TrackDef } from '../game/track';

export const GARDEN_TRACK: TrackDef = {
  id: 'jardin',
  name: 'Jardín de Noche',
  scale: 1.4,
  shoulder: 3.2,
  points: [
    { x: -100, z: 0, y: 0, hw: 8.5 }, // 0 salida
    { x: -30, z: 0, y: 0, hw: 8.5 }, // túnel de la maceta a mitad de este tramo
    { x: 40, z: 0, y: 0, hw: 8.5 },
    { x: 90, z: 12, y: 0, hw: 8 },
    { x: 112, z: 50, y: 0, hw: 8 },
    { x: 100, z: 90, y: 0, hw: 8, surf: 'stone' }, // sendero de piedras
    { x: 70, z: 115, y: 0, hw: 8, surf: 'stone' },
    { x: 30, z: 122, y: 0, hw: 8.5 }, // 7 recta del arroyo: aceleradores, rampa y salto
    { x: -30, z: 122, y: 0, hw: 8.5 },
    { x: -90, z: 122, y: 0, hw: 8 },
    { x: -130, z: 110, y: 0, hw: 8, surf: 'plank' }, // 10 puente de tabla sobre el charco
    { x: -160, z: 85, y: 1.5, hw: 7.5, surf: 'plank' },
    { x: -175, z: 55, y: 0, hw: 8 }, // 12 salto sobre la manguera
    { x: -170, z: 20, y: 0, hw: 8 },
    { x: -145, z: 2, y: 0, hw: 8.5 },
  ],
  pads: [{ seg: 3, f: 0.4, lat: 0 }],
  itemRows: [
    { seg: 2, f: 0.4 },
    { seg: 5, f: 0.5 },
    { seg: 9, f: 0.3 },
    { seg: 13, f: 0.3 },
  ],
  jumps: [
    // El arroyo: dos filas de aceleradores de barrera a barrera, rampa de madera y 12 m de agua (se cruza desde ≈ 20 m/s).
    { seg: 7, f: 0.62, ramp: 14, rise: 3, gap: 12, floor: -4, boost: true },
    // La manguera: un bache pequeño sin hueco.
    { seg: 12, f: 0.55, ramp: 6, rise: 1, gap: 0, floor: 0, boost: false },
  ],
};

/** Dónde está la maceta-túnel (punto de control + fracción). */
export const POT_AT = { seg: 1, f: 0.5 };
