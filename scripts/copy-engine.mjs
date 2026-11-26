// Copies Stockfish builds and the cross-origin-isolation service worker into public/ (gitignored).
//  - lite (multi-threaded, needs crossOriginIsolated) and lite-single (fallback): ~1.7 MB each — default engine
//  - full / full-single (~94 MB each): optional "Strong" engine, only downloaded by browsers that choose it
//  - coi-serviceworker.js: adds COOP/COEP headers on static hosts (GitHub Pages) so threads can be used
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'stockfish', 'bin');
const dest = join(root, 'public', 'engine');
mkdirSync(dest, { recursive: true });

const files = [
  'stockfish-19-lite.js',
  'stockfish-19-lite.wasm',
  'stockfish-19-lite-single.js',
  'stockfish-19-lite-single.wasm',
  'stockfish-19.js',
  'stockfish-19.wasm',
  'stockfish-19-single.js',
  'stockfish-19-single.wasm',
];
for (const f of files) {
  const from = join(src, f);
  if (!existsSync(from)) {
    console.error(`copy-engine: missing ${from}; run npm install`);
    process.exit(1);
  }
  copyFileSync(from, join(dest, f));
}

const coi = join(root, 'node_modules', 'coi-serviceworker', 'coi-serviceworker.min.js');
if (existsSync(coi)) copyFileSync(coi, join(root, 'public', 'coi-serviceworker.js'));
else console.warn('copy-engine: coi-serviceworker not installed; engine will run single-threaded on static hosts');

console.log('copy-engine: Stockfish builds and service worker copied to public/');
