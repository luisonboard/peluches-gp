// Worker de Cloudflare de Peluches GP: sirve el juego (dist, como recursos estáticos) y el relevo de salas con el
// mismo esquema que el servidor de desarrollo (rooms.mjs), dentro de un Durable Object para que todos los jugadores
// lleguen a la misma memoria. Rutas propias: /relay/health y /relay (WebSocket); lo demás son los archivos del juego.
import { createRelay } from './rooms.mjs';

const CORS = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
const MAX_MSG = 32 * 1024;
const MAX_SOCKETS = 600;

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname === '/relay/health') return new Response('ok', { headers: CORS });
    if (pathname === '/relay') {
      if (req.headers.get('upgrade') !== 'websocket') return new Response('Se espera un WebSocket', { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName('salas')).fetch(req);
    }
    return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Peluches GP: relevo de salas', { headers: CORS });
  },
};

export class Rooms {
  constructor() {
    this.attach = createRelay();
    this.count = 0;
  }

  async fetch() {
    if (this.count >= MAX_SOCKETS) return new Response('Lleno', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.count++;
    const h = this.attach({ send: (d) => server.send(d), close: () => server.close(1000, 'fin') });
    let open = true;
    const done = () => {
      if (!open) return;
      open = false;
      this.count--;
      h.close();
    };
    server.addEventListener('message', (e) => {
      if (typeof e.data === 'string' && e.data.length <= MAX_MSG) h.message(e.data);
    });
    server.addEventListener('close', done);
    server.addEventListener('error', done);
    return new Response(null, { status: 101, webSocket: client });
  }
}
