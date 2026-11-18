// Canal con un dispositivo remoto por dos caminos: el relevo (WebSocket a Cloudflare o al servidor de desarrollo),
// que siempre está, y la conexión directa WebRTC, que se intenta en cuanto se entra en la sala (negociada por el
// mismo relevo). Se mide el tiempo de ida y vuelta de cada camino una vez por segundo y se usa el directo siempre que
// no sea claramente peor: en la misma Wi-Fi suele ir varias veces más rápido que dar la vuelta por Internet.
// Los mensajes fiables llevan número de orden, así que cambiar de camino a mitad de la partida no los desordena.
import type { Msg } from './protocol';
import { DirectLink, directSupported, type Signal } from './direct';

/** Lo que viaja por los caminos: fiable con orden, latido, respuesta al latido, negociación o un mensaje suelto. */
type Wire =
  | { t: '~r'; n: number; m: Msg }
  | { t: '~p'; o: number }
  | { t: '~q'; o: number }
  | { t: '~s'; s: Signal }
  | Msg;

/** Se mandan muchas veces por segundo con el estado completo: pueden perderse y no hace falta ordenarlos. */
const LOSSY = new Set<Msg['t']>(['st', 'pad']);
/** Sin noticias del camino directo en este tiempo, se deja de usar (y se cierra un poco después). */
const DIRECT_STALE_MS = 2500;
const DIRECT_DEAD_MS = 5000;
/** Un hueco en la numeración que no se llena en este tiempo se salta (se perdió con un camino que se cayó). */
const GAP_MS = 1500;
const MAX_TRIES = 4;

export type Path = 'lan' | 'directa' | 'relevo';

export class Channel {
  /** El relevo sigue conectado para este dispositivo. */
  relayUp = true;
  private link: DirectLink | null = null;
  private k = 0;
  private useDirect = false;
  /** Tiempo de ida y vuelta suavizado de cada camino, en ms (0 = aún no se sabe). */
  private rttR = 0;
  private rttD = 0;
  private seenD = 0;
  private out = 0;
  private next = 0;
  private held = new Map<number, Msg>();
  private gapSince = 0;
  private tries = 0;
  private retryAt = 0;
  private closed = false;
  private beat = 0;
  private lastPath: Path = 'relevo';
  private ticks = 0;
  onMsg: (m: Msg) => void = () => {};
  /** Se perdieron los dos caminos. */
  onDead: () => void = () => {};
  /** Cambió el camino en uso. */
  onPath: (p: Path) => void = () => {};

  /** `initiator`: el invitado propone la conexión directa; el anfitrión responde. */
  constructor(private initiator: boolean, private relaySend: (w: Wire) => void) {
    this.beat = window.setInterval(() => this.tick(), 1000);
    if (initiator) this.retryAt = performance.now();
    setTimeout(() => this.tick(), 0);
  }

  get alive(): boolean {
    return !this.closed && (this.relayUp || this.directOk(DIRECT_DEAD_MS));
  }

  get path(): Path {
    return this.useDirect && this.link ? (this.link.kind === 'lan' ? 'lan' : 'directa') : 'relevo';
  }

  /** Tiempo de ida y vuelta del camino en uso (ms, 0 = desconocido). */
  get rtt(): number {
    return Math.round(this.useDirect ? this.rttD : this.rttR);
  }

  send(m: Msg): void {
    if (this.closed) return;
    const lossy = LOSSY.has(m.t);
    const w: Wire = lossy ? m : { t: '~r', n: this.out++, m };
    if (this.useDirect && this.link?.send(w, lossy)) return;
    if (this.relayUp) this.relaySend(w);
  }

  fromRelay(w: unknown): void {
    this.receive(w as Wire, false);
  }

  /** El relevo se cortó para este dispositivo: sigue solo el directo (si hay). */
  relayLost(): void {
    this.relayUp = false;
    this.choose();
    if (!this.alive) this.die();
  }

  private directOk(ms: number): boolean {
    return !!this.link?.open && performance.now() - this.seenD < ms;
  }

  private receive(w: Wire, direct: boolean): void {
    if (this.closed || !w || typeof w !== 'object') return;
    if (direct) this.seenD = performance.now();
    switch (w.t) {
      case '~p':
        return this.reply(w.o, direct);
      case '~q': {
        const rtt = Math.max(0.1, performance.now() - w.o);
        if (direct) this.rttD = this.rttD ? this.rttD * 0.7 + rtt * 0.3 : rtt;
        else this.rttR = this.rttR ? this.rttR * 0.7 + rtt * 0.3 : rtt;
        return this.choose();
      }
      case '~s':
        return this.signal(w.s);
      case '~r':
        return this.ordered(w.n, w.m);
      case 'ping':
        return;
      default:
        this.onMsg(w);
    }
  }

  private reply(o: number, direct: boolean): void {
    const w: Wire = { t: '~q', o };
    if (direct) this.link?.send(w, true);
    else if (this.relayUp) this.relaySend(w);
  }

  private ordered(n: number, m: Msg): void {
    if (n < this.next) return;
    if (n > this.next) {
      this.held.set(n, m);
      this.gapSince ||= performance.now();
      return;
    }
    this.next++;
    this.onMsg(m);
    this.drain();
  }

  private drain(): void {
    while (this.held.has(this.next)) {
      const m = this.held.get(this.next)!;
      this.held.delete(this.next++);
      if (this.closed) return;
      this.onMsg(m);
    }
    this.gapSince = this.held.size ? performance.now() : 0;
  }

  // ---------------- Conexión directa ----------------

  private openLink(): void {
    if (!directSupported || !this.relayUp) return;
    this.attach(new DirectLink(++this.k, true, (s) => this.relaySend({ t: '~s', s })));
  }

  private signal(s: Signal): void {
    if (!s || typeof s.k !== 'number') return;
    if (!this.initiator && s.sdp?.type === 'offer' && s.k !== this.link?.k) {
      if (!directSupported) return;
      const old = this.link;
      this.link = null;
      old?.close();
      this.attach(new DirectLink(s.k, false, (x) => this.relaySend({ t: '~s', s: x })));
    }
    if (this.link?.k === s.k) void this.link.handle(s);
  }

  private attach(l: DirectLink): void {
    this.link = l;
    l.onData = (w) => {
      if (this.link === l) this.receive(w as Wire, true);
    };
    l.onOpen = () => {
      if (this.link !== l) return;
      this.tries = 0;
      this.seenD = performance.now();
      this.rttD = 0;
      l.send({ t: '~p', o: performance.now() }, true);
    };
    l.onKind = () => this.choose(true);
    l.onClose = () => {
      if (this.link !== l) return;
      this.link = null;
      if (this.initiator) this.retryAt = performance.now() + 3000 * 2 ** this.tries++;
      this.choose();
      if (!this.alive) this.die();
    };
  }

  /** Elige el camino: el directo salvo que sea claramente más lento (con margen para no saltar de uno a otro). */
  private choose(force = false): void {
    if (!this.directOk(DIRECT_STALE_MS)) this.useDirect = false;
    else if (!this.relayUp || !this.rttR) this.useDirect = !!this.rttD || !this.relayUp;
    else if (this.rttD) this.useDirect = this.useDirect ? this.rttD <= this.rttR * 1.6 + 40 : this.rttD <= this.rttR * 1.25 + 15;
    const p = this.path;
    if (p !== this.lastPath || force) {
      this.lastPath = p;
      this.onPath(p);
    }
  }

  private tick(): void {
    if (this.closed) return;
    const now = performance.now();
    // Con el directo en uso, el relevo se mide cada 3 s (menos mensajes al servidor; basta para volver a él si mejora).
    if (this.relayUp && (!this.useDirect || this.ticks++ % 3 === 0)) this.relaySend({ t: '~p', o: now });
    if (this.link?.open) {
      this.link.send({ t: '~p', o: now }, true);
      if (now - this.seenD > DIRECT_DEAD_MS) this.link.close();
    }
    if (this.held.size && now - this.gapSince > GAP_MS) {
      this.next = Math.min(...this.held.keys());
      this.drain();
    }
    if (this.initiator && !this.link && this.relayUp && this.tries < MAX_TRIES && now >= this.retryAt) this.openLink();
    this.choose();
    if (!this.alive) this.die();
  }

  private die(): void {
    if (this.closed) return;
    this.close();
    this.onDead();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.beat);
    const l = this.link;
    this.link = null;
    l?.close();
    this.held.clear();
  }
}
