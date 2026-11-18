// Botones táctiles para teléfonos y tablets (multitáctil con Pointer Events).
// Izquierda: ◀ ▶, mirar atrás y pausa; con giroscopio, objeto y poder en la esquina, el indicador del volante,
// y centrar, mirar atrás y pausa encima. Derecha: acelerar y frenar juntos abajo, derrapar al lado y, con
// botones ◀ ▶, objeto y poder juntos encima.
// Con el perfil Peque, objeto y poder comparten un solo botón grande.
import type { Controls } from './input';
import type { Gyro } from './gyro';
import type { Settings } from '../core/settings';

const CSS = `
#pgp-touch { position: fixed; inset: 0; pointer-events: none; z-index: 6; }
#pgp-touch .tb { position: absolute; pointer-events: auto; touch-action: none; -webkit-user-select: none; user-select: none;
  -webkit-tap-highlight-color: transparent; border-radius: 50%; background: rgba(255,255,255,0.22); border: 4px solid rgba(255,255,255,0.8);
  color: #fff; font: 900 15px/1.05 ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif; display: grid; place-items: center; text-align: center;
  text-shadow: 0 1px 0 #2a2050, 0 -1px 0 #2a2050, 1px 0 0 #2a2050, -1px 0 0 #2a2050; box-shadow: 0 4px 0 rgba(42,32,80,0.35); }
#pgp-touch .tb .ic { font-size: 30px; display: block; }
#pgp-touch .tb.on { background: rgba(255,210,58,0.65); transform: scale(0.94); }
#pgp-touch .tb.ready { border-color: #ffd23a; animation: pgp-tready .5s ease-in-out infinite alternate; }
@keyframes pgp-tready { to { box-shadow: 0 0 0 8px rgba(255,210,58,.7) } }
#pgp-touch .wheel { position: absolute; pointer-events: none; width: 44px; height: 44px; border-radius: 50%; border: 5px solid rgba(255,255,255,0.85);
  box-shadow: 0 0 0 2px rgba(42,32,80,0.5); }
#pgp-touch .wheel::before { content: ""; position: absolute; left: 50%; top: 2px; bottom: 50%; width: 6px; margin-left: -3px; border-radius: 3px; background: #ffd23a; }
#pgp-rotate { position: fixed; inset: 0; z-index: 30; display: none; place-items: center; text-align: center; background: #5d6ab0; color: #fff;
  font: 900 26px/1.3 ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif; padding: 24px; }
#pgp-rotate .big { font-size: 80px; display: block; animation: pgp-rot 1.6s ease-in-out infinite; }
@keyframes pgp-rot { 50% { transform: rotate(-90deg) } }
body.pgp-touch-on #hud-pos { bottom: auto; top: calc(max(14px, env(safe-area-inset-top)) + 84px); font-size: clamp(44px, 9vh, 72px); }
`;

type Key = 'left' | 'right' | 'gas' | 'brake' | 'drift' | 'item' | 'power' | 'use' | 'look';

export function isTouchDevice(): boolean {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || new URLSearchParams(location.search).has('touch');
}

export class TouchControls {
  private root = document.createElement('div');
  private rotate = document.createElement('div');
  private held = new Map<number, Key>();
  private state: Record<Key, boolean> = { left: false, right: false, gas: false, brake: false, drift: false, item: false, power: false, use: false, look: false };
  private btns = new Map<Key, HTMLElement>();
  private wheel: HTMLElement | null = null;
  private visible = false;
  private settings: Settings | null = null;

  /** `pad`: el teléfono es el mando de la pantalla dividida (sin juego detrás), así que los botones crecen. */
  constructor(private gyro: Gyro, private onPause: () => void, private pad = false) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.append(st);
    this.root.id = 'pgp-touch';
    this.rotate.id = 'pgp-rotate';
    this.rotate.innerHTML = '<div><span class="big">📱</span>Gira el teléfono<br>para jugar</div>';
    document.body.append(this.root, this.rotate);
    this.root.style.display = 'none';
    addEventListener('resize', () => this.checkRotate());
  }

  configure(s: Settings): void {
    this.settings = s;
    this.root.innerHTML = '';
    this.btns.clear();
    this.wheel = null;
    const L = 'max(16px, env(safe-area-inset-left))';
    const R = 'max(16px, env(safe-area-inset-right))';
    const B = 'max(14px, env(safe-area-inset-bottom))';
    const mk = (key: Key | 'pause' | 'center', html: string, size: number, pos: Partial<Record<'left' | 'right' | 'bottom' | 'top', string>>): HTMLElement => {
      const b = document.createElement('div');
      b.className = 'tb';
      b.innerHTML = html;
      b.style.width = b.style.height = `${size}px`;
      Object.assign(b.style, pos);
      this.root.append(b);
      if (key === 'pause' || key === 'center') {
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (key === 'pause') this.onPause();
          else this.gyro.calibrate();
          b.classList.add('on');
          setTimeout(() => b.classList.remove('on'), 150);
        });
      } else {
        this.btns.set(key, b);
        b.addEventListener('pointerdown', (e) => this.down(e, key, b));
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) b.addEventListener(ev, (e) => this.up(e));
      }
      return b;
    };
    const peque = s.profile === 'peque';
    const giro = s.steerMode === 'giro';
    // Objeto y Poder (o ¡Usar!) grandes, y aún más en el teléfono usado como mando, donde no hay juego detrás que tapar.
    const big = (icon: string, text: string, size: number): string =>
      `<span style="font-size:${Math.max(15, Math.round(size * 0.16))}px"><span class="ic" style="font-size:${Math.round(size * 0.36)}px">${icon}</span>${text}</span>`;
    const itemSz = this.pad ? 132 : giro ? 100 : 92;
    const useSz = this.pad ? 150 : giro ? 116 : 108;
    // Con giroscopio la izquierda queda libre de ◀ ▶: Objeto y Poder pasan a la esquina izquierda (lo siguiente
    // en uso tras acelerar y frenar), con Centrar, mirar atrás, pausa y un indicador pequeño del volante encima.
    let rowL = 96;
    if (giro) {
      if (peque) {
        mk('use', big('⭐', '¡Usar!', useSz), useSz, { left: L, bottom: B });
        rowL = useSz;
      } else {
        mk('item', big('🎁', 'Objeto', itemSz), itemSz, { left: L, bottom: B });
        mk('power', big('⚡', 'Poder', itemSz), itemSz, { left: `calc(${L} + ${itemSz + 12}px)`, bottom: B });
        rowL = itemSz;
      }
    } else {
      mk('left', '<span class="ic">◀</span>', 96, { left: L, bottom: B });
      mk('right', '<span class="ic">▶</span>', 96, { left: `calc(${L} + 110px)`, bottom: B });
    }
    // Derecha, abajo: Acelerar (en la esquina) y Frenar juntos, y Derrapar a su lado. Con botones ◀ ▶, encima:
    // Objeto y Poder juntos. Con aceleración automática no hay botón de acelerar y Frenar pasa a la esquina.
    const gas = !s.autoAccel;
    if (gas) mk('gas', '<span><span class="ic">▲</span>Acelerar</span>', 100, { right: R, bottom: B });
    const brakeR = gas ? 112 : 0;
    mk('brake', '<span><span class="ic">▼</span>Frenar</span>', 84, { right: `calc(${R} + ${brakeR}px)`, bottom: B });
    mk('drift', '<span><span class="ic">🌀</span>Derrapar</span>', 88, { right: `calc(${R} + ${brakeR + 96}px)`, bottom: B });
    if (!giro) {
      const up = `calc(${B} + ${gas ? 116 : 100}px)`;
      if (peque) {
        mk('use', big('⭐', '¡Usar!', useSz), useSz, { right: `calc(${R} + ${gas ? 40 : 0}px)`, bottom: up });
      } else {
        const off = gas ? 4 : 0;
        mk('power', big('⚡', 'Poder', itemSz), itemSz, { right: `calc(${R} + ${off}px)`, bottom: up });
        mk('item', big('🎁', 'Objeto', itemSz), itemSz, { right: `calc(${R} + ${off + itemSz + 12}px)`, bottom: up });
      }
    }
    // Izquierda, encima de lo de abajo: (Centrar con giroscopio), mirar atrás, pausa y (el indicador del volante,
    // pequeño y al final porque no se toca).
    const upL = `calc(${B} + ${rowL + (giro ? 14 : 16)}px)`;
    let x = 0;
    if (giro) {
      mk('center', '<span><span class="ic" style="font-size:22px">⟲</span>Centrar</span>', 64, { left: L, bottom: upL });
      x = 76;
    }
    mk('look', '<span class="ic" style="font-size:24px">👀</span>', 56, { left: `calc(${L} + ${x}px)`, bottom: upL });
    mk('pause', '<span class="ic" style="font-size:22px">❚❚</span>', 56, { left: `calc(${L} + ${x + 68}px)`, bottom: upL });
    if (giro) {
      const w = document.createElement('div');
      w.className = 'wheel';
      Object.assign(w.style, { left: `calc(${L} + ${x + 136}px)`, bottom: `calc(${B} + ${rowL + 20}px)` });
      this.root.append(w);
      this.wheel = w;
    }
  }

  show(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
    document.body.classList.toggle('pgp-touch-on', v);
    if (!v) {
      this.held.clear();
      for (const k of Object.keys(this.state) as Key[]) this.state[k] = false;
    }
    this.checkRotate();
  }

  private checkRotate(): void {
    this.rotate.style.display = this.visible && innerHeight > innerWidth ? 'grid' : 'none';
  }

  private down(e: PointerEvent, key: Key, b: HTMLElement): void {
    e.preventDefault();
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores no lo permiten */
    }
    this.held.set(e.pointerId, key);
    this.refresh();
  }

  private up(e: PointerEvent): void {
    this.held.delete(e.pointerId);
    this.refresh();
  }

  private refresh(): void {
    for (const k of Object.keys(this.state) as Key[]) this.state[k] = false;
    for (const k of this.held.values()) this.state[k] = true;
    for (const [k, b] of this.btns) b.classList.toggle('on', this.state[k]);
  }

  /** Suma lo táctil y el giroscopio a los controles leídos del teclado y del mando. */
  merge(c: Controls, dt: number, powerReady: boolean): void {
    const s = this.settings;
    if (!s) return;
    if (s.steerMode === 'giro' && this.gyro.active) {
      const g = this.gyro.steer(dt);
      if (Math.abs(g) > Math.abs(c.steer)) c.steer = g;
      if (this.wheel) this.wheel.style.transform = `rotate(${this.gyro.tiltDeg.toFixed(0)}deg)`;
    }
    if (!this.visible) return;
    const t = this.state;
    const bs = (t.right ? 1 : 0) - (t.left ? 1 : 0);
    if (bs !== 0) c.steer = bs;
    if (t.gas) c.throttle = 1;
    if (t.brake) c.brake = 1;
    c.drift ||= t.drift;
    c.look ||= t.look;
    c.item ||= t.item || (t.use && !powerReady);
    c.power ||= t.power || (t.use && powerReady);
    this.btns.get('use')?.classList.toggle('ready', powerReady);
    this.btns.get('power')?.classList.toggle('ready', powerReady);
  }
}
