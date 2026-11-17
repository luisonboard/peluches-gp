// Iconos de los objetos (los usan el HUD y el teléfono-mando, que no carga el resto del juego).
import type { ItemId } from '../core/events';

export const ITEM_ICONS: Record<ItemId, string> = {
  turbo: `<svg viewBox="0 0 64 64"><path d="M32 5c10 8 14 21 12 35H20C18 26 22 13 32 5z" fill="#e8423a" stroke="#2a2050" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="25" r="6" fill="#8fd0ff" stroke="#2a2050" stroke-width="3"/><path d="M20 38l-9 11h13zM44 38l9 11H40z" fill="#ffd23a" stroke="#2a2050" stroke-width="3" stroke-linejoin="round"/><path d="M25 43h14l-7 16z" fill="#ff9a2a"/></svg>`,
  pelota: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#fff"/><path d="M32 8a24 24 0 0 1 0 48a9 24 0 0 0 0-48z" fill="#2f7de0"/><path d="M32 8a24 24 0 0 0 0 48a9 24 0 0 1 0-48z" fill="#e8423a"/><path d="M32 8a24 24 0 0 1 21 12a30 30 0 0 0-42 0A24 24 0 0 1 32 8z" fill="#ffd23a"/><circle cx="32" cy="32" r="24" fill="none" stroke="#2a2050" stroke-width="4"/></svg>`,
  chicle: `<svg viewBox="0 0 64 64"><path d="M9 40c0-12 10-20 23-20s23 8 23 20c0 8-8 13-23 13S9 48 9 40z" fill="#ff7ab8" stroke="#2a2050" stroke-width="4"/><ellipse cx="24" cy="32" rx="7" ry="3.5" fill="#fff" opacity=".75"/><circle cx="44" cy="22" r="7" fill="#ffb0d6" stroke="#2a2050" stroke-width="3"/></svg>`,
};
