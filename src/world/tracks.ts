// Registro de pistas: cada una trae su trazado, su escenario, su luz y sus colores.
// Las que aún no están hechas aparecen en el menú como "Pronto".
import type * as THREE from 'three';
import { Track, type TrackDef, type Surface } from '../game/track';
import type { Textures } from './textures';
import type { Quality } from '../core/quality';
import type { Rng } from '../core/rng';
import { ROOM_TRACK } from './roomTrack';
import { buildRoom } from './room';
import { BATH_TRACK } from './bathTrack';
import { buildBath } from './bath';

/** Luz, cielo y colores de la pista. */
export interface TrackLook {
  /** Color de fondo y de la niebla. */
  sky: number;
  fog: [near: number, far: number];
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number; dir: [number, number, number] };
  exposure: number;
  /** Franja lateral (alfombra) según la superficie. Las que falten usan la del suelo. */
  shoulder: Partial<Record<Surface, number>> & { floor: number };
  /** Pares de colores de las barreras según la superficie. Las que falten usan los del suelo. */
  barrier: Partial<Record<Surface, [number, number]>> & { floor: [number, number] };
  /** Polvo que levantan los karts fuera del asfalto. Sin él: el color de la franja lateral. */
  dust?: Partial<Record<Surface, number>>;
  /** Faldón bajo los tramos elevados: textura y tinte por superficie (sin tinte: blanco). */
  skirt?: { tex: 'cardboard' | 'towel'; tint?: Partial<Record<Surface, number>> };
}

export const shoulderColor = (look: TrackLook, s: Surface): number => look.shoulder[s] ?? look.shoulder.floor;
export const dustColor = (look: TrackLook, s: Surface): number => look.dust?.[s] ?? shoulderColor(look, s);

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
      dust: { floor: 0x9fcf8a, ramp: 0xd8b484, bed: 0xf3ea9c },
      barrier: { floor: ROOM_BARRIER_FLOOR, ramp: ROOM_BARRIER_UP, bed: ROOM_BARRIER_UP },
    },
    scenery: buildRoom,
  },
  {
    id: 'bano',
    name: 'Bañera Burbujeante',
    blurb: 'Por el borde de la bañera',
    ready: true,
    def: BATH_TRACK,
    seed: 'bano',
    podium: { x: 40, z: 40, yaw: Math.PI },
    look: {
      sky: 0xb4e2ee,
      fog: [280, 800],
      hemi: { sky: 0xf2fbff, ground: 0x8fb3c4, intensity: 1.3 },
      sun: { color: 0xfffaf0, intensity: 2.2, dir: [-0.25, 1, 0.55] },
      exposure: 1.05,
      shoulder: { floor: 0x7fc4d8, mat: 0xf28cbc, towel: 0xff9f5a, rim: 0xeef3f6, sponge: 0xffd84a },
      barrier: {
        floor: [0x2f9bd6, 0xf6f3ee],
        mat: [0xf07ab0, 0xf6f3ee],
        towel: [0xff8a3a, 0xffd23a],
        rim: [0xff7ab8, 0xffffff],
        sponge: [0x3fb24a, 0xffd23a],
      },
      skirt: { tex: 'towel', tint: { towel: 0xff9f5a, rim: 0xffffff, sponge: 0xffd84a } },
    },
    scenery: buildBath,
  },
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
