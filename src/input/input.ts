// Entrada unificada: teclado + mandos (Gamepad API, distribución «standard»).
// Switch Pro en Chrome/Safari: los botones frontales van por posición
// (abajo = B de Switch → acelerar, derecha = A → frenar, arriba = X → poder).
// Cada dispositivo (teclado, mando 0, mando 1…) se puede leer por separado para la pantalla dividida.
// Los teléfonos usados como mando (`tel…`, ver net/pad.ts) llegan por la red y se guardan con `setRemote`.

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
/** `kbd` = teclado; `pad0`, `pad1`… = mando por su índice en la Gamepad API; `tel…` = teléfono como mando. */
export type DeviceId = 'kbd' | `pad${number}` | `tel${string}`;

export const isPhone = (dev: DeviceId): dev is `tel${string}` => dev.startsWith('tel');
export interface MenuEvent {
  dev: DeviceId;
  key: MenuKey;
}

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const DEAD = 0.15;
const NONE: Controls = { steer: 0, throttle: 0, brake: 0, drift: false, item: false, power: false, look: false };
/** Mientras se escribe un nombre, las teclas no manejan el kart. */
const isTyping = (e: Event): boolean => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
};

interface PadPrev {
  buttons: boolean[];
  ax: number;
  ay: number;
}

export class Input {
  private keys = new Set<string>();
  private pauseQueued = false;
  private menuQueue: MenuEvent[] = [];
  private padPrev = new Map<number, PadPrev>();
  private padCtl = new Map<number, Controls>();
  private lastPad = -1;
  /** Último estado recibido de cada teléfono. */
  private remote = new Map<DeviceId, Controls>();
  /** Nombre de cada teléfono para la pantalla de unirse ("Teléfono 1"…). */
  private remoteNames = new Map<DeviceId, string>();
  /** Teléfono elegido como mando del jugador 1 en partidas de 1 jugador (los demás no cuentan en `read`). */
  soloRemote: DeviceId | null = null;
  /** Vibración de un teléfono (la manda la red). */
  onRemoteRumble: (dev: DeviceId, ms: number) => void = () => {};
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
          if (m) this.menuQueue.push({ dev: 'kbd', key: m });
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

  /** Lee los mandos (estado y bordes para los menús). Llamar una vez por cuadro, antes de `read`/`readDevice`. */
  poll(): void {
    this.padCtl.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i: number): boolean => p.buttons[i]?.pressed ?? false;
      const bv = (i: number): number => p.buttons[i]?.value ?? 0;
      let ax = p.axes[0] ?? 0;
      ax = Math.abs(ax) < DEAD ? 0 : (ax - Math.sign(ax) * DEAD) / (1 - DEAD);
      if (b(14)) ax = -1;
      if (b(15)) ax = 1;
      const ay = p.axes[1] ?? 0;
      this.padCtl.set(p.index, {
        steer: Math.max(-1, Math.min(1, ax)),
        throttle: Math.max(b(0) ? 1 : 0, bv(7) > 0.1 ? bv(7) : 0),
        brake: b(1) ? 1 : 0,
        drift: b(5),
        item: b(4) || b(6) || b(2),
        power: b(3),
        look: b(8) || b(11),
      });

      // Bordes para menús y pausa.
      const prev = this.padPrev.get(p.index) ?? { buttons: [], ax: 0, ay: 0 };
      const any = p.buttons.some((x) => x.pressed) || Math.abs(ax) > 0.5;
      if (any) {
        this.lastPad = p.index;
        this.touch();
      }
      const dev: DeviceId = `pad${p.index}`;
      const push = (key: MenuKey): number => this.menuQueue.push({ dev, key });
      const edge = (i: number): boolean => b(i) && !prev.buttons[i];
      if (edge(9)) this.pauseQueued = true;
      if (edge(0)) push('ok');
      if (edge(1)) push('back');
      if (edge(12)) push('up');
      if (edge(13)) push('down');
      const axDir = ax < -0.6 ? -1 : ax > 0.6 ? 1 : 0;
      if (axDir !== prev.ax && axDir !== 0) push(axDir < 0 ? 'left' : 'right');
      const ayDir = ay < -0.6 ? -1 : ay > 0.6 ? 1 : 0;
      if (ayDir !== prev.ay && ayDir !== 0) push(ayDir < 0 ? 'up' : 'down');
      this.padPrev.set(p.index, { buttons: p.buttons.map((x) => x.pressed), ax: axDir, ay: ayDir });
    }
  }

  /** Estado de un teléfono (`null` al desconectarse). */
  setRemote(dev: DeviceId, c: Controls | null, name?: string): void {
    if (c) this.remote.set(dev, c);
    else this.remote.delete(dev);
    if (name) this.remoteNames.set(dev, name);
    if (c) this.touch();
  }

  /** Tecla de menú o pausa que llegó de un teléfono. */
  pushRemote(dev: DeviceId, key: MenuKey | 'pause'): void {
    this.touch();
    if (key === 'pause') this.pauseQueued = true;
    else this.menuQueue.push({ dev, key });
  }

  private keyboard(): Controls {
    const k = this.keys;
    return {
      steer: (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0),
      throttle: k.has('ArrowUp') || k.has('KeyW') ? 1 : 0,
      brake: k.has('ArrowDown') || k.has('KeyS') ? 1 : 0,
      drift: k.has('Space'),
      item: k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyK'),
      power: k.has('KeyE') || k.has('KeyL'),
      look: k.has('KeyC'),
    };
  }

  /** Estado combinado de todos los dispositivos (un solo jugador). */
  read(): Controls {
    const c = this.keyboard();
    const solo = this.soloRemote ? this.remote.get(this.soloRemote) : undefined;
    for (const p of solo ? [...this.padCtl.values(), solo] : this.padCtl.values()) {
      if (Math.abs(p.steer) > Math.abs(c.steer)) c.steer = p.steer;
      c.throttle = Math.max(c.throttle, p.throttle);
      c.brake = Math.max(c.brake, p.brake);
      c.drift ||= p.drift;
      c.item ||= p.item;
      c.power ||= p.power;
      c.look ||= p.look;
    }
    return c;
  }

  /** Estado de un solo dispositivo (pantalla dividida). Un mando desconectado no hace nada. */
  readDevice(dev: DeviceId): Controls {
    if (dev === 'kbd') return this.keyboard();
    if (isPhone(dev)) return { ...(this.remote.get(dev) ?? NONE) };
    return { ...(this.padCtl.get(Number(dev.slice(3))) ?? NONE) };
  }

  /** Nombre corto del dispositivo para la pantalla de unirse. */
  deviceName(dev: DeviceId): string {
    if (dev === 'kbd') return 'Teclado';
    if (isPhone(dev)) return `📱 ${this.remoteNames.get(dev) ?? 'Teléfono'}${this.remote.has(dev) ? '' : ' (desconectado)'}`;
    const p = navigator.getGamepads?.()[Number(dev.slice(3))];
    const name = p?.id.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
    return name ? `Mando: ${name}` : 'Mando (desconectado)';
  }

  /** Mando conectado y botones pulsados (para la prueba del mando en Ajustes). */
  padInfo(): string {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const lines: string[] = [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const names = ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', '↑', '↓', '←', '→'];
      const on = p.buttons.map((b, i) => (b.pressed ? names[i] ?? `#${i}` : '')).filter(Boolean);
      const ax = Math.abs(p.axes[0] ?? 0) > 0.15 ? ` · palanca ${(p.axes[0] * 100).toFixed(0)}%` : '';
      lines.push(`${p.id.replace(/\(.*?\)/g, '').trim().slice(0, 40)} — ${on.length ? on.join(' ') : 'pulsa un botón'}${ax}`);
    }
    return lines.length ? lines.join('\n') : 'Ningún mando conectado (conéctalo y pulsa un botón)';
  }

  consumePause(): boolean {
    const p = this.pauseQueued;
    this.pauseQueued = false;
    return p;
  }

  consumeMenu(): MenuKey[] {
    return this.consumeMenuEvents().map((e) => e.key);
  }

  /** Teclas de menú con el dispositivo que las pulsó. */
  consumeMenuEvents(): MenuEvent[] {
    const q = this.menuQueue;
    this.menuQueue = [];
    return q;
  }

  /** Vibración del mando, si el navegador la permite. `dev`: ese dispositivo (si no, el último mando usado). */
  rumble(strong: number, weak: number, ms: number, dev?: DeviceId): void {
    if (dev === 'kbd') return;
    if (dev && isPhone(dev)) return this.onRemoteRumble(dev, ms);
    if (!dev && this.soloRemote) this.onRemoteRumble(this.soloRemote, ms);
    const idx = dev ? Number(dev.slice(3)) : this.lastPad;
    if (idx < 0) return;
    const p = navigator.getGamepads?.()[idx] as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | null;
    p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak })?.catch(() => {});
  }
}

const KEY_MENU: Record<string, MenuKey> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Enter: 'ok',
  Space: 'ok',
  Backspace: 'back',
};
