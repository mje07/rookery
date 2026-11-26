// Builds public/data/puzzles/ from the CC0 Lichess puzzle database.
//   1. Download https://database.lichess.org/lichess_db_puzzle.csv.zst to data-src/ (done automatically if missing)
//   2. node scripts/build-puzzles.mjs
// Output:
//   puzzles/r{band}.json     rating bands of 100 (e.g. r1200.json = 1200..1299): [[id, fen, moves, rating, themes], ...]
//   puzzles/t-{theme}.json   per-theme samples across all ratings
//   puzzles/index.json       { bands: [...], themes: [{ id, count }] }
import { createReadStream, createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'data-src', 'lichess_db_puzzle.csv.zst');
const out = join(root, 'public', 'data', 'puzzles');
const PER_BAND = Number(process.env.PER_BAND ?? 2000);
const PER_THEME = Number(process.env.PER_THEME ?? 1000);
const MIN_BAND = 400;
const MAX_BAND = 3000;

// Themes offered in the UI (Lichess theme keys).
const THEMES = [
  'mateIn1', 'mateIn2', 'mateIn3', 'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'hangingPiece',
  'trappedPiece', 'deflection', 'attraction', 'clearance', 'interference', 'xRayAttack', 'zugzwang', 'sacrifice',
  'backRankMate', 'smotheredMate', 'promotion', 'advancedPawn', 'kingsideAttack', 'queensideAttack', 'defensiveMove',
  'quietMove', 'intermezzo', 'capturingDefender', 'exposedKing', 'endgame', 'rookEndgame', 'pawnEndgame',
  'bishopEndgame', 'knightEndgame', 'queenEndgame', 'opening', 'middlegame', 'short', 'long', 'veryLong', 'oneMove',
  'crushing', 'equality', 'master',
];

if (!existsSync(src)) {
  console.log('downloading lichess_db_puzzle.csv.zst (~300MB)…');
  mkdirSync(dirname(src), { recursive: true });
  const res = await fetch('https://database.lichess.org/lichess_db_puzzle.csv.zst');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(src));
}
mkdirSync(out, { recursive: true });

// Reservoir sampling per rating band and per theme (seeded RNG for reproducible builds).
let seed = 1234567;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const bands = new Map(); // band -> { seen, items }
const themes = new Map(THEMES.map((t) => [t, { seen: 0, items: [] }]));
const offer = (res, cap, item) => {
  res.seen++;
  if (res.items.length < cap) res.items.push(item);
  else {
    const j = Math.floor(rand() * res.seen);
    if (j < cap) res.items[j] = item;
  }
};

const rl = createInterface({ input: createReadStream(src).pipe(createZstdDecompress()), crlfDelay: Infinity });
let n = 0;
let kept = 0;
for await (const line of rl) {
  if (n++ === 0) continue; // header
  // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const f = line.split(',');
  const rating = +f[3];
  const rd = +f[4];
  const pop = +f[5];
  const plays = +f[6];
  if (rd > 90 || pop < 80 || plays < 300) continue;
  const item = [f[0], f[1], f[2], rating, f[7]];
  const band = Math.min(MAX_BAND, Math.max(MIN_BAND, Math.floor(rating / 100) * 100));
  if (!bands.has(band)) bands.set(band, { seen: 0, items: [] });
  offer(bands.get(band), PER_BAND, item);
  for (const t of f[7].split(' ')) if (themes.has(t)) offer(themes.get(t), PER_THEME, item);
  kept++;
  if (n % 1_000_000 === 0) console.log(`${n} rows…`);
}

const bandList = [...bands.keys()].sort((a, b) => a - b);
for (const b of bandList) writeFileSync(join(out, `r${b}.json`), JSON.stringify(bands.get(b).items));
const themeList = [];
for (const [t, r] of themes) {
  if (!r.items.length) continue;
  r.items.sort((a, b) => a[3] - b[3]);
  writeFileSync(join(out, `t-${t}.json`), JSON.stringify(r.items));
  themeList.push({ id: t, count: r.items.length });
}
writeFileSync(join(out, 'index.json'), JSON.stringify({ bands: bandList, themes: themeList, source: 'Lichess puzzle database (CC0)' }));
console.log(`rows ${n}, eligible ${kept}, bands ${bandList.length}, themes ${themeList.length}`);
