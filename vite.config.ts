import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run build` genera un único dist/index.html con todo incrustado.
// `npm run dev:lan` sirve por HTTPS en la red local para probar en el teléfono (giroscopio y mandos lo exigen).
export default defineConfig(({ mode }) => ({
  plugins: [viteSingleFile(), ...(mode === 'lan' ? [basicSsl()] : [])],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
  server: mode === 'lan' ? { host: true, port: 5175 } : { host: '127.0.0.1', port: 5174 },
}));
