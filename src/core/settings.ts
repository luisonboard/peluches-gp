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
  /** Cómo se gira en el teléfono. */
  steerMode: SteerMode;
  gyroSens: GyroSens;
  gyroInvert: boolean;
  cpu: 'facil' | 'normal' | 'dificil';
  laps: number;
  charIndex: number;
}

export const PROFILE_DEFAULTS: Record<Profile, Pick<Settings, 'autoAccel' | 'smartSteer' | 'autoPower' | 'voice' | 'cpu'>> = {
  peque: { autoAccel: true, smartSteer: true, autoPower: true, voice: true, cpu: 'facil' },
  normal: { autoAccel: false, smartSteer: false, autoPower: false, voice: false, cpu: 'normal' },
};

const KEY = 'pgp.settings';

export function defaultSettings(): Settings {
  return { profile: 'peque', ...PROFILE_DEFAULTS.peque, steerMode: 'botones', gyroSens: 'normal', gyroInvert: false, laps: 3, charIndex: 3 };
}

export function loadSettings(): Settings {
  const s = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
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
