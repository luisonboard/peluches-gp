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
import { GARDEN_TRACK } from './gardenTrack';
import { buildGarden, MOON_DIR } from './garden';
import { CLASSROOM_TRACK, PLAYGROUND_TRACK, CAFETERIA_TRACK } from './schoolTracks';
import { buildClassroom } from './classroom';
import { buildPlayground, SUN_DIR } from './playground';
import { buildCafeteria } from './cafeteria';

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
  /** Pista de noche: los karts llevan los faros encendidos. */
  night?: boolean;
  /** Polvo que levantan los karts fuera del asfalto. Sin él: el color de la franja lateral. */
  dust?: Partial<Record<Surface, number>>;
  /** Faldón bajo los tramos elevados: textura y tinte por superficie (sin tinte: blanco). */
  skirt?: { tex: 'cardboard' | 'towel'; tint?: Partial<Record<Surface, number>> };
  /** Charcos (`slicks`): colores del dibujo (sin ellos, jabón), palabra que aparece y color de las gotas. */
  slick?: { fill: [string, string]; ring: string; word: string; particle: number };
  /** Caída en un hueco de salto: palabra y color de la salpicadura (sin ellos, el arroyo). */
  fall?: { word: string; color: number };
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
  {
    id: 'jardin',
    name: 'Jardín de Noche',
    blurb: 'Salto sobre el arroyo',
    ready: true,
    def: GARDEN_TRACK,
    seed: 'jardin',
    podium: { x: 60, z: 55, yaw: Math.PI },
    look: {
      night: true,
      sky: 0x161e40,
      fog: [200, 700],
      hemi: { sky: 0x8a9ae0, ground: 0x24382a, intensity: 1.1 },
      sun: { color: 0xc8d6ff, intensity: 1.7, dir: MOON_DIR },
      exposure: 1.2,
      shoulder: { floor: 0x3f7a3a, stone: 0x8a8f99, plank: 0x9a6a3c, ramp: 0xa8743f },
      dust: { floor: 0x5a8a4a, stone: 0xb8bcc4, plank: 0xb88a5a, ramp: 0xb88a5a },
      barrier: {
        floor: [0xffd23a, 0xf6f3ee],
        stone: [0x8a4fd8, 0xf6f3ee],
        plank: [0xff9a2a, 0xf6f3ee],
        ramp: [0xff9a2a, 0xffd23a],
      },
      skirt: { tex: 'cardboard', tint: { plank: 0x9a6a3c, ramp: 0xb07a45 } },
    },
    scenery: buildGarden,
  },
  // --- Copa Escuelita ---
  {
    id: 'aula',
    name: 'El Aula',
    blurb: 'Sube por los libros a la mesa de la maestra',
    ready: true,
    def: CLASSROOM_TRACK,
    seed: 'aula',
    podium: { x: 5, z: 30, yaw: Math.PI },
    look: {
      sky: 0xd8c890,
      fog: [260, 760],
      hemi: { sky: 0xfff4dc, ground: 0x9a8a5a, intensity: 1.3 },
      sun: { color: 0xfff0d6, intensity: 2.2, dir: [-0.3, 1, 0.5] },
      exposure: 1.05,
      shoulder: { floor: 0x3f8fd8, books: 0xe8423a, desk: 0xf3d08a, ruler: 0xffd23a },
      dust: { floor: 0xbfe0f0, books: 0xf3b0a0, desk: 0xf3e0b0, ruler: 0xffe89a },
      barrier: {
        floor: [0x3fb24a, 0xf6f3ee],
        books: [0xe8423a, 0xffd23a],
        desk: [0x8a4fd8, 0xf6f3ee],
        ruler: [0xff8a1a, 0xffd23a],
      },
      skirt: { tex: 'cardboard', tint: { books: 0xe86a5a, desk: 0xd9a868, ruler: 0xffd23a } },
      slick: { fill: ['rgba(255,255,255,0.97)', 'rgba(240,240,232,0.9)'], ring: 'rgba(200,200,190,0.9)', word: '¡Pegamento!', particle: 0xffffff },
    },
    scenery: buildClassroom,
  },
  {
    id: 'recreo',
    name: 'Patio de Recreo',
    blurb: 'Salta sobre la piscina de pelotas',
    ready: true,
    def: PLAYGROUND_TRACK,
    seed: 'recreo',
    podium: { x: 60, z: -55, yaw: 0 },
    look: {
      sky: 0x9fd3ff,
      fog: [320, 900],
      hemi: { sky: 0xe6f4ff, ground: 0x5a8a3a, intensity: 1.35 },
      sun: { color: 0xfff4dc, intensity: 2.4, dir: SUN_DIR },
      exposure: 1.05,
      shoulder: { floor: 0xf28c3a, sand: 0xe8cf8e, plank: 0xb07a45, ramp: 0x2f9bd6 },
      dust: { floor: 0x9fcf8a, sand: 0xf0dca0, plank: 0xc89a6a, ramp: 0x9fcf8a },
      barrier: {
        floor: [0x2f7de0, 0xffd23a],
        sand: [0xe8423a, 0xf6f3ee],
        plank: [0x8a4fd8, 0xffd23a],
        ramp: [0xff8a1a, 0xf6f3ee],
      },
      skirt: { tex: 'cardboard', tint: { plank: 0xa86a3c, ramp: 0x2f9bd6 } },
      fall: { word: '¡A la piscina de pelotas! ¡Más rápido la próxima!', color: 0xffd23a },
    },
    scenery: buildPlayground,
  },
  {
    id: 'comedor',
    name: 'El Comedor',
    blurb: 'Salta de una mesa a otra',
    ready: true,
    def: CAFETERIA_TRACK,
    seed: 'comedor',
    podium: { x: 40, z: -40, yaw: 0 },
    look: {
      sky: 0xc8e4d8,
      fog: [280, 800],
      hemi: { sky: 0xf4fff8, ground: 0x8fae9c, intensity: 1.3 },
      sun: { color: 0xfffaf0, intensity: 2.2, dir: [0.3, 1, -0.5] },
      exposure: 1.05,
      shoulder: { floor: 0xf07ab0, tray: 0xff8a3a, table: 0xf6f3ee, napkin: 0x7fc4d8, ramp: 0xffd23a },
      dust: { floor: 0xf4d0e0, tray: 0xffc090, table: 0xffffff, napkin: 0xd8f0ff, ramp: 0xfff0a0 },
      barrier: {
        floor: [0xe8423a, 0xf6f3ee],
        tray: [0xff8a3a, 0xffd23a],
        table: [0x3fb24a, 0xf6f3ee],
        napkin: [0x2f9bd6, 0xf6f3ee],
        ramp: [0xff8a1a, 0xffd23a],
      },
      skirt: { tex: 'towel', tint: { tray: 0xff8a3a, table: 0xe0563a, napkin: 0xffffff, ramp: 0xe0563a } },
      slick: { fill: ['rgba(255,170,40,0.95)', 'rgba(255,140,20,0.85)'], ring: 'rgba(255,220,120,0.95)', word: '¡Jugo!', particle: 0xffb030 },
      fall: { word: '¡Al suelo! ¡Más rápido la próxima!', color: 0xf6f3ee },
    },
    scenery: buildCafeteria,
  },
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
