// Mensajes entre dispositivos. Topología en estrella: los invitados hablan con el anfitrión y él reenvía.
import type { ItemId, Species } from '../core/events';

export const PROTOCOL = 1;
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

export const HIT_CODES = ['', 'spin', 'stuck', 'bubble', 'shrink', 'tumble'] as const;

export type Msg =
  | { t: 'hello'; v: number; name: string; char: Species }
  | { t: 'reject'; why: string }
  | { t: 'lobby'; players: LobbyPlayer[]; laps: number; cpu: string; you: number; racing: boolean }
  | { t: 'pick'; char: Species; name: string }
  | { t: 'start'; roster: RosterEntry[]; laps: number; cpu: string }
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
  | { t: 'ping' };
