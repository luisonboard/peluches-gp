// Salas a través del relevo WebSocket (/relay): funciona en cualquier red porque los dispositivos no se conectan
// entre sí, sino al servidor que ya les sirve el juego. Por el mismo relevo se negocia además una conexión directa
// WebRTC con cada invitado (channel.ts), que pasa a llevar los mensajes cuando es más rápida (por ejemplo, en la
// misma red local); el relevo queda de respaldo. Misma interfaz que la conexión directa con PeerJS.
import type { Msg } from './protocol';
import { randomCode } from './net';
import { Channel, type Path } from './channel';

// El relevo está en el mismo servidor que el juego (Vite en desarrollo, el Worker publicado). VITE_RELAY_URL permite
// usar otro al compilar.
const REMOTE = (import.meta.env.VITE_RELAY_URL as string | undefined)?.replace(/\/$/, '') ?? '';
let base = '';

const url = (): string => `${base.replace(/^http/, 'ws')}/relay`;

async function healthy(origin: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(`${origin}/relay/health`, { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    return r.ok && (await r.text()).trim() === 'ok';
  } catch {
    return false;
  }
}

/** ¿Hay relevo de salas? Primero el mismo servidor del juego y luego el Worker publicado. */
export async function relayAvailable(): Promise<boolean> {
  if (base) return true;
  for (const o of [location.origin, REMOTE]) {
    if (o && (await healthy(o))) {
      base = o;
      return true;
    }
  }
  return false;
}

export class RelayHost {
  code = '';
  private ws: WebSocket | null = null;
  private guests = new Map<string, Channel>();
  onMsg: (from: string, m: Msg) => void = () => {};
  onJoin: (id: string) => void = () => {};
  onLeave: (id: string) => void = () => {};
  onError: (text: string) => void = () => {};
  /** Cambió el camino con un invitado (relevo, directo, red local). */
  onPath: (id: string, p: Path) => void = () => {};

  open(tries = 4): Promise<string> {
    return new Promise((resolve, reject) => {
      const code = randomCode();
      const ws = new WebSocket(url());
      let ready = false;
      ws.onopen = () => ws.send(JSON.stringify({ op: 'host', room: code }));
      ws.onmessage = (e) => {
        const d = JSON.parse(String(e.data));
        if (!ready) {
          if (d.op === 'ok') {
            ready = true;
            this.ws = ws;
            this.code = code;
            resolve(code);
          } else if (d.op === 'taken') {
            ws.close();
            if (tries > 0) this.open(tries - 1).then(resolve, reject);
            else reject(new Error('No se pudo crear la sala. Inténtalo de nuevo.'));
          }
          return;
        }
        if (d.op === 'join') this.join(String(d.id));
        else if (d.op === 'leave') this.guests.get(d.id)?.relayLost();
        else if (d.op === 'from') this.guests.get(d.id)?.fromRelay(d.m);
      };
      ws.onerror = () => {
        if (!ready) reject(new Error('No se pudo conectar con el servidor de salas.'));
      };
      ws.onclose = () => {
        if (!ready || this.ws !== ws) return;
        this.ws = null;
        // Los invitados con conexión directa siguen en la partida; los demás se pierden.
        for (const c of [...this.guests.values()]) c.relayLost();
        this.onError('Se cortó la conexión con el servidor de salas.');
      };
    });
  }

  private join(id: string): void {
    // Un dispositivo que vuelve a entrar con el mismo id (el mando al reconectarse) empieza un canal nuevo.
    this.guests.get(id)?.close();
    const c = new Channel(false, (w) => this.raw({ op: 'to', id, m: w }));
    this.guests.set(id, c);
    c.onMsg = (m) => this.onMsg(id, m);
    c.onPath = (p) => this.onPath(id, p);
    c.onDead = () => {
      if (this.guests.get(id) !== c) return;
      this.guests.delete(id);
      this.onLeave(id);
    };
    this.onJoin(id);
  }

  private raw(o: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(o));
  }

  send(id: string, m: Msg): void {
    this.guests.get(id)?.send(m);
  }

  broadcast(m: Msg, except = ''): void {
    for (const [id, c] of this.guests) if (id !== except) c.send(m);
  }

  path(id: string): Path | '' {
    return this.guests.get(id)?.path ?? '';
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    for (const c of this.guests.values()) c.close();
    this.guests.clear();
    ws?.close();
  }
}

export class RelayGuest {
  /** `id` fijo para volver a entrar como el mismo dispositivo (el teléfono-mando al reconectarse). */
  constructor(readonly id = `g${Math.random().toString(36).slice(2, 10)}`) {}
  private ws: WebSocket | null = null;
  private ch: Channel | null = null;
  onMsg: (m: Msg) => void = () => {};
  onClose: (text: string) => void = () => {};
  /** Cambió el camino con el anfitrión (relevo, directo, red local). */
  onPath: (p: Path) => void = () => {};

  connect(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url());
      let ready = false;
      const timer = setTimeout(() => {
        if (!ready) {
          ws.close();
          reject(new Error('No se pudo conectar con el servidor de salas.'));
        }
      }, 8000);
      ws.onopen = () => ws.send(JSON.stringify({ op: 'join', room: code, id: this.id }));
      ws.onmessage = (e) => {
        const d = JSON.parse(String(e.data));
        if (!ready) {
          clearTimeout(timer);
          if (d.op === 'ok') {
            ready = true;
            this.ws = ws;
            const c = (this.ch = new Channel(true, (w) => {
              if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: 'm', m: w }));
            }));
            c.onMsg = (m) => this.onMsg(m);
            c.onPath = (p) => this.onPath(p);
            c.onDead = () => this.lost('Se perdió la conexión con el anfitrión.');
            resolve();
          } else {
            ws.close();
            reject(new Error('No existe una sala con ese código. Revisa que el anfitrión siga en la sala de espera.'));
          }
          return;
        }
        if (d.op === 'm') this.ch?.fromRelay(d.m);
        else if (d.op === 'gone') this.lost('El anfitrión cerró la sala.');
      };
      ws.onclose = () => {
        if (!ready || this.ws !== ws) return;
        this.ws = null;
        // Con conexión directa la partida sigue; si no hay, el canal avisa de que se perdió.
        this.ch?.relayLost();
      };
    });
  }

  private lost(text: string): void {
    if (!this.ch) return;
    this.close();
    this.onClose(text);
  }

  get path(): Path | '' {
    return this.ch?.path ?? '';
  }

  send(m: Msg): void {
    this.ch?.send(m);
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    const c = this.ch;
    this.ch = null;
    c?.close();
    ws?.close();
  }
}
