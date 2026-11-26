// Builds public/data/openings.json from the CC0 lichess-org/chess-openings TSVs.
// Downloads the TSVs into data-src/openings/ on first run (one-time, build-time only).
// Output: { positions: { [epd]: [eco, name] }, lines: [[eco, name, "uci uci ..."]], book: [epd, ...] }
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'data-src', 'openings');
const outDir = join(root, 'public', 'data');
mkdirSync(srcDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';
for (const f of ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']) {
  const p = join(srcDir, f);
  if (existsSync(p)) continue;
  console.log(`downloading ${f}`);
  const res = await fetch(BASE + f);
  if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
  writeFileSync(p, await res.text());
}

const epd = (fen) => fen.split(' ').slice(0, 4).join(' ');
const positions = {};
const book = new Set();
const lines = [];
for (const f of ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']) {
  const rows = readFileSync(join(srcDir, f), 'utf8').split('\n').slice(1).filter(Boolean);
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    const chess = new Chess();
    chess.loadPgn(pgn);
    const hist = chess.history({ verbose: true });
    const uci = hist.map((m) => m.from + m.to + (m.promotion ?? ''));
    for (const m of hist) book.add(epd(m.after));
    const key = epd(chess.fen());
    // Prefer the shortest line that names a position (the canonical one).
    if (!positions[key] || positions[key][2] > uci.length) positions[key] = [eco, name, uci.length];
    lines.push([eco, name, uci.join(' ')]);
  }
}
for (const k of Object.keys(positions)) positions[k] = positions[k].slice(0, 2);
writeFileSync(join(outDir, 'openings.json'), JSON.stringify({ positions, lines, book: [...book] }));
console.log(`openings: ${Object.keys(positions).length} named, ${book.size} book positions, ${lines.length} lines`);
