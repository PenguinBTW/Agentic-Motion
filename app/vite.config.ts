import { defineConfig } from 'vite';
import path from 'node:path';

// The app serves audio/data next to the app. NOTE: repo-root allow is intentionally broad
// until audio assets are vendored (ROOT/audio/*.mp3 + public/audio/pdoom.mp3 both missing —
// player/render guard missing files). Narrow to [app, app/public, calibration] once vendored.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  // PDOOM_NO_HMR=1: no live reload (export renders must not reload mid-run when a file changes)
  server: { port: 5173, strictPort: false, hmr: process.env.PDOOM_NO_HMR ? false : undefined, fs: { allow: [path.resolve(import.meta.dirname, '..')] } },
  resolve: { alias: { '@root': path.resolve(import.meta.dirname, '..') } },
  build: { target: 'esnext', assetsInlineLimit: 0 },
});
