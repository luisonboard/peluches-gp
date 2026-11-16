import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` genera un único dist/index.html con todo incrustado.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
  server: { host: '127.0.0.1', port: 5174 },
});
