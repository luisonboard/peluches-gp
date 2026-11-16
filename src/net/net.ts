// Conexión directa entre dispositivos con PeerJS (WebRTC). El servidor público de PeerJS solo sirve para que los
// dispositivos se encuentren; los datos de la carrera van directo entre ellos.
import { Peer, type DataConnection } from 'peerjs';
import type { Msg } from './protocol';

const PREFIX = 'peluchesgp-v1-';
// Sin I, O, 0 ni 1 para que no se confundan al dictarlos.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function randomCode(): string {
  let c = '';
  for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return c;
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

/** Segundos de silencio tras los que se da por perdida una conexión. */
const TIMEOUT_S = 5;

const peerOptions = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };

export class NetHost {
  code = '';
  private peer: Peer | null = null;
  readonly conns = new Map<string, DataConnection>();
  private lastSeen = new Map<string, number>();
  private beat = 0;
  onMsg: (from: string, m: Msg) => void = () => {};
  onJoin: (id: string) => void = () => {};
  onLeave: (id: string) => void = () => {};
  onError: (text: string) => void = () => {};

  /** Abre una sala con un código libre. */
  open(tries = 4): Promise<string> {
    return new Promise((resolve, reject) => {
      const code = randomCode();
      const peer = new Peer(PREFIX + code, peerOptions);
      peer.on('open', () => {
        this.peer = peer;
        this.code = code;
        this.beat = window.setInterval(() => this.heartbeat(), 1000);
        resolve(code);
      });
      peer.on('error', (err: Error & { type?: string }) => {
        if (!this.peer) {
          peer.destroy();
          if (err.type === 'unavailable-id' && tries > 0) this.open(tries - 1).then(resolve, reject);
          else reject(new Error(describe(err)));
        } else if (err.type !== 'peer-unavailable') this.onError(describe(err));
      });
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          this.conns.set(conn.peer, conn);
          this.lastSeen.set(conn.peer, performance.now());
          this.onJoin(conn.peer);
        });
        conn.on('data', (d) => {
          this.lastSeen.set(conn.peer, performance.now());
          if ((d as Msg).t !== 'ping') this.onMsg(conn.peer, d as Msg);
        });
        const gone = (): void => {
          if (this.conns.delete(conn.peer)) this.onLeave(conn.peer);
        };
        conn.on('close', gone);
        conn.on('error', gone);
      });
      peer.on('disconnected', () => {
        // Se perdió el servidor de encuentro: las conexiones abiertas siguen; se intenta reconectar para nuevos invitados.
        try {
          peer.reconnect();
        } catch {
          /* nada */
        }
      });
    });
  }

  private heartbeat(): void {
    const now = performance.now();
    for (const [id, c] of this.conns) {
      if (now - (this.lastSeen.get(id) ?? now) > TIMEOUT_S * 1000) {
        this.conns.delete(id);
        c.close();
        this.onLeave(id);
      } else if (c.open) c.send({ t: 'ping' });
    }
  }

  send(id: string, m: Msg): void {
    const c = this.conns.get(id);
    if (c?.open) c.send(m);
  }

  broadcast(m: Msg, except = ''): void {
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(m);
  }

  close(): void {
    clearInterval(this.beat);
    for (const c of this.conns.values()) c.close();
    this.conns.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}

export class NetGuest {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private lastSeen = 0;
  private beat = 0;
  onMsg: (m: Msg) => void = () => {};
  onClose: (text: string) => void = () => {};

  connect(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerOptions);
      let done = false;
      const fail = (text: string): void => {
        if (!done) {
          done = true;
          peer.destroy();
          reject(new Error(text));
        } else this.onClose(text);
      };
      let reached = false;
      const timer = setTimeout(
        () =>
          fail(
            reached
              ? 'Se encontró la sala, pero esta red no deja conectar los dispositivos directamente. Abran el juego desde el mismo servidor (con relevo) o prueben otra red.'
              : 'No hay conexión con el servidor de salas. Revisa que haya Internet.',
          ),
        12000,
      );
      peer.on('open', () => {
        reached = true;
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          clearTimeout(timer);
          done = true;
          this.peer = peer;
          this.conn = conn;
          this.lastSeen = performance.now();
          this.beat = window.setInterval(() => {
            if (performance.now() - this.lastSeen > TIMEOUT_S * 1000) {
              clearInterval(this.beat);
              fail('Se perdió la conexión con el anfitrión.');
            } else this.send({ t: 'ping' });
          }, 1000);
          resolve();
        });
        conn.on('data', (d) => {
          this.lastSeen = performance.now();
          if ((d as Msg).t !== 'ping') this.onMsg(d as Msg);
        });
        conn.on('close', () => fail('Se cortó la conexión con el anfitrión.'));
        conn.on('error', () => fail('Se cortó la conexión con el anfitrión.'));
      });
      peer.on('error', (err: Error & { type?: string }) => {
        clearTimeout(timer);
        fail(err.type === 'peer-unavailable' ? 'No existe una sala con ese código.' : describe(err));
      });
    });
  }

  send(m: Msg): void {
    if (this.conn?.open) this.conn.send(m);
  }

  get id(): string {
    return this.peer?.id ?? '';
  }

  close(): void {
    clearInterval(this.beat);
    this.conn?.close();
    this.peer?.destroy();
    this.peer = null;
    this.conn = null;
  }
}

function describe(err: Error & { type?: string }): string {
  switch (err.type) {
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'No hay conexión con el servidor de salas. Revisa que haya Internet.';
    case 'browser-incompatible':
      return 'Este navegador no permite jugar en línea.';
    case 'webrtc':
      return 'La red no permitió conectar los dispositivos. Prueben en la misma Wi-Fi.';
    default:
      return `Error de conexión (${err.type ?? err.message}).`;
  }
}
