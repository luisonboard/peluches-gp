// Salas a través del relevo WebSocket (/relay): funciona en cualquier red porque los dispositivos no se conectan
// entre sí, sino al servidor que ya les sirve el juego. Misma interfaz que la conexión directa con PeerJS.
import type { Msg } from './protocol';
import { randomCode } from './net';

const url = (): string => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/relay`;

/** ¿El servidor que sirve el juego tiene relevo? */
export async function relayAvailable(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch('/relay/health', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    return r.ok && (await r.text()).trim() === 'ok';
  } catch {
    return false;
  }
}

export class RelayHost {
  code = '';
  private ws: WebSocket | null = null;
  private guests = new Set<string>();
  onMsg: (from: string, m: Msg) => void = () => {};
  onJoin: (id: string) => void = () => {};
  onLeave: (id: string) => void = () => {};
  onError: (text: string) => void = () => {};

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
        if (d.op === 'join') {
          this.guests.add(d.id);
          this.onJoin(d.id);
        } else if (d.op === 'leave') {
          if (this.guests.delete(d.id)) this.onLeave(d.id);
        } else if (d.op === 'from' && d.m && d.m.t !== 'ping') this.onMsg(d.id, d.m as Msg);
      };
      ws.onerror = () => {
        if (!ready) reject(new Error('No se pudo conectar con el servidor de salas.'));
      };
      ws.onclose = () => {
        if (ready && this.ws === ws) this.onError('Se cortó la conexión con el servidor de salas.');
      };
    });
  }

  send(id: string, m: Msg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: 'to', id, m }));
  }

  broadcast(m: Msg, except = ''): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: 'all', m, except }));
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.guests.clear();
  }
}

export class RelayGuest {
  readonly id = `g${Math.random().toString(36).slice(2, 10)}`;
  private ws: WebSocket | null = null;
  onMsg: (m: Msg) => void = () => {};
  onClose: (text: string) => void = () => {};

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
            resolve();
          } else {
            ws.close();
            reject(new Error('No existe una sala con ese código. Revisa que el anfitrión siga en la sala de espera.'));
          }
          return;
        }
        if (d.op === 'm' && d.m && d.m.t !== 'ping') this.onMsg(d.m as Msg);
        else if (d.op === 'gone') this.onClose('El anfitrión cerró la sala.');
      };
      ws.onclose = () => {
        if (ready && this.ws === ws) {
          this.ws = null;
          this.onClose('Se perdió la conexión con el anfitrión.');
        }
      };
    });
  }

  send(m: Msg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: 'm', m }));
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
