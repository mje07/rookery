import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Cross-origin isolation lets the multi-threaded Stockfish build use SharedArrayBuffer.
// On GitHub Pages the same headers are added by public/coi-serviceworker.js.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/rookery/"); local dev serves from "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
})
