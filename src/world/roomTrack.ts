// "El Cuarto de Juegos": vuelta por el suelo de madera, rampa de cartón que sube a la cama y bajada.
// Coordenadas sin escalar (se multiplican por `scale`); la altura de la cama es 8 m.
import type { TrackDef } from '../game/track';

export const BED_HEIGHT = 8;

/** Rectángulo del colchón, sin escalar. */
export const BED_RECT = { x0: -158, x1: -91, z0: 58, z1: 146 };

export const ROOM_TRACK: TrackDef = {
  name: 'El Cuarto de Juegos',
  scale: 1.4,
  shoulder: 3.2,
  points: [
    { x: -50, z: 0, y: 0, hw: 8.5 }, // 0 salida
    { x: 20, z: 0, y: 0, hw: 8.5 },
    { x: 70, z: 0, y: 0, hw: 8.5 },
    { x: 105, z: 18, y: 0, hw: 8 }, // curva amplia a la derecha
    { x: 118, z: 55, y: 0, hw: 8 },
    { x: 100, z: 92, y: 0, hw: 8 },
    { x: 60, z: 102, y: 0, hw: 7.5 }, // eses
    { x: 28, z: 84, y: 0, hw: 7.5 },
    { x: -5, z: 98, y: 0, hw: 7.5 },
    { x: -28, z: 118, y: 0, hw: 8 },
    { x: -50, z: 121, y: 0, hw: 8 }, // 10 pie de la rampa
    { x: -88, z: 121, y: 8, hw: 7.5 }, // 11 borde de la cama
    { x: -115, z: 124, y: 8, hw: 7.5 },
    { x: -138, z: 102, y: 8, hw: 7.5 },
    { x: -136, z: 76, y: 8, hw: 7.5 },
    { x: -120, z: 54, y: 8, hw: 7.5 }, // 15 borde de la cama (bajada)
    { x: -114, z: 22, y: 0, hw: 8 },
    { x: -100, z: 6, y: 0, hw: 8.5 },
  ],
  pads: [
    { seg: 4, f: 0.1, lat: 0 },
    { seg: 9, f: 0.7, lat: -2.5 },
    { seg: 13, f: 0.45, lat: 2 },
    { seg: 16, f: 0.55, lat: 0 },
  ],
  itemRows: [
    { seg: 2, f: 0.3 },
    { seg: 7, f: 0.5 },
    { seg: 12, f: 0.5 },
    { seg: 16, f: 0.2 },
  ],
};
