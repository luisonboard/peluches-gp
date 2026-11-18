// Teléfonos como mando: el computador abre una sala propia (con el relevo o, si no hay, con PeerJS) y cada teléfono
// que escanea el QR entra en ella. El teléfono no dibuja la carrera: manda sus controles unas 30 veces por segundo
// y recibe qué pantalla mostrar (menú, unirse, manejar) y lo justo del HUD (puesto, vuelta, objeto y poder).
import type { Controls, DeviceId, MenuKey } from '../input/input';
import { NetHost } from './net';
import { RelayHost, relayAvailable } from './relay';
import { PAD_PROTOCOL, type Msg, type PadHud, type PadKey, type PadState } from './protocol';

/** Si un teléfono deja de mandar controles este tiempo, se sueltan todos los botones. */
const STALE_MS = 700;

interface Phone {
  dev: DeviceId;
  peer: string;
  label: string;
  ctl: Controls | null;
  seen: number;
  /** Lo último enviado (para no repetirlo). */
  st: string;
  hud: string;
}

export class PadHub {
  code = '';
  private host: RelayHost | NetHost | null = null;
  private opening: Promise<string> | null = null;
  private phones = new Map<string, Phone>();
  /** Número de cada teléfono, que se conserva si se reconecta ("Teléfono 1", "Teléfono 2"…). */
  private numbers = new Map<string, number>();
  onControls: (dev: DeviceId, c: Controls | null, label: string) => void = () => {};
  onKey: (dev: DeviceId, k: PadKey) => void = () => {};
  /** Se conectó un teléfono (hay que mandarle su estado). */
  onJoin: (dev: DeviceId) => void = () => {};
  onLeave: (dev: DeviceId, label: string) => void = () => {};

  get open(): boolean {
    return !!this.host;
  }

  /** Abre la sala de mandos (una sola vez; las siguientes devuelven el mismo código). */
  start(): Promise<string> {
    if (!this.opening) {
      this.opening = (async () => {
        const h = (await relayAvailable()) ? new RelayHost() : new NetHost();
        h.onMsg = (from, m) => this.msg(from, m);
        h.onLeave = (id) => this.leave(id);
        h.onError = () => {};
        this.code = await h.open();
        this.host = h;
        return this.code;
      })();
      this.opening.catch(() => (this.opening = null));
    }
    return this.opening;
  }

  /** Dirección que abre el mando en el teléfono. */
  url(): string {
    return `${location.origin}${location.pathname}?mando=${this.code}`;
  }

  get devices(): DeviceId[] {
    return [...this.phones.values()].map((p) => p.dev);
  }

  private msg(from: string, m: Msg): void {
    let p = this.phones.get(from);
    if (m.t === 'padhi') {
      if (m.v !== PAD_PROTOCOL) {
        this.host?.send(from, { t: 'padst', st: { mode: 'reject', label: '', who: -1, note: 'Actualiza el juego: este teléfono y la pantalla tienen versiones distintas. Recarguen la página en los dos.' } });
        return;
      }
      if (!this.numbers.has(from)) this.numbers.set(from, this.numbers.size + 1);
      const n = this.numbers.get(from)!;
      p = { dev: `tel${n}`, peer: from, label: `Teléfono ${n}`, ctl: null, seen: performance.now(), st: '', hud: '' };
      this.phones.set(from, p);
      this.onJoin(p.dev);
      return;
    }
    if (!p) return;
    p.seen = performance.now();
    if (m.t === 'pad') {
      const [steer, throttle, brake, bits] = m.c;
      p.ctl = {
        steer: clamp(steer, -1, 1),
        throttle: clamp(throttle, 0, 1),
        brake: clamp(brake, 0, 1),
        drift: !!(bits & 1),
        item: !!(bits & 2),
        power: !!(bits & 4),
        look: !!(bits & 8),
      };
      this.onControls(p.dev, p.ctl, p.label);
    } else if (m.t === 'pkey') {
      if (!p.ctl) this.onControls(p.dev, NONE, p.label);
      if (KEYS.has(m.k)) this.onKey(p.dev, m.k);
    }
  }

  private leave(peer: string): void {
    const p = this.phones.get(peer);
    if (!p) return;
    this.phones.delete(peer);
    this.onControls(p.dev, null, p.label);
    this.onLeave(p.dev, p.label);
  }

  /** Suelta los botones de un teléfono que dejó de mandar (pantalla bloqueada, mala señal). Llamar cada cuadro. */
  tick(): void {
    const now = performance.now();
    for (const p of this.phones.values()) {
      if (p.ctl && now - p.seen > STALE_MS) {
        p.ctl = null;
        this.onControls(p.dev, NONE, p.label);
      }
    }
  }

  private byDev(dev: DeviceId): Phone | undefined {
    for (const p of this.phones.values()) if (p.dev === dev) return p;
    return undefined;
  }

  label(dev: DeviceId): string {
    return this.byDev(dev)?.label ?? 'Teléfono';
  }

  /** Manda al teléfono qué pantalla mostrar (solo si cambió, salvo `force`). */
  setState(dev: DeviceId, st: Omit<PadState, 'label'>, force = false): void {
    const p = this.byDev(dev);
    if (!p || !this.host) return;
    const full: PadState = { ...st, label: p.label };
    const key = JSON.stringify(full);
    if (!force && key === p.st) return;
    p.st = key;
    this.host.send(p.peer, { t: 'padst', st: full });
  }

  setHud(dev: DeviceId, h: PadHud): void {
    const p = this.byDev(dev);
    if (!p || !this.host) return;
    const key = JSON.stringify(h);
    if (key === p.hud) return;
    p.hud = key;
    this.host.send(p.peer, { t: 'padhud', h });
  }

  buzz(dev: DeviceId, ms: number): void {
    const p = this.byDev(dev);
    if (p && this.host) this.host.send(p.peer, { t: 'buzz', ms: Math.round(Math.min(600, ms)) });
  }
}

const NONE: Controls = { steer: 0, throttle: 0, brake: 0, drift: false, item: false, power: false, look: false };
const KEYS = new Set<PadKey>(['left', 'right', 'up', 'down', 'ok', 'back', 'pause', 'solo', 'unsolo'] satisfies (MenuKey | 'pause' | 'solo' | 'unsolo')[]);
const clamp = (v: unknown, a: number, b: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : 0);
