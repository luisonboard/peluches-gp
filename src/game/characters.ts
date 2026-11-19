// Los peluches. Los nombres por defecto se pueden cambiar desde el juego (hito 3); se guardan en el dispositivo.

import type { Species } from '../core/events';
export type { Species };

export interface CharacterDef {
  id: Species;
  defaultName: string;
  /** Qué es, en palabras de niño. */
  label: string;
  /** Color principal del peluche. */
  color: number;
  /** Color secundario (hocico, barriga, detalles). */
  accent: number;
  /** Color del kart. */
  kart: number;
  power: string;
  powerDesc: string;
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'perro', defaultName: 'Canelo', label: 'Perro', color: 0xa8693a, accent: 0xe6c79a, kart: 0x2f6fd6, power: 'Ladrido sónico', powerDesc: 'Hace girar a los que están cerca' },
  { id: 'esponja', defaultName: 'Esponjo', label: 'Esponja', color: 0xf0dc3a, accent: 0x8a5a2b, kart: 0x35b4d8, power: 'Burbuja atrapadora', powerDesc: 'Atrapa al de delante en una burbuja' },
  { id: 'raton', defaultName: 'Chispa', label: 'Ratón eléctrico', color: 0xf6cf2a, accent: 0xd8302a, kart: 0xe2453a, power: 'Rayo', powerDesc: 'Encoge a los que van delante' },
  { id: 'zorro', defaultName: 'Kitsu', label: 'Zorro', color: 0xf0862a, accent: 0x2a2a35, kart: 0x8a4fd8, power: 'Llama de zorro', powerDesc: 'Supervelocidad con fuego' },
  { id: 'dino', defaultName: 'Dino', label: 'Dinosaurio', color: 0x9cc48a, accent: 0xf1e6b0, kart: 0xf2a33a, power: 'Pisotón', powerDesc: 'Hace temblar el suelo' },
  { id: 'robot', defaultName: 'Robotín', label: 'Robot', color: 0xd83a2a, accent: 0x9aa3ad, kart: 0x3d4350, power: 'Brazos telescópicos', powerDesc: 'Estira el brazo, atrapa al de delante y se impulsa' },
  { id: 'nieve', defaultName: 'Copito', label: 'Perrito de nieve', color: 0xa9dcf5, accent: 0xf7fbff, kart: 0x7a5ad8, power: 'Aliento helado', powerDesc: 'Congela a los que tiene delante y cerca' },
];

export function displayName(c: CharacterDef): string {
  try {
    const v = localStorage.getItem(`pgp.name.${c.id}`);
    if (v && v.trim()) return v.trim().slice(0, 12);
  } catch {
    /* sin almacenamiento */
  }
  return c.defaultName;
}

export function cssColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
