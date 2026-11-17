// Registro de pistas: cada una trae su trazado, su escenario, su luz y sus colores.
// Las que aún no están hechas aparecen en el menú como "Pronto".
import type * as THREE from 'three';
import { Track, type TrackDef, type Surface } from '../game/track';
import type { Textures } from './textures';
import type { Quality } from '../core/quality';
import type { Rng } from '../core/rng';
import { ROOM_TRACK } from './roomTrack';
import { buildRoom } from './room';

/** Luz, cielo y colores de la pista. */
export interface TrackLook {
  /** Color de fondo y de la niebla. */
  sky: number;
  fog: [near: number, far: number];
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number; dir: [number, number, number] };
  exposure: number;
  /** Franja lateral (alfombra) según la superficie. */
  shoulder: Record<Surface, number>;
  /** Pares de colores de las barreras según la superficie. */
  barrier: Record<Surface, [number, number]>;
}

interface TrackBase {
  id: string;
  name: string;
  /** Una línea para el menú. */
  blurb: string;
}

export interface ReadyTrack extends TrackBase {
  ready: true;
  def: TrackDef;
  look: TrackLook;
  /** Podio (sin escalar) y hacia dónde mira. */
  podium: { x: number; z: number; yaw: number };
  /** Nombre del generador aleatorio del escenario (cambiarlo cambia el decorado). */
  seed: string;
  scenery(track: Track, tex: Textures, q: Quality, rng: Rng): THREE.Group;
}

export interface SoonTrack extends TrackBase {
  ready: false;
}

export type TrackEntry = ReadyTrack | SoonTrack;

const ROOM_BARRIER_FLOOR: [number, number] = [0xe0392c, 0xf6f3ee];
const ROOM_BARRIER_UP: [number, number] = [0x2f6fd6, 0xffd23a];

export const TRACKS: TrackEntry[] = [
  {
    id: 'cuarto',
    name: 'El Cuarto de Juegos',
    blurb: 'Rampa a la cama y vuelta por el suelo',
    ready: true,
    def: ROOM_TRACK,
    seed: 'cuarto',
    podium: { x: -5, z: 30, yaw: Math.PI },
    look: {
      sky: 0x8590cc,
      fog: [260, 760],
      hemi: { sky: 0xe4ecff, ground: 0x9a6438, intensity: 1.25 },
      sun: { color: 0xfff0d6, intensity: 2.3, dir: [0.25, 1, 0.6] },
      exposure: 1.05,
      shoulder: { floor: 0x63a85a, ramp: 0xc99f68, bed: 0xf3ea9c },
      barrier: { floor: ROOM_BARRIER_FLOOR, ramp: ROOM_BARRIER_UP, bed: ROOM_BARRIER_UP },
    },
    scenery: buildRoom,
  },
  { id: 'bano', name: 'Bañera Burbujeante', blurb: 'Por el borde de la bañera', ready: false },
  { id: 'jardin', name: 'Jardín de Noche', blurb: 'Luciérnagas y farolitos', ready: false },
];

export const DEFAULT_TRACK = 'cuarto';

/** La pista lista con ese id, o la de por defecto. */
export function readyTrack(id: string | null | undefined): ReadyTrack {
  const t = TRACKS.find((x) => x.id === id);
  return t?.ready ? t : (TRACKS.find((x) => x.id === DEFAULT_TRACK) as ReadyTrack);
}

export const isReadyTrack = (id: string | null | undefined): boolean => !!TRACKS.find((x) => x.id === id)?.ready;

const outlines = new Map<string, { x: number; z: number }[]>();

/** Línea central (≈ 1 punto cada 4 m) para dibujar el minimapa en el menú. */
export function trackOutline(t: ReadyTrack): { x: number; z: number }[] {
  let o = outlines.get(t.id);
  if (!o) {
    const tr = new Track(t.def);
    o = tr.samples.filter((_, i) => i % 4 === 0).map((s) => ({ x: s.x, z: s.z }));
    outlines.set(t.id, o);
  }
  return o;
}
