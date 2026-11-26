export interface Puzzle {
  id: string;
  /** Position before the opponent's setup move. */
  fen: string;
  /** UCI moves; moves[0] is the opponent's move, then alternating solution/reply. */
  moves: string[];
  rating: number;
  themes: string[];
}

type Raw = [string, string, string, number, string];
const toPuzzle = ([id, fen, moves, rating, themes]: Raw): Puzzle => ({
  id,
  fen,
  moves: moves.split(' '),
  rating,
  themes: themes.split(' ').filter(Boolean),
});

const base = () => `${import.meta.env.BASE_URL}data/puzzles/`;
const cache = new Map<string, Promise<Puzzle[]>>();

function load(file: string): Promise<Puzzle[]> {
  let p = cache.get(file);
  if (!p) {
    p = fetch(base() + file)
      .then((r) => {
        if (!r.ok) throw new Error(`Puzzle data missing (${file}). Run: npm run build:puzzles`);
        return r.json();
      })
      .then((rows: Raw[]) => rows.map(toPuzzle));
    cache.set(file, p);
    p.catch(() => cache.delete(file));
  }
  return p;
}

export interface PuzzleIndex {
  bands: number[];
  themes: { id: string; count: number }[];
}

let indexP: Promise<PuzzleIndex> | null = null;
export function loadIndex(): Promise<PuzzleIndex> {
  indexP ??= fetch(base() + 'index.json').then((r) => {
    if (!r.ok) {
      indexP = null;
      throw new Error('Puzzle data missing. Run: npm run build:puzzles');
    }
    return r.json();
  });
  return indexP;
}

/** Random puzzle near `rating`, avoiding ids in `exclude`. Widens the search band if needed. */
export async function puzzleNear(rating: number, exclude: Set<string>): Promise<Puzzle> {
  const idx = await loadIndex();
  const target = Math.round(rating / 100) * 100;
  const sorted = [...idx.bands].sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
  for (const band of sorted) {
    const list = await load(`r${band}.json`);
    const fresh = list.filter((p) => !exclude.has(p.id) && Math.abs(p.rating - rating) <= 150);
    const pool = fresh.length ? fresh : list.filter((p) => !exclude.has(p.id));
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  throw new Error('No puzzles available');
}

export async function themePuzzles(theme: string): Promise<Puzzle[]> {
  return load(`t-${theme}.json`);
}

export const THEME_NAMES: Record<string, string> = {
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  discoveredAttack: 'Discovered attack',
  doubleCheck: 'Double check',
  hangingPiece: 'Hanging piece',
  trappedPiece: 'Trapped piece',
  deflection: 'Deflection',
  attraction: 'Attraction',
  clearance: 'Clearance',
  interference: 'Interference',
  xRayAttack: 'X-ray attack',
  zugzwang: 'Zugzwang',
  sacrifice: 'Sacrifice',
  backRankMate: 'Back-rank mate',
  smotheredMate: 'Smothered mate',
  promotion: 'Promotion',
  advancedPawn: 'Advanced pawn',
  kingsideAttack: 'Kingside attack',
  queensideAttack: 'Queenside attack',
  defensiveMove: 'Defensive move',
  quietMove: 'Quiet move',
  intermezzo: 'In-between move',
  capturingDefender: 'Remove the defender',
  exposedKing: 'Exposed king',
  endgame: 'Endgame',
  rookEndgame: 'Rook endgame',
  pawnEndgame: 'Pawn endgame',
  bishopEndgame: 'Bishop endgame',
  knightEndgame: 'Knight endgame',
  queenEndgame: 'Queen endgame',
  opening: 'Opening',
  middlegame: 'Middlegame',
  short: 'Short (2 moves)',
  long: 'Long (3 moves)',
  veryLong: 'Very long (4+ moves)',
  oneMove: 'One move',
  crushing: 'Crushing',
  equality: 'Find equality',
  master: 'From master games',
};
