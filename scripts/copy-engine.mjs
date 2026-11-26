// Copies the single-threaded lite Stockfish WASM build into public/engine so Vite serves it as a static worker.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'stockfish', 'bin');
const dest = join(root, 'public', 'engine');
mkdirSync(dest, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  const from = join(src, f);
  if (!existsSync(from)) {
    console.error(`copy-engine: missing ${from}; run npm install`);
    process.exit(1);
  }
  copyFileSync(from, join(dest, f));
}
console.log('copy-engine: Stockfish copied to public/engine');
