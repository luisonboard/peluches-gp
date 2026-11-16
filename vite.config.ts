import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { WebSocketServer } from 'ws';
import { createRelay } from './relay/rooms.mjs';

/** Relevo de salas multijugador en /relay (el juego lo usa si existe; si no, PeerJS). */
function relayPlugin(): Plugin {
  const install = (httpServer: import('node:http').Server | null): void => {
    if (!httpServer) return;
    const wss = new WebSocketServer({ noServer: true });
    const attach = createRelay();
    httpServer.on('upgrade', (req, socket, head) => {
      if (!req.url?.startsWith('/relay')) return;
      wss.handleUpgrade(req, socket, head, (ws) => {
        const h = attach(ws);
        ws.on('message', (data) => h.message(data));
        ws.on('close', () => h.close());
        ws.on('error', () => h.close());
      });
    });
  };
  return {
    name: 'pgp-relay',
    configureServer(server) {
      server.middlewares.use('/relay/health', (_req, res) => res.end('ok'));
      install(server.httpServer as import('node:http').Server | null);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/relay/health', (_req, res) => res.end('ok'));
      install(server.httpServer as import('node:http').Server | null);
    },
  };
}

// `npm run build` genera un único dist/index.html con todo incrustado.
// `npm run dev:lan` sirve por HTTPS en la red local para probar en el teléfono (giroscopio y mandos lo exigen).
export default defineConfig(({ mode }) => ({
  plugins: [viteSingleFile(), relayPlugin(), ...(mode === 'lan' ? [basicSsl()] : [])],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
  // Caché propia para el servidor de la red local: así puede convivir con `npm run dev` sin invalidarse.
  cacheDir: mode === 'lan' ? 'node_modules/.vite-lan' : 'node_modules/.vite',
  server: mode === 'lan' ? { host: true, port: 5175 } : { host: '127.0.0.1', port: 5174 },
}));
