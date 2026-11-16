// Entrada unificada: teclado + mandos (Gamepad API, distribución «standard»).
// Switch Pro en Chrome/Safari: los botones frontales van por posición
// (abajo = B de Switch → acelerar, derecha = A → frenar, arriba = X → poder).

export interface Controls {
  steer: number; // -1 izquierda … 1 derecha
  throttle: number;
  brake: number;
  drift: boolean;
  item: boolean;
  power: boolean;
  /** Mantener para mirar hacia atrás. */
  look: boolean;
}

export type MenuKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'back';

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const DEAD = 0.15;
/** Mientras se escribe un nombre, las teclas no manejan el kart. */
const isTyping = (e: Event): boolean => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
};

export class Input {
  private keys = new Set<string>();
  private pauseQueued = false;
  private menuQueue: MenuKey[] = [];
  private padPrev: boolean[] = [];
  private padAxisPrev = 0;
  private lastPad = -1;
  /** Se llama en la primera interacción (para desbloquear el audio). */
  onFirstInteraction: () => void = () => {};
  onFullscreenKey: () => void = () => {};
  private interacted = false;

  constructor() {
    addEventListener(
      'keydown',
      (e) => {
        if (isTyping(e)) return;
        if (PREVENT.has(e.code)) e.preventDefault();
        this.touch();
        if (!e.repeat) {
          if (e.code === 'Escape' || e.code === 'KeyP') this.pauseQueued = true;
          if (e.code === 'KeyF') this.onFullscreenKey();
          const m = KEY_MENU[e.code];
          if (m) this.menuQueue.push(m);
        }
        this.keys.add(e.code);
      },
      { passive: false },
    );
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('focusin', (e) => {
      if (isTyping(e)) this.keys.clear();
    });
    addEventListener('blur', () => this.keys.clear());
    addEventListener('pointerdown', () => this.touch());
  }

  private touch(): void {
    if (this.interacted) return;
    this.interacted = true;
    this.onFirstInteraction();
  }

  /** Lee el estado combinado. Llamar una vez por cuadro. */
  read(): Controls {
    const k = this.keys;
    let steer = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let throttle = k.has('ArrowUp') || k.has('KeyW') ? 1 : 0;
    let brake = k.has('ArrowDown') || k.has('KeyS') ? 1 : 0;
    let drift = k.has('Space');
    let item = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyK');
    let power = k.has('KeyE') || k.has('KeyL');
    let look = k.has('KeyC');

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i: number): boolean => p.buttons[i]?.pressed ?? false;
      const bv = (i: number): number => p.buttons[i]?.value ?? 0;
      let ax = p.axes[0] ?? 0;
      ax = Math.abs(ax) < DEAD ? 0 : (ax - Math.sign(ax) * DEAD) / (1 - DEAD);
      if (b(14)) ax = -1;
      if (b(15)) ax = 1;
      if (Math.abs(ax) > Math.abs(steer)) steer = ax;
      throttle = Math.max(throttle, b(0) ? 1 : 0, bv(7) > 0.1 ? bv(7) : 0);
      brake = Math.max(brake, b(1) ? 1 : 0);
      drift ||= b(5);
      item ||= b(4) || b(6) || b(2);
      power ||= b(3);
      look ||= b(8) || b(11);

      // Bordes para menús y pausa.
      const any = p.buttons.some((x) => x.pressed) || Math.abs(ax) > 0.5;
      if (any) {
        this.lastPad = p.index;
        this.touch();
      }
      const edge = (i: number): boolean => b(i) && !this.padPrev[i];
      if (edge(9)) this.pauseQueued = true;
      if (edge(0)) this.menuQueue.push('ok');
      if (edge(1)) this.menuQueue.push('back');
      if (edge(12)) this.menuQueue.push('up');
      if (edge(13)) this.menuQueue.push('down');
      const axDir = ax < -0.6 ? -1 : ax > 0.6 ? 1 : 0;
      if (axDir !== this.padAxisPrev && axDir !== 0) this.menuQueue.push(axDir < 0 ? 'left' : 'right');
      this.padAxisPrev = axDir;
      this.padPrev = p.buttons.map((x) => x.pressed);
      break; // un solo mando por dispositivo en el hito 1
    }
    return { steer: Math.max(-1, Math.min(1, steer)), throttle, brake, drift, item, power, look };
  }

  /** Mando conectado y botones pulsados (para la prueba del mando en Ajustes). */
  padInfo(): string {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const names = ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', '↑', '↓', '←', '→'];
      const on = p.buttons.map((b, i) => (b.pressed ? names[i] ?? `#${i}` : '')).filter(Boolean);
      const ax = Math.abs(p.axes[0] ?? 0) > 0.15 ? ` · palanca ${(p.axes[0] * 100).toFixed(0)}%` : '';
      return `${p.id.replace(/\(.*?\)/g, '').trim().slice(0, 40)} — ${on.length ? on.join(' ') : 'pulsa un botón'}${ax}`;
    }
    return 'Ningún mando conectado (conéctalo y pulsa un botón)';
  }

  consumePause(): boolean {
    const p = this.pauseQueued;
    this.pauseQueued = false;
    return p;
  }

  consumeMenu(): MenuKey[] {
    const q = this.menuQueue;
    this.menuQueue = [];
    return q;
  }

  /** Vibración del mando, si el navegador la permite. */
  rumble(strong: number, weak: number, ms: number): void {
    if (this.lastPad < 0) return;
    const p = navigator.getGamepads?.()[this.lastPad] as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null;
    p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak })?.catch(() => {});
  }
}

const KEY_MENU: Record<string, MenuKey> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'ok',
  Space: 'ok',
  Backspace: 'back',
};
