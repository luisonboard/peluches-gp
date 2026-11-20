// Pistas de la Copa Escuelita. Coordenadas sin escalar (se multiplican por `scale`).
// - "El Aula": suelo de baldosas entre pupitres, subida por una pila de libros a la mesa de la maestra, vuelta
//   por encima de la mesa y bajada por una regla gigante. Charcos de pegamento.
// - "Patio de Recreo": de día, túnel de gusano, arenero, salto sobre la piscina de pelotas, puente del castillo
//   y bache del sube y baja. Pelotas que cruzan la pista.
// - "El Comedor": baldosas, subida por una bandeja a la mesa larga, salto entre dos mesas, bajada por una
//   servilleta. Jugo derramado y naranjas que ruedan.
import type { TrackDef } from '../game/track';

/** Altura de la mesa de la maestra (Aula) y de las mesas del comedor. */
export const DESK_HEIGHT = 8;
export const TABLE_HEIGHT = 10;

/** Mesa de la maestra, sin escalar: la pista hace una vuelta por encima. */
export const DESK_RECT = { x0: 91, x1: 158, z0: 58, z1: 146 };

export const CLASSROOM_TRACK: TrackDef = {
  id: 'aula',
  name: 'El Aula',
  scale: 1.4,
  shoulder: 3.2,
  points: [
    { x: 50, z: 0, y: 0, hw: 8.5 }, // 0 salida
    { x: -20, z: 0, y: 0, hw: 8.5 },
    { x: -72, z: 2, y: 0, hw: 8.5 },
    { x: -108, z: 22, y: 0, hw: 8 }, // curva amplia a la izquierda
    { x: -120, z: 58, y: 0, hw: 8 },
    { x: -102, z: 94, y: 0, hw: 8 },
    { x: -62, z: 104, y: 0, hw: 7.5 }, // eses entre los pupitres
    { x: -30, z: 86, y: 0, hw: 7.5 },
    { x: 4, z: 98, y: 0, hw: 7.5 },
    { x: 28, z: 118, y: 0, hw: 8 },
    { x: 50, z: 121, y: 0, hw: 8, surf: 'books' }, // 10 pie de la pila de libros
    { x: 88, z: 121, y: DESK_HEIGHT, hw: 7.5, surf: 'desk' }, // 11 borde de la mesa
    { x: 115, z: 124, y: DESK_HEIGHT, hw: 7.5, surf: 'desk' },
    { x: 138, z: 102, y: DESK_HEIGHT, hw: 7.5, surf: 'desk' },
    { x: 136, z: 76, y: DESK_HEIGHT, hw: 7.5, surf: 'desk' },
    { x: 120, z: 54, y: DESK_HEIGHT, hw: 7.5, surf: 'ruler' }, // 15 borde de la mesa: bajada por la regla
    { x: 114, z: 22, y: 0, hw: 8 },
    { x: 100, z: 6, y: 0, hw: 8.5 },
  ],
  pads: [
    { seg: 4, f: 0.1, lat: 0 },
    { seg: 9, f: 0.7, lat: 2.5 },
    { seg: 13, f: 0.45, lat: -2 },
    { seg: 16, f: 0.55, lat: 0 },
  ],
  itemRows: [
    { seg: 2, f: 0.3 },
    { seg: 7, f: 0.5 },
    { seg: 12, f: 0.5 },
    { seg: 16, f: 0.2 },
  ],
  // Charcos de pegamento.
  slicks: [
    { seg: 3, f: 0.6, lat: 2.5 },
    { seg: 8, f: 0.4, lat: -2.5 },
  ],
};

/** Dónde está el túnel de gusano del Recreo (punto de control + fracción). */
export const WORM_AT = { seg: 1, f: 0.5 };
/** Dónde está el sube y baja (el bache). */
export const SEESAW_AT = { seg: 12, f: 0.55 };

export const PLAYGROUND_TRACK: TrackDef = {
  id: 'recreo',
  name: 'Patio de Recreo',
  scale: 1.4,
  shoulder: 3.2,
  points: [
    { x: -100, z: 0, y: 0, hw: 8.5 }, // 0 salida
    { x: -30, z: 0, y: 0, hw: 8.5 }, // túnel de gusano a mitad de este tramo
    { x: 40, z: 0, y: 0, hw: 8.5 },
    { x: 90, z: -12, y: 0, hw: 8 },
    { x: 112, z: -50, y: 0, hw: 8 },
    { x: 100, z: -90, y: 0, hw: 8.5, surf: 'sand' }, // arenero
    { x: 70, z: -115, y: 0, hw: 8.5, surf: 'sand' },
    { x: 30, z: -122, y: 0, hw: 8.5 }, // 7 recta del tobogán: aceleradores, rampa y salto sobre la piscina de pelotas
    { x: -30, z: -122, y: 0, hw: 8.5 },
    { x: -90, z: -122, y: 0, hw: 8 },
    { x: -130, z: -110, y: 0, hw: 8, surf: 'plank' }, // 10 puente del castillo
    { x: -160, z: -85, y: 1.5, hw: 7.5, surf: 'plank' },
    { x: -175, z: -55, y: 0, hw: 8 }, // 12 bache del sube y baja
    { x: -170, z: -20, y: 0, hw: 8 },
    { x: -145, z: -2, y: 0, hw: 8.5 },
  ],
  pads: [{ seg: 3, f: 0.4, lat: 0 }],
  itemRows: [
    { seg: 2, f: 0.4 },
    { seg: 5, f: 0.5 },
    { seg: 9, f: 0.3 },
    { seg: 13, f: 0.3 },
  ],
  jumps: [
    // Salto largo: rampa de 20 m que sube 5 m y 22 m de piscina de pelotas (≈ 1 s en el aire; se cruza desde ≈ 26 m/s).
    { seg: 7, f: 0.62, ramp: 20, rise: 5, gap: 22, floor: -4, boost: true },
    { seg: SEESAW_AT.seg, f: SEESAW_AT.f, ramp: 6, rise: 1, gap: 0, floor: 0, boost: false },
  ],
  // Pelotas de colores que cruzan la pista dando botes.
  movers: [
    { seg: 4, f: 0.45, amp: 0.7, period: 7, phase: 0, r: 1.8 },
    { seg: 9, f: 0.75, amp: 0.7, period: 6.5, phase: 0.5, r: 1.8 },
  ],
  moverLook: 'ball',
};

export const CAFETERIA_TRACK: TrackDef = {
  id: 'comedor',
  name: 'El Comedor',
  scale: 1.4,
  shoulder: 3.2,
  points: [
    { x: -100, z: 0, y: 0, hw: 8.5 }, // 0 salida
    { x: -30, z: 0, y: 0, hw: 8.5 },
    { x: 40, z: 0, y: 0, hw: 8.5 },
    { x: 85, z: -15, y: 0, hw: 8 },
    { x: 100, z: -50, y: 0, hw: 8 },
    { x: 80, z: -80, y: 0, hw: 8 },
    { x: 45, z: -72, y: 0, hw: 7.5 }, // eses entre las sillas
    { x: 20, z: -90, y: 0, hw: 7.5 },
    { x: 5, z: -108, y: 0, hw: 8 },
    { x: -25, z: -112, y: 0, hw: 8, surf: 'tray' }, // 9 pie de la bandeja
    { x: -60, z: -112, y: TABLE_HEIGHT, hw: 7.5, surf: 'table' }, // 10 mesa larga
    { x: -100, z: -112, y: TABLE_HEIGHT, hw: 7.5, surf: 'table' }, // salto a la segunda mesa
    { x: -140, z: -112, y: TABLE_HEIGHT, hw: 7.5, surf: 'table' },
    // 13–14 bajada por una servilleta, larga y suave, hasta un rellano...
    { x: -158, z: -112, y: TABLE_HEIGHT, hw: 7.5, surf: 'napkin' },
    { x: -202, z: -111, y: 2.5, hw: 7.5, surf: 'napkin' },
    // ...y caída corta al suelo.
    { x: -212, z: -110.5, y: 0, hw: 8 },
    { x: -226, z: -95, y: 0, hw: 8 },
    { x: -220, z: -55, y: 0, hw: 8 },
    { x: -192, z: -22, y: 0, hw: 8 },
    { x: -160, z: -4, y: 0, hw: 8.5 },
  ],
  pads: [
    { seg: 2, f: 0.3, lat: 0 },
    { seg: 17, f: 0.5, lat: -2 },
  ],
  itemRows: [
    { seg: 1, f: 0.6 },
    { seg: 7, f: 0.3 },
    { seg: 10, f: 0.25 },
    { seg: 18, f: 0.2 },
  ],
  jumps: [
    // Entre las dos mesas: aceleradores, rampa corta y 10 m sin mesa (quien cae, al suelo y reaparece en la otra).
    { seg: 11, f: 0.45, ramp: 14, rise: 3, gap: 10, floor: 0, boost: true },
  ],
  // Jugo derramado.
  slicks: [
    { seg: 3, f: 0.4, lat: 3 },
    { seg: 8, f: 0.3, lat: -2.5 },
    { seg: 17, f: 0.1, lat: 2.5 },
  ],
  movers: [
    { seg: 6, f: 0.5, amp: 0.7, period: 7, phase: 0, r: 1.8 },
    { seg: 16, f: 0.5, amp: 0.7, period: 8, phase: 0.4, r: 1.8 },
    { seg: 18, f: 0.6, amp: 0.6, period: 6, phase: 0.7, r: 1.8 },
  ],
  moverLook: 'orange',
};
