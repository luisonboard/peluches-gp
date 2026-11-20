// Ajustes del jugador, guardados en el dispositivo. El perfil "Peque" (5 años) es el de partida.

export type Profile = 'peque' | 'normal';
export type SteerMode = 'botones' | 'giro';
export type GyroSens = 'sensible' | 'normal' | 'suave';

export interface Settings {
  profile: Profile;
  /** Ayuda de manejo: el kart acelera solo. */
  autoAccel: boolean;
  /** Ayuda de manejo: corrige el volante para no chocar ni salirse. */
  smartSteer: boolean;
  /** Usa el poder solo cuando conviene. */
  autoPower: boolean;
  /** Indicaciones en voz alta. */
  voice: boolean;
  music: boolean;
  sfx: boolean;
  /** Cómo se gira en el teléfono. */
  steerMode: SteerMode;
  gyroSens: GyroSens;
  gyroInvert: boolean;
  cpu: 'facil' | 'normal' | 'dificil';
  laps: number;
  charIndex: number;
  /** Última pista elegida. */
  trackId: string;
  /** Copa elegida (id, ver game/cup.ts) o null para una carrera suelta. */
  cup: string | null;
  /** Jugadores 2, 3 y 4 de la pantalla dividida (el jugador 1 usa los ajustes de arriba). */
  others: PlayerPrefs[];
}

/** Lo que cambia por jugador en la pantalla dividida. */
export interface PlayerPrefs {
  profile: Profile;
  autoAccel: boolean;
  smartSteer: boolean;
  autoPower: boolean;
  charIndex: number;
}

/** Ayudas de cada perfil (sin tocar la voz ni los rivales, que son comunes). */
export function profileAssist(p: Profile): Pick<PlayerPrefs, 'autoAccel' | 'smartSteer' | 'autoPower'> {
  const d = PROFILE_DEFAULTS[p];
  return { autoAccel: d.autoAccel, smartSteer: d.smartSteer, autoPower: d.autoPower };
}

export const PROFILE_DEFAULTS: Record<Profile, Pick<Settings, 'autoAccel' | 'smartSteer' | 'autoPower' | 'voice' | 'cpu'>> = {
  peque: { autoAccel: true, smartSteer: true, autoPower: true, voice: true, cpu: 'facil' },
  normal: { autoAccel: false, smartSteer: false, autoPower: false, voice: false, cpu: 'normal' },
};

const KEY = 'pgp.settings';

export function defaultSettings(): Settings {
  return { profile: 'peque', ...PROFILE_DEFAULTS.peque, music: true, sfx: true, steerMode: 'botones', gyroSens: 'normal', gyroInvert: false, laps: 3, charIndex: 3, trackId: 'cuarto', cup: null, others: OTHER_CHARS.map((charIndex) => ({ profile: 'normal', ...profileAssist('normal'), charIndex })) };
}

/** Peluche por defecto de los jugadores 2, 3 y 4 (el 1 empieza con el zorro, índice 3). */
const OTHER_CHARS = [0, 1, 2];
/** Jugadores locales como máximo en la pantalla dividida. */
export const MAX_LOCAL = 4;

export function loadSettings(): Settings {
  const s = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings> & { p2?: Partial<PlayerPrefs> };
      // Versiones anteriores guardaban solo el jugador 2 en `p2`.
      const old = saved.others ?? (saved.p2 ? [saved.p2] : []);
      const others = s.others.map((d, i) => ({ ...d, ...(old[i] ?? {}) }));
      delete saved.p2;
      // Versiones anteriores guardaban la copa como sí/no (solo había una).
      const cup = (saved.cup as unknown) === true ? 'copa' : typeof saved.cup === 'string' ? saved.cup : null;
      Object.assign(s, saved, { others, cup });
    }
  } catch {
    /* sin almacenamiento: valores por defecto */
  }
  return s;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento */
  }
}

export function applyProfile(s: Settings, p: Profile): void {
  s.profile = p;
  Object.assign(s, PROFILE_DEFAULTS[p]);
}

/** Medio ángulo (grados) de inclinación que da el giro completo. */
export const GYRO_RANGE: Record<GyroSens, number> = { sensible: 20, normal: 30, suave: 42 };
