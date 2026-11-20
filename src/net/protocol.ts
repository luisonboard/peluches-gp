// Mensajes entre dispositivos. Topología en estrella: los invitados hablan con el anfitrión y él reenvía.
import type { ItemId, Species } from '../core/events';

/** 2: la sala y el inicio llevan la pista. 3: copa de 3 carreras. 5: varias copas (la copa lleva su id). */
export const PROTOCOL = 5;

/** Copa en curso tal como viaja por la red (ver game/cup.ts). */
export interface CupData {
  id: string;
  raced: number;
  rows: import('../game/cup').CupRow[];
}
export const MAX_PLAYERS = 6;

export interface LobbyPlayer {
  slot: number;
  /** Id de PeerJS del dispositivo ("" = anfitrión). */
  peer: string;
  name: string;
  char: Species;
  host: boolean;
  /** Llegó con la carrera en marcha: entra en la siguiente. */
  waiting: boolean;
}

export interface RosterEntry {
  slot: number;
  char: Species;
  name: string;
  /** "host", "ai" o el id de PeerJS del invitado que lo maneja. */
  owner: string;
}

/**
 * Estado compacto de un kart (20 veces por segundo):
 * [slot, x, y, z, rumbo, velocidad, giro, derrape, nivelDerrape, turbo, vuelta, índice, fracción,
 *  golpe, tiempoGolpe, duraciónGolpe, encogido, fuego, invulnerable, vy, poder]
 */
export type KartState = number[];

export const HIT_CODES = ['', 'spin', 'stuck', 'bubble', 'shrink', 'tumble', 'freeze'] as const;

export type Msg =
  | { t: 'hello'; v: number; name: string; char: Species }
  | { t: 'reject'; why: string }
  /** `track` puede ser el id de una copa ('copa', 'copa-escuela'). */
  | { t: 'lobby'; players: LobbyPlayer[]; laps: number; cpu: string; track: string; you: number; racing: boolean }
  | { t: 'pick'; char: Species; name: string }
  /** `track`: pista de esta carrera. `cup`: copa en curso (si es una copa). */
  | { t: 'start'; roster: RosterEntry[]; laps: number; cpu: string; track: string; cup?: CupData }
  /** Anfitrión: puntos de la copa tras una carrera. */
  | { t: 'cup'; cup: CupData }
  | { t: 'st'; k: KartState[] }
  | {
      t: 'use';
      s: number;
      w: 'item' | 'power';
      item?: ItemId;
      id: string;
      x: number;
      y: number;
      z: number;
      vx: number;
      vz: number;
      /** Slots objetivo (burbuja, misil, rayo). */
      tg: number[];
      prog?: number;
      lat?: number;
    }
  | { t: 'kill'; id: string }
  | { t: 'quake'; s: number; x: number; y: number; z: number }
  | { t: 'box'; i: number }
  | { t: 'fin'; s: number; time: number }
  | { t: 'place'; s: number; place: number; time: number }
  | { t: 'menu' }
  /** Latido: si un dispositivo calla más de 5 s, se le da por desconectado. */
  | { t: 'ping' }
  // --- Teléfono como mando (net/pad.ts) ---
  /** Teléfono → pantalla: se presenta. */
  | { t: 'padhi'; v: number }
  /** Teléfono → pantalla: controles [volante, acelerar, frenar, bits] (bits: 1 derrape, 2 objeto, 4 poder, 8 mirar atrás). */
  | { t: 'pad'; c: [number, number, number, number] }
  /** Teléfono → pantalla: tecla de menú o pausa. */
  | { t: 'pkey'; k: PadKey }
  /** Pantalla → teléfono: qué mostrar. */
  | { t: 'padst'; st: PadState }
  /** Pantalla → teléfono: lo justo del HUD del jugador. */
  | { t: 'padhud'; h: PadHud }
  /** Pantalla → teléfono: vibrar. */
  | { t: 'buzz'; ms: number };

/** Versión del protocolo del mando (va en `padhi`). */
export const PAD_PROTOCOL = 1;
/** `solo`/`unsolo`: usar (o dejar de usar) el teléfono como mando del jugador 1 en partidas de 1 jugador. */
export type PadKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'back' | 'pause' | 'solo' | 'unsolo';

export interface PadState {
  /** `menu`: flechas y OK. `join`: pantalla de unirse. `race`: manejar. `wait`: la carrera es de otros. `reject`: versión distinta. */
  mode: 'menu' | 'join' | 'race' | 'wait' | 'reject';
  /** Nombre del teléfono ("Teléfono 1"). */
  label: string;
  /** Jugador que maneja (0, 1) o −1. */
  who: number;
  /** Peluche y color del jugador. */
  name?: string;
  color?: string;
  /** En la pantalla de unirse: ya dijo "listo". */
  ready?: boolean;
  /** El kart acelera solo (no hace falta el botón Acelerar). */
  auto?: boolean;
  /** Perfil Peque: objeto y poder en un solo botón. */
  peque?: boolean;
  /** Texto de ayuda o de error. */
  note?: string;
  /** Fuera de «2–4 jugadores»: puede elegirse como mando del jugador 1 (botón «Usar como mando»). */
  canSolo?: boolean;
  /** Es el mando del jugador 1 en partidas de 1 jugador (botón «Dejar de usarlo»). */
  solo?: boolean;
}

export interface PadHud {
  /** Puesto actual (o de llegada). */
  pos: number;
  lap: number;
  laps: number;
  /** Objeto en la mano ("" = ninguno). */
  item: string;
  /** La ruleta está girando. */
  roul: boolean;
  /** Barra de poder 0..1. */
  pow: number;
  fin: boolean;
}
